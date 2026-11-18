/* eslint-disable max-lines */
import crypto from 'node:crypto';

import type { Dependencies } from '../../iocContainer/index.js';
import { inject } from '../../iocContainer/utils.js';
import { type Prisma, type PrismaPgClient } from '../../storage/prisma/index.js';
import {
  makeBadRequestError,
  makeNotFoundError,
  makeUnauthorizedError,
} from '../../utils/errors.js';
import { asyncRandomBytes } from '../../utils/misc.js';
import { makePrismaTransactionWithRetry } from '../../utils/prismaTransactionWithRetry.js';
import { HOUR_MS } from '../../utils/time.js';
import { CoopEmailAddress } from '../sendEmailService/sendEmailService.js';
import { MIN_PASSWORD_LENGTH } from './constants.js';
import type { MrtChartConfig } from './dbTypes.js';
import {
  UserPermission,
  type Invoker,
  type UserRole,
} from './permissioning.js';
import { deleteSessionsForUser } from './sessionPersistence.js';
import { hashPassword } from './utils.js';

class UserManagementService {
  constructor(
    private readonly prisma: PrismaPgClient,
    private readonly sendEmail: Dependencies['sendEmail'],
    private readonly configService: Dependencies['ConfigService'],
  ) {}

  async #lookupSystemRoleId(opts: {
    orgId: string;
    role: UserRole;
  }): Promise<string> {
    const row = await this.prisma.roles.findFirstOrThrow({
      select: { id: true },
      where: { org_id: opts.orgId, key: opts.role, is_system: true },
    });
    return row.id;
  }

  async getUserInterfaceSettings(opts: { userId: string; orgId: string }) {
    const { userId, orgId } = opts;
    const row = await this.prisma.user_interface_settings.findUnique({
      where: { user_id: userId },
    });
    // `jsonb[]` comes back as `JsonValue[]`; these are the chart configs this
    // service wrote.
    const mrtChartConfigurations = row?.mrt_chart_configurations as
      | MrtChartConfig[]
      | null
      | undefined;

    if (
      row &&
      row.moderator_safety_grayscale != null &&
      row.moderator_safety_blur_level != null &&
      row.moderator_safety_mute_video != null &&
      row.moderator_safety_sepia != null
    ) {
      // If all the user's settings have been set, just return them
      return {
        moderatorSafetyGrayscale: row.moderator_safety_grayscale,
        moderatorSafetyBlurLevel: row.moderator_safety_blur_level,
        moderatorSafetyMuteVideo: row.moderator_safety_mute_video,
        moderatorSafetySepia: row.moderator_safety_sepia,
        mrtChartConfigurations: mrtChartConfigurations ?? [],
      };
    }

    // Otherwise, merge the user's settings with the org's default settings,
    // prioritizing the user's settings over the defaults.
    const orgDefaults = await this.getOrgDefaultUserInterfaceSettings(orgId);
    return {
      moderatorSafetyGrayscale:
        row?.moderator_safety_grayscale ?? orgDefaults.moderatorSafetyGrayscale,
      moderatorSafetySepia:
        row?.moderator_safety_sepia ?? orgDefaults.moderatorSafetySepia,
      moderatorSafetyBlurLevel:
        row?.moderator_safety_blur_level ??
        orgDefaults.moderatorSafetyBlurLevel,
      moderatorSafetyMuteVideo:
        row?.moderator_safety_mute_video ??
        orgDefaults.moderatorSafetyMuteVideo,
      mrtChartConfigurations: mrtChartConfigurations ?? [],
    };
  }

  async getInviteUserToken(opts: { token: string }) {
    const { token } = opts;
    // The join also required `roles.org_id = invite_user_tokens.org_id`, a
    // column-to-column condition across the relation that Prisma can't
    // filter on, so it's applied to the loaded rows.
    const candidates = await this.prisma.invite_user_tokens.findMany({
      where: { token },
      include: { roles: { select: { key: true, org_id: true } } },
    });
    const match = candidates.find(
      (it) => it.org_id != null && it.roles.org_id === it.org_id,
    );

    if (match == null) {
      return null;
    }
    const { roles, ...inviteColumns } = match;
    const tokenRow = {
      ...inviteColumns,
      // `invite_user_tokens.id` is an int column; its Kysely type was
      // `string`, which callers (`deleteInvite`) depend on.
      id: String(inviteColumns.id),
      // Narrowed by the `it.org_id != null` check above (the join excluded
      // NULL org ids).
      org_id: inviteColumns.org_id!,
      // `roles.key` replaced the legacy `invite_user_tokens.role` column in
      // the selection.
      role: roles.key,
    };

    const orgSettings = await this.prisma.org_settings.findUnique({
      select: { saml_enabled: true },
      where: { org_id: tokenRow.org_id },
    });

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

    const roleId = await this.#lookupSystemRoleId({ orgId, role });

    const token = (await asyncRandomBytes(32)).toString('hex');
    await this.prisma.invite_user_tokens.create({
      data: { token, email, role_id: roleId, org_id: orgId },
    });
    return token;
  }

  async getPendingInvites(
    orgId: string,
  ): Promise<
    Array<{ id: string; email: string; role: UserRole; createdAt: string }>
  > {
    // With `invite_user_tokens.org_id = orgId`, the join's
    // `roles.org_id = invite_user_tokens.org_id` is `roles.org_id = orgId`.
    const result = await this.prisma.invite_user_tokens.findMany({
      where: { org_id: orgId, roles: { org_id: orgId } },
      include: { roles: { select: { key: true } } },
      orderBy: { created_at: 'desc' },
    });

    return result.map((row) => ({
      id: String(row.id),
      email: row.email,
      // `roles.key` holds `UserRole` values; Prisma types it `string`.
      role: row.roles.key as UserRole,
      createdAt: row.created_at.toISOString(),
    }));
  }

  async deleteInvite(inviteId: string, orgId: string): Promise<boolean> {
    await this.prisma.invite_user_tokens.deleteMany({
      where: { id: Number(inviteId), org_id: orgId },
    });

    // Kysely's `execute()` returned one result object per statement, so this
    // was always true; kept as-is.
    return true;
  }

  async upsertUserInterfaceSettings(input: {
    userId: string;
    userInterfaceSettings: {
      moderatorSafetySettings?: {
        moderatorSafetyMuteVideo: boolean;
        moderatorSafetyGrayscale: boolean;
        moderatorSafetyBlurLevel: number;
        moderatorSafetySepia: boolean;
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
            moderator_safety_sepia:
              moderatorSafetySettings.moderatorSafetySepia,
            moderator_safety_blur_level:
              moderatorSafetySettings.moderatorSafetyBlurLevel,
            moderator_safety_mute_video:
              moderatorSafetySettings.moderatorSafetyMuteVideo,
          }
        : {}),
      ...(mrtChartConfigurations
        ? {
            // Chart configs are plain JSON; the domain type isn't assignable to
            // Prisma's JSON input type.
            mrt_chart_configurations: [
              ...mrtChartConfigurations,
            ] as unknown as Prisma.InputJsonValue[],
          }
        : {}),
    };

    // Only upsert if there are fields to update
    if (Object.keys(dbFormattedInterfaceSettings).length > 0) {
      const row = await this.prisma.user_interface_settings.upsert({
        where: { user_id: userId },
        create: { user_id: userId, ...dbFormattedInterfaceSettings },
        update: dbFormattedInterfaceSettings,
      });
      return [row];
    }
    // If no update fields, just do nothing on conflict (returns no rows then)
    return this.prisma.user_interface_settings.createManyAndReturn({
      data: [{ user_id: userId }],
      skipDuplicates: true,
    });
  }

  async getOrgDefaultUserInterfaceSettings(orgId: string) {
    const row =
      // Every org should have a default interface settings row
      await this.prisma.org_default_user_interface_settings.findUniqueOrThrow({
        where: { org_id: orgId },
      });

    return {
      moderatorSafetyGrayscale: row.moderator_safety_grayscale,
      moderatorSafetySepia: row.moderator_safety_sepia,
      moderatorSafetyBlurLevel: row.moderator_safety_blur_level,
      moderatorSafetyMuteVideo: row.moderator_safety_mute_video,
    };
  }

  async upsertOrgDefaultUserInterfaceSettings(opts: {
    orgId: string;
    // If you don't provide these values, they will be set to the default values
    // configured on the pg table definition
    moderatorSafetyGrayscale?: boolean;
    moderatorSafetySepia?: boolean;
    moderatorSafetyBlurLevel?: number;
    moderatorSafetyMuteVideo?: boolean;
  }) {
    const {
      orgId,
      moderatorSafetyGrayscale,
      moderatorSafetySepia,
      moderatorSafetyBlurLevel,
      moderatorSafetyMuteVideo,
    } = opts;
    const updateFields = {
      ...(moderatorSafetyGrayscale !== undefined
        ? { moderator_safety_grayscale: moderatorSafetyGrayscale }
        : {}),
      ...(moderatorSafetySepia !== undefined
        ? { moderator_safety_sepia: moderatorSafetySepia }
        : {}),
      ...(moderatorSafetyBlurLevel !== undefined
        ? { moderator_safety_blur_level: moderatorSafetyBlurLevel }
        : {}),
      ...(moderatorSafetyMuteVideo !== undefined
        ? { moderator_safety_mute_video: moderatorSafetyMuteVideo }
        : {}),
    };

    // Undefined values are omitted from the INSERT, so the table defaults apply.
    const create = {
      org_id: orgId,
      moderator_safety_grayscale: moderatorSafetyGrayscale,
      moderator_safety_sepia: moderatorSafetySepia,
      moderator_safety_blur_level: moderatorSafetyBlurLevel,
      moderator_safety_mute_video: moderatorSafetyMuteVideo,
    };

    // Only upsert if there are fields to update
    if (Object.keys(updateFields).length > 0) {
      await this.prisma.org_default_user_interface_settings.upsert({
        where: { org_id: orgId },
        create,
        update: updateFields,
      });
    } else {
      // If no update fields, just do nothing on conflict
      await this.prisma.org_default_user_interface_settings.createMany({
        data: [create],
        skipDuplicates: true,
      });
    }
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

    if (!invoker.permissions.includes(UserPermission.MANAGE_USERS)) {
      throw makeUnauthorizedError(
        'User does not have permission to change roles',
        { shouldErrorSpan: true },
      );
    }

    const newRoleId = await this.#lookupSystemRoleId({
      orgId: invoker.orgId,
      role: newRole,
    });

    const result = await this.prisma.users.updateMany({
      data: { role_id: newRoleId },
      where: { id: userId, org_id: invoker.orgId },
    });

    if (result.count === 0) {
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

    const existingUser = await this.prisma.users.findUnique({
      select: { id: true, org_id: true },
      where: { email },
    });

    if (existingUser == null) {
      return;
    }

    const { id: userId, org_id: orgId } = existingUser;
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

    const userRow = await this.prisma.users.findUnique({
      select: { email: true, org_id: true },
      where: { id: userId },
    });
    const existingUser =
      userRow == null ? null : { email: userRow.email, orgId: userRow.org_id };

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
    await this.prisma.password_reset_tokens.deleteMany({
      where: { user_id: userId },
    });

    // create new token
    await this.prisma.password_reset_tokens.create({
      data: {
        user_id: userId,
        org_id: orgId,
        hashed_token: hashedToken,
        created_at: new Date(),
      },
    });

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
    const fetchedToken = await this.prisma.password_reset_tokens.findUnique({
      where: { hashed_token: hashedToken },
    });

    if (fetchedToken == null) {
      return;
    }

    // NB: Tokens expire one hour after creation
    if (Date.now() - new Date(fetchedToken.created_at).getTime() > HOUR_MS) {
      return;
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      throw makeBadRequestError(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`,
        { shouldErrorSpan: false, pointer: '/input/newPassword' },
      );
    }

    const hashedPassword = await hashPassword(newPassword);
    // Atomic: a committed password change must not leave the user's sessions
    // or reset tokens alive.
    await makePrismaTransactionWithRetry(this.prisma)(async (tx) => {
      await tx.users.updateMany({
        data: { password: hashedPassword },
        where: { id: fetchedToken.user_id },
      });
      await deleteSessionsForUser(tx, fetchedToken.user_id);
      await tx.password_reset_tokens.deleteMany({
        where: { user_id: fetchedToken.user_id },
      });
    });
  }

  async getUsersForOrg(orgId: string) {
    // With `users.org_id = orgId`, the join's `roles.org_id = users.org_id`
    // is `roles.org_id = orgId`.
    const rows = await this.prisma.users.findMany({
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        roles: { select: { key: true } },
      },
      where: {
        org_id: orgId,
        rejected_by_admin: false,
        approved_by_admin: true,
        roles: { org_id: orgId },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      role: row.roles.key,
    }));
  }

  async getUserNamesForOrg(orgId: string) {
    const rows = await this.prisma.users.findMany({
      select: { id: true, first_name: true, last_name: true },
      where: { org_id: orgId },
    });
    return rows.map((row) => ({
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
    }));
  }
}

export default inject(
  ['PrismaPg', 'sendEmail', 'ConfigService'],
  UserManagementService,
);
export { type UserManagementService };
