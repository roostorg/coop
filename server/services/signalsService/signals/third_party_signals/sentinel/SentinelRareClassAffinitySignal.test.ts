import { ScalarTypes } from '@roostorg/coop-types';
import { vi, type Mock } from 'vitest';

import { type ItemInvestigationService } from '../../../../itemInvestigationService/index.js';
import {
  SentinelServiceError,
  type SentinelService,
} from '../../../../sentinelService/sentinelService.js';
import { Integration } from '../../../types/Integration.js';
import { SignalPricingStructure } from '../../../types/SignalPricingStructure.js';
import { SignalType } from '../../../types/SignalType.js';
import { type SignalInput } from '../../SignalBase.js';
import SentinelRareClassAffinitySignal from './SentinelRareClassAffinitySignal.js';

type SentinelSignalInput = SignalInput<
  ScalarTypes['STRING'],
  false,
  false,
  string,
  'SENTINEL_RARE_CLASS_AFFINITY'
>;

function makeInput(
  overrides: Partial<SentinelSignalInput> = {},
): SentinelSignalInput {
  return {
    value: { type: 'STRING', value: 'test content' },
    matchingValues: undefined,
    actionPenalties: undefined,
    orgId: 'org-1',
    ...overrides,
  } as unknown as SentinelSignalInput;
}

function makeSentinelService(
  overrides: Partial<SentinelService> = {},
): SentinelService {
  return {
    healthCheck: vi
      .fn()
      .mockResolvedValue({ status: 'ok', banks_loaded: true }),
    getBanksStatus: vi.fn().mockResolvedValue({ loaded: true }),
    scoreTexts: vi.fn().mockResolvedValue({
      rare_class_affinity_score: 0.5,
      observation_scores: { 'test content': 0.5 },
      num_observations: 1,
    }),
    scoreSingleText: vi.fn().mockResolvedValue(0.5),
    loadBanks: vi.fn().mockResolvedValue(undefined),
    unloadBanks: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

type MockItemInvestigationService = {
  insertItem: Mock;
  getThreadSubmissionsByPosition: Mock;
  getThreadSubmissionsByTime: Mock;
  getItemByIdentifier: Mock;
  getItemByTypeAgnosticIdentifier: Mock;
  getAncestorItems: Mock;
  getItemSubmissionsByCreator: Mock;
  getItemActionHistory: Mock;
};

function makeItemInvestigationService(
  overrides: Partial<MockItemInvestigationService> = {},
): MockItemInvestigationService {
  return {
    insertItem: vi.fn().mockResolvedValue(undefined),
    getThreadSubmissionsByPosition: vi.fn(),
    getThreadSubmissionsByTime: vi.fn().mockReturnValue(
      (async function* () {
        // Empty async iterable by default
      })(),
    ),
    getItemByIdentifier: vi.fn(),
    getItemByTypeAgnosticIdentifier: vi.fn(),
    getAncestorItems: vi.fn(),
    getItemSubmissionsByCreator: vi.fn(),
    getItemActionHistory: vi.fn(),
    ...overrides,
  };
}

function makeSignal(
  sentinelService?: Partial<SentinelService>,
  iisOverrides?: Partial<MockItemInvestigationService>,
) {
  return new SentinelRareClassAffinitySignal(
    makeSentinelService(sentinelService),
    makeItemInvestigationService(
      iisOverrides,
    ) as unknown as ItemInvestigationService,
  );
}

describe('SentinelRareClassAffinitySignal', () => {
  describe('signal metadata', () => {
    it('returns correct id', () => {
      expect(makeSignal().id).toEqual({
        type: SignalType.SENTINEL_RARE_CLASS_AFFINITY,
      });
    });

    it('returns correct integration', () => {
      expect(makeSignal().integration).toBe(Integration.SENTINEL);
    });

    it('returns STRING as eligible input type', () => {
      expect(makeSignal().eligibleInputs).toEqual([ScalarTypes.STRING]);
    });

    it('returns NUMBER as output type', () => {
      expect(makeSignal().outputType).toEqual({
        scalarType: ScalarTypes.NUMBER,
      });
    });

    it('returns FREE pricing structure', () => {
      expect(makeSignal().pricingStructure).toBe(SignalPricingStructure.FREE);
    });

    it('is allowed in automated rules', () => {
      expect(makeSignal().allowedInAutomatedRules).toBe(true);
    });

    it('does not need matching values', () => {
      expect(makeSignal().needsMatchingValues).toBe(false);
    });

    it('does not need action penalties', () => {
      expect(makeSignal().needsActionPenalties).toBe(false);
    });

    it('has no eligible subcategories', () => {
      expect(makeSignal().eligibleSubcategories).toEqual([]);
    });

    it('returns ALL as supported languages', () => {
      expect(makeSignal().supportedLanguages).toBe('ALL');
    });
  });

  describe('getDisabledInfo', () => {
    it('returns disabled=false when service is healthy and banks are loaded', async () => {
      const info = await makeSignal().getDisabledInfo('org-1');
      expect(info.disabled).toBe(false);
    });

    it('returns disabled=true when health check fails', async () => {
      const signal = makeSignal({
        healthCheck: vi.fn().mockRejectedValue(new Error('Connection refused')),
      });
      const info = await signal.getDisabledInfo('org-1');
      expect(info.disabled).toBe(true);
      expect(info.disabledMessage).toContain('unavailable');
    });

    it('returns disabled=true when health status is not ok', async () => {
      const signal = makeSignal({
        healthCheck: vi
          .fn()
          .mockResolvedValue({ status: 'error', banks_loaded: false }),
      });
      const info = await signal.getDisabledInfo('org-1');
      expect(info.disabled).toBe(true);
      expect(info.disabledMessage).toContain('not healthy');
    });

    it('returns disabled=true when banks are not loaded', async () => {
      const signal = makeSignal({
        getBanksStatus: vi.fn().mockResolvedValue({ loaded: false }),
      });
      const info = await signal.getDisabledInfo('org-1');
      expect(info.disabled).toBe(true);
      expect(info.disabledMessage).toContain('banks are not loaded');
    });
  });

  describe('run', () => {
    it('scores the primary text and returns rare_class_affinity_score', async () => {
      const scoreTexts = vi.fn().mockResolvedValue({
        rare_class_affinity_score: 0.72,
        observation_scores: { 'test content': 0.72 },
        num_observations: 1,
      });
      const signal = makeSignal({ scoreTexts });

      const result = await signal.run(makeInput());

      expect(scoreTexts).toHaveBeenCalledWith(
        expect.objectContaining({
          texts: expect.arrayContaining(['test content']),
        }),
      );
      expect(result).toMatchObject({
        outputType: { scalarType: ScalarTypes.NUMBER },
        score: 0.72,
      });
    });

    it('includes thread context texts when threadIdentifier is provided', async () => {
      const scoreTexts = vi.fn().mockResolvedValue({
        rare_class_affinity_score: 0.85,
        observation_scores: {},
        num_observations: 2,
      });

      // Async iterable that yields one prior thread item
      const threadItem = {
        latestSubmission: {
          data: { text: 'prior thread message' },
          itemType: { kind: 'CONTENT', schema: [], schemaFieldRoles: {} },
        },
        priorSubmissions: undefined,
        parents: (async function* () {})(),
      };
      const getThreadSubmissionsByTime = vi.fn().mockReturnValue(
        (async function* () {
          yield threadItem;
        })(),
      );

      const signal = makeSignal({ scoreTexts }, { getThreadSubmissionsByTime });

      await signal.run(
        makeInput({
          runtimeArgs: {
            threadIdentifier: { id: 'thread-1', typeId: 'content-type-1' },
            contentTextFieldName: 'text',
          },
        }),
      );

      const texts = scoreTexts.mock.calls[0][0].texts;
      expect(texts).toContain('test content');
      expect(texts).toContain('prior thread message');
    });

    it('does not double-count the triggering submission when it is echoed back as thread context', async () => {
      // submitContent.ts writes the current submission to Scylla before
      // running rules, so getThreadSubmissionsByTime (which is time-bounded,
      // not identity-bounded) can return the very submission that triggered
      // this signal run alongside genuine prior messages.
      const scoreTexts = vi.fn().mockResolvedValue({
        rare_class_affinity_score: 0.5,
        observation_scores: {},
        num_observations: 2,
      });

      const priorItem = {
        latestSubmission: {
          data: { text: 'prior thread message' },
          itemType: { kind: 'CONTENT', schema: [], schemaFieldRoles: {} },
        },
        priorSubmissions: undefined,
        parents: (async function* () {})(),
      };
      const selfItem = {
        latestSubmission: {
          data: { text: 'test content' },
          itemType: { kind: 'CONTENT', schema: [], schemaFieldRoles: {} },
        },
        priorSubmissions: undefined,
        parents: (async function* () {})(),
      };
      const getThreadSubmissionsByTime = vi.fn().mockReturnValue(
        (async function* () {
          yield selfItem;
          yield priorItem;
        })(),
      );

      const signal = makeSignal({ scoreTexts }, { getThreadSubmissionsByTime });

      await signal.run(
        makeInput({
          runtimeArgs: {
            threadIdentifier: { id: 'thread-1', typeId: 'content-type-1' },
            contentTextFieldName: 'text',
          },
        }),
      );

      const texts = scoreTexts.mock.calls[0][0].texts;
      expect(texts).toEqual(['test content', 'prior thread message']);
    });

    it('only drops one occurrence of duplicate text, in case a genuine duplicate message exists', async () => {
      const scoreTexts = vi.fn().mockResolvedValue({
        rare_class_affinity_score: 0.5,
        observation_scores: {},
        num_observations: 3,
      });

      const makeItem = (text: string) => ({
        latestSubmission: {
          data: { text },
          itemType: { kind: 'CONTENT', schema: [], schemaFieldRoles: {} },
        },
        priorSubmissions: undefined,
        parents: (async function* () {})(),
      });
      const getThreadSubmissionsByTime = vi.fn().mockReturnValue(
        (async function* () {
          yield makeItem('test content');
          yield makeItem('test content');
        })(),
      );

      const signal = makeSignal({ scoreTexts }, { getThreadSubmissionsByTime });

      await signal.run(
        makeInput({
          runtimeArgs: {
            threadIdentifier: { id: 'thread-1', typeId: 'content-type-1' },
            contentTextFieldName: 'text',
          },
        }),
      );

      const texts = scoreTexts.mock.calls[0][0].texts;
      expect(texts).toEqual(['test content', 'test content']);
    });

    it('still returns a score when thread fetch fails', async () => {
      const scoreTexts = vi.fn().mockResolvedValue({
        rare_class_affinity_score: 0.5,
        observation_scores: { 'test content': 0.5 },
        num_observations: 1,
      });
      const getThreadSubmissionsByTime = vi.fn().mockImplementation(() => {
        throw new Error('Scylla unavailable');
      });

      const signal = makeSignal({ scoreTexts }, { getThreadSubmissionsByTime });

      const result = await signal.run(
        makeInput({
          runtimeArgs: {
            threadIdentifier: { id: 'thread-1', typeId: 'content-type-1' },
          },
        }),
      );

      // Should still score with just the primary text
      expect(result).toMatchObject({ score: 0.5 });
      expect(scoreTexts).toHaveBeenCalledWith(
        expect.objectContaining({ texts: ['test content'] }),
      );
    });

    it('returns an error result when Sentinel service throws SentinelServiceError', async () => {
      const signal = makeSignal({
        scoreTexts: vi
          .fn()
          .mockRejectedValue(new SentinelServiceError('Banks not loaded', 503)),
      });
      const result = await signal.run(makeInput());
      expect(result.type).toBe('ERROR');
    });

    it('re-throws non-SentinelServiceError exceptions', async () => {
      const signal = makeSignal({
        scoreTexts: vi.fn().mockRejectedValue(new Error('Unexpected error')),
      });
      await expect(signal.run(makeInput())).rejects.toThrow('Unexpected error');
    });
  });
});
