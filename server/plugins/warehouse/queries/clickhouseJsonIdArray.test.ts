import { extractIds, parseJsonIdArray } from './clickhouseJsonIdArray.js';

describe('parseJsonIdArray', () => {
  it.each([null, undefined, ''])('returns null for %p', (value) => {
    expect(parseJsonIdArray(value)).toBeNull();
  });

  it('returns null for an empty array', () => {
    expect(parseJsonIdArray('[]')).toBeNull();
  });

  it.each(['[ ]', '[\n]', '[  \t ]'])(
    'returns null for an empty array written as %p',
    (value) => {
      expect(parseJsonIdArray(value)).toBeNull();
    },
  );

  it('returns the entries that carry a string id', () => {
    expect(parseJsonIdArray('[{"id":"pol-1","name":"Spam"}]')).toEqual([
      { id: 'pol-1', name: 'Spam' },
    ]);
  });

  it('distinguishes a filtered-to-nothing array from an absent one', () => {
    expect(parseJsonIdArray('[{"name":"Spam"}]')).toEqual([]);
    expect(parseJsonIdArray('[]')).toBeNull();
  });

  it.each(['not json', '{"id":"pol-1"}', '"pol-1"', '42'])(
    'returns null for %p',
    (value) => {
      expect(parseJsonIdArray(value)).toBeNull();
    },
  );
});

describe('extractIds', () => {
  it('returns an empty array for null or undefined', () => {
    expect(extractIds(null)).toEqual([]);
    expect(extractIds(undefined)).toEqual([]);
  });

  it('projects the id field', () => {
    expect(extractIds([{ id: 'a' }, { id: 'b' }])).toEqual(['a', 'b']);
  });

  it('drops empty ids', () => {
    expect(extractIds([{ id: 'a' }, { id: '' }])).toEqual(['a']);
  });
});
