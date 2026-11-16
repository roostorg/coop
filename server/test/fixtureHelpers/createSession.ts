import * as superTest from 'supertest';

import { type MockedServer } from '../setupMockedServer.js';

export default async function createSession(
  server: MockedServer['server'],
  email: string,
  password: string,
) {
  const session = superTest.agent(server);
  const response = await session
    .post('/api/v1/graphql')
    .send({
      query: `mutation($input: LoginInput!) { login(input: $input) { __typename } }`,
      variables: { input: { email, password } },
    })
    .expect(200);
  expect(response.body).toEqual({
    data: { login: { __typename: 'LoginSuccessResponse' } },
  });
  return session;
}

export async function expectSessionIdentity(
  session: MockedServer['request'],
  user: { id: string; orgId: string } | null,
) {
  const response = await session
    .post('/api/v1/graphql')
    .send({ query: '{ me { id } myOrg { id } }' })
    .expect(200);
  expect(response.body.data).toEqual({
    me: user ? { id: user.id } : null,
    myOrg: user ? { id: user.orgId } : null,
  });
  if (user) expect(response.body.errors).toBeUndefined();
  else
    expect(response.body.errors).toEqual([
      expect.objectContaining({
        extensions: expect.objectContaining({ code: 'UNAUTHENTICATED' }),
      }),
    ]);
}
