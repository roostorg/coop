import { type NormalizedItemData } from '../itemProcessingService/index.js';
import { extractHashesForUrl } from './buildSubmitReportParamsFromDecision.js';
import { toOriginalFileHashes } from './ncmecReporting.js';

const asNormalizedData = (data: Record<string, unknown>): NormalizedItemData =>
  data as unknown as NormalizedItemData;

const URL = 'https://x.test/a.png';

describe('extractHashesForUrl', () => {
  it('returns the hashes stored for the image', () => {
    const data = asNormalizedData({
      cover: { url: URL, hashes: { pdq: 'abc', md5: 'def' } },
    });
    expect(extractHashesForUrl(data, URL)).toEqual({ pdq: 'abc', md5: 'def' });
  });

  it('finds the image inside an array', () => {
    const data = asNormalizedData({
      images: [
        { url: 'https://x.test/other.png', hashes: { pdq: 'zzz' } },
        { url: URL, hashes: { pdq: 'abc' } },
      ],
    });
    expect(extractHashesForUrl(data, URL)).toEqual({ pdq: 'abc' });
  });

  it('never returns a CLIP embedding, which is not a file hash', () => {
    const data = asNormalizedData({
      cover: {
        url: URL,
        hashes: { pdq: 'abc' },
        embeddings: { clip_float: 'e'.repeat(4096) },
      },
    });
    expect(extractHashesForUrl(data, URL)).toEqual({ pdq: 'abc' });
  });

  it('returns nothing for an image that only has an embedding', () => {
    const data = asNormalizedData({
      cover: { url: URL, hashes: {}, embeddings: { clip_float: 'e' } },
    });
    expect(extractHashesForUrl(data, URL)).toBeUndefined();
  });

  it('keeps the embedding out of the hashes sent to NCMEC', () => {
    const data = asNormalizedData({
      cover: {
        url: URL,
        hashes: { pdq: 'abc' },
        embeddings: { clip_float: 'e'.repeat(4096) },
      },
    });
    expect(
      toOriginalFileHashes({ hmaHashes: extractHashesForUrl(data, URL) }),
    ).toEqual([{ _text: 'abc', _attributes: { hashType: 'PDQ' } }]);
  });
});
