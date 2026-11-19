import { MultiSamlStrategy } from '@node-saml/passport-saml';
import { vi } from 'vitest';

import createOrg from './test/fixtureHelpers/createOrg.js';
import { makeTransactionalTestWithFixture } from './test/harness/transactionalTest.js';
import { disableConsoleLogging } from './test/setupMockedServer.js';

vi.hoisted(() => {
  // sanitizeError selects its implementation when the module is imported, and
  // these errors were only misreported with sensitive details hidden.
  vi.resetModules();
  vi.stubEnv('EXPOSE_SENSITIVE_IMPLEMENTATION_DETAILS_IN_ERRORS', 'false');
});

afterAll(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

let restoreConsole: () => void;
beforeEach(() => {
  restoreConsole = disableConsoleLogging();
});
afterEach(() => {
  restoreConsole();
});

const invalidInput = (status: number, title: string) => ({
  errors: [{ status, type: ['/errors/invalid-user-input'], title }],
});

describe('API error responses for malformed requests', () => {
  const test = makeTransactionalTestWithFixture(async ({ deps }) => {
    const { apiKey } = await createOrg(deps);
    return { apiKey };
  });

  test('rejects a malformed JSON body with a 400', async ({ request }) => {
    const response = await request
      .post('/api/v1/items/async')
      .set('content-type', 'application/json')
      .send('{"items": [')
      .expect(400);
    expect(response.body).toEqual(invalidInput(400, 'Malformed JSON body.'));
  });

  test('rejects a body over the size limit with a 413', async ({ request }) => {
    const response = await request
      .post('/api/v1/items/async')
      .set('content-type', 'application/json')
      .send(`"${'a'.repeat(51 * 1024 * 1024)}"`)
      .expect(413);
    expect(response.body).toEqual(invalidInput(413, 'Request body too large.'));
  });

  test('rejects an undecodable path param with a 400', async ({ request }) => {
    const response = await request
      .get('/api/v1/integration-logos/%C0%80')
      .expect(400);
    expect(response.body).toEqual(invalidInput(400, 'Malformed URL.'));
  });

  test('rejects user_scores without id and typeId with a 400', async ({
    request,
    apiKey,
  }) => {
    const response = await request
      .get('/api/v1/user_scores')
      .set('x-api-key', apiKey)
      .expect(400);
    expect(response.body).toEqual(
      invalidInput(400, 'id and typeId are required'),
    );
  });

  test('rejects an action that does not exist with a 400', async ({
    request,
    apiKey,
  }) => {
    const response = await request
      .post('/api/v1/actions')
      .set('x-api-key', apiKey)
      .send({ itemId: 'item', itemTypeId: 'type', actionId: 'missing' })
      .expect(400);
    expect(response.body.errors).toMatchObject([
      { status: 400, title: 'Invalid Action' },
    ]);
  });
});

describe('SAML login failure', () => {
  const test = makeTransactionalTestWithFixture(() => ({}));

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('redirects when the strategy fails with a message', async ({
    request,
  }) => {
    vi.spyOn(MultiSamlStrategy.prototype, 'authenticate').mockImplementation(
      function (this: MultiSamlStrategy) {
        this.fail('x', 401);
      },
    );

    await request
      .post('/api/v1/saml/login/some-org/callback')
      .type('form')
      .send({ SAMLResponse: 'unused' })
      .expect(302)
      .expect('location', '/');
  });
});
