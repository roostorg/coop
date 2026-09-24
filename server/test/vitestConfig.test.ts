import { describe, expect, it } from 'vitest';

import config from '../vitest.config.js';
import integrationConfig from '../vitest.integ.config.js';

describe('Vitest console output', () => {
  it('hides logs from passing unit tests but shows logs from failing tests', () => {
    expect(config.test?.silent).toBe('passed-only');
  });

  it('uses the same console output setting for integration tests', () => {
    expect(integrationConfig.test?.silent).toBe('passed-only');
  });
});
