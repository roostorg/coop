import { SpanStatusCode } from '@opentelemetry/api';
import _ from 'lodash';
import stringify from 'safe-stable-stringify';
import { type ReadonlyDeep } from 'type-fest';

import { inject } from '../../iocContainer/utils.js';
import { type PolicyActionPenalties } from '../../models/OrgModel.js';
import { type MatchingValues } from '../../models/rules/matchingValues.js';
import { type LocationArea } from '../../models/types/locationArea.js';
import { jsonStringify } from '../../utils/encoding.js';
import { CoopError, ErrorType } from '../../utils/errors.js';
import type SafeTracer from '../../utils/SafeTracer.js';
import {
  isNonEmptyArray,
  type NonEmptyArray,
} from '../../utils/typescript-types.js';
import {
  type SignalId,
  type SignalInput,
  type SignalInputType,
  type SignalOutputType,
  type SignalResult,
  type SignalsService,
  type SignalType,
  type SignalTypesToRunInputTypes,
} from '../signalsService/index.js';
import { type HashBank } from '../hmaService/index.js';

const { memoize } = _;

// The exposed runSignal function takes the matchingValues as they're specified
// _in the condition_ (which is w/ reference to a text/media bank id) and
// resolves that id to the actual matchingValues that should be passed to the
// signal.
//
// NB: when we support custom signals, pg id of the signal should be
// an argument here too.
type RunSignalInput<T extends SignalType = SignalType> = Omit<
  SignalTypesToRunInputTypes[T],
  'matchingValues' | 'actionPenalties'
> & {
  matchingValues?: ReadonlyDeep<MatchingValues>;
  signal: SignalId;
};

export type TransientRunSignalWithCache = (
  input: RunSignalInput,
) => Promise<
  SignalResult<SignalOutputType> | { type: 'ERROR'; score: unknown }
>;

type LocationsLoader = (
  locationBankId: string,
) => Promise<ReadonlyDeep<LocationArea[]> | undefined>;

export default inject(
  [
    'getLocationBankLocationsEventuallyConsistent',
    'getTextBankStringsEventuallyConsistent',
    'getPolicyActionPenaltiesEventuallyConsistent',
    'getImageBankEventuallyConsistent',
    'SignalsService',
    'Tracer',
  ],
  (
    locationsLoader: LocationsLoader,
    textBankStringsLoader: (input: {
      orgId: string;
      bankId: string;
    }) => Promise<readonly string[] | undefined>,
    getPolicyActionPenalties: (orgId: string) => Promise<ReadonlyDeep<PolicyActionPenalties[]>>,
    getImageBank: (input: { orgId: string; bankId: string }) => Promise<HashBank | null>,
    signalsService: SignalsService,
    tracer: SafeTracer,
  ) =>
    /**
     * Returns a function that can run signals. This function takes care of caching
     * (in case the signal is run multiple times on the same content submission,
     * likely for different rules); bulk loading the inputs for signals (like text
     * bank matching values); and will eventually handle retries.
     *
     * The returned function is meant to be transient/ephemeral -- i.e., used for a
     * single ruleSet execution or a single content submission. Keeping this
     * function around long-term risks stale data (from its cache) being passed to
     * signals, like text/location bank data or action penalties.
     *
     * Because signals themselves don't handle retries (they just throw on an error),
     * a signal.run() call can never actually produce a ConditionFailureOutcome.
     * However, this function can, if a signal's retry budget is exhausted or the
     * error is identified as one that can't be retried, hence the return type.
     */
    function getTransientRunSignalWithCache(): TransientRunSignalWithCache {
      const loadActionPenalties = memoize(getPolicyActionPenalties);

      const textBanksStringsLoader = async (
        orgId: string,
        textBankIds: readonly string[],
      ) =>
        Promise.all(
          textBankIds.map(async (id) =>
            textBankStringsLoader({ orgId, bankId: id }),
          ),
        ).then(
          (bankResults) =>
            bankResults
              .filter((it): it is readonly string[] => Array.isArray(it))
              .flat() as readonly string[],
        );

      const imageBanksLoader = async (
        orgId: string,
        bankIds: readonly string[],
      ) =>
        Promise.all(
          bankIds.map(async (bankId) =>
            getImageBank({ orgId, bankId }),
          ),
        ).then(
          (bankResults) =>
            bankResults.filter((it): it is HashBank => it !== null),
        );

      // For running a signal for now with caching, we use a memoized function
      // but _do not_ use dataloader, because we can't actually run signals in a
      // batch, so dataloader's batching functionality will only serve to slow
      // things down (blocking all our results on the slowest one in the batch).
      //
      // NB: this method of generating the cache key may need to be updated when
      // we support custom signals, since they'll all use the same SignalType.
      return memoize(
        async (input: RunSignalInput) => {
          return runSignal(
            signalsService,
            locationsLoader,
            textBanksStringsLoader,
            imageBanksLoader,
            loadActionPenalties,
            tracer,
            input,
          );
        },
        ({ signal, ...signalInput }) => stringify([signal, signalInput]),
      );
    },
);

async function runSignal(
  signalsService: SignalsService,
  locationsLoader: LocationsLoader,
  textBanksStringsLoader: (
    orgId: string,
    bankIds: readonly string[],
  ) => Promise<readonly string[]>,
  imageBanksLoader: (
    orgId: string,
    bankIds: readonly string[],
  ) => Promise<HashBank[]>,
  actionPenaltiesLoader: (
    orgId: string,
  ) => Promise<ReadonlyDeep<PolicyActionPenalties[]>>,
  tracer: SafeTracer,
  signalInput: RunSignalInput,
) {
  return tracer.addActiveSpan(
    {
      operation: 'runSignal',
      resource: signalInput.signal.type,
      attributes: {
        signal: jsonStringify(signalInput.signal),
        orgId: signalInput.orgId,
        contentId: signalInput.contentId ?? '',
      },
    },
    async (span) => {
      try {
        const { orgId, signal: signalId, matchingValues } = signalInput;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const signalRef = { orgId, signalId } as any;
        const signal = await signalsService.getSignalOrThrow(signalRef);

        const [finalMatchingValues, finalActionPenalties] = await Promise.all([
          (async () => {
            if (!signal.needsMatchingValues) {
              return undefined;
            }

            const { locationBankIds, textBankIds, imageBankIds } = matchingValues ?? {};

            // A condition can have both strings and text banks as matching
            // values simultaneously (and same with locations and location
            // banks). So we first fetch all the "scalar" values (plain strings
            // & locations), then extract the "scalar" values stored in text &
            // location banks.
            const scalarMatchingValues =
              matchingValues?.strings ?? matchingValues?.locations ?? [];

            let matchingValuesFromBanks: readonly (string | ReadonlyDeep<LocationArea> | HashBank)[] = [];
            if (textBankIds?.length) {
              matchingValuesFromBanks = await textBanksStringsLoader(orgId, textBankIds);
            } else if (locationBankIds?.length) {
              matchingValuesFromBanks = await Promise.all(
                locationBankIds.map(async (id) => locationsLoader(id)),
              ).then((allBankLocations) =>
                allBankLocations
                  .filter((it): it is ReadonlyDeep<LocationArea>[] =>
                    Array.isArray(it),
                  )
                  .flat(),
              );
            } else if (imageBankIds?.length) {
              matchingValuesFromBanks = await imageBanksLoader(orgId, imageBankIds);
            }

            const loadedMatchingValues = [
              ...scalarMatchingValues,
              ...matchingValuesFromBanks,
            ];

            if (!isNonEmptyArray(loadedMatchingValues)) {
              throw new CoopError({
                status: 400,
                name: 'CoopError',
                type: [ErrorType.InvalidMatchingValues],
                shouldErrorSpan: true,
                title:
                  'Matching values were required, but none were found, or bank was empty.',
              });
            }

            return loadedMatchingValues satisfies NonEmptyArray<
              string | ReadonlyDeep<LocationArea> | HashBank
            > as
              | NonEmptyArray<string>
              | NonEmptyArray<ReadonlyDeep<LocationArea>>
              | NonEmptyArray<HashBank>;
          })(),
          signal.needsActionPenalties
            ? actionPenaltiesLoader(signalInput.orgId)
            : undefined,
        ]);

        const fullInput = {
          ...signalInput,
          actionPenalties: finalActionPenalties,
          matchingValues: finalMatchingValues,
        } as unknown as SignalInput<SignalInputType>;

        return await signalsService.runSignal({
          signal: signalRef,
          input: fullInput,
        });
      } catch (e) {
        if (e instanceof Error) {
          span.recordException(e);
        }
        span.setStatus({ code: SpanStatusCode.ERROR });
        return { type: 'ERROR' as const, score: e };
      }
    },
  );
}
