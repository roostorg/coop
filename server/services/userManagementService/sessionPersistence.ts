import { and, eq, ne, sql } from 'drizzle-orm';

import { schema, type CoopDbOrTx } from '../../storage/postgres/drizzle.js';

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
  db: CoopDbOrTx,
  userId: string,
  opts: { exceptSid?: string } = {},
): Promise<void> {
  const { session } = schema;
  await db
    .delete(session)
    .where(
      and(
        eq(sql`${session.sess} -> 'passport' ->> 'user'`, userId),
        opts.exceptSid != null ? ne(session.sid, opts.exceptSid) : undefined,
      ),
    );
}
