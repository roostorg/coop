import { type Opaque, type ReadonlyDeep } from 'type-fest';

import { jsonStringify } from '../../utils/encoding.js';
import {
  ErrorType,
  makeBadRequestError,
  type CoopError,
} from '../../utils/errors.js';
import { type JSON } from '../../utils/json-schema-types.js';
import {
  instantiateOpaqueType,
  type NonEmptyArray,
} from '../../utils/typescript-types.js';
import { type ItemType } from '../moderationConfigService/index.js';
import { getFieldValueForRole } from './extractItemDataValues.js';
import { fieldTypeHandlers } from './fieldTypeHandlers.js';

// The type of the content that we get from the client, pre validation.
export type RawItemData = { readonly [key: string]: ReadonlyDeep<JSON> };

export type NormalizedItemData = Opaque<RawItemData, 'NormalizedItemData'>;

/**
 * For some item field types, we allow input in many different formats (e.g.,
 * we allow booleans to be represented by the strings '1' or '0' in input json).
 * However, our signals should always get each ScalarType with a consistent
 * runtime representation. So, this function 'normalizes' the representation of
 * an incoming item data object (which could also improve caching on the margin).
 *
 * @param itemType The item type that applies to the content.
 * @param data The submitted content.
 */
export function toNormalizedItemDataOrErrors(
  legalItemTypeIds: readonly string[],
  itemType: ItemType,
  data: RawItemData,
): NormalizedItemData | NonEmptyArray<CoopError> {
  type CoercionResult = ReturnType<
    (typeof fieldTypeHandlers)[keyof typeof fieldTypeHandlers]['coerce']
  >;

  const fieldsByName = new Map(
    itemType.schema.map((field) => [field.name, field]),
  );
  const normalizedEntriesWithErrors = Object.entries(data)
    .filter(([_, value]) => {
      // Remove all fields that were provided with a null value, as those
      // are always treated as being missing, equivalent to if the user had
      // omitted the key from the JSON payload. We have to do this _first_ so
      // that these nulls are never passed to `coerce`.
      return value != null;
    })
    .map(([key, value]) => {
      const fieldDefinition = fieldsByName.get(key);
      return [
        key,
        // If there's no field definition for this key in the schema, retain the
        // value as-is, which could come in useful later. Otherwise, normalize
        // the value according to its field type in the schema, possibly
        // producing errors.
        !fieldDefinition
          ? value
          : fieldDefinition.type === 'ARRAY' || fieldDefinition.type === 'MAP'
          ? fieldTypeHandlers[fieldDefinition.type].coerce(
              value,
              legalItemTypeIds,
              fieldDefinition.container as never,
            )
          : fieldTypeHandlers[fieldDefinition.type].coerce(
              value,
              legalItemTypeIds,
            ),
      ] as const;
    })
    .filter(([key, value]) => {
      // Now, remove all fields (that were defined in the schema) where the
      // value became `null` as a result of coercion/normalization, as these
      // should be treated like missing in the normalized result.
      return value != null || !fieldsByName.has(key);
    });

  const potentialNormalizedResult = Object.fromEntries(
    normalizedEntriesWithErrors,
  );

  // To find errors, we look over the fields _of the schema_, not the `data`
  // object, as any fields in the data object that aren't in the schema will
  // have been left as-is and can't have errors.
  const errors = itemType.schema.flatMap(({ name, required }) => {
    const normalizedValueOrError = potentialNormalizedResult[name];

    // Either, the data didn't have a key for this field, or the field was
    // provided as null, or another value was provided, but that value was
    // equivalent to null after normalization; all these count as the field
    // being "missing", which is an error if the field is required.
    if (normalizedValueOrError == null && required) {
      return [
        makeBadRequestError('Invalid Data for Item', {
          detail: `The field '${name}' is required, but was not provided.`,
          type: [ErrorType.DataInvalidForItemType],
          shouldErrorSpan: true,
        }),
      ];
    }

    // If the validation/normalization process found an error, return that error.
    if (normalizedValueOrError instanceof Error) {
      const { message } = normalizedValueOrError;
      return [
        makeBadRequestError('Invalid Data for Item', {
          detail:
            `The field '${name}' has an invalid value. The value you ` +
            `provided was: ${jsonStringify(data[name])}. ${message}`,
          type: [ErrorType.DataInvalidForItemType],
          shouldErrorSpan: true,
        }),
      ];
    }

    return [];
  });

  if (errors.length > 0) {
    return errors satisfies CoopError[] as NonEmptyArray<CoopError>;
  }

  const normalizedData = instantiateOpaqueType<NormalizedItemData>(
    // Cast is safe because of the check for errors above.
    // Arbitrary JSON values are possible from the fields we retained as-is,
    // that weren't in the schema.
    potentialNormalizedResult satisfies {
      [k: string]: CoercionResult | ReadonlyDeep<JSON>;
    } as { [k: string]: Exclude<CoercionResult | ReadonlyDeep<JSON>, Error> },
  );

  if (itemType.kind === 'CONTENT') {
    const [parentId, threadId, createdAt] = (
      ['parentId', 'threadId', 'createdAt'] as const
    ).map((role) => {
      return getFieldValueForRole(
        itemType.schema,
        itemType.schemaFieldRoles,
        role,
        normalizedData,
      );
    });
    if (parentId && (threadId === undefined || createdAt === undefined)) {
      return [
        makeBadRequestError('Invalid field roles for Item', {
          detail:
            `You provided us a parent: ${itemType.schemaFieldRoles.parentId}` +
            ` without providing a value for when the item was created: ` +
            `${itemType.schemaFieldRoles.createdAt} or a value for the ` +
            `thread: ${itemType.schemaFieldRoles.threadId}`,
          type: [ErrorType.FieldRolesInvalidForItemType],
          shouldErrorSpan: true,
        }),
      ];
    }
    if (threadId && createdAt === undefined) {
      return [
        makeBadRequestError('Invalid field roles for Item', {
          detail:
            `You provided us a thread: ${itemType.schemaFieldRoles.threadId}` +
            ` without providing a value for when the item was created: ` +
            `${itemType.schemaFieldRoles.createdAt}`,
          type: [ErrorType.FieldRolesInvalidForItemType],
          shouldErrorSpan: true,
        }),
      ];
    }
  }

  return normalizedData;
}
