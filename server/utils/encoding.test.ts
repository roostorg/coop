import * as fc from 'fast-check';

import { regexEscape, runEncode } from './encoding.js';

describe('Encoding Utilities', () => {
  describe('runEncode', () => {
    test('empty string', () => {
      expect(runEncode('')).toMatchObject([]);
    });
    test('single character', () => {
      expect(runEncode('a')).toMatchObject([['a', 1]]);
    });
    test('duplicate multiple characters', () => {
      expect(runEncode('aaaabbaaabbbb')).toMatchObject([
        ['a', 4],
        ['b', 2],
        ['a', 3],
        ['b', 4],
      ]);
    });
  });

  describe('regexEscape', () => {
    test('should always produce a valid regex that matches the literal characters of the input', () => {
      fc.assert(
        fc.property(fc.string({ size: '+2' }), (str) => {
          // eslint-disable-next-line security/detect-non-literal-regexp
          const regex = new RegExp(`^${regexEscape(str)}$`);
          return regex.test(str);
        }),
      );
    });
  });
});
