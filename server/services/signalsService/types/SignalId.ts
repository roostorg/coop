import fc, { type Arbitrary } from 'fast-check';

import { jsonStringify, type JsonOf } from '../../../utils/encoding.js';
import { safePick } from '../../../utils/misc.js';
import {
  isNonEmptyString,
  type AllKeys,
  type NonEmptyString,
} from '../../../utils/typescript-types.js';
import {
  BuiltInExternalSignalTypeArbitrary,
  InternalSignalType,
  InternalSignalTypeArbitrary,
  SignalType,
  type ExternalSignalType,
} from './SignalType.js';

// We need a unique id that can identify a signal precisely enough for us to run
// it. That means that this id has to identify custom signals as well, w/ the
// pg id required for us to actually load the signal's webhook url etc. A string
// version of this id can then also serve as a unique identifier for apollo's
// cache on the frontend. The structure here is a bit weird, honestly, but it's
// set up this way for backwards compatibility.
export type SignalId = InternalSignalId | ExternalSignalId;

// We use these types in contexts where we need more precision about the signal
// in question (e.g., only external signals can be specified in conditions,
// whereas internal signals are used to generate derived field values and are
// never exposed to users).
export type InternalSignalId = { type: InternalSignalType };
export type ExternalSignalId =
  | { type: typeof SignalType.CUSTOM; id: NonEmptyString }
  | { type: Exclude<ExternalSignalType, typeof SignalType.CUSTOM> }
  | { type: string }; // plugin signal type ids (not in SignalType enum)

export const InternalSignalIdArbitrary = fc.record({
  type: InternalSignalTypeArbitrary,
}) satisfies Arbitrary<InternalSignalId>;

const BuiltinExternalSignalIdArbitrary = fc.record({
  type: BuiltInExternalSignalTypeArbitrary,
});

const CustomExternalSignalIdArbitrary = fc.record({
  type: fc.constantFrom(SignalType.CUSTOM),
  id: fc.string({ minLength: 1 }) as Arbitrary<NonEmptyString>,
});

export const ExternalSignalIdArbitrary = fc.oneof(
  BuiltinExternalSignalIdArbitrary,
  CustomExternalSignalIdArbitrary,
) satisfies Arbitrary<ExternalSignalId>;

export const SignalIdArbitrary = fc.oneof(
  InternalSignalIdArbitrary,
  ExternalSignalIdArbitrary,
);

/**
 * Converts a SignalId to its canonical string form, as serialized in the
 * signal's id key.
 *
 * Even though the logic here is simple, having this helper is useful for
 * consistency and because `safePick` triggers a false positive excess property
 * check error from TS, so it's nice to only have to deal with that once.
 */
export function getSignalIdString<T extends SignalId>(it: T): JsonOf<T> {
  return jsonStringify(
    safePick(it, [
      'id',
      'type',
    ] satisfies AllKeys<SignalId>[] as readonly (keyof T)[]),
  );
}

export function isSignalId(it: unknown): it is SignalId {
  return (
    typeof it === 'object' &&
    it !== null &&
    'type' in it &&
    typeof (it as { type: unknown }).type === 'string' &&
    (it.type === SignalType.CUSTOM
      ? 'id' in it && isNonEmptyString(it.id)
      : true)
  );
}

// Defined outside the SignalBase class since it must not be overrideable; its
// result must be totally derived from signal.id.type.
export function signalIsInternal(
  signalId: SignalId,
): signalId is InternalSignalId {
  return Object.hasOwn(InternalSignalType, signalId.type);
}

export function signalIsExternal(
  signalId: SignalId,
): signalId is ExternalSignalId {
  return !signalIsInternal(signalId);
}
