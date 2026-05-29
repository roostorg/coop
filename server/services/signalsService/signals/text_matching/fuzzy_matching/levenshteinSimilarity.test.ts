import { fullProcess, partialRatio, ratio } from './levenshteinSimilarity.js';

describe('fullProcess', () => {
  test.each([
    ['Hello', 'hello'],
    ['HELLO WORLD', 'hello world'],
    ['  spaces  trimmed  ', 'spaces trimmed'],
    ['punctuation!!!', 'punctuation'],
    ['café', 'café'],
    ['日本語', '日本語'],
    ['emoji 👍 test', 'emoji test'],
    ['', ''],
    ['_underscore_', 'underscore'],
    ['mixed!!! 123 abc', 'mixed 123 abc'],
  ])('fullProcess(%j) === %j', (input, expected) => {
    expect(fullProcess(input)).toBe(expected);
  });
});

describe('ratio', () => {
  test.each([
    ['hello', 'hello', 100],
    ['', '', 0],
    ['hello', '', 0],
    ['hello', 'xyzqr', 0], // No characters in common after pre-processing.
    ['hello', 'world', 20], // LCS = {l} or {o}, distance = 8, lensum = 10.
    ['hello world', 'hello', 63],
    ['hello world', 'world', 63],
    ['this is a much longer string', 'cat', 13],
    ['hello', 'hallo', 80],
    ['hello world', 'helo world', 95],
    ['café', 'cafe', 75], // Unicode preserved; é→e is a single substitution.
    ['naïve', 'naive', 80],
    ['日本語のテスト', '日本語', 60],
    ['emoji 👍 test', 'emoji test', 100], // Emoji stripped by fullProcess.
    ['cat', 'this is a much longer string', 13],
    ['A', 'AAAAAAAA', 22],
    ['fuck this', 'fuck', 62],
    ['fu ck', 'fuck', 89], // LCS = 'fuck' length 4, distance = 1.
    ['fxck', 'fuck', 75], // One substitution.
    ['Hello', 'hello', 100], // Case folded by fullProcess.
    ['HELLO WORLD', 'hello world', 100],
    ['  spaces  trimmed  ', 'spaces trimmed', 100],
    ['punctuation!!!', 'punctuation', 100],
  ])('ratio(%j, %j) === %i', (a, b, expected) => {
    expect(ratio(a, b)).toBe(expected);
  });

  test('is commutative', () => {
    expect(ratio('hello world', 'world')).toBe(ratio('world', 'hello world'));
    expect(ratio('café', 'cafe')).toBe(ratio('cafe', 'café'));
  });
});

describe('partialRatio', () => {
  test.each([
    ['hello', 'hello', 100],
    ['hello', 'world', 22],
    ['hello world', 'hello', 100], // 'hello' is a substring.
    ['hello world', 'world', 100],
    ['this is a much longer string', 'cat', 33],
    ['cat', 'this is a much longer string', 33],
    ['日本語のテスト', '日本語', 100], // 3-char substring match in 7-char string.
    ['A', 'AAAAAAAA', 100],
    ['fuck this', 'fuck', 100], // 'fuck' is a substring of 'fuck this'.
    ['fu ck', 'fuck', 75],
    ['fxck', 'fuck', 75],
    ['Hello', 'hello', 100],
    ['HELLO WORLD', 'hello world', 100],
    ['emoji 👍 test', 'emoji test', 100],
    ['hello world', 'helo world', 90],
  ])('partialRatio(%j, %j) === %i', (a, b, expected) => {
    expect(partialRatio(a, b)).toBe(expected);
  });
});

describe('partialRatio: invariants', () => {
  test('empty either side returns 0', () => {
    expect(partialRatio('', 'hello')).toBe(0);
    expect(partialRatio('hello', '')).toBe(0);
    expect(partialRatio('', '')).toBe(0);
  });

  test('is commutative', () => {
    expect(partialRatio('hello world', 'world')).toBe(
      partialRatio('world', 'hello world'),
    );
    expect(partialRatio('cat', 'this is a much longer string')).toBe(
      partialRatio('this is a much longer string', 'cat'),
    );
  });

  test('exact substring always scores 100', () => {
    expect(partialRatio('the quick brown fox', 'quick brown')).toBe(100);
    expect(partialRatio('quick brown', 'the quick brown fox')).toBe(100);
  });
});
