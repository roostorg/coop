import { createHash } from 'node:crypto';
import { sql } from 'kysely';
import * as superTest from 'supertest';

import createOrg from '../../test/fixtureHelpers/createOrg.js';
import createSession, {
  expectSessionIdentity,
} from '../../test/fixtureHelpers/createSession.js';
import createUser from '../../test/fixtureHelpers/createUser.js';
import { makeTransactionalTestWithFixture } from '../../test/harness/transactionalTest.js';
import { MIN_PASSWORD_LENGTH } from './constants.js';

describe('password recovery session persistence', () => {
  const initialPassword = 'Initial-password';
  const newPassword = 'a'.repeat(MIN_PASSWORD_LENGTH);
  const token = 'synthetic-reset-token';
  const testWithSessions = makeTransactionalTestWithFixture(
    async ({ deps, server }) => {
      const { org } = await createOrg(deps);
      const foreign = await createOrg(deps);
      const { user } = await createUser(deps.KyselyPg, org.id, {
        approvedByAdmin: true,
        loginMethods: ['password'],
        password: initialPassword,
      });
      const sessions = [
        await createSession(server, user.email, initialPassword),
        await createSession(server, user.email, initialPassword),
        await createSession(server, user.email, initialPassword),
      ];
      for (const session of sessions)
        await expectSessionIdentity(session, user);
      const createObserver = async (orgId: string) => {
        const { user: observer } = await createUser(deps.KyselyPg, orgId, {
          approvedByAdmin: true,
          loginMethods: ['password'],
          password: initialPassword,
        });
        return {
          user: observer,
          session: await createSession(server, observer.email, initialPassword),
        };
      };
      const observers = [
        await createObserver(org.id),
        await createObserver(foreign.org.id),
      ];
      await deps.KyselyPg.insertInto(
        'user_management_service.password_reset_tokens',
      )
        .values({
          user_id: user.id,
          org_id: org.id,
          hashed_token: createHash('sha256').update(token).digest('hex'),
          created_at: new Date(),
        })
        .execute();
      const recover = (
        kind: 'reset' | 'change',
        password = newPassword,
        resetToken = token,
      ) => {
        const session =
          kind === 'change' ? sessions[1] : superTest.agent(server);
        return session
          .post('/api/v1/graphql')
          .send(
            kind === 'change'
              ? {
                  query: `mutation($input: ChangePasswordInput!) { changePassword(input: $input) { __typename } }`,
                  variables: {
                    input: {
                      currentPassword: initialPassword,
                      newPassword: password,
                    },
                  },
                }
              : {
                  query: `mutation($input: ResetPasswordInput!) { resetPassword(input: $input) }`,
                  variables: {
                    input: { token: resetToken, newPassword: password },
                  },
                },
          )
          .expect(200);
      };
      const expectUnchanged = async () => {
        const stored = await deps.KyselyPg.selectFrom('public.users')
          .select('password')
          .where('id', '=', user.id)
          .executeTakeFirstOrThrow();
        expect(stored.password).toBe(user.password);
        for (const session of sessions)
          await expectSessionIdentity(session, user);
        for (const observer of observers)
          await expectSessionIdentity(observer.session, observer.user);
        await expectSessionIdentity(
          await createSession(server, user.email, initialPassword),
          user,
        );
      };
      return { user, sessions, observers, recover, expectUnchanged };
    },
  );

  for (const kind of ['reset', 'change'] as const) {
    testWithSessions(
      `${kind} revokes the intended sessions and accepts only the new password`,
      async ({ user, sessions, observers, recover, server, deps }) => {
        const result = await recover(kind);
        expect(result.body).toEqual({
          data:
            kind === 'reset'
              ? { resetPassword: true }
              : {
                  changePassword: {
                    __typename: 'ChangePasswordSuccessResponse',
                  },
                },
        });
        for (const [index, session] of sessions.entries()) {
          await expectSessionIdentity(
            session,
            kind === 'change' && index === 1 ? user : null,
          );
        }
        for (const observer of observers)
          await expectSessionIdentity(observer.session, observer.user);
        const fresh = await createSession(server, user.email, newPassword);
        await expectSessionIdentity(fresh, user);
        const oldPassword = await superTest
          .agent(server)
          .post('/api/v1/graphql')
          .send({
            query: `mutation($input: LoginInput!) { login(input: $input) { __typename } }`,
            variables: {
              input: { email: user.email, password: initialPassword },
            },
          });
        expect(oldPassword.body).toEqual({
          data: { login: { __typename: 'LoginIncorrectPasswordError' } },
        });
        if (kind === 'reset') {
          expect(
            await deps.KyselyPg.selectFrom(
              'user_management_service.password_reset_tokens',
            )
              .selectAll()
              .where('user_id', '=', user.id)
              .execute(),
          ).toEqual([]);
          await recover('reset', 'Replayed-password');
          await expectSessionIdentity(fresh, user);
          await expectSessionIdentity(
            await createSession(server, user.email, newPassword),
            user,
          );
        }
      },
    );

    testWithSessions(
      `${kind} rejects short passwords without changing password or sessions`,
      async ({ recover, expectUnchanged }) => {
        const result = await recover(kind, 'a'.repeat(MIN_PASSWORD_LENGTH - 1));
        expect(result.body.errors).toEqual([
          expect.objectContaining({
            message: expect.stringContaining(
              `at least ${MIN_PASSWORD_LENGTH} characters`,
            ),
          }),
        ]);
        await expectUnchanged();
      },
    );

    testWithSessions(
      `${kind} rolls back the password when session deletion fails`,
      async ({ deps, user, recover, expectUnchanged }) => {
        // A real PostgreSQL failure tests the transaction, not a mocked query order.
        await sql`CREATE FUNCTION pg_temp.reject_session_delete() RETURNS trigger AS $$
        BEGIN RAISE EXCEPTION 'synthetic session deletion failure'; END;
      $$ LANGUAGE plpgsql`.execute(deps.KyselyPg);
        await sql`CREATE TRIGGER reject_session_delete BEFORE DELETE ON public.session
        FOR EACH ROW EXECUTE FUNCTION pg_temp.reject_session_delete()`.execute(
          deps.KyselyPg,
        );
        const result = await recover(kind);
        expect(result.body.errors).toBeDefined();
        await expectUnchanged();
        expect(
          await deps.KyselyPg.selectFrom(
            'user_management_service.password_reset_tokens',
          )
            .select('user_id')
            .where('user_id', '=', user.id)
            .execute(),
        ).toEqual([{ user_id: user.id }]);
      },
    );
  }

  testWithSessions(
    'expired and unknown reset tokens preserve passwords and sessions',
    async ({ deps, user, recover, expectUnchanged }) => {
      await deps.KyselyPg.updateTable(
        'user_management_service.password_reset_tokens',
      )
        .set({ created_at: new Date(Date.now() - 7_200_000) })
        .where('user_id', '=', user.id)
        .execute();
      for (const resetToken of [token, 'unknown-token']) {
        const result = await recover('reset', newPassword, resetToken);
        expect(result.body).toEqual({ data: { resetPassword: true } });
        await expectUnchanged();
      }
    },
  );

  testWithSessions(
    'an incorrect current password preserves passwords and sessions',
    async ({ sessions, expectUnchanged }) => {
      const result = await sessions[1].post('/api/v1/graphql').send({
        query: `mutation($input: ChangePasswordInput!) { changePassword(input: $input) { __typename } }`,
        variables: {
          input: { currentPassword: 'Incorrect-password', newPassword },
        },
      });
      expect(result.body.errors).toBeDefined();
      await expectUnchanged();
    },
  );
});
