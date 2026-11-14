import { type ScalarTypes } from '@roostorg/coop-types';
import { vi } from 'vitest';

import { jsonParse, type JsonOf } from '../../../utils/encoding.js';
import { type HashBank, type HmaService } from '../../hmaService/index.js';
import ImageClipMatch from './ImageClipMatch.js';
import { type SignalInput } from './SignalBase.js';

type MatchSignalInput = SignalInput<ScalarTypes['IMAGE'], true>;
type MatchedValuePayload = { matchedBanks: string[] };

const EMBEDDING = 'ab'.repeat(2048);

function makeBank(overrides: Partial<HashBank> = {}): HashBank {
  return {
    id: 1,
    name: 'Clip Bank',
    hma_name: 'ORG_CLIP_BANK',
    description: null,
    enabled_ratio: 1,
    org_id: 'org-1',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

const clipBank = makeBank();
const otherClipBank = makeBank({
  id: 2,
  name: 'Other Clip Bank',
  hma_name: 'ORG_OTHER_CLIP_BANK',
});

function makeSignal(
  hma: Partial<Pick<HmaService, 'findClosestClipMatch' | 'isClipEnabled'>> = {},
) {
  const hmaService = {
    isClipEnabled: vi.fn().mockReturnValue(true),
    findClosestClipMatch: vi
      .fn()
      .mockResolvedValue({ matchedBanks: [], closestDistance: undefined }),
    ...hma,
  };
  return {
    signal: new ImageClipMatch(hmaService as unknown as HmaService),
    hmaService,
  };
}

const makeInput = (
  image: Record<string, unknown>,
  banks: HashBank[],
): MatchSignalInput =>
  ({
    value: {
      type: 'IMAGE',
      value: { url: 'https://example.com/a.png', ...image },
    },
    matchingValues: banks,
    orgId: 'org-1',
    actionPenalties: undefined,
  }) as unknown as MatchSignalInput;

const withEmbedding = { embeddings: { clip_float: EMBEDDING } };

describe('ImageClipMatchSignal', () => {
  describe('scoring', () => {
    it('scores the similarity of the closest match, and names the matched banks', async () => {
      const { signal, hmaService } = makeSignal({
        findClosestClipMatch: vi.fn().mockResolvedValue({
          matchedBanks: ['ORG_CLIP_BANK'],
          closestDistance: 0.04,
        }),
      });

      const result = await signal.run(makeInput(withEmbedding, [clipBank]));

      expect(result.outputType).toEqual({ scalarType: 'NUMBER' });
      expect(result.score).toBeCloseTo(0.96, 10);
      expect(
        jsonParse(result.matchedValue as JsonOf<MatchedValuePayload>),
      ).toEqual({ matchedBanks: ['Clip Bank'] });
      expect(hmaService.findClosestClipMatch).toHaveBeenCalledWith(
        ['ORG_CLIP_BANK'],
        EMBEDDING,
      );
    });

    it('scores an identical image 1', async () => {
      const { signal } = makeSignal({
        findClosestClipMatch: vi.fn().mockResolvedValue({
          matchedBanks: ['ORG_CLIP_BANK'],
          closestDistance: 0,
        }),
      });
      const result = await signal.run(makeInput(withEmbedding, [clipBank]));
      expect(result.score).toBe(1);
    });

    it('scores 0, with no matched banks, when nothing is close enough', async () => {
      const { signal } = makeSignal();
      const result = await signal.run(makeInput(withEmbedding, [clipBank]));
      expect(result.score).toBe(0);
      expect(result.matchedValue).toBeUndefined();
    });

    it.each([
      ['a slightly negative distance', -1e-7, 1],
      ['a distance above 1', 1.4, 0],
    ])(
      'keeps the score within 0 and 1 for %s',
      async (_name, distance, score) => {
        const { signal } = makeSignal({
          findClosestClipMatch: vi.fn().mockResolvedValue({
            matchedBanks: ['ORG_CLIP_BANK'],
            closestDistance: distance,
          }),
        });
        const result = await signal.run(makeInput(withEmbedding, [clipBank]));
        expect(result.score).toBe(score);
      },
    );

    it('looks in every selected bank at once and names each one that matched', async () => {
      const { signal, hmaService } = makeSignal({
        findClosestClipMatch: vi.fn().mockResolvedValue({
          matchedBanks: ['ORG_CLIP_BANK', 'ORG_OTHER_CLIP_BANK'],
          closestDistance: 0.02,
        }),
      });
      const result = await signal.run(
        makeInput(withEmbedding, [clipBank, otherClipBank]),
      );
      expect(hmaService.findClosestClipMatch).toHaveBeenCalledWith(
        ['ORG_CLIP_BANK', 'ORG_OTHER_CLIP_BANK'],
        EMBEDDING,
      );
      expect(
        jsonParse(result.matchedValue as JsonOf<MatchedValuePayload>),
      ).toEqual({ matchedBanks: ['Clip Bank', 'Other Clip Bank'] });
    });
  });

  describe('when no score can be determined', () => {
    const expectPermanentError = async (
      promise: Promise<unknown>,
      title: string,
    ) => {
      await expect(promise).rejects.toMatchObject({
        name: 'SignalPermanentError',
        title,
      });
    };

    it('is a permanent error when the image has no embedding', async () => {
      const { signal, hmaService } = makeSignal();
      await expectPermanentError(
        signal.run(makeInput({ hashes: { pdq: 'abc' } }, [clipBank])),
        'This image has no CLIP embedding',
      );
      expect(hmaService.findClosestClipMatch).not.toHaveBeenCalled();
    });

    it('does not read a CLIP value out of `hashes`', async () => {
      const { signal } = makeSignal();
      await expectPermanentError(
        signal.run(
          makeInput({ hashes: { clip_float: EMBEDDING } }, [clipBank]),
        ),
        'This image has no CLIP embedding',
      );
    });

    it.each([
      ['an empty embedding', { embeddings: { clip_float: '' } }],
      ['an empty embeddings object', { embeddings: {} }],
      [
        'an embedding that is not hex',
        { embeddings: { clip_float: 'z'.repeat(4096) } },
      ],
    ])('is a permanent error for %s', async (_name, image) => {
      const { signal } = makeSignal();
      await expectPermanentError(
        signal.run(makeInput(image, [clipBank])),
        'This image has no CLIP embedding',
      );
    });

    it('is a permanent error when no banks were selected', async () => {
      const { signal, hmaService } = makeSignal();
      await expectPermanentError(
        signal.run(makeInput(withEmbedding, [])),
        'No hash banks were selected',
      );
      expect(hmaService.findClosestClipMatch).not.toHaveBeenCalled();
    });

    it('is a permanent error when CLIP is not deployed', async () => {
      const { signal } = makeSignal({
        isClipEnabled: vi.fn().mockReturnValue(false),
      });
      await expectPermanentError(
        signal.run(makeInput(withEmbedding, [clipBank])),
        'CLIP is not available',
      );
    });

    it.each([
      [
        'an image without an embedding',
        async () => makeSignal().signal.run(makeInput({}, [clipBank])),
      ],
      [
        'no selected banks',
        async () => makeSignal().signal.run(makeInput(withEmbedding, [])),
      ],
      [
        'CLIP not being enabled',
        async () =>
          makeSignal({
            isClipEnabled: vi.fn().mockReturnValue(false),
          }).signal.run(makeInput(withEmbedding, [clipBank])),
      ],
    ])(
      'does not mark the trace as failed for %s, since these cases are expected',
      async (_name, run) => {
        const error: unknown = await run().catch((e: unknown) => e);
        expect(error).toMatchObject({
          name: 'SignalPermanentError',
          shouldErrorSpan: false,
        });
      },
    );
  });

  it('lets an error from HMA through, to be retried, not treated as a non-match', async () => {
    const failure = new Error('CLIP down');
    const { signal } = makeSignal({
      findClosestClipMatch: vi.fn().mockRejectedValue(failure),
    });
    const error: unknown = await signal
      .run(makeInput(withEmbedding, [clipBank]))
      .catch((e: unknown) => e);
    expect(error).toBe(failure);
    expect(error).not.toMatchObject({ name: 'SignalPermanentError' });
  });

  describe('availability', () => {
    it('is enabled where the operator has enabled CLIP', async () => {
      await expect(makeSignal().signal.getDisabledInfo()).resolves.toEqual({
        disabled: false,
      });
    });

    it('is disabled, with a pointer to the guide, where CLIP is not enabled', async () => {
      const { signal } = makeSignal({
        isClipEnabled: vi.fn().mockReturnValue(false),
      });
      await expect(signal.getDisabledInfo()).resolves.toEqual({
        disabled: true,
        disabledMessage: expect.stringContaining('HMA with CLIP'),
      });
    });
  });

  it('describes itself as a numeric score over images that needs banks', () => {
    const { signal } = makeSignal();
    expect(signal.id).toEqual({ type: 'IMAGE_CLIP_MATCH' });
    expect(signal.outputType).toEqual({ scalarType: 'NUMBER' });
    expect(signal.eligibleInputs).toEqual(['IMAGE']);
    expect(signal.needsMatchingValues).toBe(true);
    expect(signal.allowedInAutomatedRules).toBe(true);
    expect(signal.integration).toBeNull();
  });
});
