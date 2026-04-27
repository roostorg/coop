import crypto from 'node:crypto';
import { URL } from 'node:url';
import { type Exception } from '@opentelemetry/api';
import { uid } from 'uid';

import { inject, type Dependencies } from '../../iocContainer/index.js';
import { CoopEmailAddress } from '../../services/sendEmailService/index.js';
import { b64EncodeArrayBuffer } from '../../utils/encoding.js';
import {
  CoopError,
  ErrorType,
  makeBadRequestError,
  type ErrorInstanceData,
  isCoopErrorOfType,
} from '../../utils/errors.js';
import { WEEK_MS } from '../../utils/time.js';
import {
  type GQLInviteUserInput,
  type GQLMutationCreateOrgArgs,
  type GQLRequestDemoInput,
} from '../generated.js';
import {
  kyselyOrgFindAll,
  kyselyOrgFindByEmail,
  kyselyOrgFindById,
  kyselyOrgFindByName,
  kyselyOrgInsert,
  kyselyOrgUpdate,
  type GraphQLOrgParent,
} from './orgKyselyPersistence.js';
import {
  validateOrgCreateInput,
  validateOrgUpdatePatch,
  type OrgValidationFailure,
} from './orgValidation.js';

class OrgAPI {
  constructor(
    private readonly orgCreationLogger: Dependencies['OrgCreationLogger'],
    private readonly apiKeyService: Dependencies['ApiKeyService'],
    private readonly sendEmail: Dependencies['sendEmail'],
    private readonly signingKeyPairService: Dependencies['SigningKeyPairService'],
    private readonly tracer: Dependencies['Tracer'],
    private readonly moderationConfigService: Dependencies['ModerationConfigService'],
    private readonly userManagementService: Dependencies['UserManagementService'],
    private readonly config: Dependencies['ConfigService'],
    private readonly orgSettingsService: Dependencies['OrgSettingsService'],
    private readonly manualReviewToolService: Dependencies['ManualReviewToolService'],
    private readonly kysely: Dependencies['KyselyPg'],
    private readonly sequelize: Dependencies['Sequelize'],
  ) {}

  async createOrg(params: GQLMutationCreateOrgArgs) {
    const { email, name, website } = params.input;

    const validation = validateOrgCreateInput({
      name,
      email,
      websiteUrl: website,
    });
    if (!validation.ok) {
      throw orgValidationFailureToBadRequestError(
        validation.failure,
        'createOrg',
      );
    }

    const existingOrgByName = await kyselyOrgFindByName(this.kysely, name);
    if (existingOrgByName != null) {
      throw makeOrgNameExistsError({ shouldErrorSpan: true });
    }
    const existingOrgByEmail = await kyselyOrgFindByEmail(this.kysely, email);

    if (existingOrgByEmail != null) {
      throw makeOrgEmailExistsError({ shouldErrorSpan: true });
    }

    const id = uid();

    // Create api key before inserting the org, so we don't have to worry about
    // the possibility of orgs existing without an api key.
    // TODO: if org fails to save later, delete orphaned api key.
    const { record } = await this.apiKeyService.createApiKey(
      id,
      'Main API Key',
      'Primary API key for organization',
      null
    );

    // TODO: if org fails to save later, delete orphaned signing key pair
    await this.signingKeyPairService.createAndStoreSigningKeys(id);

    try {
      const org = await kyselyOrgInsert({
        db: this.kysely,
        id,
        email,
        name,
        websiteUrl: website,
        apiKeyId: record.id,
      });

      await Promise.all([
        // This should ideally be done in one transaction, but we can update
        // this after we move off of sequelize
        this.moderationConfigService.createDefaultUserType(id),
        this.orgCreationLogger.logOrgCreated(id, name, email, website),
        this.userManagementService.upsertOrgDefaultUserInterfaceSettings({
          orgId: id,
        }),
        this.orgSettingsService.upsertOrgDefaultSettings({ orgId: id }),
        this.manualReviewToolService.upsertDefaultSettings({ orgId: id }),
      ]);

      return org;
    } catch (e) {
      const activeSpan = this.tracer.getActiveSpan();
      if (activeSpan?.isRecording()) {
        activeSpan.recordException(e as Exception);
      }
      throw e;
    }
  }

  // Create invite token and optionally send email
  async inviteUser(input: GQLInviteUserInput, orgId: string) {
    const { email, role } = input;
    const org = await kyselyOrgFindById(this.kysely, orgId);
    if (org == null) {
      throw new Error(`Organization not found: ${orgId}`);
    }

    const token = await this.userManagementService.createInviteUserToken({
      email,
      role,
      orgId,
    });

    const url = new URL(`${this.config.uiUrl}/signup/${token}`);
    const msg = {
      to: email,
      from: CoopEmailAddress.NoReply,
      subject: "You've been invited to join your team on Coop!",
      html: `Hi, and welcome to Coop! Your admin has invited you to join the <strong>${org.name}</strong> Coop team.
      <br /><br />
      Click on <a href='${url.href}'>this link</a> to get started! The link expires in 24 hours, so please make sure to sign up soon.
      <br /><br />
      Best,<br />
      Coop Support Team`,
    };
    try {
      await this.sendEmail(msg);
    } catch (error: unknown) {
      // Even if email fails, return the token so it can be copied
      // eslint-disable-next-line no-console
      console.warn('Failed to send invite email, but token was created:', error);
    }
    return token;
  }

  async getInviteUserToken(tokenString: string) {
    const token = await this.userManagementService.getInviteUserToken({
      token: tokenString,
    });

    // NB: if the db query above returns in a time proportional to the number
    // of matching characters at the start of the tokenString, then this code
    // is vulnerable to a timing attack. But we don't care, and can't do much
    // about it, for right now.
    // eslint-disable-next-line security/detect-possible-timing-attacks
    if (token == null) {
      throw makeInviteUserTokenMissingError({ shouldErrorSpan: true });
    }

    if (Date.now() - new Date(token.createdAt).getTime() > 2 * WEEK_MS) {
      throw makeInviteUserTokenExpiredError({ shouldErrorSpan: true });
    }

    return token;
  }

  async requestDemo(input: GQLRequestDemoInput) {
    const { email, company, website, interests, ref, isFromGoogleAds } = input;
    const msg = {
      to: CoopEmailAddress.Support,
      from: CoopEmailAddress.NoReply,
      subject: '[URGENT] Demo Request',
      text: `A new potential user has requested a Coop demo.\n\nEmail address: ${email}\n\nCompany name: ${company}\n\nCompany website: ${website}\n\nInterests: ${interests.join(
        ', ',
      )} \n\nRef: ${ref} \n\nIs from Google Ads: ${isFromGoogleAds}`,
    };
    try {
      await this.sendEmail(msg);
    } catch (error: unknown) {
      return false;
    }
    return true;
  }

  async getGraphQLOrgFromId(id: string): Promise<GraphQLOrgParent> {
    const org = await kyselyOrgFindById(this.kysely, id);
    if (org == null) {
      throw new Error(`Organization not found: ${id}`);
    }
    return org;
  }

  async getAllGraphQLOrgs(): Promise<GraphQLOrgParent[]> {
    return kyselyOrgFindAll(this.kysely);
  }

  async updateOrgInfo(
    orgId: string,
    input: {
      name?: string | null;
      email?: string | null;
      websiteUrl?: string | null;
      onCallAlertEmail?: string | null;
    },
  ): Promise<GraphQLOrgParent> {
    const validation = validateOrgUpdatePatch(input);
    if (!validation.ok) {
      throw orgValidationFailureToBadRequestError(
        validation.failure,
        'updateOrgInfo',
      );
    }

    const updated = await kyselyOrgUpdate(this.kysely, orgId, {
      name: input.name ?? undefined,
      email: input.email ?? undefined,
      websiteUrl: input.websiteUrl ?? undefined,
      onCallAlertEmail: input.onCallAlertEmail,
    });
    if (updated == null) {
      throw new Error('Organization not found');
    }

    return updated;
  }

  /**
   * Legacy GraphQL `ContentType` parents still use Sequelize `getActions` on
   * item types; load them from the ORM until item types are fully migrated.
   */
  async getSequelizeContentTypesForOrg(orgId: string) {
    return this.sequelize.ItemType.findAll({
      where: { orgId },
    });
  }

  /** GraphQL `Org.users` / permission filters still use Sequelize `User` models. */
  async getOrgUsersForGraphQL(orgId: string) {
    return this.sequelize.User.findAll({ where: { orgId } });
  }

  // TODO: ApiKeyService should maybe be its own dataSource,
  // or just an object on context?
  async getActivatedApiKeyForOrg(orgId: string) {
    const apiKeyRecord = await this.apiKeyService.getActiveApiKeyForOrg(orgId);
    if (!apiKeyRecord) {
      return false;
    }
    return {
      key: apiKeyRecord.keyHash,
      metadata: {
        name: apiKeyRecord.name,
        description: apiKeyRecord.description ?? '',
      },
    };
  }

  /**
   * Returns the org's webhook public signing key as PEM. If no key exists yet
   * (e.g. org created before this feature), we create and persist one once.
   */
  async getPublicSigningKeyPem(orgId: string) {
    let key: CryptoKey;
    try {
      key = await this.signingKeyPairService.getSignatureVerificationInfo(
        orgId,
      );
    } catch (error) {
      if (isCoopErrorOfType(error, 'SigningKeyPairNotFound')) {
        key = await this.signingKeyPairService.createAndStoreSigningKeys(orgId);
      } else {
        throw error;
      }
    }
    const exported = await crypto.subtle.exportKey('spki', key);
    const exportedAsBase64 = b64EncodeArrayBuffer(exported);
    return `-----BEGIN PUBLIC KEY-----\n${exportedAsBase64}\n-----END PUBLIC KEY-----`;
  }

  /**
   * Rotates the webhook signing key for the org: generates a new key pair,
   * overwrites storage, invalidates cache, and returns the new public key as PEM.
   */
  async rotateWebhookSigningKey(orgId: string): Promise<string> {
    const publicKey = await this.signingKeyPairService.rotateSigningKeys(orgId);
    const exported = await crypto.subtle.exportKey('spki', publicKey);
    const exportedAsBase64 = b64EncodeArrayBuffer(exported);
    return `-----BEGIN PUBLIC KEY-----\n${exportedAsBase64}\n-----END PUBLIC KEY-----`;
  }
}

export type OrgErrorType =
  | 'OrgWithEmailExistsError'
  | 'OrgWithNameExistsError'
  | 'InviteUserTokenExpiredError'
  | 'InviteUserTokenMissingError';

function orgValidationFailureToBadRequestError(
  failure: OrgValidationFailure,
  mutation: 'createOrg' | 'updateOrgInfo',
) {
  // `createOrg` exposes `websiteUrl` as `website` in its GraphQL input;
  // `updateOrgInfo` uses the same field name.
  const gqlField =
    mutation === 'createOrg' && failure.field === 'websiteUrl'
      ? 'website'
      : failure.field;
  return makeBadRequestError(failure.message, {
    pointer: `/input/${gqlField}`,
    shouldErrorSpan: false,
  });
}

export const makeOrgEmailExistsError = (data: ErrorInstanceData) =>
  new CoopError({
    status: 409,
    type: [ErrorType.UniqueViolation],
    title: 'An org with this email already exists',
    name: 'OrgWithEmailExistsError',
    ...data,
  });

export const makeOrgNameExistsError = (data: ErrorInstanceData) =>
  new CoopError({
    status: 409,
    type: [ErrorType.UniqueViolation],
    title: 'An org with this name already exists',
    name: 'OrgWithNameExistsError',
    ...data,
  });

export const makeInviteUserTokenExpiredError = (data: ErrorInstanceData) =>
  new CoopError({
    status: 403,
    type: [ErrorType.Unauthorized],
    title: 'Invite token expired',
    name: 'InviteUserTokenExpiredError',
    ...data,
  });

export const makeInviteUserTokenMissingError = (data: ErrorInstanceData) =>
  new CoopError({
    status: 401,
    type: [ErrorType.Unauthorized],
    title: 'Invite token missing',
    name: 'InviteUserTokenMissingError',
    ...data,
  });

export default inject(
  [
    'OrgCreationLogger',
    'ApiKeyService',
    'sendEmail',
    'SigningKeyPairService',
    'Tracer',
    'ModerationConfigService',
    'UserManagementService',
    'ConfigService',
    'OrgSettingsService',
    'ManualReviewToolService',
    'KyselyPg',
    'Sequelize',
  ],
  OrgAPI,
);
export type { OrgAPI };
