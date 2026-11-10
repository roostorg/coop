import fc from 'fast-check';
import * as superTest from 'supertest';

import createOrg from './test/fixtureHelpers/createOrg.js';
import { expectSessionIdentity } from './test/fixtureHelpers/createSession.js';
import createUser from './test/fixtureHelpers/createUser.js';
import {
  makeMockedServer,
  type MockedServer,
} from './test/setupMockedServer.js';

it('isolates login and logout sessions after another app has shut down', async () => {
  const previous = await makeMockedServer();
  try {
    await previous.rollback();
  } finally {
    await previous.shutdown();
  }

  await fc.assert(
    fc.asyncProperty(
      fc.record({ passwordSuffix: fc.string(), signatureOffset: fc.nat() }),
      async ({ passwordSuffix, signatureOffset }) => {
        const {
          deps,
          server,
          request: userSession,
          rollback,
          shutdown,
        } = await makeMockedServer();
        try {
          const { org, apiKey } = await createOrg(deps);
          const { org: foreignOrg } = await createOrg(deps);
          const password = `First-${passwordSuffix}`;
          const { user } = await createUser(deps.KyselyPg, org.id, {
            approvedByAdmin: true,
            loginMethods: ['password'],
            password,
          });
          const { user: foreignUser } = await createUser(
            deps.KyselyPg,
            foreignOrg.id,
            {
              approvedByAdmin: true,
              loginMethods: ['password'],
              password: `Second-${passwordSuffix}`,
            },
          );
          const foreignUserSession = superTest.agent(server);

          const failed = await login(userSession, user.email, `${password}!`);
          expect(failed.body.data.login.__typename).toBe(
            'LoginIncorrectPasswordError',
          );
          await expectSessionIdentity(userSession, null);
          const authenticated = await login(userSession, user.email, password);
          expect(authenticated.body.errors).toBeUndefined();
          expect(authenticated.body.data.login.__typename).toBe(
            'LoginSuccessResponse',
          );
          const cookies: unknown = authenticated.headers['set-cookie'];
          if (!Array.isArray(cookies) || typeof cookies[0] !== 'string')
            throw new Error('Expected a session cookie');
          const cookie = cookies[0].split(';')[0];
          expect(cookie).toMatch(/^connect\.sid=.+\..+$/);
          await expectSessionIdentity(userSession, user);
          const foreignLogin = await login(
            foreignUserSession,
            foreignUser.email,
            `Second-${passwordSuffix}`,
          );
          expect(foreignLogin.body.data.login.__typename).toBe(
            'LoginSuccessResponse',
          );

          // A session does not substitute for a REST API key, or vice versa.
          await userSession.get('/api/v1/policies/').expect(401);
          const keyOnly = await superTest
            .agent(server)
            .post('/api/v1/graphql')
            .set('x-api-key', apiKey)
            .send({ query: '{ me { id } myOrg { id } }' })
            .expect(200);
          expect(keyOnly.body.data).toEqual({ me: null, myOrg: null });

          const failedSwitch = await login(
            userSession,
            foreignUser.email,
            password,
          );
          expect(failedSwitch.body.data.login.__typename).toBe(
            'LoginIncorrectPasswordError',
          );
          await expectSessionIdentity(userSession, user);

          const forgedSession = superTest.agent(server);
          forgedSession.set(
            'Cookie',
            tamperSessionSignature(cookie, signatureOffset),
          );
          await expectSessionIdentity(forgedSession, null);
          await expectSessionIdentity(userSession, user);
          const replayedSession = superTest.agent(server);
          replayedSession.set('Cookie', cookie);
          await expectSessionIdentity(replayedSession, user);

          const logout = await userSession
            .post('/api/v1/graphql')
            .send({ query: 'mutation { logout }' })
            .expect(200);
          expect(logout.body.errors).toBeUndefined();
          expect(logout.body.data.logout).toBe(true);
          await expectSessionIdentity(userSession, null);
          await expectSessionIdentity(replayedSession, null);
          await expectSessionIdentity(foreignUserSession, foreignUser);
        } finally {
          try {
            await rollback();
          } finally {
            await shutdown();
          }
        }
      },
    ),
    {
      numRuns: 15,
      examples: [
        [{ passwordSuffix: 'boundary', signatureOffset: 0 }],
        [{ passwordSuffix: 'x'.repeat(80), signatureOffset: 42 }],
        [{ passwordSuffix: ' whitespace \0é', signatureOffset: 1 }],
      ],
    },
  );
}, 30_000);

// Helpers
function login(
  session: MockedServer['request'],
  email: string,
  password: string,
) {
  return session
    .post('/api/v1/graphql')
    .send({
      query:
        'mutation Login($input: LoginInput!) { login(input: $input) { __typename } }',
      variables: { input: { email, password } },
    })
    .expect(200);
}

function tamperSessionSignature(cookie: string, signatureOffset: number) {
  const value = decodeURIComponent(cookie.slice('connect.sid='.length));
  const signatureStart = value.lastIndexOf('.') + 1;
  const signatureLength = value.length - signatureStart;
  const index = signatureStart + (signatureOffset % signatureLength);
  const tampered =
    value.slice(0, index) +
    (value[index] === 'a' ? 'b' : 'a') +
    value.slice(index + 1);
  return `connect.sid=${encodeURIComponent(tampered)}`;
}
