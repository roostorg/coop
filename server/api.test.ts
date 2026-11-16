import * as superTest from 'supertest';

import createOrg from './test/fixtureHelpers/createOrg.js';
import createSession, {
  expectSessionIdentity,
} from './test/fixtureHelpers/createSession.js';
import createUser from './test/fixtureHelpers/createUser.js';
import { makeTransactionalTestWithFixture } from './test/harness/transactionalTest.js';
import { makeMockedServer } from './test/setupMockedServer.js';

it('authenticates sessions after another app has shut down', async () => {
  const previous = await makeMockedServer();
  try {
    await previous.rollback();
  } finally {
    await previous.shutdown();
  }

  const { deps, request, rollback, shutdown } = await makeMockedServer();
  try {
    const { org } = await createOrg(deps);
    const password = 'Session-isolation-test-password-123!';
    const { user } = await createUser(deps.KyselyPg, org.id, {
      approvedByAdmin: true,
      loginMethods: ['password'],
      password,
    });

    const login = await request
      .post('/api/v1/graphql')
      .send({
        query: `mutation Login($input: LoginInput!) {
          login(input: $input) { __typename }
        }`,
        variables: { input: { email: user.email, password } },
      })
      .expect(200);
    expect(login.body.errors).toBeUndefined();
    expect(login.body.data.login.__typename).toBe('LoginSuccessResponse');

    const response = await request
      .post('/api/v1/graphql')
      .send({ query: '{ myOrg { id } }' })
      .expect(200);
    expect(response.body.errors).toBeUndefined();
    expect(response.body.data.myOrg.id).toBe(org.id);
  } finally {
    await rollback();
    await shutdown();
  }
});

describe('session authentication', () => {
  const testWithSession = makeTransactionalTestWithFixture(
    async ({ deps, request: session }) => {
      const { org } = await createOrg(deps);
      const password = 'Session-test-password-123!';
      const { user } = await createUser(deps.KyselyPg, org.id, {
        approvedByAdmin: true,
        loginMethods: ['password'],
        password,
      });
      const login = await session
        .post('/api/v1/graphql')
        .send({
          query: `mutation($input: LoginInput!) { login(input: $input) { __typename } }`,
          variables: { input: { email: user.email, password } },
        })
        .expect(200);
      expect(login.body).toEqual({
        data: { login: { __typename: 'LoginSuccessResponse' } },
      });
      const cookies: unknown = login.headers['set-cookie'];
      if (!Array.isArray(cookies) || typeof cookies[0] !== 'string')
        throw new Error('Expected a session cookie');
      const cookie = cookies[0].split(';')[0];
      expect(cookie).toMatch(/^connect\.sid=.+\..+$/);
      return { user, session, cookie };
    },
  );

  testWithSession(
    'preserves the current session when login to another account fails',
    async ({ deps, session, user }) => {
      const { org: foreignOrg } = await createOrg(deps);
      const { user: foreignUser } = await createUser(
        deps.KyselyPg,
        foreignOrg.id,
        {
          approvedByAdmin: true,
          loginMethods: ['password'],
          password: 'Foreign-user-password-456!',
        },
      );

      const failedLogin = await session
        .post('/api/v1/graphql')
        .send({
          query: `mutation($input: LoginInput!) { login(input: $input) { __typename } }`,
          variables: {
            input: { email: foreignUser.email, password: 'Incorrect-password' },
          },
        })
        .expect(200);

      expect(failedLogin.body).toEqual({
        data: { login: { __typename: 'LoginIncorrectPasswordError' } },
      });
      await expectSessionIdentity(session, user);
    },
  );

  testWithSession(
    'rejects a session cookie with a tampered signature',
    async ({ server, session, user, cookie }) => {
      await expectSessionIdentity(session, user);
      const value = decodeURIComponent(cookie.slice('connect.sid='.length));
      const signatureStart = value.lastIndexOf('.') + 1;

      for (let index = signatureStart; index < value.length; index++) {
        const tamperedValue =
          value.slice(0, index) +
          (value[index] === 'a' ? 'b' : 'a') +
          value.slice(index + 1);
        const forgedSession = superTest.agent(server);
        forgedSession.set(
          'Cookie',
          `connect.sid=${encodeURIComponent(tamperedValue)}`,
        );

        await expectSessionIdentity(forgedSession, null);
      }

      await expectSessionIdentity(session, user);
    },
  );

  testWithSession(
    'logout invalidates copied session cookies without affecting another user',
    async ({ deps, server, session, user, cookie }) => {
      const { org: foreignOrg } = await createOrg(deps);
      const foreignPassword = 'Foreign-user-password-456!';
      const { user: foreignUser } = await createUser(
        deps.KyselyPg,
        foreignOrg.id,
        {
          approvedByAdmin: true,
          loginMethods: ['password'],
          password: foreignPassword,
        },
      );
      const foreignSession = await createSession(
        server,
        foreignUser.email,
        foreignPassword,
      );
      const replayedSession = superTest.agent(server);
      replayedSession.set('Cookie', cookie);
      await expectSessionIdentity(replayedSession, user);
      await expectSessionIdentity(foreignSession, foreignUser);

      const logout = await session
        .post('/api/v1/graphql')
        .send({ query: 'mutation { logout }' })
        .expect(200);

      expect(logout.body).toEqual({ data: { logout: true } });
      await expectSessionIdentity(session, null);
      await expectSessionIdentity(replayedSession, null);
      await expectSessionIdentity(foreignSession, foreignUser);
    },
  );
});
