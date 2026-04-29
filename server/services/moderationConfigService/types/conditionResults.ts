import { type ScalarType, type TaggedScalar } from '@roostorg/types';

import { type TaggedItemData } from '../../../models/rules/item-type-fields.js';
import { type SerializableError } from '../../../utils/errors.js';
import {
  type NonEmptyArray,
  type WithUndefined,
} from '../../../utils/typescript-types.js';
import { type ConditionSet, type LeafCondition } from './rules.js';

/**
 * Outcome + result types for condition evaluation. Lived on
 * `models/rules/RuleModel.ts` (via `ruleTypes.ts`) for historical reasons but
 * they don't depend on Sequelize — moving them here keeps them importable from
 * Sequelize-free code paths once the `models/*Model.ts` files are deleted.
 */

export enum ConditionCompletionOutcome {
  PASSED = 'PASSED',
  FAILED = 'FAILED',
  INAPPLICABLE = 'INAPPLICABLE',
}

export enum ConditionFailureOutcome {
  ERRORED = 'ERRORED',
}

export type ConditionOutcome =
  | ConditionCompletionOutcome
  | ConditionFailureOutcome;

export type ConditionCompletionMetadata = {
  score?: string;
  matchedValue?: string;
};

export type ConditionFailureMetadata = {
  error?: SerializableError;
};

type ConditionResultCommonMetadata = {
  signalInputValues?: (TaggedScalar<ScalarType> | TaggedItemData)[];
};

// prettier-ignore
export type ConditionResult =
  | ({ outcome: ConditionCompletionOutcome }
        & ConditionCompletionMetadata
        & Partial<Pick<ConditionFailureMetadata, 'error'>>
        & ConditionResultCommonMetadata)
  | ({ outcome: ConditionFailureOutcome; }
        & ConditionFailureMetadata
        & WithUndefined<ConditionCompletionMetadata>
        & ConditionResultCommonMetadata)

export type ConditionWithResult =
  | LeafConditionWithResult
  | ConditionSetWithResult;

export type ConditionSetWithResult = Omit<ConditionSet, 'conditions'> & {
  conditions:
    | NonEmptyArray<LeafConditionWithResult>
    | NonEmptyArray<ConditionSetWithResult>;
  result?: ConditionResult;
};

export type LeafConditionWithResult = LeafCondition & {
  result?: ConditionResult;
};
