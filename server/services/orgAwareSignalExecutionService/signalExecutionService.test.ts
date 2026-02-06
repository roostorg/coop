import { ScalarTypes } from '@roostorg/types';

import getBottle, { type Dependencies } from '../../iocContainer/index.js';
import { getBottleContainerWithIOMocks } from '../../test/setupMockedServer.js';
import { SignalType, type SignalsService } from '../signalsService/index.js';
import makeGetTransientRunSignalWithCache from './signalExecutionService.js';

describe('Signal Execution Service', () => {
  let container: Dependencies;
  let signalsService: SignalsService;
  let getPolicyActionPenalties: Dependencies['getPolicyActionPenaltiesEventuallyConsistent'];
  const mockLocationsLoader = async () => [];
  const mockTextBankStringsLoader = jest.fn(async ({ bankId }) =>
    bankId === '1' ? ['a', 'b', 'c'] : bankId === '2' ? ['d', 'e', 'f'] : [],
  );
  const mockGetImageBank = jest.fn(async ({ bankId }) =>
    bankId === 'test-bank' ? { id: 1, name: 'test-bank', hma_name: 'org_test-bank', description: null, enabled_ratio: 1.0, org_id: 'test-org', created_at: new Date(), updated_at: new Date() } : null,
  );

  // eslint-disable-next-line better-mutation/no-mutation
  mockLocationsLoader.close = jest.fn();
  // eslint-disable-next-line better-mutation/no-mutation
  (mockTextBankStringsLoader as any).close = jest.fn();
  // eslint-disable-next-line better-mutation/no-mutation, @typescript-eslint/no-explicit-any
  (mockGetImageBank as any).close = jest.fn();

  describe('getTransientRunSignalWithCache', () => {
    beforeAll(async () => {
      // No mutation rule here is a false positive, since this is more initial
      // setup (we're never gonna reassign again later) that simply has to use
      // `let` vars to defer the work until the test suite is actually running
      // (so we don't bother w/ it if this test suite is skipped, e.g., in which
      // case cleanup wouldn't happen).
      /* eslint-disable better-mutation/no-mutation */
      container = await getBottleContainerWithIOMocks();
      signalsService = container.SignalsService;
      getPolicyActionPenalties =
        container.getPolicyActionPenaltiesEventuallyConsistent;
      /* eslint-enable better-mutation/no-mutation */
    });

    afterAll(async () => {
      await container.closeSharedResourcesForShutdown();
    }, 20_000);

    beforeEach(() => {
      // This is only safe while we're not running tests concurrently.
      // Consider using the `makeTestWithFixture` helper instead to make
      // a local copy of this state for each test.
      jest.clearAllMocks();
    });

    test('should batch textBank loads w/i a single tick', async () => {
      const runSignal = makeGetTransientRunSignalWithCache(
        mockLocationsLoader,
        mockTextBankStringsLoader,
        getPolicyActionPenalties,
        mockGetImageBank,
        signalsService,
        container.Tracer,
      )();

      const signalInputs = [
        {
          signal: { type: SignalType.TEXT_MATCHING_CONTAINS_REGEX },
          value: { type: ScalarTypes.STRING, value: 'a' },
          matchingValues: {
            textBankIds: ['1'],
          },
          threshold: null,
          comparator: null,
          userId: 'dummy',
          orgId: 'dummmy',
        },
        {
          signal: { type: SignalType.TEXT_MATCHING_CONTAINS_TEXT },
          value: { type: ScalarTypes.STRING, value: 'a' },
          matchingValues: {
            textBankIds: ['2'],
          },
          threshold: null,
          comparator: null,
          userId: 'dummy',
          orgId: 'dummmy',
        },
      ] as const;

      const results = await Promise.all(signalInputs.map(runSignal));
      expect(mockTextBankStringsLoader).toHaveBeenCalledTimes(2);
      expect(mockTextBankStringsLoader.mock.calls).toMatchInlineSnapshot(`
        [
          [
            {
              "bankId": "1",
              "orgId": "dummmy",
            },
          ],
          [
            {
              "bankId": "2",
              "orgId": "dummmy",
            },
          ],
        ]
      `);

      expect(results).toEqual([
        {
          score: true,
          outputType: { scalarType: ScalarTypes.BOOLEAN },
          matchedValue: 'a',
        },
        {
          score: false,
          outputType: { scalarType: ScalarTypes.BOOLEAN },
          matchedValue: undefined,
        },
      ]);
    });

    test('should not re-run the same signal with the same input', async () => {
      // NB: this test actually does run the signals, but that's fine; these
      // signals don't hit the network. (The point of the mock is just so we can
      // spy on how many times runSignal was called.)
      const signalsServiceSpy = (await getBottle()).container.SignalsService;
      // eslint-disable-next-line better-mutation/no-mutation
      signalsServiceSpy.runSignal = jest.fn(
        signalsServiceSpy.runSignal.bind(signalsServiceSpy),
      ) as any;

      const runSignal = makeGetTransientRunSignalWithCache(
        mockLocationsLoader,
        mockTextBankStringsLoader,
        getPolicyActionPenalties,
        mockGetImageBank,
        signalsServiceSpy,
        container.Tracer,
      )();

      const signalInputs = [
        {
          signal: { type: SignalType.TEXT_MATCHING_CONTAINS_REGEX },
          value: { type: ScalarTypes.STRING, value: 'a' },
          matchingValues: {
            textBankIds: ['1'],
          },
          threshold: null,
          comparator: null,
          userId: 'dummy',
          orgId: 'dummmy',
        },
        {
          signal: { type: SignalType.TEXT_MATCHING_CONTAINS_REGEX },
          value: { type: ScalarTypes.STRING, value: 'a' },
          matchingValues: {
            textBankIds: ['1'],
          },
          threshold: null,
          comparator: null,
          userId: 'dummy',
          orgId: 'dummmy',
        },
      ] as const;

      const results = await Promise.all(signalInputs.map(runSignal));
      expect(signalsServiceSpy.runSignal).toHaveBeenCalledTimes(1);
      expect(results).toEqual([
        {
          matchedValue: 'a',
          score: true,
          outputType: { scalarType: ScalarTypes.BOOLEAN },
        },
        {
          matchedValue: 'a',
          score: true,
          outputType: { scalarType: ScalarTypes.BOOLEAN },
        },
      ]);
    });
  });
});
