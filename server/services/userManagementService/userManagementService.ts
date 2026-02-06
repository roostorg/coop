import crypto from 'node:crypto';
import { type Kysely } from 'kysely';

import type { Dependencies } from '../../iocContainer/index.js';
import { inject } from '../../iocContainer/utils.js';
import {
  UserPermission,
  type Invoker,
  type UserRole,
} from '../../models/types/permissioning.js';
import {
  makeNotFoundError,
  makeUnauthorizedError,
} from '../../utils/errors.js';
import { asyncRandomBytes } from '../../utils/misc.js';
import { HOUR_MS } from '../../utils/time.js';
import { CoopEmailAddress } from '../sendEmailService/sendEmailService.js';
import type { MrtChartConfig } from './dbTypes.js';
import type { UserManagementPg } from './index.js';
import { hashPassword } from './utils.js';

class UserManagementService {
  constructor(
    private readonly pgQuery: Kysely<UserManagementPg>,
    private readonly sendEmail: Dependencies['sendEmail'],
    private readonly configService: Dependencies['ConfigService'],
  ) {}

  async getUserInterfaceSettings(opts: { userId: string; orgId: string }) {
    const { userId, orgId } = opts;
    const row = await this.pgQuery
      .selectFrom('user_management_service.user_interface_settings')
      .selectAll()
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (
      row &&
      row.moderator_safety_grayscale &&
      row.moderator_safety_blur_level &&
      row.moderator_safety_mute_video
    ) {
      // If all the user's settings have been set, just return them
      return {
        moderatorSafetyGrayscale: row.moderator_safety_grayscale,
        moderatorSafetyBlurLevel: row.moderator_safety_blur_level,
        moderatorSafetyMuteVideo: row.moderator_safety_mute_video,
        mrtChartConfigurations: row.mrt_chart_configurations ?? [],
      };
    }

    // Otherwise, merge the user's settings with the org's default settings,
    // prioritizing the user's settings over the defaults.
    const orgDefaults = await this.getOrgDefaultUserInterfaceSettings(orgId);
    return {
      moderatorSafetyGrayscale:
        row?.moderator_safety_grayscale ?? orgDefaults.moderatorSafetyGrayscale,
      moderatorSafetyBlurLevel:
        row?.moderator_safety_blur_level ??
        orgDefaults.moderatorSafetyBlurLevel,
      moderatorSafetyMuteVideo:
        row?.moderator_safety_mute_video ??
        orgDefaults.moderatorSafetyMuteVideo,
      mrtChartConfigurations: row?.mrt_chart_configurations ?? [],
    };
  }

  async getInviteUserToken(opts: { token: string }) {
    const { token } = opts;
    const tokenRow = await this.pgQuery
      .selectFrom('public.invite_user_tokens')
      .selectAll()
      .where('token', '=', token)
      .executeTakeFirst();

    if (tokenRow == null) {
      return null;
    }

    const orgSettings = await this.pgQuery
      .selectFrom('public.org_settings')
      .select('saml_enabled')
      .where('org_id', '=', tokenRow.org_id)
      .executeTakeFirst();

    return {
      ...tokenRow,
      orgId: tokenRow.org_id,
      createdAt: tokenRow.created_at,
      samlEnabled: orgSettings?.saml_enabled ?? false,
    };
  }

  async createInviteUserToken(opts: {
    email: string;
    role: UserRole;
    orgId: string;
  }) {
    const { email, role, orgId } = opts;

    const token = (await asyncRandomBytes(32)).toString('hex');
    await this.pgQuery
      .insertInto('public.invite_user_tokens')
      .values({ token, email, role, org_id: orgId })
      .execute();
    return token;
  }

  async getPendingInvites(
    orgId: string,
  ): Promise<
    Array<{ id: string; email: string; role: UserRole; createdAt: string }>
  > {
    const result = await this.pgQuery
      .selectFrom('public.invite_user_tokens')
      .selectAll()
      .where('org_id', '=', orgId)
      .orderBy('created_at', 'desc')
      .execute();

    return result.map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role,
      createdAt: row.created_at.toISOString(),
    }));
  }

  async deleteInvite(inviteId: string, orgId: string): Promise<boolean> {
    const result = await this.pgQuery
      .deleteFrom('public.invite_user_tokens')
      .where('id', '=', inviteId)
      .where('org_id', '=', orgId)
      .execute();

    return result.length > 0;
  }

  async upsertUserInterfaceSettings(input: {
    userId: string;
    userInterfaceSettings: {
      moderatorSafetySettings?: {
        moderatorSafetyMuteVideo: boolean;
        moderatorSafetyGrayscale: boolean;
        moderatorSafetyBlurLevel: number;
      };
      mrtChartConfigurations?: readonly MrtChartConfig[];
    };
  }) {
    const { userId, userInterfaceSettings } = input;
    const { moderatorSafetySettings, mrtChartConfigurations } =
      userInterfaceSettings;

    const dbFormattedInterfaceSettings = {
      ...(moderatorSafetySettings
        ? {
            moderator_safety_grayscale:
              moderatorSafetySettings.moderatorSafetyGrayscale,
            moderator_safety_blur_level:
              moderatorSafetySettings.moderatorSafetyBlurLevel,
            moderator_safety_mute_video:
              moderatorSafetySettings.moderatorSafetyMuteVideo,
          }
        : {}),
      ...(mrtChartConfigurations
        ? {
            mrt_chart_configurations: [...mrtChartConfigurations],
          }
        : {}),
    };

    let query = this.pgQuery
      .insertInto('user_management_service.user_interface_settings')
      .values({
        user_id: userId,
        ...dbFormattedInterfaceSettings,
      });

    // Only add onConflict if there are fields to update
    if (Object.keys(dbFormattedInterfaceSettings).length > 0) {
      query = query.onConflict((oc) =>
        oc.column('user_id').doUpdateSet({
          ...dbFormattedInterfaceSettings,
        }),
      );
    } else {
      // If no update fields, just do nothing on conflict
      query = query.onConflict((oc) => oc.column('user_id').doNothing());
    }

    return query.returningAll().execute();
  }

  async getOrgDefaultUserInterfaceSettings(orgId: string) {
    const row = await this.pgQuery
      .selectFrom('user_management_service.org_default_user_interface_settings')
      .selectAll()
      .where('org_id', '=', orgId)
      // Every org should have a default interface settings row
      .executeTakeFirstOrThrow();

    return {
      moderatorSafetyGrayscale: row.moderator_safety_grayscale,
      moderatorSafetyBlurLevel: row.moderator_safety_blur_level,
      moderatorSafetyMuteVideo: row.moderator_safety_mute_video,
    };
  }

  async upsertOrgDefaultUserInterfaceSettings(opts: {
    orgId: string;
    // If you don't provide these values, they will be set to the default values
    // configured on the pg table definition
    moderatorSafetyGrayscale?: boolean;
    moderatorSafetyBlurLevel?: number;
    moderatorSafetyMuteVideo?: boolean;
  }) {
    const {
      orgId,
      moderatorSafetyGrayscale,
      moderatorSafetyBlurLevel,
      moderatorSafetyMuteVideo,
    } = opts;
    const updateFields = {
      ...(moderatorSafetyGrayscale !== undefined
        ? { moderator_safety_grayscale: moderatorSafetyGrayscale }
        : {}),
      ...(moderatorSafetyBlurLevel !== undefined
        ? { moderator_safety_blur_level: moderatorSafetyBlurLevel }
        : {}),
      ...(moderatorSafetyMuteVideo !== undefined
        ? { moderator_safety_mute_video: moderatorSafetyMuteVideo }
        : {}),
    };

    let query = this.pgQuery
      .insertInto('user_management_service.org_default_user_interface_settings')
      .values([
        {
          org_id: orgId,
          moderator_safety_grayscale: moderatorSafetyGrayscale,
          moderator_safety_blur_level: moderatorSafetyBlurLevel,
          moderator_safety_mute_video: moderatorSafetyMuteVideo,
        },
      ]);

    // Only add onConflict if there are fields to update
    if (Object.keys(updateFields).length > 0) {
      query = query.onConflict((oc) =>
        // Explicitly check for undefined because these values are booleans and
        // numbers, so they can be falsey
        oc.column('org_id').doUpdateSet(updateFields),
      );
    } else {
      // If no update fields, just do nothing on conflict
      query = query.onConflict((oc) => oc.column('org_id').doNothing());
    }

    await query.execute();
  }

  async updateUserRole(input: {
    userId: string;
    newRole: UserRole;
    orgId: string;
    invoker: Invoker;
  }): Promise<void> {
    const { userId, newRole, orgId, invoker } = input;
    if (orgId !== invoker.orgId) {
      throw makeUnauthorizedError(
        'User does not have permission to change roles in another org',
        { shouldErrorSpan: true },
      );
    }

    if (!invoker.permissions.includes(UserPermission.MANAGE_ORG)) {
      throw makeUnauthorizedError(
        'User does not have permission to change roles',
        { shouldErrorSpan: true },
      );
    }

    const result = await this.pgQuery
      .updateTable('public.users')
      .set({ role: newRole })
      .where('id', '=', userId)
      .where('org_id', '=', invoker.orgId)
      .executeTakeFirst();

    if (result.numUpdatedRows === 0n) {
      throw makeNotFoundError('User not found', { shouldErrorSpan: true });
    }
  }

  /**
   * NB: this function is a no-op if the email does not exist in the database.
   * However, in that case, we do return earlier than if the email had been
   * found, so callers should NOT await this function, and return to the end
   * user before the call completes in order to prevent timing attacks.
   */
  async sendPasswordResetEmail(opts: { email: string }) {
    const { email } = opts;

    const existingUser = await this.pgQuery
      .selectFrom('public.users')
      .select(['id as userId', 'org_id as orgId'])
      .where('email', '=', email)
      .executeTakeFirst();

    if (existingUser == null) {
      return;
    }

    const { userId, orgId } = existingUser;
    const token = await this.#createPasswordResetToken({ userId, orgId });

    const url = new URL(`${this.configService.uiUrl}/reset_password/` + token);
    const msg = {
      to: email,
      from: CoopEmailAddress.NoReply,
      subject: '[Coop] Reset your password',
      html: `You recently indicated that you forgot your Coop password. Click on <a href='${url.href}'>this link</a> to create a new password. The link expires in 1 hour, so please make sure to sign up soon.
      <br /><br />
      Best,<br />
      Coop Support Team`,
    };

    await this.sendEmail(msg);
  }

  /**
   * Generate a password reset token for a specific user (for admin use).
   * Returns the raw token that can be shared with the user.
   * Also sends an email to the user using the standard password reset flow.
   */
  async generatePasswordResetTokenForUser(opts: {
    userId: string;
    invokerOrgId: string;
  }) {
    const { userId, invokerOrgId } = opts;

    const existingUser = await this.pgQuery
      .selectFrom('public.users')
      .select(['email', 'org_id as orgId'])
      .where('id', '=', userId)
      .executeTakeFirst();

    if (existingUser == null) {
      throw makeNotFoundError('User not found', { shouldErrorSpan: true });
    }

    // Security check: ensure admin can only reset passwords for users in their own org
    if (existingUser.orgId !== invokerOrgId) {
      throw makeUnauthorizedError(
        'You can only reset passwords for users in your organization',
        { shouldErrorSpan: true },
      );
    }

    const { email } = existingUser;

    const token = await this.#createPasswordResetToken({
      userId,
      orgId: existingUser.orgId,
    });

    // Send email using the standard flow (will be no-op if SendGrid not configured)
    const url = new URL(`${this.configService.uiUrl}/reset_password/` + token);
    const msg = {
      to: email,
      from: CoopEmailAddress.NoReply,
      subject: '[Coop] Reset your password',
      html: `Your organization administrator has initiated a password reset for your account. Click on <a href='${url.href}'>this link</a> to create a new password. The link expires in 1 hour, so please make sure to reset your password soon.
      <br /><br />
      Best,<br />
      Coop Support Team`,
    };

    await this.sendEmail(msg);

    return token;
  }

  async #createPasswordResetToken(opts: { userId: string; orgId: string }) {
    const { userId, orgId } = opts;
    const token = (await asyncRandomBytes(32)).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // delete tokens for the user
    await this.pgQuery
      .deleteFrom('user_management_service.password_reset_tokens')
      .where('user_id', '=', userId)
      .execute();

    // create new token
    await this.pgQuery
      .insertInto('user_management_service.password_reset_tokens')
      .values({
        user_id: userId,
        org_id: orgId,
        hashed_token: hashedToken,
        created_at: new Date(),
      })
      .execute();

    return token;
  }

  /**
   * NB: we use a hashed token instead of comparing the token directly to
   * prevent timing attacks (by 'removing' any attempts at direct manipulation
   * of the input via the hash function). If we were not hashing the token, we
   * would be vulnerable to timing attacks because an attacker could measure the
   * time to compare the token and use that information to iteratively guess the
   * token.
   */
  async resetPasswordForToken(opts: { token: string; newPassword: string }) {
    const { token, newPassword } = opts;

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Step 1: Validate token
    const fetchedToken = await this.pgQuery
      .selectFrom('user_management_service.password_reset_tokens')
      .selectAll()
      .where('hashed_token', '=', hashedToken)
      .executeTakeFirst();

    if (fetchedToken == null) {
      return;
    }

    // NB: Tokens expire one hour after creation
    if (Date.now() - new Date(fetchedToken.created_at).getTime() > HOUR_MS) {
      return;
    }

    // Step 2: reset password for that token's user
    await this.pgQuery
      .updateTable('public.users')
      .set({ password: await hashPassword(newPassword) })
      .where('id', '=', fetchedToken.user_id)
      .execute();

    // Step 3: Delete all tokens for the user
    await this.pgQuery
      .deleteFrom('user_management_service.password_reset_tokens')
      .where('user_id', '=', fetchedToken.user_id)
      .execute();
  }

  async getUsersForOrg(orgId: string) {
    return this.pgQuery
      .selectFrom('public.users')
      .select([
        'id',
        'email',
        'first_name as firstName',
        'last_name as lastName',
        'role',
      ])
      .where('org_id', '=', orgId)
      .where('rejected_by_admin', '=', false)
      .where('approved_by_admin', '=', true)
      .execute();
  }
}

export default inject(
  ['KyselyPg', 'sendEmail', 'ConfigService'],
  UserManagementService,
);
export { type UserManagementService };
