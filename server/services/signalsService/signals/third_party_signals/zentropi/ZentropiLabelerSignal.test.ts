import { ScalarTypes } from '@roostorg/types';

import { type CachedGetCredentials } from '../../../../signalAuthService/signalAuthService.js';
import { Integration } from '../../../types/Integration.js';
import { SignalType } from '../../../types/SignalType.js';
import { type SignalInput } from '../../SignalBase.js';
import ZentropiLabelerSignal from './ZentropiLabelerSignal.js';
import {
  type FetchZentropiScores,
  type ZentropiResponse,
} from './zentropiUtils.js';

type StringSignalInput = SignalInput<ScalarTypes['STRING']>;

function makeCredentialGetter(
  apiKey: string | undefined = 'test-api-key',
): CachedGetCredentials<'ZENTROPI'> {
  const fn = jest
    .fn()
    .mockResolvedValue(
      apiKey ? { apiKey } : undefined,
    ) as unknown as CachedGetCredentials<'ZENTROPI'>;
  fn.close = jest.fn().mockResolvedValue(undefined);
  return fn;
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

describe('ZentropiLabelerSignal', () => {
  it('has correct signal metadata', () => {
    const signal = new ZentropiLabelerSignal(makeCredentialGetter(), jest.fn());

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
      makeCredentialGetter(undefined),
      jest.fn(),
    );

    const info = await signal.getDisabledInfo('org-1');
    expect(info.disabled).toBe(true);
    expect(info.disabledMessage).toContain('Zentropi API key');
  });

  it('returns enabled info when credentials are present', async () => {
    const signal = new ZentropiLabelerSignal(
      makeCredentialGetter('key'),
      jest.fn(),
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
    );

    const result = await signal.run(makeInput());

    expect(result.score).toBe(0.88);
    expect(result.outputType).toEqual({ scalarType: ScalarTypes.NUMBER });
  });
});
