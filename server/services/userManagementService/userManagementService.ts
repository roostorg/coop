/* eslint-disable max-lines */
import crypto from 'node:crypto';
import { and, desc, eq, sql } from 'drizzle-orm';

import type { Dependencies } from '../../iocContainer/index.js';
import { inject } from '../../iocContainer/utils.js';
import {
  schema,
  transactionWithRetry,
  type CoopDb,
} from '../../storage/postgres/drizzle.js';
import {
  makeBadRequestError,
  makeNotFoundError,
  makeUnauthorizedError,
} from '../../utils/errors.js';
import { asyncRandomBytes } from '../../utils/misc.js';
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

const {
  inviteUserTokens,
  orgDefaultUserInterfaceSettings,
  orgSettings,
  passwordResetTokens,
  roles,
  userInterfaceSettings: userInterfaceSettingsTable,
  users,
} = schema;

// The invite row (snake_case keys, as callers read them) with `role` taken
// from the joined role's key. `id` is a serial, but our API treats it as an
// opaque string id.
const INVITE_TOKEN_FIELDS = {
  id: sql<string>`${inviteUserTokens.id}::text`,
  token: inviteUserTokens.token,
  email: inviteUserTokens.email,
  role: sql<UserRole>`${roles.key}`,
  created_at: inviteUserTokens.createdAt,
  updated_at: inviteUserTokens.updatedAt,
  org_id: inviteUserTokens.orgId,
  role_id: inviteUserTokens.roleId,
};

const inviteTokenRoleJoin = and(
  eq(roles.id, inviteUserTokens.roleId),
  eq(roles.orgId, inviteUserTokens.orgId),
);

function inviteIdAsColumnValue(inviteId: string) {
  return Number(inviteId);
}

class UserManagementService {
  constructor(
    private readonly db: CoopDb,
    private readonly sendEmail: Dependencies['sendEmail'],
    private readonly configService: Dependencies['ConfigService'],
  ) {}

  async #lookupSystemRoleId(opts: {
    orgId: string;
    role: UserRole;
  }): Promise<string> {
    const row = (
      await this.db
        .select({ id: roles.id })
        .from(roles)
        .where(
          and(
            eq(roles.orgId, opts.orgId),
            eq(roles.key, opts.role),
            eq(roles.isSystem, true),
          ),
        )
        .limit(1)
    ).at(0);
    if (row === undefined) {
      throw new Error(`No system role ${opts.role} for org ${opts.orgId}`);
    }
    return row.id;
  }

  async getUserInterfaceSettings(opts: { userId: string; orgId: string }) {
    const { userId, orgId } = opts;
    const row = (
      await this.db
        .select()
        .from(userInterfaceSettingsTable)
        .where(eq(userInterfaceSettingsTable.userId, userId))
        .limit(1)
    ).at(0);

    if (
      row &&
      row.moderatorSafetyGrayscale != null &&
      row.moderatorSafetyBlurLevel != null &&
      row.moderatorSafetyMuteVideo != null &&
      row.moderatorSafetySepia != null
    ) {
      // If all the user's settings have been set, just return them
      return {
        moderatorSafetyGrayscale: row.moderatorSafetyGrayscale,
        moderatorSafetyBlurLevel: row.moderatorSafetyBlurLevel,
        moderatorSafetyMuteVideo: row.moderatorSafetyMuteVideo,
        moderatorSafetySepia: row.moderatorSafetySepia,
        mrtChartConfigurations: (row.mrtChartConfigurations ??
          []) as MrtChartConfig[],
      };
    }

    // Otherwise, merge the user's settings with the org's default settings,
    // prioritizing the user's settings over the defaults.
    const orgDefaults = await this.getOrgDefaultUserInterfaceSettings(orgId);
    return {
      moderatorSafetyGrayscale:
        row?.moderatorSafetyGrayscale ?? orgDefaults.moderatorSafetyGrayscale,
      moderatorSafetySepia:
        row?.moderatorSafetySepia ?? orgDefaults.moderatorSafetySepia,
      moderatorSafetyBlurLevel:
        row?.moderatorSafetyBlurLevel ?? orgDefaults.moderatorSafetyBlurLevel,
      moderatorSafetyMuteVideo:
        row?.moderatorSafetyMuteVideo ?? orgDefaults.moderatorSafetyMuteVideo,
      mrtChartConfigurations: (row?.mrtChartConfigurations ??
        []) as MrtChartConfig[],
    };
  }

  async getInviteUserToken(opts: { token: string }) {
    const { token } = opts;
    const tokenRow = (
      await this.db
        .select(INVITE_TOKEN_FIELDS)
        .from(inviteUserTokens)
        .innerJoin(roles, inviteTokenRoleJoin)
        .where(eq(inviteUserTokens.token, token))
        .limit(1)
    ).at(0);

    if (tokenRow == null) {
      return null;
    }

    const settings = (
      await this.db
        .select({ samlEnabled: orgSettings.samlEnabled })
        .from(orgSettings)
        // The join on `roles.org_id = invite_user_tokens.org_id` guarantees
        // `org_id` is non-null here.
        .where(eq(orgSettings.orgId, tokenRow.org_id!))
        .limit(1)
    ).at(0);

    return {
      ...tokenRow,
      orgId: tokenRow.org_id!,
      createdAt: tokenRow.created_at,
      samlEnabled: settings?.samlEnabled ?? false,
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
    await this.db
      .insert(inviteUserTokens)
      .values({ token, email, roleId, orgId });
    return token;
  }

  async getPendingInvites(
    orgId: string,
  ): Promise<
    Array<{ id: string; email: string; role: UserRole; createdAt: string }>
  > {
    const result = await this.db
      .select(INVITE_TOKEN_FIELDS)
      .from(inviteUserTokens)
      .innerJoin(roles, inviteTokenRoleJoin)
      .where(eq(inviteUserTokens.orgId, orgId))
      .orderBy(desc(inviteUserTokens.createdAt));

    return result.map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role,
      createdAt: row.created_at.toISOString(),
    }));
  }

  async deleteInvite(inviteId: string, orgId: string): Promise<boolean> {
    await this.db
      .delete(inviteUserTokens)
      .where(
        and(
          eq(inviteUserTokens.id, inviteIdAsColumnValue(inviteId)),
          eq(inviteUserTokens.orgId, orgId),
        ),
      );

    // NB: true even when no row matched (PoC keeps the existing contract).
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
            moderatorSafetyGrayscale:
              moderatorSafetySettings.moderatorSafetyGrayscale,
            moderatorSafetySepia: moderatorSafetySettings.moderatorSafetySepia,
            moderatorSafetyBlurLevel:
              moderatorSafetySettings.moderatorSafetyBlurLevel,
            moderatorSafetyMuteVideo:
              moderatorSafetySettings.moderatorSafetyMuteVideo,
          }
        : {}),
      ...(mrtChartConfigurations
        ? { mrtChartConfigurations: [...mrtChartConfigurations] }
        : {}),
    };

    const insert = this.db
      .insert(userInterfaceSettingsTable)
      .values({ userId, ...dbFormattedInterfaceSettings });

    // Only update on conflict if there are fields to update
    const upsert =
      Object.keys(dbFormattedInterfaceSettings).length > 0
        ? insert.onConflictDoUpdate({
            target: userInterfaceSettingsTable.userId,
            set: dbFormattedInterfaceSettings,
          })
        : insert.onConflictDoNothing({
            target: userInterfaceSettingsTable.userId,
          });

    return upsert.returning();
  }

  async getOrgDefaultUserInterfaceSettings(orgId: string) {
    const row = (
      await this.db
        .select({
          moderatorSafetyGrayscale:
            orgDefaultUserInterfaceSettings.moderatorSafetyGrayscale,
          moderatorSafetySepia:
            orgDefaultUserInterfaceSettings.moderatorSafetySepia,
          moderatorSafetyBlurLevel:
            orgDefaultUserInterfaceSettings.moderatorSafetyBlurLevel,
          moderatorSafetyMuteVideo:
            orgDefaultUserInterfaceSettings.moderatorSafetyMuteVideo,
        })
        .from(orgDefaultUserInterfaceSettings)
        .where(eq(orgDefaultUserInterfaceSettings.orgId, orgId))
        .limit(1)
    ).at(0);

    // Every org should have a default interface settings row
    if (row === undefined) {
      throw new Error('no result');
    }
    return row;
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
    // Explicitly check for undefined because these values are booleans and
    // numbers, so they can be falsey
    const updateFields = {
      ...(moderatorSafetyGrayscale !== undefined
        ? { moderatorSafetyGrayscale }
        : {}),
      ...(moderatorSafetySepia !== undefined ? { moderatorSafetySepia } : {}),
      ...(moderatorSafetyBlurLevel !== undefined
        ? { moderatorSafetyBlurLevel }
        : {}),
      ...(moderatorSafetyMuteVideo !== undefined
        ? { moderatorSafetyMuteVideo }
        : {}),
    };

    // Omitted (undefined) columns are left out of the INSERT, so the table
    // defaults apply.
    const insert = this.db
      .insert(orgDefaultUserInterfaceSettings)
      .values({ orgId, ...updateFields });

    // Only update on conflict if there are fields to update
    await (Object.keys(updateFields).length > 0
      ? insert.onConflictDoUpdate({
          target: orgDefaultUserInterfaceSettings.orgId,
          set: updateFields,
        })
      : insert.onConflictDoNothing({
          target: orgDefaultUserInterfaceSettings.orgId,
        }));
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

    const result = await this.db
      .update(users)
      .set({ roleId: newRoleId })
      .where(and(eq(users.id, userId), eq(users.orgId, invoker.orgId)));

    if (result.rowCount === 0) {
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

    const existingUser = (
      await this.db
        .select({ userId: users.id, orgId: users.orgId })
        .from(users)
        .where(eq(users.email, email))
        .limit(1)
    ).at(0);

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

    const existingUser = (
      await this.db
        .select({ email: users.email, orgId: users.orgId })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)
    ).at(0);

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
    await this.db
      .delete(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, userId));

    // create new token
    await this.db.insert(passwordResetTokens).values({
      userId,
      orgId,
      hashedToken,
      createdAt: new Date(),
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
    const fetchedToken = (
      await this.db
        .select()
        .from(passwordResetTokens)
        .where(eq(passwordResetTokens.hashedToken, hashedToken))
        .limit(1)
    ).at(0);

    if (fetchedToken == null) {
      return;
    }

    // NB: Tokens expire one hour after creation
    if (Date.now() - fetchedToken.createdAt.getTime() > HOUR_MS) {
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
    await transactionWithRetry(this.db, async (tx) => {
      await tx
        .update(users)
        .set({ password: hashedPassword })
        .where(eq(users.id, fetchedToken.userId));
      await deleteSessionsForUser(tx, fetchedToken.userId);
      await tx
        .delete(passwordResetTokens)
        .where(eq(passwordResetTokens.userId, fetchedToken.userId));
    });
  }

  async getUsersForOrg(orgId: string) {
    return this.db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: roles.key,
      })
      .from(users)
      .innerJoin(
        roles,
        and(eq(roles.id, users.roleId), eq(roles.orgId, users.orgId)),
      )
      .where(
        and(
          eq(users.orgId, orgId),
          eq(users.rejectedByAdmin, false),
          eq(users.approvedByAdmin, true),
        ),
      );
  }

  async getUserNamesForOrg(orgId: string) {
    return this.db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(users)
      .where(eq(users.orgId, orgId));
  }
}

export default inject(
  ['DrizzlePg', 'sendEmail', 'ConfigService'],
  UserManagementService,
);
export { type UserManagementService };
