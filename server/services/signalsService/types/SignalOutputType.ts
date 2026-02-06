import {
  type ScalarType,
  type ScalarTypeRuntimeType,
  type ScalarTypes,
} from '@roostorg/types';

import { type SignalErrorResult as _SignalErrorResult } from '../signals/SignalBase.js';

/**
 * Values of type `SignalOutputType` are essentially mini schemas that describe
 * what kind of value a signal will _when the signal runs successfully_. All
 * signals are assumed to also be able to return errors; see the
 * {@link _SignalErrorResult} type.
 *
 * On success, signals output a single scalar value for now, but it's pretty
 * easy to imagine a signal wanting to return multiple/complex values, which
 * could be used in a condition's final expression to determine its outcome. If
 * we supported that, the exposed comparators would have to be the intersection
 * of the comparators supported for each output type, and we'd need a way for
 * conditions to encode more complex expressions. I thought through a bit what
 * all that might look like, to make sure that our design won't make it hard to
 * add in a backwards-compatible way; I think we're good, and the types might be
 * something like:
 *
 * export type SignalOutputType = | ScalarType | [SignalOutputType] | { [key:
 *   string]: ScalarType }; *
 *
 * export type SignalOutputTypeRuntimeType<T extends SignalOutputType> = T
 *   extends ScalarType ? ScalarTypeRuntimeType<T> : T extends [infer U extends
 *   SignalOutputType] ? SignalOutputTypeRuntimeType<U>[] : T extends object ? {
 *   [K in keyof T]: T[K] extends SignalOutputType ?
 *   SignalOutputTypeRuntimeType<T[K]> : never } : never;
 */
export type SignalOutputType =
  | { scalarType: ScalarType }
  | {
      scalarType: ScalarTypes['STRING'];
      enum: readonly string[];
      ordered: boolean;
    }
  | {
      scalarType: ScalarTypes['NUMBER'];
      enum: readonly number[];
      ordered: boolean;
    };

/**
 * Represents the type of runtime values that conform to a given
 * SignalOutputType.
 */
export type SignalOutputTypeRuntimeType<T extends SignalOutputType> =
  ScalarTypeRuntimeType<T['scalarType']>;
