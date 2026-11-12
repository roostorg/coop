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
  const replacementPassword = 'a'.repeat(MIN_PASSWORD_LENGTH);
  const resetToken = 'synthetic-reset-token';
  const testWithSessions = makeTransactionalTestWithFixture(
    async ({ deps, server }) => {
      const { org } = await createOrg(deps);
      const { org: foreignOrg } = await createOrg(deps);
      const { user } = await createUser(deps.KyselyPg, org.id, {
        approvedByAdmin: true,
        loginMethods: ['password'],
        password: initialPassword,
      });
      const callerSession = await createSession(
        server,
        user.email,
        initialPassword,
      );
      const otherSessions = [
        await createSession(server, user.email, initialPassword),
        await createSession(server, user.email, initialPassword),
      ];
      const allUserSessions = [callerSession, ...otherSessions];
      for (const session of allUserSessions)
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
      const sameOrgObserver = await createObserver(org.id);
      const foreignOrgObserver = await createObserver(foreignOrg.id);
      const expectUnrelatedSessionsActive = async () => {
        for (const observer of [sameOrgObserver, foreignOrgObserver])
          await expectSessionIdentity(observer.session, observer.user);
      };

      await deps.KyselyPg.insertInto(
        'user_management_service.password_reset_tokens',
      )
        .values({
          user_id: user.id,
          org_id: org.id,
          hashed_token: createHash('sha256').update(resetToken).digest('hex'),
          created_at: new Date(),
        })
        .execute();

      const changePassword = ({
        currentPassword = initialPassword,
        newPassword = replacementPassword,
      }: { currentPassword?: string; newPassword?: string } = {}) =>
        callerSession
          .post('/api/v1/graphql')
          .send({
            query: `mutation($input: ChangePasswordInput!) { changePassword(input: $input) { __typename } }`,
            variables: { input: { currentPassword, newPassword } },
          })
          .expect(200);
      const resetPassword = ({
        token = resetToken,
        newPassword = replacementPassword,
      }: { token?: string; newPassword?: string } = {}) =>
        superTest
          .agent(server)
          .post('/api/v1/graphql')
          .send({
            query: `mutation($input: ResetPasswordInput!) { resetPassword(input: $input) }`,
            variables: { input: { token, newPassword } },
          })
          .expect(200);

      const expectPasswordAndSessionsUnchanged = async () => {
        const stored = await deps.KyselyPg.selectFrom('public.users')
          .select('password')
          .where('id', '=', user.id)
          .executeTakeFirstOrThrow();
        expect(stored.password).toBe(user.password);
        for (const session of allUserSessions)
          await expectSessionIdentity(session, user);
        await expectUnrelatedSessionsActive();
        await expectSessionIdentity(
          await createSession(server, user.email, initialPassword),
          user,
        );
      };
      const expectOnlyNewPasswordWorks = async () => {
        const freshSession = await createSession(
          server,
          user.email,
          replacementPassword,
        );
        await expectSessionIdentity(freshSession, user);
        const oldPassword = await superTest
          .agent(server)
          .post('/api/v1/graphql')
          .send({
            query: `mutation($input: LoginInput!) { login(input: $input) { __typename } }`,
            variables: {
              input: { email: user.email, password: initialPassword },
            },
          })
          .expect(200);
        expect(oldPassword.body).toEqual({
          data: { login: { __typename: 'LoginIncorrectPasswordError' } },
        });
        return freshSession;
      };
      return {
        user,
        callerSession,
        otherSessions,
        allUserSessions,
        changePassword,
        resetPassword,
        expectPasswordAndSessionsUnchanged,
        expectUnrelatedSessionsActive,
        expectOnlyNewPasswordWorks,
      };
    },
  );

  testWithSessions(
    'changePassword preserves the caller session and revokes the user’s other sessions',
    async ({
      user,
      callerSession,
      otherSessions,
      changePassword,
      expectUnrelatedSessionsActive,
      expectOnlyNewPasswordWorks,
    }) => {
      const result = await changePassword();
      expect(result.body).toEqual({
        data: {
          changePassword: { __typename: 'ChangePasswordSuccessResponse' },
        },
      });
      await expectSessionIdentity(callerSession, user);
      for (const session of otherSessions)
        await expectSessionIdentity(session, null);
      await expectUnrelatedSessionsActive();
      await expectOnlyNewPasswordWorks();
    },
  );

  testWithSessions(
    'resetPassword revokes all of the user’s sessions and consumes the reset token',
    async ({
      deps,
      user,
      allUserSessions,
      resetPassword,
      expectUnrelatedSessionsActive,
      expectOnlyNewPasswordWorks,
    }) => {
      const result = await resetPassword();
      expect(result.body).toEqual({ data: { resetPassword: true } });
      for (const session of allUserSessions)
        await expectSessionIdentity(session, null);
      await expectUnrelatedSessionsActive();
      const freshSession = await expectOnlyNewPasswordWorks();
      expect(
        await deps.KyselyPg.selectFrom(
          'user_management_service.password_reset_tokens',
        )
          .selectAll()
          .where('user_id', '=', user.id)
          .execute(),
      ).toEqual([]);

      await resetPassword({ newPassword: 'Replayed-password' });
      await expectSessionIdentity(freshSession, user);
      await expectOnlyNewPasswordWorks();
    },
  );

  for (const method of ['resetPassword', 'changePassword'] as const) {
    testWithSessions(
      `${method} rejects short passwords without changing password or sessions`,
      async (fixture) => {
        const result = await fixture[method]({
          newPassword: 'a'.repeat(MIN_PASSWORD_LENGTH - 1),
        });
        expect(result.body.errors).toEqual([
          expect.objectContaining({
            message: expect.stringContaining(
              `at least ${MIN_PASSWORD_LENGTH} characters`,
            ),
          }),
        ]);
        await fixture.expectPasswordAndSessionsUnchanged();
      },
    );

    testWithSessions(
      `${method} rolls back the password when session deletion fails`,
      async (fixture) => {
        const { deps, user, expectPasswordAndSessionsUnchanged } = fixture;
        // A real PostgreSQL failure tests the transaction, not a mocked query order.
        await sql`CREATE FUNCTION pg_temp.reject_session_delete() RETURNS trigger AS $$
        BEGIN RAISE EXCEPTION 'synthetic session deletion failure'; END;
      $$ LANGUAGE plpgsql`.execute(deps.KyselyPg);
        await sql`CREATE TRIGGER reject_session_delete BEFORE DELETE ON public.session
        FOR EACH ROW EXECUTE FUNCTION pg_temp.reject_session_delete()`.execute(
          deps.KyselyPg,
        );
        const result = await fixture[method]();
        expect(result.body.errors).toBeDefined();
        await expectPasswordAndSessionsUnchanged();
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
    async ({
      deps,
      user,
      resetPassword,
      expectPasswordAndSessionsUnchanged,
    }) => {
      await deps.KyselyPg.updateTable(
        'user_management_service.password_reset_tokens',
      )
        .set({ created_at: new Date(Date.now() - 2 * 60 * 60 * 1000) })
        .where('user_id', '=', user.id)
        .execute();
      for (const token of [resetToken, 'unknown-token']) {
        const result = await resetPassword({ token });
        expect(result.body).toEqual({ data: { resetPassword: true } });
        await expectPasswordAndSessionsUnchanged();
      }
    },
  );

  testWithSessions(
    'an incorrect current password preserves passwords and sessions',
    async ({ changePassword, expectPasswordAndSessionsUnchanged }) => {
      const result = await changePassword({
        currentPassword: 'Incorrect-password',
      });
      expect(result.body.errors).toBeDefined();
      await expectPasswordAndSessionsUnchanged();
    },
  );
});
