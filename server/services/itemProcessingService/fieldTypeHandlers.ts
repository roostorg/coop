import {
  ContainerTypes,
  makeDateString,
  ScalarTypes,
  type Container,
  type ContainerType,
  type ContainerTypeRuntimeType,
  type ItemIdentifier,
  type RelatedItem,
  type ScalarType,
  type ScalarTypeRuntimeType,
} from '@roostorg/types';
import Geohash from 'latlon-geohash';
import _ from 'lodash';
import { match } from 'ts-pattern';

import { doesThrow } from '../../utils/misc.js';
import { isValidUrl, makeUrlString } from '../../utils/url.js';

const { isPlainObject } = _;

/**
 * For every FieldType, we define two core operations that can be performed on
 * values (from JSON ItemData) that our schema says should be interpreted as
 * that FieldType type.
 *
 * - `coerce`, on each FieldType, takes any value that shows up in the user
 *   input and returns either:
 *
 *     - An error, if there's no way to treat the user input as a valid value
 *       for the given field type.
 *
 *     - `null`, if the value should be treated as though the user didn't
 *       provide the field at all. E.g., on fields that take urls, we allow
 *       users to provide an empty string, and we treat the empty string
 *       equivalently to them having left the field out. (Note: if the user
 *       provides `null` directly, that's always treated equivalently to the
 *       field not being provided, so `coerce` needn't handle this case.)
 *
 *     - the canonical value to use for this input, which satisifies the
 *       expected ScalarTypeRuntimeType/ContainerTypeRuntimeType for the field,
 *       if the value is valid or can be coerced to something valid. This makes
 *       sure that our signals always receive values of the type they expect.
 *       Eg, on a NUMBER Field, `coerce('13')` should return 13, the JS number.
 *
 * - `getValues`, on each FieldType, takes a value and returns any array of all
 *   the scalar values within value. For scalars, there's obviously just one
 *   value, which is the input value itself. But, for containers, this extracts
 *   all the values from the container. Note that the returned values must be
 *   valid ScalarTypeRuntimeType values.
 */
type Handlers = {
  [K in ScalarType]: {
    coerce: (
      this: void,
      value: unknown,
      legalItemTypeIds: readonly string[],
    ) => ScalarTypeRuntimeType<K> | null | Error;
    getValues: (value: ScalarTypeRuntimeType<K>) => [ScalarTypeRuntimeType<K>];
  };
} & {
  [K in ContainerType]: {
    coerce: (
      this: void,
      value: unknown,
      legalItemTypeIds: readonly string[],
      container: Container<K>,
    ) => ContainerTypeRuntimeType<K> | null | Error;
    getValues: (
      value: ContainerTypeRuntimeType<K>,
      container: Container<K>,
    ) => ScalarTypeRuntimeType[];
  };
};

/**
 * The default implementation of `getValues` for ScalarTypes. By definition,
 * a scalar type is an atomic value, so we just have to put it in an array.
 */
const scalarGetValues = <T>(value: T): [T] => [value];

export const fieldTypeHandlers: Handlers = {
// NB: for ids (including user ids), we accept numbers or strings for user
// convenience, but we always coerce the value to a string so that we're not
// mixing strings and numbers in the same json column in snowflake (which
// could drastically reduce perf).
  [ScalarTypes.USER_ID]: {
    // TODO (COOP-745): USER_ID will be deprecated
    coerce: (v, legalItemTypeIds) => {
      // NB: We intentionally checks that the id is a string, rather than using
      // `isIdLike` because we only allow users to give item ids as non-empty
      // strings (despite our ID ScalarType allowing numbers and empty strings);
      // cf RawItemSubmission['id'].
      const isObjectWithRequisiteKeys =
        typeof v === 'object' &&
        v !== null &&
        'id' in v &&
        typeof v.id === 'string' &&
        v['id'].length > 0 &&
        'typeId' in v &&
        legalItemTypeIds.includes(v['typeId'] as string);

      return isObjectWithRequisiteKeys
        ? (v satisfies { id: unknown; typeId: unknown } as ItemIdentifier)
        : new Error(
            "This field, if given, must be an object with a (non-empty) string 'id' and a valid 'typeId'.",
          );
    },
    getValues: scalarGetValues,
  },
  [ScalarTypes.ID]: {
    coerce: coerceIdLikeInput,
    getValues: scalarGetValues,
  },
  [ScalarTypes.POLICY_ID]: {
    coerce: coerceIdLikeInput,
    getValues: scalarGetValues,
  },
  [ScalarTypes.STRING]: {
    coerce: (v) =>
      typeof v === 'string'
        ? v
        : new Error('This field, if given, must be a string.'),
    getValues: scalarGetValues,
  },
  [ScalarTypes.URL]: {
    coerce: (v) => {
      const urlString = typeof v === 'string' && makeUrlString(v);

      return urlString
        ? urlString
        : v === ''
        ? null
        : new Error('This field, if given, must be a valid URL.');
    },
    getValues: scalarGetValues,
  },
  [ScalarTypes.GEOHASH]: {
    coerce: (v) =>
      typeof v === 'string' && !doesThrow(() => Geohash.decode(v))
        ? v
        : v === ''
        ? null
        : new Error('This field, if given, must be a valid geohash.'),
    getValues: scalarGetValues,
  },
  [ScalarTypes.BOOLEAN]: {
    coerce(v) {
      if (typeof v === 'boolean') return v;

      // For legacy reasons and/or user convenience,
      // we accept boolean-like strings.
      // TODO: create metric; see if this is used; if not, kill?
      return match(String(v).toLowerCase())
        .with('true', '1', () => true)
        .with('false', '0', () => false)
        .otherwise(
          () => new Error('This field, if given, must hold a boolean.'),
        );
    },
    getValues: scalarGetValues,
  },
  [ScalarTypes.NUMBER]: {
    coerce(v) {
      const asNumber =
        typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : null;
      return isFiniteNonNaNNumber(asNumber)
        ? asNumber
        : new Error('This field, if given, must hold a number.');
    },
    getValues: scalarGetValues,
  },
  [ScalarTypes.AUDIO]: {
    coerce: coerceMediaUrlInput,
    getValues: scalarGetValues,
  },
  [ScalarTypes.IMAGE]: {
    coerce: coerceMediaUrlInput,
    getValues: scalarGetValues,
  },
  [ScalarTypes.VIDEO]: {
    coerce: coerceMediaUrlInput,
    getValues: scalarGetValues,
  },
  [ScalarTypes.DATETIME]: {
    getValues: scalarGetValues,
    coerce(v) {
      const asDateString =
        typeof v === 'string' ? makeDateString(v) : undefined;
      return asDateString
        ? asDateString
        : v === ''
        ? null
        : new Error('This field, if given, must contain a valid date string.');
    },
  },
  [ScalarTypes.RELATED_ITEM]: {
    coerce: (v, legalItemTypeIds) => {
      // NB: We intentionally checks that the id is a string, rather than using
      // `isIdLike` because we only allow users to give item ids as non-empty
      // strings (despite our ID ScalarType allowing numbers and empty strings);
      // cf RawItemSubmission['id'].
      const isObjectWithRequisiteKeys =
        typeof v === 'object' &&
        v !== null &&
        'id' in v &&
        typeof v.id === 'string' &&
        v['id'].length > 0 &&
        'typeId' in v &&
        legalItemTypeIds.includes(v['typeId'] as string) &&
        (!('name' in v) || typeof v['name'] === 'string');

      return isObjectWithRequisiteKeys
        ? (v satisfies { id: unknown; typeId: unknown } as RelatedItem)
        : new Error(
            "This field, if given, must be an object with a (non-empty) string 'id' and a valid 'typeId', with an optional string name.",
          );
    },
    getValues: scalarGetValues,
  },
  [ContainerTypes.ARRAY]: {
    coerce(value, itemTypeIds, container) {
      if (!Array.isArray(value)) {
        return new Error('This field, if given, must be an array.');
      }
      const coerceItem = fieldTypeHandlers[container.valueScalarType].coerce;
      const normalizedValues = value.map((v) => coerceItem(v, itemTypeIds));
      return normalizedValues.some((v) => v instanceof Error)
        ? new Error("Some items in this field's array were not valid.")
        : (normalizedValues.filter((it) => it != null) as Exclude<
            (typeof normalizedValues)[number],
            Error | null
          >[]);
    },
    getValues: (v, _container) => v.slice(),
  },
  [ContainerTypes.MAP]: {
    coerce(v, itemTypeIds, container) {
      if (!isPlainObject(v)) {
        return new Error('This field, if given, must be an object.');
      }
      const { keyScalarType, valueScalarType } = container;
      const coerceKey = fieldTypeHandlers[keyScalarType].coerce;
      const coerceValue = fieldTypeHandlers[valueScalarType].coerce;

      const normalizedEntries = Object.entries(v as object)
        .map(
          ([key, val]) =>
            [
              coerceKey(key, itemTypeIds),
              coerceValue(val, itemTypeIds),
            ] as const,
        )
        .filter(([key, val]) => key != null && val != null);

      const hasErrors = normalizedEntries.some(
        ([k, v]) => k instanceof Error || v instanceof Error,
      );

      if (hasErrors) {
        return new Error("Some entries in this field's map were not valid.");
      }

      return Object.fromEntries(normalizedEntries) as {
        [k: string | number]: Exclude<
          (typeof normalizedEntries)[number][1],
          Error | null
        >;
      };
    },
    getValues: (v, _container) => Object.values(v),
  },
};

function coerceMediaUrlInput(value: unknown) {
  const err = new Error('This field, if given, must hold a valid URL.');

  return typeof value !== 'string'
    ? err
    : value === ''
    ? null
    : isValidUrl(value)
    ? // NB: `value` here CANNOT be typed as a UrlString, because we have some
      // legacy submissions in Snowflake where the string is not a valid URL.
      // (Usually, it's the empty string, which previously got through.)
      // TODO: replace all those submissions in snowflake with `field: null`,
      // and then update the type here/in ScalarTypeRuntimeType.
      { url: value }
    : err;
}

function coerceIdLikeInput(value: unknown) {
  // NB: we don't currently have any restrictions on the string in an `ID` field;
  // in particular, it's allowed to be empty. But note that _item ids_ (like in
  // RELATED_ITEM fields) don't get checked w/ this function and can't be empty.
  return typeof value === 'string'
    ? value
    : isFiniteNonNaNNumber(value)
    ? String(value)
    : new Error('This field must be a string or a number.');
}

function isFiniteNonNaNNumber(value: unknown) {
  return (
    typeof value === 'number' && Number.isFinite(value) && !Number.isNaN(value)
  );
}
