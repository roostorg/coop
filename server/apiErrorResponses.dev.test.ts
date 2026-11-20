import { vi } from 'vitest';

import { describeApiErrorResponses } from './test/apiErrorResponseTests.js';

vi.hoisted(() => {
  // sanitizeError selects its implementation when the module is imported.
  vi.resetModules();
  vi.stubEnv('EXPOSE_SENSITIVE_IMPLEMENTATION_DETAILS_IN_ERRORS', 'true');
});

afterAll(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describeApiErrorResponses();
