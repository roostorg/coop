import { type Span } from '@opentelemetry/api';
import { uid } from 'uid';
import { vi } from 'vitest';

import createOrg from '../test/fixtureHelpers/createOrg.js';
import { makeTransactionalTestWithFixture } from '../test/harness/transactionalTest.js';

// Drives a real API-key-protected route through the app's error handler, so
// the status and Retry-After header are what an API client actually sees.
describe('API key middleware through the HTTP stack (#676)', () => {
  const testWithFixture = makeTransactionalTestWithFixture(async ({ deps }) => {
    const { apiKey } = await createOrg(
      {
        KyselyPg: deps.KyselyPg,
        ModerationConfigService: deps.ModerationConfigService,
        ApiKeyService: deps.ApiKeyService,
      },
      uid(),
    );
    return { apiKey };
  });

  testWithFixture(
    'answers 503 with Retry-After when the key lookup fails',
    async ({ request, apiKey, deps }) => {
      const dbError = new Error('connect ECONNREFUSED 127.0.0.1:5432');
      const validateApiKey = vi
        .spyOn(deps.ApiKeyService, 'validateApiKey')
        .mockRejectedValue(dbError);
      const activeSpan = {
        isRecording: () => true,
        recordException: vi.fn(),
        setStatus: vi.fn(),
      };
      const getActiveSpan = vi
        .spyOn(deps.Tracer, 'getActiveSpan')
        .mockReturnValue(activeSpan as unknown as Span);
      try {
        const res = await request
          .post('/api/v1/items/async')
          .set('x-api-key', apiKey)
          .send({ items: [] });
        expect(res.status).toBe(503);
        expect(res.headers['retry-after']).toBe('5');
        expect(res.text).not.toContain('ECONNREFUSED');
        expect(activeSpan.recordException).toHaveBeenCalledWith(dbError);
        expect(activeSpan.setStatus).not.toHaveBeenCalled();
      } finally {
        validateApiKey.mockRestore();
        getActiveSpan.mockRestore();
      }
    },
  );

  testWithFixture(
    'still answers 401 for an unknown key',
    async ({ request }) => {
      const res = await request
        .post('/api/v1/items/async')
        .set('x-api-key', 'not-a-real-key')
        .send({ items: [] });
      expect(res.status).toBe(401);
    },
  );

  testWithFixture(
    'answers 401 for a missing key without looking it up',
    async ({ request, deps }) => {
      const validateApiKey = vi.spyOn(deps.ApiKeyService, 'validateApiKey');
      try {
        const res = await request
          .post('/api/v1/items/async')
          .send({ items: [] });
        expect(res.status).toBe(401);
        expect(validateApiKey).not.toHaveBeenCalled();
      } finally {
        validateApiKey.mockRestore();
      }
    },
  );
});
