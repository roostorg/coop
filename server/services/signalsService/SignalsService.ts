/* eslint-disable max-lines */
import { type ConsumerDirectives } from '../../lib/cache/index.js';
import { type ReadonlyDeep, type Simplify } from 'type-fest';

import { inject, type Dependencies } from '../../iocContainer/index.js';
import { isTaggedItemData } from '../../models/rules/item-type-fields.js';
import { jsonStringify } from '../../utils/encoding.js';
import { CoopError, ErrorType, makeNotFoundError } from '../../utils/errors.js';
import { __throw, assertUnreachable } from '../../utils/misc.js';
import { type CollapseCases } from '../../utils/typescript-types.js';
import { getIntegrationRegistry } from '../integrationRegistry/index.js';
import { instantiateBuiltInSignals } from './helpers/instantiateBuiltInSignals.js';
import { loadPluginSignals } from './helpers/loadPluginSignals.js';
import { makeCachedCredentialGetters } from './helpers/makeCachedCredentialsGetters.js';
import { makeCachedFetchers } from './helpers/makeCachedFetchers.js';
import {
  signalIsExternal,
  type SignalId,
  type SignalInputType,
  type SignalOutputType,
  type SignalType,
} from './index.js';
import type UnusedCustomSignal from './signals/CustomSignal.js';
import {
  type SignalBase,
  type SignalDisabledInfo,
} from './signals/SignalBase.js';

const publicSignalProps = [
  'id',
  'type',
  'displayName',
  'description',
  'docsUrl',
  'recommendedThresholds',
  'supportedLanguages',
  'pricingStructure',
  'eligibleInputs',
  'outputType',
  'needsMatchingValues',
  'needsActionPenalties',
  'eligibleSubcategories',
  'getCost',
  'integration',
  'allowedInAutomatedRules',
] as const;

/**
 * This is the primary, public representation of signals returned from this
 * service. When we expose signals from this class, we specifically we don't
 * expose:
 *
 * - run(), because we want to force all signal runs to go through this service,
 *   where we can add retries/error handling and the like.
 *
 * - whether the signal is disabled, which varies by org even for the "same"
 *   signal (according to signal id), and so can't be a property of the signal
 *   itself.
 */
export type Signal = Simplify<
  Pick<
    SignalBase<
      SignalInputType,
      SignalOutputType,
      unknown,
      SignalType | string
    >,
    (typeof publicSignalProps)[number]
  >
>;

/**
 * A signal is genuinely identifiable by only its SignalId, without needing an
 * orgId, in the sense that that gives us all the info we need to instantiate
 * the signal class and run it. However, while signals are identifiable without
 * an org id, not every org should be able to see or run every signal;
 * specifically, custom signals and Coop model signals created by one org must
 * not be usable by, or even visible to, other orgs. (This goes beyond whether a
 * beyond whether a visible signal is currently disabled for an org.)
 *
 * To enforce that uniformly, we make the SignalsService take an
 * `SignalReference` for every signal lookup, which includes the orgId! We
 * intentionally do not call this something like `OrgScopedSignalId`, as the
 * `id` field of the returned `Signal` still holds a `SignalId`, and the
 * returned signal still does not contain org-derived properties (like
 * disabled); to do otherwise would be super confusing, as it would introduce
 * multiple forms of signal ids _used publicly outside this service_, given that
 * Conditions already use `SignalId`.
 *
 * NB: below, we treat the case where T = SignalType specially, so that the
 * result type is simpler (but logically equivalent to the result if we didn't
 * apply special casing), which helps TS with inference in many places.
 */
export type SignalReference<T extends SignalType = SignalType> =
  SignalType extends T
    ? { orgId: string; signalId: SignalId }
    : CollapseCases<
        { [K in T]: { orgId: string; signalId: SignalId & { type: K } } }[T]
      >;

type BuiltInSignalsByType = ReturnType<typeof instantiateBuiltInSignals>;
type SignalClassByType = BuiltInSignalsByType & {
  CUSTOM: UnusedCustomSignal;
};

export type SignalTypesToRunInputTypes = {
  [K in SignalType]: Parameters<SignalClassByType[K]['run']>[0];
};

export type SignalTypesToRunOutputTypes = {
  [K in SignalType]: ReturnType<SignalClassByType[K]['run']>;
};

/** All signals by type: built-in + plugin. Used for lookup and getSignalsForOrg. */
type SignalsByType = Record<
  string,
  SignalBase<SignalInputType, SignalOutputType, unknown, SignalType | string>
>;

export class SignalsService {
  public readonly close: () => Promise<void>;

  private readonly builtInSignalsByType: BuiltInSignalsByType;
  private readonly signalsByType: SignalsByType;

  constructor(
    private readonly tracer: Dependencies['Tracer'],
    private readonly moderationConfigService: Dependencies['ModerationConfigService'],
    private readonly aggregationsService: Dependencies['AggregationsService'],
    private readonly userStrikeService: Dependencies['UserStrikeService'],
    private readonly getPoliciesByIdEventuallyConsistent: Dependencies['getPoliciesByIdEventuallyConsistent'],
    private readonly hmaService: Dependencies['HMAHashBankService'],
    signalAuthService: Dependencies['SignalAuthService'],
    getUserScoreEventuallyConsistent: Dependencies['getUserScoreEventuallyConsistent'],
    fetchHTTP: Dependencies['fetchHTTP'],
  ) {
    const cachedCredentialGetters =
      makeCachedCredentialGetters(signalAuthService);

    const cachedFetchers = makeCachedFetchers(
      fetchHTTP,
      tracer,
    );

    this.builtInSignalsByType = instantiateBuiltInSignals(
      cachedCredentialGetters,
      cachedFetchers,
      getUserScoreEventuallyConsistent,
      this.aggregationsService,
      this.userStrikeService,
      this.getPoliciesByIdEventuallyConsistent,
      this.hmaService,
    );

    const pluginEntries = getIntegrationRegistry().getPluginEntries();
    const pluginSignals = loadPluginSignals(pluginEntries, signalAuthService);
    this.signalsByType = {
      ...this.builtInSignalsByType,
      ...pluginSignals,
    };

    this.close = async function () {
      await cachedCredentialGetters.close();
      await Promise.all(
        Object.values(cachedFetchers).map(async (it) => it.close()),
      );
    };
  }

  /**
   * Returns all signals usable by an org, whether or not they're enabled.
   *
   * It filters out internal signals by default, which are usable by an org
   * indirectly as part of derived field calculations, but shouldn't be visible
   * in the UI for direct use through rules.
   *
   * It applies no caching by default, but this can/should be overriden for
   * cases where freshness isn't critical.
   */
  public async getSignalsForOrg(opts: {
    orgId: string;
    externalOnly?: boolean;
    directives?: ConsumerDirectives;
  }): Promise<Signal[]> {
    const { orgId, externalOnly = true } = opts;

    const allSignals = Object.values(this.signalsByType).filter((signal) =>
      isSignalEnabledForOrg(signal.id, orgId),
    );

    const finalSignals = externalOnly
      ? allSignals.filter((it) => signalIsExternal(it.id))
      : allSignals;

    return finalSignals.map((it) => this.#signalInstanceToPublicSignal(it));
  }

  async #getSignalInstance<T extends SignalType>(
    ref: SignalReference<T>,
  ): Promise<
    | SignalBase<
        SignalInputType,
        SignalOutputType,
        unknown,
        SignalType | string
      >
    | undefined
  > {
    const { signalId } = ref;

    if (signalId.type === 'CUSTOM') {
      throw new Error('not implemented');
    }

    return this.signalsByType[signalId.type];
  }

  public async getSignal<T extends SignalType>(ref: SignalReference<T>) {
    const signal = await this.#getSignalInstance(ref);
    return signal && this.#signalInstanceToPublicSignal(signal);
  }

  public async getSignalOrThrow<T extends SignalType>(ref: SignalReference<T>) {
    const signal = await this.getSignal(ref);
    return signal ?? __throw(makeSignalNotFoundError(ref));
  }

  public async getSignalDisabledForOrg(
    ref: SignalReference,
  ): Promise<SignalDisabledInfo | undefined> {
    const signal = await this.#getSignalInstance(ref);
    return signal?.getDisabledInfo(ref.orgId);
  }

  /**
   * A note on type safety: to make this safe, we need to make sure that the
   * type of the `input` matches the expected input type for the specific signal
   * `type` given in `opts.signal.type`. I.e., the type of the signal id and the
   * type of the `input` must be correlated. The type signature used here _does_
   * capture that, and will work very well if `T` is instantiated with a single
   * signal type. Eg, `runSignal<"BENIGN_MODEL">(..)` gives very good inferred
   * argument types. However, when `T` is not known precisely at compile time at
   * the call site, this argument type is gonna be very hard to satisfy (and
   * rightfully so -- the call probably isn't type safe), so the caller will
   * likely need to cast.
   */
  public async runSignal<T extends SignalType>(
    opts: {
      [Type in T]: {
        signal: SignalReference<Type>;
        input: SignalTypesToRunInputTypes[Type];
      };
    }[T],
  ): Promise<Awaited<SignalTypesToRunOutputTypes[T]>> {
    const { signal: signalRef, input } = opts;
    const signal = await this.#getSignalInstance(signalRef);

    if (!signal) {
      throw makeSignalNotFoundError(signalRef);
    }

    const { needsActionPenalties, needsMatchingValues } = signal;
    const { matchingValues, actionPenalties } = input;

    // NB: because it's so hard for callers to satisfy the argument types
    // without a cast, we do some extra runtime validation here.
    if (needsMatchingValues && !matchingValues?.length) {
      throw new CoopError({
        status: 400,
        name: 'CoopError',
        type: [ErrorType.InvalidMatchingValues],
        title: 'Matching values were required, but none were provided.',
        shouldErrorSpan: true,
      });
    }

    if (needsActionPenalties && !actionPenalties?.length) {
      throw new CoopError({
        status: 400,
        name: 'CoopError',
        type: [ErrorType.InvalidUserInput],
        title: 'Action penalties were required, but none were provided.',
        shouldErrorSpan: true,
      });
    }

    // Make sure that the caller is trying to run the signal with an input type
    // that it accepts. The frontend will usually prevent this, by not signals
    // with mismatched input types during condition creation. But, there are
    // some edge cases that could produce this sort of type mismatch (esp. if an
    // item type's schema evolves after the rule is created).
    const signalInputType: SignalInputType =
      'value' in input.value
        ? input.value.type
        : isTaggedItemData(input.value)
        ? 'FULL_ITEM'
        : assertUnreachable(input.value, 'Unknown signal input...');

    if (!signal.eligibleInputs.includes(signalInputType)) {
      throw new CoopError({
        status: 400,
        name: 'CoopError',
        type: [ErrorType.InvalidUserInput],
        title: 'Invalid input type to signal.',
        shouldErrorSpan: true,
        detail:
          `Signal expects input to be one of: ` +
          `${signal.eligibleInputs.join(', ')}.` +
          `Got: ${signalInputType}`,
      });
    }

    // When we look up the signal with `#getSignalInstance` above, TS thinks
    // (correctly) that we could get any signal back, but it loses track of the
    // relationship between the signal we get back and the type of the `input`.
    // So, when we call `signal.run()` it tries to check that the `input` is a
    // type that _any_ signal would accept. However, there is no type that'll
    // work as every signal's input (e.g, because some signals demand text input
    // and some demand an image reference), so it'll only let us make this call
    // if we cast the input to `never` (which is the intersection of every
    // signal's input type).
    return signal.run(input as never) as Promise<
      Awaited<SignalTypesToRunOutputTypes[T]>
    >;
  }

  #signalInstanceToPublicSignal(
    it: ReadonlyDeep<
      SignalBase<SignalInputType, SignalOutputType, unknown, SignalType | string>
    >,
  ) {
    // This used to be implemented as simply `safePick(it, publicSignalProps)`,
    // but we found that this is such a hot path that lodash was adding very
    // noticeable overhead -- `_.pick` calls all kinds of internal lodash
    // functions like `basePickBy`, `hasIn`, `hasPath`, `castPath`, `isKey`,
    // `baseGet`, `baseSet`, etc. So, the overhead was enough to switch here to
    // a tiny bit more boilerplate, with the `satisfies Signal` check making
    // sure that we got all the keys from `publicSignalProps`.
    return {
      id: it.id,
      type: it.type,
      displayName: it.displayName,
      description: it.description,
      docsUrl: it.docsUrl,
      recommendedThresholds: it.recommendedThresholds,
      supportedLanguages: it.supportedLanguages,
      pricingStructure: it.pricingStructure,
      eligibleInputs: it.eligibleInputs,
      outputType: it.outputType,
      needsMatchingValues: it.needsMatchingValues,
      needsActionPenalties: it.needsActionPenalties,
      eligibleSubcategories: it.eligibleSubcategories,
      getCost: it.getCost,
      integration: it.integration,
      allowedInAutomatedRules: it.allowedInAutomatedRules,
    } satisfies Signal as Signal;
  }
}

export default inject(
  [
    'Tracer',
    'ModerationConfigService',
    'AggregationsService',
    'UserStrikeService',
    'getPoliciesByIdEventuallyConsistent',
    'HMAHashBankService',
    'SignalAuthService',
    'getUserScoreEventuallyConsistent',
    'fetchHTTP',
  ],
  SignalsService,
);

function makeSignalNotFoundError(it: SignalReference) {
  // NB: this isn't a permanent error, as the signal may just not have been
  // picked up yet by the various eventually consistent parts of the system.
  return makeNotFoundError('Signal not found', {
    detail: `Signal requested was ${jsonStringify(it)}.`,
    shouldErrorSpan: true,
  });
}

function isSignalEnabledForOrg(signalId: SignalId, orgId: string) {
  if (signalId.type === 'AGGREGATION') {
    return [
      'e7c89ce7729' /* Local Test Example */,
      '53d45130ba1' /* Prod ML Test */,
    ].includes(orgId);
  }

  return true;
}
