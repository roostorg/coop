import crypto from 'node:crypto';
import { URL } from 'node:url';
import { type Exception } from '@opentelemetry/api';
import { DataSource } from 'apollo-datasource';
import { uid } from 'uid';

import { inject, type Dependencies } from '../../iocContainer/index.js';
import { CoopEmailAddress } from '../../services/sendEmailService/index.js';
import { b64EncodeArrayBuffer } from '../../utils/encoding.js';
import {
  CoopError,
  ErrorType,
  type ErrorInstanceData,
} from '../../utils/errors.js';
import { WEEK_MS } from '../../utils/time.js';
import {
  type GQLInviteUserInput,
  type GQLMutationCreateOrgArgs,
  type GQLRequestDemoInput,
} from '../generated.js';

class OrgAPI extends DataSource {
  constructor(
    private readonly orgCreationLogger: Dependencies['OrgCreationLogger'],
    private readonly apiKeyService: Dependencies['ApiKeyService'],
    private readonly sendEmail: Dependencies['sendEmail'],
    private readonly sequelize: Dependencies['Sequelize'],
    private readonly signingKeyPairService: Dependencies['SigningKeyPairService'],
    private readonly tracer: Dependencies['Tracer'],
    private readonly moderationConfigService: Dependencies['ModerationConfigService'],
    private readonly userManagementService: Dependencies['UserManagementService'],
    private readonly config: Dependencies['ConfigService'],
    private readonly orgSettingsService: Dependencies['OrgSettingsService'],
    private readonly manualReviewToolService: Dependencies['ManualReviewToolService'],
  ) {
    super();
  }

  async createOrg(params: GQLMutationCreateOrgArgs) {
    const { email, name, website } = params.input;
    const existingOrgByName = await this.sequelize.Org.findOne({
      where: { name },
    });
    if (existingOrgByName != null) {
      throw makeOrgNameExistsError({ shouldErrorSpan: true });
    }
    const existingOrgByEmail = await this.sequelize.Org.findOne({
      where: { email },
    });

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
      const org = await this.sequelize.Org.create({
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
    const org = await this.sequelize.Org.findByPk(orgId, {
      rejectOnEmpty: true,
    });

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

  async getGraphQLOrgFromId(id: string) {
    return this.sequelize.Org.findByPk(id, { rejectOnEmpty: true });
  }

  async getAllGraphQLOrgs() {
    return this.sequelize.Org.findAll();
  }

  async updateOrgInfo(
    orgId: string,
    input: {
      name?: string | null;
      email?: string | null;
      websiteUrl?: string | null;
      onCallAlertEmail?: string | null;
    },
  ) {
    const org = await this.sequelize.Org.findByPk(orgId);
    if (!org) {
      throw new Error('Organization not found');
    }

    if (input.name != null) {
      org.name = input.name;
    }
    if (input.email != null) {
      org.email = input.email;
    }
    if (input.websiteUrl != null && input.websiteUrl !== '') {
      org.websiteUrl = input.websiteUrl;
    }
    if (input.onCallAlertEmail !== undefined) {
      org.onCallAlertEmail = input.onCallAlertEmail ?? undefined;
    }

    await org.save();

    return org;
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

  async getPublicSigningKeyPem(orgId: string) {
    try {
      const key = await this.signingKeyPairService.getSignatureVerificationInfo(
        orgId,
      );
      const exported = await crypto.subtle.exportKey('spki', key);
      const exportedAsBase64 = b64EncodeArrayBuffer(exported);
      return `-----BEGIN PUBLIC KEY-----\n${exportedAsBase64}\n-----END PUBLIC KEY-----`;
    } catch (error) {
      // In development, if there's no signing key, generate one on-the-fly
      if (process.env.NODE_ENV === 'development') {
        try {
          // Generate a development signing key for this organization
          const devKey = await this.signingKeyPairService.createAndStoreSigningKeys(orgId);
          const exported = await crypto.subtle.exportKey('spki', devKey);
          const exportedAsBase64 = b64EncodeArrayBuffer(exported);
          return `-----BEGIN PUBLIC KEY-----\n${exportedAsBase64}\n-----END PUBLIC KEY-----`;
        } catch (devError) {
          // If even the dev key generation fails, return a placeholder
          // eslint-disable-next-line no-console
          console.warn(`Failed to generate dev signing key for org ${orgId}:`, devError);
          return 'dev-signing-key-placeholder';
        }
      }
      throw error;
    }
  }
}

export type OrgErrorType =
  | 'OrgWithEmailExistsError'
  | 'OrgWithNameExistsError'
  | 'InviteUserTokenExpiredError'
  | 'InviteUserTokenMissingError';

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
    'Sequelize',
    'SigningKeyPairService',
    'Tracer',
    'ModerationConfigService',
    'UserManagementService',
    'ConfigService',
    'OrgSettingsService',
    'ManualReviewToolService',
  ],
  OrgAPI,
);
export type { OrgAPI };
