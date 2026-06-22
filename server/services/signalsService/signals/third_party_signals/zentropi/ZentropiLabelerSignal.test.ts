import { ScalarTypes } from '@roostorg/coop-types';

import { type CachedGetCredentials } from '../../../../signalAuthService/signalAuthService.js';
import { Integration } from '../../../types/Integration.js';
import { SignalType } from '../../../types/SignalType.js';
import { type SignalInput } from '../../SignalBase.js';
import { type FetchOpenAICompatibleScore } from '../openai_compatible/openaiCompatibleUtils.js';
import ZentropiLabelerSignal from './ZentropiLabelerSignal.js';
import {
  type FetchZentropiScores,
  type GetPolicyText,
  type ZentropiResponse,
} from './zentropiUtils.js';

type StringSignalInput = SignalInput<ScalarTypes['STRING']>;

function makeCredentialGetter(
  apiKey: string | null = 'test-api-key',
): CachedGetCredentials<'ZENTROPI'> {
  return Object.assign(
    jest
      .fn()
      .mockResolvedValue(
        apiKey ? { apiKey } : undefined,
      ) as unknown as CachedGetCredentials<'ZENTROPI'>,
    { close: jest.fn().mockResolvedValue(undefined) },
  );
}

function makeInput(
  overrides: Partial<StringSignalInput> = {},
): StringSignalInput {
  return {
    value: { type: 'STRING', value: 'test content' },
    matchingValues: undefined,
    actionPenalties: undefined,
    orgId: 'org-1',
    subcategory: 'lv_abc123',
    ...overrides,
  } as unknown as StringSignalInput;
}

function makeOpenAICompatibleFetcher(): FetchOpenAICompatibleScore {
  return Object.assign(
    jest
      .fn()
      .mockResolvedValue({ score: 0 }) as unknown as FetchOpenAICompatibleScore,
    { close: jest.fn().mockResolvedValue(undefined) },
  );
}

function makeGetPolicyText(): GetPolicyText {
  return jest.fn().mockResolvedValue(null);
}

describe('ZentropiLabelerSignal', () => {
  it('has correct signal metadata', () => {
    const signal = new ZentropiLabelerSignal(
      makeCredentialGetter(),
      jest.fn(),
      makeOpenAICompatibleFetcher(),
      makeGetPolicyText(),
    );

    expect(signal.id).toEqual({ type: SignalType.ZENTROPI_LABELER });
    expect(signal.displayName).toBe('Zentropi Labeler');
    expect(signal.integration).toBe(Integration.ZENTROPI);
    expect(signal.eligibleInputs).toEqual([ScalarTypes.STRING]);
    expect(signal.outputType).toEqual({ scalarType: ScalarTypes.NUMBER });
    expect(signal.allowedInAutomatedRules).toBe(true);
    expect(signal.needsMatchingValues).toBe(false);
    expect(signal.needsActionPenalties).toBe(false);
    expect(signal.eligibleSubcategories).toEqual([]);
    expect(signal.supportedLanguages).toBe('ALL');
    expect(signal.getCost()).toBe(20);
  });

  it('returns disabled info when credentials are missing', async () => {
    const signal = new ZentropiLabelerSignal(
      makeCredentialGetter(null),
      jest.fn(),
      makeOpenAICompatibleFetcher(),
      makeGetPolicyText(),
    );

    const info = await signal.getDisabledInfo('org-1');
    expect(info.disabled).toBe(true);
    expect(info.disabledMessage).toContain('Zentropi API key');
  });

  it('returns enabled info when credentials are present', async () => {
    const signal = new ZentropiLabelerSignal(
      makeCredentialGetter('key'),
      jest.fn(),
      makeOpenAICompatibleFetcher(),
      makeGetPolicyText(),
    );

    const info = await signal.getDisabledInfo('org-1');
    expect(info.disabled).toBe(false);
  });

  it('calls run and returns correct result', async () => {
    const fetchScores: FetchZentropiScores = jest.fn().mockResolvedValue({
      label: 1,
      confidence: 0.88,
    } satisfies ZentropiResponse);

    const signal = new ZentropiLabelerSignal(
      makeCredentialGetter(),
      fetchScores,
      makeOpenAICompatibleFetcher(),
      makeGetPolicyText(),
    );

    const result = await signal.run(makeInput());

    expect(result.score).toBe(0.88);
    expect(result.outputType).toEqual({ scalarType: ScalarTypes.NUMBER });
  });
});
