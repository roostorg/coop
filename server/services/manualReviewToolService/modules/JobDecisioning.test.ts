import { parseItemCreatedAt } from './JobDecisioning.js';

describe('parseItemCreatedAt', () => {
  test('parses a valid ISO string', () => {
    expect(parseItemCreatedAt('2026-01-01T00:00:00.000Z')).toEqual(
      new Date('2026-01-01T00:00:00.000Z'),
    );
  });

  test('parses an epoch-millis number', () => {
    expect(parseItemCreatedAt(1735689600000)).toEqual(new Date(1735689600000));
  });

  test('treats epoch 0 as a valid timestamp, not empty', () => {
    expect(parseItemCreatedAt(0)).toEqual(new Date(0));
  });

  test('passes a Date through', () => {
    const d = new Date('2026-01-01T00:00:00.000Z');
    expect(parseItemCreatedAt(d)).toEqual(d);
  });

  test.each([null, undefined, ''])(
    'returns null for empty value %p',
    (value) => {
      expect(parseItemCreatedAt(value)).toBeNull();
    },
  );

  // Regression: a truthy-but-unparseable createdAt (seen on reports from
  // automated sources) produced an Invalid Date, which throws on pg
  // serialization and failed the entire decision insert, surfacing as
  // "Job submission failed" in the reviewer UI.
  test.each(['   ', 'not-a-date', 'garbage', '2026-99-99T99:99:99Z'])(
    'returns null for unparseable value %p instead of an Invalid Date',
    (value) => {
      expect(parseItemCreatedAt(value)).toBeNull();
    },
  );
});
