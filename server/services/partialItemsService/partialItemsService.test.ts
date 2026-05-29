import { isJsonParseFailure } from './isJsonParseFailure.js';

describe('isJsonParseFailure', () => {
  it('returns true for a bare SyntaxError', () => {
    expect(
      isJsonParseFailure(
        new SyntaxError(
          'Unexpected non-whitespace character after JSON at position 4',
        ),
      ),
    ).toBe(true);
  });

  it('returns true for an Error whose cause is a SyntaxError', () => {
    const underlying = new SyntaxError(
      'Unexpected non-whitespace character after JSON at position 4',
    );
    expect(
      isJsonParseFailure(new Error('wrapped', { cause: underlying })),
    ).toBe(true);
  });

  it('returns false for a generic error with no SyntaxError cause', () => {
    expect(isJsonParseFailure(new Error('ECONNREFUSED'))).toBe(false);
  });

  it('returns false for an error whose cause is something other than a SyntaxError', () => {
    expect(
      isJsonParseFailure(new Error('boom', { cause: new TypeError('nope') })),
    ).toBe(false);
  });

  it('returns false for non-Error thrown values', () => {
    expect(isJsonParseFailure('parse failed')).toBe(false);
    expect(isJsonParseFailure(undefined)).toBe(false);
    expect(isJsonParseFailure(null)).toBe(false);
    expect(isJsonParseFailure({ message: 'parse failed' })).toBe(false);
  });
});
