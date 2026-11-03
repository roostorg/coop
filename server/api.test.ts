import fc from 'fast-check';
import * as superTest from 'supertest';

import createOrg from './test/fixtureHelpers/createOrg.js';
import createUser from './test/fixtureHelpers/createUser.js';
import { makeMockedServer } from './test/setupMockedServer.js';

it('isolates login and logout sessions after another app has shut down', async () => {
  const previous = await makeMockedServer();
  try {
    await previous.rollback();
  } finally {
    await previous.shutdown();
  }

  await fc.assert(
    fc.asyncProperty(
      fc.string({ minLength: 1, maxLength: 96 }),
      fc.nat(),
      async (suffix, position) => {
        const { deps, server, request, rollback, shutdown } =
          await makeMockedServer();
        try {
          const { org, apiKey } = await createOrg(deps);
          const other = await createOrg(deps);
          const password = `First-${suffix}`;
          const { user } = await createUser(deps.KyselyPg, org.id, {
            approvedByAdmin: true,
            loginMethods: ['password'],
            password,
          });
          const { user: otherUser } = await createUser(
            deps.KyselyPg,
            other.org.id,
            {
              approvedByAdmin: true,
              loginMethods: ['password'],
              password: `Second-${suffix}`,
            },
          );
          const observer = superTest.agent(server);
          const login = (
            agent: typeof request,
            email: string,
            suppliedPassword: string,
          ) =>
            agent
              .post('/api/v1/graphql')
              .send({
                query:
                  'mutation Login($input: LoginInput!) { login(input: $input) { __typename } }',
                variables: { input: { email, password: suppliedPassword } },
              })
              .expect(200);
          const expectIdentity = async (
            agent: typeof request,
            expected: { id: string; orgId: string } | null,
          ) => {
            const response = await agent
              .post('/api/v1/graphql')
              .send({ query: '{ me { id } myOrg { id } }' })
              .expect(200);
            expect(response.body.data).toEqual({
              me: expected ? { id: expected.id } : null,
              myOrg: expected ? { id: expected.orgId } : null,
            });
            if (expected) expect(response.body.errors).toBeUndefined();
            else
              expect(response.body.errors).toEqual([
                expect.objectContaining({
                  extensions: expect.objectContaining({
                    code: 'UNAUTHENTICATED',
                  }),
                }),
              ]);
          };

          const failed = await login(request, user.email, `${password}!`);
          expect(failed.body.data.login.__typename).toBe(
            'LoginIncorrectPasswordError',
          );
          await expectIdentity(request, null);
          const authenticated = await login(request, user.email, password);
          expect(authenticated.body.errors).toBeUndefined();
          expect(authenticated.body.data.login.__typename).toBe(
            'LoginSuccessResponse',
          );
          const cookies: unknown = authenticated.headers['set-cookie'];
          if (!Array.isArray(cookies) || typeof cookies[0] !== 'string')
            throw new Error('Expected a session cookie');
          const cookie = cookies[0].split(';')[0];
          expect(cookie).toMatch(/^connect\.sid=.+\..+$/);
          await expectIdentity(request, user);
          const otherLogin = await login(
            observer,
            otherUser.email,
            `Second-${suffix}`,
          );
          expect(otherLogin.body.data.login.__typename).toBe(
            'LoginSuccessResponse',
          );

          // A session does not substitute for a REST API key, or vice versa.
          await request.get('/api/v1/policies/').expect(401);
          const keyOnly = await superTest
            .agent(server)
            .post('/api/v1/graphql')
            .set('x-api-key', apiKey)
            .send({ query: '{ me { id } myOrg { id } }' })
            .expect(200);
          expect(keyOnly.body.data).toEqual({ me: null, myOrg: null });

          const failedSwitch = await login(request, otherUser.email, password);
          expect(failedSwitch.body.data.login.__typename).toBe(
            'LoginIncorrectPasswordError',
          );
          await expectIdentity(request, user);

          const value = decodeURIComponent(cookie.slice('connect.sid='.length));
          const signatureStart = value.lastIndexOf('.') + 1;
          const index =
            signatureStart + (position % (value.length - signatureStart));
          const tampered =
            value.slice(0, index) +
            (value[index] === 'a' ? 'b' : 'a') +
            value.slice(index + 1);
          const forged = superTest.agent(server);
          forged.set('Cookie', `connect.sid=${encodeURIComponent(tampered)}`);
          await expectIdentity(forged, null);
          await expectIdentity(request, user);
          const replay = superTest.agent(server);
          replay.set('Cookie', cookie);
          await expectIdentity(replay, user);

          const logout = await request
            .post('/api/v1/graphql')
            .send({ query: 'mutation { logout }' })
            .expect(200);
          expect(logout.body.errors).toBeUndefined();
          expect(logout.body.data.logout).toBe(true);
          await expectIdentity(request, null);
          await expectIdentity(replay, null);
          await expectIdentity(observer, otherUser);
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
        ['boundary', 0],
        ['x'.repeat(80), 42],
        [' whitespace \0é', 1],
      ],
    },
  );
}, 30_000);
