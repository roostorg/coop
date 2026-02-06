import { type ScalarType, type TaggedScalar } from '@roostorg/types';
import _Ajv, { type JSONSchemaType } from 'ajv-draft-04';
import _ from 'lodash';
import { type ReadonlyDeep } from 'type-fest';

import { extractContentValueOrValues } from '../../condition_evaluator/leafCondition.js';
import { type TaggedItemData } from '../../models/rules/item-type-fields.js';
import {
  b64UrlDecode,
  b64UrlEncode,
  jsonParse,
  jsonStringifyUnstable,
  type B64UrlOf,
  type JsonOf,
} from '../../utils/encoding.js';
import {
  makeDerivedFieldPermanentError,
  type CoopError,
} from '../../utils/errors.js';
import { everyAsync } from '../../utils/fp-helpers.js';
import { assertUnreachable } from '../../utils/misc.js';
import { type NonEmptyArray } from '../../utils/typescript-types.js';
import { type ItemSubmission } from '../itemProcessingService/makeItemSubmission.js';
import { CoopInput } from '../moderationConfigService/index.js';
import { type TransientRunSignalWithCache } from '../orgAwareSignalExecutionService/signalExecutionService.js';
import {
  isSignalErrorResult,
  SignalType,
  type SignalId,
  type SignalInputType,
  type SignalOutputType,
  type SignalsService,
} from '../signalsService/index.js';

const Ajv = _Ajv as unknown as typeof _Ajv.default;

const { sum } = _;

// A bit of data that defines how to create a derived field, and that also
// serves as a unique identity for the field within a given content type.
// (Ie, no two derived fields on the same content type will have the same spec.)
//
// NB: this data is exposed to end users through the API -- both directly and
// through the stringified version of the spec used to request the associated
// derived field's comuputed value -- which is why it (partially) duplicates,
// rather than references, the ConditionInput types in its `source` definition:
// if we later modify ConditionInput's definition for internal use, we don't
// want to inadvertently change the public API; having a type mismatch at that
// point will make TS alert us of this risk, while letting us use the
// Condition-input processing helper fns against these specs for now.
export type DerivedFieldSpec = {
  source:
    | { type: 'FULL_ITEM' }
    | { type: 'CONTENT_FIELD'; name: string; contentTypeId: string }
    | { type: 'CONTENT_COOP_INPUT'; name: CoopInput };
  derivationType: DerivedFieldType;
};

export type DerivedFieldSpecSource = DerivedFieldSpec['source'];

export type DerivedFieldType = keyof typeof derivedFieldRecipes;

export type DeriveFieldOperation = RunSignalOperation;

export enum DerivedFieldOperationType {
  RUN_SIGNAL = 'RUN_SIGNAL',
}

export type RunSignalOperation = {
  type: DerivedFieldOperationType.RUN_SIGNAL;
  args: { id: SignalId; subcategory?: string };
};

// For each DerivedFieldType that we can reference in a DerivedFieldSpec, we map
// it below into a more detailed set of steps (a 'recipe') for how to actually
// compute the derived value. Unlike the DerivedFieldSpec, recipes are wholly
// internal implementation details, not exposed anywhere to end users (via REST
// or GraphQL).
//
// These recipes are defined as data (an array of sequential operation objects),
// not as functions, so that the recipe can be analyzed -- e.g., we can
// calculate the total cost of deriving the field by finding the 'RUN_SIGNAL'
// steps and summing the cost of each associated signal.
//
// Currently, the only operation type is calling a signal, but we know that
// these 'recipes' are gonna have to support other kind of steps for derived
// fields that use multiple input fields and aggregate the results, like the
// 'All text (including text extracted from images and videos)' field.
export const derivedFieldRecipes = {
  VIDEO_TRANSCRIPTION: [
    {
      type: DerivedFieldOperationType.RUN_SIGNAL,
      args: { id: { type: SignalType.OPEN_AI_WHISPER_TRANSCRIPTION } },
    },
  ] satisfies DerivedFieldRecipe as DerivedFieldRecipe,
  ENGLISH_TRANSLATION: [
    {
      type: DerivedFieldOperationType.RUN_SIGNAL,
      args: { id: { type: SignalType.GOOGLE_CLOUD_TRANSLATE_MODEL } },
    },
  ] satisfies DerivedFieldRecipe as DerivedFieldRecipe,
};

export type DerivedFieldRecipe = ReadonlyDeep<
  NonEmptyArray<DeriveFieldOperation>
>;

export const derivedFieldTypes = Object.keys(
  derivedFieldRecipes,
) as DerivedFieldType[];

export async function getFieldDerivationCost(
  getSignalCost: (it: SignalId) => Promise<number>,
  spec: DerivedFieldSpec,
) {
  return sum(
    await Promise.all(
      derivedFieldRecipes[spec.derivationType]
        // This filter is currently unnecessary, but it's here to make sure if
        // we ever add a new value to the DerivedFieldOperationType enum, we'll be
        // properly filtering these derived field recipes
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        .filter((it) => it.type === DerivedFieldOperationType.RUN_SIGNAL)
        .map(async (it) => getSignalCost(it.args.id)),
    ),
  );
}

/**
 * Returns what ScalarTypes (and possibly the full content object) are eligible
 * to be fed in as inputs to derived fields of the given derivationType.
 *
 * For now, its assumed that, if some ScalarType, x, is a valid input, then an
 * array/map ContainerType that has x as its valueScalarType is valid as well.
 */
export async function getDerivedFieldInputTypes(
  getSignal: SignalsService['getSignalOrThrow'],
  derivationType: DerivedFieldType,
  orgId: string,
): Promise<readonly SignalInputType[]> {
  const [recipeFirstStep] = derivedFieldRecipes[derivationType];
  // NB: this intentionally doesn't check the step's type, so that we'll get
  // type errors if we define new step types besides RUN_SIGNAL.
  const signal = await getSignal({ orgId, signalId: recipeFirstStep.args.id });
  return signal.eligibleInputs;
}

/**
 * Returns what ScalarTypes (and possibly the full content object) are eligible
 * to be returned as values for derived fields of the given derivationType.
 *
 * For now, its assumed that, if some ScalarType, x, is a valid input, then an
 * array/map ContainerType that has x as its valueScalarType is valid as well.
 */
export async function getDerivedFieldOutputType(
  getSignal: SignalsService['getSignalOrThrow'],
  derivationType: DerivedFieldType,
  orgId: string,
): Promise<SignalOutputType> {
  const recipeLastStep = derivedFieldRecipes[derivationType].at(-1)!;
  // NB: this intentionally doesn't check the step's type, so that we'll get type
  // errors if we define new step types besides RUN_SIGNAL.
  const signal = await getSignal({ orgId, signalId: recipeLastStep.args.id });
  return signal.outputType;
}

/**
 * Returns whether the derived field is enabled for the given org. For derived
 * fields whose recipe involves running a signal, we check if that signal is
 * enabled.
 */
export async function getDerivedFieldIsEnabled(
  getSignalDisabled: SignalsService['getSignalDisabledForOrg'],
  derivationType: DerivedFieldType,
  orgId: string,
) {
  const runSignalSteps = derivedFieldRecipes[derivationType].filter(
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    (it) => it.type === DerivedFieldOperationType.RUN_SIGNAL,
  );

  const allSignalsEnabled = await everyAsync(runSignalSteps, async (step) => {
    const res = await getSignalDisabled({ orgId, signalId: step.args.id });
    return !res ? false : !res.disabled;
  });

  return allSignalsEnabled;
}

// We allow users to request specific derived fields from the API.
// To make this possible, we have to be able to convert a DerivedFieldSpec to
// and from a string, which will be used by the consumer to request their field
// of interest. The easiest way, of course -- both now and if/when we want to
// extend the DerivedFieldSpec format -- would be to just JSON.stringify() the
// spec, and probably base64url encode the result, so that callers don't run
// into url encoding issues. The one potential issue with that is that it's not
// very user-friendly. Then again, almost no format we could come up with here
// would be simple enough to allow user devs to guess what value they should
// use, and even hand-writing the value following some documented syntax would
// be tricky (esp. w/o encoding edge cases), so I think a simple, standard
// encodings of JSON might actually be the best.
export function serializeDerivedFieldSpec(spec: DerivedFieldSpec) {
  // TODO: this really should use a stable serialization -- i.e., one where the
  // order in which we add the keys to the `spec` object doesn't change the
  // serialization result. However, we didn't do that from the beginning, and
  // normalizing the key order in the stringified result now would likely break
  // existing users, who are depending on the current strings. So, we need
  // to find a migration path for those, and switch to `true` for the future.
  return b64UrlEncode(jsonStringifyUnstable(spec));
}

const derivedFieldSpecSchema: JSONSchemaType<DerivedFieldSpec> = {
  type: 'object',
  properties: {
    source: {
      type: 'object',
      required: ['type'],
      oneOf: [
        {
          properties: {
            type: { type: 'string', const: 'FULL_ITEM' },
          },
          required: ['type'],
          additionalProperties: false,
        },
        {
          properties: {
            type: { type: 'string', const: 'CONTENT_FIELD' },
            name: { type: 'string' },
            contentTypeId: { type: 'string' },
          },
          required: ['type', 'name', 'contentTypeId'],
          additionalProperties: false,
        },
        {
          properties: {
            type: { type: 'string', const: 'CONTENT_COOP_INPUT' },
            name: { type: 'string', enum: Object.values(CoopInput) },
          },
          required: ['type', 'name'],
          additionalProperties: false,
        },
      ],
    },
    derivationType: { type: 'string', enum: derivedFieldTypes },
  },
  required: ['source', 'derivationType'],
  additionalProperties: false,
};

const ajv = new Ajv();
const validateDerivedFieldSpec = ajv.compile(derivedFieldSpecSchema);

export function parseDerivedFieldSpec(
  spec: B64UrlOf<JsonOf<DerivedFieldSpec>>,
): DerivedFieldSpec {
  const parsedResult = jsonParse(b64UrlDecode(spec));
  if (validateDerivedFieldSpec(parsedResult)) {
    return parsedResult;
  } else {
    throw new Error(`Invalid derived field spec`, {
      cause: new AggregateError(validateDerivedFieldSpec.errors ?? []),
    });
  }
}

export type DerivedFieldValue<T extends ScalarType = ScalarType> =
  | TaggedScalar<T>
  | TaggedScalar<T>[]
  | TaggedItemData
  | undefined
  // if we weren't able to derive the field's value for some permanent reason;
  // likely a permanent failure in one of the used derivation signals.
  | CoopError<'DerivedFieldPermanentError'>;

/**
 * This computes and returns the value of a derived field.
 *
 * @param runSignal A function to run a signal, which is needed b/c a derived
 *   field will usually use a signal result as part of creating its final value.
 * @param contextOrgId The org id for which the derived field is being computed.
 *   This needs to be passed as part of running the relevant signals (e.g., for
 *   looking up the org's API keys for third-party-based signals.)
 * @param submission The content from which to derive the field's value.
 * @param derivedFieldSpec The spec defining what field to derive.
 *   (See {@link DerivedFieldSpec}).
 */
export async function getDerivedFieldValue(
  runSignal: TransientRunSignalWithCache,
  contextOrgId: string,
  itemSubmission: ItemSubmission,
  derivedFieldSpec: DerivedFieldSpec,
): Promise<DerivedFieldValue> {
  const signalInput = extractContentValueOrValues(
    itemSubmission,
    derivedFieldSpec.source,
  );

  // NB: it's fairly expected to have some cases where the derived field simply
  // doesn't exist on the submission, which is what undefined represents. A
  // typical case would be if the derived field's spec uses a field from content
  // type A as the derived field's input, but this derived field is referenced
  // in a condition in a rule that runs on content types A and B. In that case,
  // content submissions of content type B will have undefined for the derived field.
  if (signalInput === undefined) {
    return undefined;
  }

  async function transformWithSignal(
    signal: SignalId,
    signalArgs: { subcategory?: string | null },
    value: TaggedScalar<ScalarType> | TaggedItemData,
  ): Promise<TaggedScalar<ScalarType>> {
    // NB: no matchingValues support here yet, b/c we don't need it,
    // and b/c the matchingValues aren't stored on the ConditionSignalInfo
    // type, which we're reusing for the signal's args.
    const signalResult = await runSignal({
      signal,
      value,
      orgId: contextOrgId,
      userId: itemSubmission.creator?.id,
      subcategory: signalArgs.subcategory ?? undefined,
    });

    if (isSignalErrorResult(signalResult)) {
      throw signalResult.score;
    }

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return {
      type: signalResult.outputType.scalarType,
      value: signalResult.score,
    } as TaggedScalar<ScalarType>;
  }

  return derivedFieldRecipes[derivedFieldSpec.derivationType]
    .reduce(async (derivedResPromise, recipeOperation) => {
      // get value(s) as they've been generated so far.
      const valueOrValues = await derivedResPromise;
      switch (recipeOperation.type) {
        case DerivedFieldOperationType.RUN_SIGNAL: {
          const transformValue = transformWithSignal.bind(
            null,
            recipeOperation.args.id,
            recipeOperation.args,
          );

          return Array.isArray(valueOrValues)
            ? Promise.all(valueOrValues.map(async (v) => transformValue(v)))
            : transformValue(valueOrValues);
        }

        default:
          assertUnreachable(recipeOperation.type);
      }
    }, Promise.resolve(signalInput))
    .catch((error) => {
      return makeDerivedFieldPermanentError('Failed to derive field value.', {
        cause: error,
        shouldErrorSpan: true,
      });
    });
}
