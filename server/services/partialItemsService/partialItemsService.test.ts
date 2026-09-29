import { isJsonParseFailure } from './isJsonParseFailure.js';
import makePartialItemsService from './partialItemsService.js';

describe('partialItemsService', () => {
  it('throws the existing domain error for a malformed HTTP response', async () => {
    const service = makePartialItemsService(
      {
        partialItemsInfo: vi.fn().mockResolvedValue({
          partialItemsEndpoint: 'https://example.com/items',
        }),
      } as never,
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        body: { items: 'not-an-array' },
      }) as never,
      vi.fn() as never,
      vi.fn() as never,
      { sign: vi.fn() } as never,
      {
        addSpan: vi.fn(
          async (_options, callback: (span: unknown) => Promise<unknown>) =>
            callback({ setAttribute: vi.fn() }),
        ),
      } as never,
    );

    await expect(service.getPartialItems('org-id', [])).rejects.toMatchObject({
      name: 'PartialItemsInvalidResponseError',
      title: 'Get More Info Endpoint Returned a malformed response',
    });
  });
});

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
