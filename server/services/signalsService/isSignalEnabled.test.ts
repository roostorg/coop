import { isSignalEnabled } from './SignalsService.js';

describe('isSignalEnabled', () => {
  afterEach(() => {
    delete process.env.ENABLE_AGGREGATION_SIGNAL;
  });

  test('AGGREGATION is disabled unless ENABLE_AGGREGATION_SIGNAL=true', () => {
    expect(isSignalEnabled({ type: 'AGGREGATION' })).toBe(false);

    process.env.ENABLE_AGGREGATION_SIGNAL = 'false';
    expect(isSignalEnabled({ type: 'AGGREGATION' })).toBe(false);

    process.env.ENABLE_AGGREGATION_SIGNAL = 'true';
    expect(isSignalEnabled({ type: 'AGGREGATION' })).toBe(true);
  });

  test('other signal types are always enabled', () => {
    expect(isSignalEnabled({ type: 'USER_SCORE' })).toBe(true);
    expect(isSignalEnabled({ type: 'OPEN_AI_HATE_TEXT_MODEL' })).toBe(true);
  });
});
