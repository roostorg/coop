import { type PrismaPgQueryable } from '../../storage/prisma/index.js';

/**
 * Delete connect-pg-simple session rows for a user, to force re-authentication
 * after a password change. Passport stores the user id at
 * `sess -> 'passport' ->> 'user'` (see `passport.serializeUser` in
 * `server/api.ts`, which serializes `user.id`).
 *
 * Pass `exceptSid` to keep one session alive — e.g. the caller's own session on
 * a self-service password change, so they aren't logged out mid-request.
 */
export async function deleteSessionsForUser(
  db: PrismaPgQueryable,
  userId: string,
  opts: { exceptSid?: string } = {},
): Promise<void> {
  await db.session.deleteMany({
    where: {
      // Passport serializes the id as a JSON string, so comparing the value
      // at the path to the string `userId` matches `->> 'user' = userId`.
      sess: { path: ['passport', 'user'], equals: userId },
      ...(opts.exceptSid != null ? { sid: { not: opts.exceptSid } } : {}),
    },
  });
}
