import { toOriginalFileHashes } from './ncmecReporting.js';

describe('toOriginalFileHashes', () => {
  it('uppercases the algorithm into the `hashType` attribute', () => {
    expect(
      toOriginalFileHashes({ hmaHashes: { md5: 'abc', pdq: 'def' } }),
    ).toEqual([
      { _text: 'abc', _attributes: { hashType: 'MD5' } },
      { _text: 'def', _attributes: { hashType: 'PDQ' } },
    ]);
  });

  it('trims surrounding whitespace from hash values', () => {
    expect(toOriginalFileHashes({ hmaHashes: { md5: '  abc  ' } })).toEqual([
      { _text: 'abc', _attributes: { hashType: 'MD5' } },
    ]);
  });

  it('drops entries with empty or whitespace-only hash values', () => {
    // NCMEC requires non-empty `hash` text and `hashType` attribute; an
    // entry with whitespace would fail XSD validation on receipt.
    expect(
      toOriginalFileHashes({
        hmaHashes: { md5: '', sha1: '   ', sha256: 'kept' },
      }),
    ).toEqual([{ _text: 'kept', _attributes: { hashType: 'SHA256' } }]);
  });

  it('returns undefined when no entries survive filtering', () => {
    // Caller branches on undefined to omit the `originalFileHash` key
    // entirely rather than serialise an empty array.
    expect(toOriginalFileHashes({})).toBeUndefined();
    expect(toOriginalFileHashes({ hmaHashes: {} })).toBeUndefined();
    expect(
      toOriginalFileHashes({ hmaHashes: { md5: '', sha1: '  ' } }),
    ).toBeUndefined();
  });

  it('includes the webhook hash when only the webhook source has data', () => {
    expect(
      toOriginalFileHashes({
        webhookFileDetails: { hash: 'webhook-abc', hashType: 'md5' },
      }),
    ).toEqual([{ _text: 'webhook-abc', _attributes: { hashType: 'MD5' } }]);
  });

  it('combines HMA and webhook hashes when both sources provide data', () => {
    expect(
      toOriginalFileHashes({
        hmaHashes: { md5: 'hma-md5', pdq: 'hma-pdq' },
        webhookFileDetails: { hash: 'webhook-sha1', hashType: 'sha1' },
      }),
    ).toEqual([
      { _text: 'hma-md5', _attributes: { hashType: 'MD5' } },
      { _text: 'hma-pdq', _attributes: { hashType: 'PDQ' } },
      { _text: 'webhook-sha1', _attributes: { hashType: 'SHA1' } },
    ]);
  });

  it('dedupes when HMA and webhook return the same (algorithm, hash) pair', () => {
    // Common case: both sources independently compute MD5 of the same
    // content. Single entry in the outgoing report instead of two.
    expect(
      toOriginalFileHashes({
        hmaHashes: { md5: 'same-value' },
        webhookFileDetails: { hash: 'same-value', hashType: 'md5' },
      }),
    ).toEqual([{ _text: 'same-value', _attributes: { hashType: 'MD5' } }]);
  });

  it('keeps both entries when HMA and webhook return the same algorithm but different hashes', () => {
    // Real conflict (different MD5 values for the same content) is signal
    // NCMEC investigators may care about; surface both rather than picking
    // a winner.
    expect(
      toOriginalFileHashes({
        hmaHashes: { md5: 'hma-md5' },
        webhookFileDetails: { hash: 'webhook-md5', hashType: 'md5' },
      }),
    ).toEqual([
      { _text: 'hma-md5', _attributes: { hashType: 'MD5' } },
      { _text: 'webhook-md5', _attributes: { hashType: 'MD5' } },
    ]);
  });

  it('drops a whitespace-only webhook hash', () => {
    expect(
      toOriginalFileHashes({
        webhookFileDetails: { hash: '   ', hashType: 'md5' },
      }),
    ).toBeUndefined();
  });

  it('dedupe is case-insensitive on the algorithm name', () => {
    // Webhook returns `MD5` uppercase; HMA returns `md5` lowercase. Same
    // algorithm, should dedupe on identical hash value.
    expect(
      toOriginalFileHashes({
        hmaHashes: { md5: 'shared' },
        webhookFileDetails: { hash: 'shared', hashType: 'MD5' },
      }),
    ).toEqual([{ _text: 'shared', _attributes: { hashType: 'MD5' } }]);
  });
});
