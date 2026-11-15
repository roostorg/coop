import { type Simplify } from 'type-fest';

import { type CollapseCases } from '../../utils/typescript-types.js';
import { type instantiateBuiltInSignals } from './helpers/instantiateBuiltInSignals.js';
import {
  type SignalId,
  type SignalInputType,
  type SignalOutputType,
  type SignalType,
} from './index.js';
import type UnusedCustomSignal from './signals/CustomSignal.js';
import { type SignalBase } from './signals/SignalBase.js';

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- used only via typeof for type derivation
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
  'contextNeeds',
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
    SignalBase<SignalInputType, SignalOutputType, unknown, SignalType | string>,
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

export type BuiltInSignalsByType = ReturnType<typeof instantiateBuiltInSignals>;
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
export type SignalsByType = Record<
  string,
  SignalBase<SignalInputType, SignalOutputType, unknown, SignalType | string>
>;
