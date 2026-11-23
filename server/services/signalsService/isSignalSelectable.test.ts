import { isSignalSelectable } from './SignalsService.js';

describe('isSignalSelectable', () => {
  test('AGGREGATION is not selectable', () => {
    expect(isSignalSelectable({ type: 'AGGREGATION' })).toBe(false);
  });

  test('other signal types are selectable', () => {
    expect(isSignalSelectable({ type: 'USER_SCORE' })).toBe(true);
    expect(isSignalSelectable({ type: 'OPEN_AI_HATE_TEXT_MODEL' })).toBe(true);
  });
});
