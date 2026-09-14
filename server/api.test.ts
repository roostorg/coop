import createOrg from './test/fixtureHelpers/createOrg.js';
import createUser from './test/fixtureHelpers/createUser.js';
import { makeMockedServer } from './test/setupMockedServer.js';

it('authenticates sessions after another app has shut down', async () => {
  const previous = await makeMockedServer();
  await previous.rollback();
  await previous.shutdown();

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
