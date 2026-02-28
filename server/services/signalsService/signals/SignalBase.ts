import {
  type ScalarType,
  type ScalarTypeRuntimeType,
  type SignalSubcategory,
  type TaggedScalar,
} from '@roostorg/types';
import { type ReadonlyDeep, type Simplify } from 'type-fest';

import { type PolicyActionPenalties } from '../../../models/OrgModel.js';
import { type TaggedItemData } from '../../../models/rules/item-type-fields.js';
import { type CoopError } from '../../../utils/errors.js';
import { type Language } from '../../../utils/language.js';
import { type NonEmptyArray } from '../../../utils/typescript-types.js';
import { type Integration } from '../types/Integration.js';
import { type RecommendedThresholds } from '../types/RecommendedThresholds.js';
import {
  type RuntimeSignalArgsByType,
  type SignalArgsByType,
} from '../types/SignalArgsByType.js';
import { type SignalId } from '../types/SignalId.js';
import {
  type SignalOutputType,
  type SignalOutputTypeRuntimeType,
} from '../types/SignalOutputType.js';
import { type SignalPricingStructure } from '../types/SignalPricingStructure.js';
import { type SignalType } from '../types/SignalType.js';

export type SignalDisabledInfo =
  | { disabled: false; disabledMessage?: undefined }
  | { disabled: true; disabledMessage: string };

export type SignalErrorResult = {
  type: 'ERROR';
  score: CoopError<'SignalPermanentError'>;
};

// Helper for TS
export function isSignalErrorResult(it: object): it is { type: 'ERROR' } {
  return 'type' in it && it.type === 'ERROR';
}

// Signals either get passed a single scalar value (extracted from the content)
// or a full content object (with schema metadata so that the object can be
// interpreted.)
export type SignalInputType = ScalarType | 'FULL_ITEM';

export interface ImageValue {
  url: string;
  hashes?: {
    pdq?: string;
  };
  // Matched hash banks populated during rule execution
  matchedBanks?: string[];
}

// The input type to all signals needs to be standardized so that
// we can eventually use it as the payload in a task queue job that'll run the
// signal w/ retries and rate limits. This payload below is still not quite a
// coherent interface -- in particular, we might want subcategory and
// matchingValues to merge into some more general notion of 'signal args', and
// we might want apiKeys/apiKeyIds to be part of this payload  -- but it's
// reasonably close to where we want to end up.
export type SignalInput<
  T extends SignalInputType = ScalarType,
  NeedsMatchingValues extends boolean = boolean,
  NeedsActionPenalties extends boolean = boolean,
  MatchingValue = T extends ScalarType ? ScalarTypeRuntimeType<T> : unknown,
  Type extends SignalType | string = SignalType,
> = {
  value: T extends 'FULL_ITEM'
    ? TaggedItemData
    : T extends ScalarType
    ? TaggedScalar<T>
    : TaggedItemData | TaggedScalar<Exclude<T, 'FULL_ITEM'>>;
  matchingValues:
    | NonEmptyArray<MatchingValue>
    | (NeedsMatchingValues extends true ? never : undefined);
  actionPenalties:
    | ReadonlyDeep<PolicyActionPenalties[]>
    | (NeedsActionPenalties extends true ? never : undefined);
  subcategory?: string;
  // contentId is optional because user rules don't have a contentId
  // TODO: replace this + userId with an item identifier or remove entirely?
  contentId?: string;
  userId?: string;
  orgId: string;
  // Context ID for signals that need additional context beyond content ID
  // TODO: figure out a better, generalized way to capture signals' required params.
  contextId?: string;
  contentType?: string;
  args?: ReadonlyDeep<
    Type extends SignalType ? SignalArgsByType[Type] : unknown
  >;

  runtimeArgs?: ReadonlyDeep<
    Type extends SignalType ? RuntimeSignalArgsByType[Type] : unknown
  >;
};

// The result of running a signal can be:
//
// - A result value that'll be used to determine the result of the containing
//   condition, usually by checking it against the condition's comparator and
//   threshold, or that'll be used to generate a derived content field. This is
//   called `score` right now, but it should probably be called `result`, to
//   clarify that it can be much more than a numeric score, but we leave it
//   as-is for back-compat.
//
// - An error, which is also stored in score, indicating the the signal value
//   could not be determined for the input. There are specific types of errors
//   that can be returned here, which get checked. If an arbitrary error is
//   thrown, it'll be handled, but not as precisely. Currently, this is used for
//   permanent errors (which won't be retried), such as the content being in a
//   language that the signal doesn't support.
//
// - Signal results can also include metadata (currently `matchedValue`), but
//   you can imagine wanting to expand this a lot.
//
// - Signals can't return undefined/null. They should either yield a result or
//   some kind of error.
//
// NB: we could make this type more precise, like we do with TaggedScalar, i.e.,
// `SignalResult<T ...> = { [K in SignalOutputType]: ...use K... }[T]`.
// That does work to help TS in some places, but it also exceeds TS's max union
// size (seemingly) in other places, resulting in TS falling back to `any`,
// which then causes other type errors. So we're leaving this as-is for now.
export type SignalResult<T extends SignalOutputType> = {
  // A tag so we can interpret the type in score when it might be ambiguous.
  // This is needed for signal chaining, as signals 2 – n in the chain expect
  // typed inputs, which means the prior signals need to type their outputs.
  outputType: T;
  score: SignalOutputTypeRuntimeType<T>;

  // Other result metadata.
  matchedValue?: string; // TODO: replace matchedValue with matchedValues?
};

/**
 * This is an abstract base class for all Signals
 */
export default abstract class SignalBase<
  Input extends SignalInputType = ScalarType,
  OutputType extends SignalOutputType = SignalOutputType,
  MatchingValue = Input extends ScalarType
    ? ScalarTypeRuntimeType<Input>
    : unknown,
  Type extends SignalType | string = SignalType,
> {
  /**
   * See {@link SignalId}.
   */
  abstract get id(): Simplify<SignalId & { type: Type }>;

  /**
   * Return the value from the Signal enum corresponding to this class.
   */
  get type() {
    return this.id.type;
  }

  /**
   * Name of the signal that gets displayed to the user
   */
  abstract get displayName(): string;

  /**
   * Detailed description of the signal that gets displayed to the user
   */
  abstract get description(): string;

  /**
   * Link to some documentation
   */
  abstract get docsUrl(): string | null;

  /**
   * Recommended thresholds for this signal
   */
  abstract get recommendedThresholds(): RecommendedThresholds | null;

  /**
   * Languages that this signal supports
   */
  abstract get supportedLanguages(): readonly Language[] | 'ALL';

  /**
   * Pricing structure for this specific signal
   */
  abstract get pricingStructure(): SignalPricingStructure;

  /**
   * This should return all eligible inputs types.
   */
  abstract get eligibleInputs(): readonly Input[];

  /**
   * This returns a value indicating the type of value that the signal will
   * produce if it runs successfully. (Basically, it's a schema describing the
   * type of the signal's result.)
   *
   * NB: we allow each signal to support multiple types of input (i.e.,
   * `getEligibleInputs` returns an array), but only return a single type of
   * output. This might change in the future but, for now, allowing only one
   * type of output is just simpler. Among other things, it allows derived
   * fields, whose values come from signal output, to have a single, statically-
   * analyzable type (without us having to assert/specify that type manually),
   * which is consistent with non-derived fields (i.e., our content type schemas
   * do not allow a field to have type `A | B`) and is useful for the UI.
   * Moreover, if signals could return different types of output, presumably
   * Condition definitions would have to be able discriminate between those
   * types, which sounds like a pain. Meanwhile, it's hard to imagine any use
   * cases that would justify this complexity, even for custom signals.
   *
   * If, down the line, we also let our normal, non-synthetic content type
   * fields be defined as a union type, then we _might_ wanna update this to
   * return an array too. For now, though, that's not worth the complexity
   * either. E.g., if a user has a field that's a number or a string, they
   * can just make two fields -- `xyz_string` and `xyz_number` -- and only
   * submit one.
   */
  abstract get outputType(): OutputType;

  /**
   * Estimate of the "cost" of computing the signal. Signals with near-zero
   * latency/cost should have zero cost (e.g. exact text matching), whereas
   * signals with high latency or high cost (e.g. costly and/or slow 3rd party
   * APIs) should have high cost.
   *
   * NB: this is not a getter because, in the future, we may pass in arguments
   * about the current input the signal is being evaluated with.
   */
  abstract getCost(): number;

  abstract run(
    input: SignalInput<
      Input,
      this['needsMatchingValues'],
      this['needsActionPenalties'],
      MatchingValue,
      Type
    >,
  ): Promise<SignalResult<OutputType> | SignalErrorResult>;

  /**
   * Returns a DisabledInfo object that tells the client whether
   * the signal is enabled for the logged in user, and if not,
   * what explanation to display.
   */
  abstract getDisabledInfo(_orgId: string): Promise<SignalDisabledInfo>;

  /**
   * Return true if the signal requires some values to match against.
   *
   * For example, for text matching rules, the 'matching values' are the
   * keywords and regexes that we use to match against content sent to our APIs,
   * so text matching rules should return true.
   *
   * For image matching rules, the 'matching values' are the banks of
   * images that we use to match against the image content we get sent.
   * Image matching rules should return true.
   */
  abstract get needsMatchingValues(): boolean;

  /**
   * This is only for 3rd party integrations. If the 3rd party models compute
   * scores across different buckets (i.e. for a Violence model, it could
   * compute probability scores for subcategories/buckets like graphic_violence,
   * animated_violence, gun_violence, no_violence), then we have to allow the
   * user to construct rules that specifically utilize those subcategory/bucket
   * scores. To do that, we need to display all subcategories in the Rules UI.
   *
   * This function returns the names of all possible subcategories for a given
   * signal so the UI can display them.
   */
  abstract get eligibleSubcategories(): ReadonlyDeep<SignalSubcategory[]>;

  abstract get needsActionPenalties(): boolean;

  /** Built-in integration enum value, or integration id string for plugin signals. */
  abstract get integration(): Integration | string | null;

  /**
   * Indicates whether this signal can be used in automated rules with actions.
   * When false, the signal can only be used in routing rules (for manual review).
   *
   * This is useful for signals that:
   * - Are intended only for prioritization/routing
   * - Have high latency or cost
   * - Require human review before action
   * - Have regulatory or policy restrictions on automated decisions
   *
   * Default: true (most signals can be used in automated rules)
   */
  abstract get allowedInAutomatedRules(): boolean;
}

export { SignalBase };
