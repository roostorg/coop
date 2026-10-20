import { escapeCsvField } from './moderationActivityCsv';

describe('escapeCsvField', () => {
  it.each(['=1+1', '+1', '-1', '@SUM(A1)'])('prefixes %s', (value) => {
    expect(escapeCsvField(value)).toBe(`"'${value}"`);
  });

  it('doubles embedded quotes', () => {
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
  });
});
