import { MultiSamlStrategy } from '@node-saml/passport-saml';
import { vi } from 'vitest';

import { toCoopErrorIfClientRequestError } from '../utils/clientRequestErrors.js';
import createActions from './fixtureHelpers/createActions.js';
import createOrg from './fixtureHelpers/createOrg.js';
import { makeTransactionalTestWithFixture } from './harness/transactionalTest.js';
import { disableConsoleLogging } from './setupMockedServer.js';

const invalidInput = (status: number, title: string, detail?: string) => ({
  errors: [
    {
      status,
      type: ['/errors/invalid-user-input'],
      title,
      ...(detail === undefined ? {} : { detail }),
    },
  ],
});

/**
 * Registers the REST error-response tests. Callers stub
 * EXPOSE_SENSITIVE_IMPLEMENTATION_DETAILS_IN_ERRORS before any import, because
 * `sanitizeError` picks its implementation when its module loads, so each
 * setting needs its own test file.
 */
export function describeApiErrorResponses() {
  let restoreConsole: () => void;
  beforeEach(() => {
    restoreConsole = disableConsoleLogging();
  });
  afterEach(() => {
    restoreConsole();
    vi.restoreAllMocks();
  });

  describe('malformed requests', () => {
    const test = makeTransactionalTestWithFixture(async ({ deps }) => {
      const { org, apiKey, defaultUserItemType } = await createOrg(deps);
      const { actions } = await createActions({
        actionAPI: deps.ActionAPIDataSource,
        itemTypeIds: [defaultUserItemType.id],
        orgId: org.id,
      });
      return { apiKey, action: actions[0] };
    });

    test('rejects a malformed JSON body with a 400', async ({ request }) => {
      const response = await request
        .post('/api/v1/items/async')
        .set('content-type', 'application/json')
        .send('{"items": [')
        .expect(400);
      expect(response.body).toEqual(
        invalidInput(400, 'Malformed JSON body.', expect.any(String)),
      );
    });

    test('rejects a body over the size limit with a 413', async ({
      request,
    }) => {
      const response = await request
        .post('/api/v1/items/async')
        .set('content-type', 'application/json')
        .send(`"${'a'.repeat(51 * 1024 * 1024)}"`)
        .expect(413);
      expect(response.body).toEqual(
        invalidInput(
          413,
          'Request body too large.',
          'request entity too large',
        ),
      );
    });

    test('rejects an undecodable path param with a 400', async ({
      request,
    }) => {
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
      expect(response.body.errors).toEqual([
        expect.objectContaining({
          status: 400,
          type: ['/errors/invalid-user-input'],
          title: 'Invalid Action',
        }),
      ]);
    });

    test('rejects an item type that does not exist with a 400', async ({
      request,
      apiKey,
      action,
    }) => {
      const response = await request
        .post('/api/v1/actions')
        .set('x-api-key', apiKey)
        .send({ itemId: 'item', itemTypeId: 'missing', actionId: action.id })
        .expect(400);
      expect(response.body.errors).toEqual([
        expect.objectContaining({
          status: 400,
          type: ['/errors/invalid-user-input'],
          title: 'Invalid Item Type ID',
        }),
      ]);
    });
  });

  describe('SAML login failure', () => {
    const test = makeTransactionalTestWithFixture(() => ({}));

    beforeEach(() => {
      vi.spyOn(MultiSamlStrategy.prototype, 'authenticate').mockImplementation(
        function (this: MultiSamlStrategy) {
          this.fail('x', 401);
        },
      );
    });

    test('redirects from the login route', async ({ request }) => {
      await request
        .get('/api/v1/saml/login/some-org')
        .expect(302)
        .expect('location', '/');
    });

    test('redirects from the callback route', async ({ request }) => {
      await request
        .post('/api/v1/saml/login/some-org/callback')
        .type('form')
        .send({ SAMLResponse: 'unused' })
        .expect(302)
        .expect('location', '/');
    });
  });

  describe('toCoopErrorIfClientRequestError', () => {
    // The shape http-errors gives errors from body-parser and res.sendFile.
    const httpError = (status: number, expose: boolean) =>
      Object.assign(new Error('message'), {
        status,
        statusCode: status,
        expose,
      });

    it('keeps a 404 from serving a missing file as not found', () => {
      expect(
        toCoopErrorIfClientRequestError(httpError(404, true)),
      ).toMatchObject({
        status: 404,
        type: ['/errors/not-found'],
        title: 'Not found.',
      });
    });

    it('leaves server errors unchanged', () => {
      const err = httpError(503, false);
      expect(toCoopErrorIfClientRequestError(err)).toBe(err);
    });
  });
}
