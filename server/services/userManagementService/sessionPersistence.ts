import { sql, type Kysely } from 'kysely';

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
  // `Kysely<any>` because the session table is managed by connect-pg-simple and
  // is intentionally absent from our typed schema; injected instances are
  // themselves `Kysely<any>`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: Kysely<any>,
  userId: string,
  opts: { exceptSid?: string } = {},
): Promise<void> {
  let query = db
    .deleteFrom('public.session')
    .where(sql`sess -> 'passport' ->> 'user'`, '=', userId);
  if (opts.exceptSid != null) {
    query = query.where('sid', '!=', opts.exceptSid);
  }
  await query.execute();
}
