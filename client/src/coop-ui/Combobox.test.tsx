import { joinWithOverflowCount } from './Combobox';

describe('joinWithOverflowCount', () => {
  it('joins every label when there is no limit or the limit is not hit', () => {
    expect(joinWithOverflowCount(['A', 'B'])).toBe('A, B');
    expect(joinWithOverflowCount(['A', 'B'], 2)).toBe('A, B');
  });

  it('collapses labels past the limit into a +N count', () => {
    expect(joinWithOverflowCount(['A', 'B', 'C'], 1)).toBe('A +2');
  });
});
