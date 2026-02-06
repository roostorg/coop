import {
  getScalarType,
  isContainerType,
  type ContainerType,
  type Field,
  type FieldScalarType,
  type FieldType,
  type ScalarType,
  type ScalarTypeRuntimeType,
  type TaggedScalar,
} from '@roostorg/types';

import { hasOwn } from '../../utils/misc.js';
import {
  type FieldRoleToScalarType,
  type ItemSchema,
  type SchemaFieldRoles,
} from '../moderationConfigService/index.js';
import { fieldTypeHandlers } from './fieldTypeHandlers.js';
import { type NormalizedItemData } from './toNormalizedItemDataOrErrors.js';

/**
 * Extracts all the values from all the passed in fields from a given piece of
 * content, as one merged array. I.e., if one field is a container with
 * multiple values, all those values will be flattened into the final result.
 *
 * NB: the `content` object might not actually have the fields and structure
 * suggested by `fields`. In that case, the returned values may not be of the
 * type suggested by `getScalarType(field)`, and some fields might be missing.
 *
 * @param data Content object whose field values should be returned
 * @param fields The fields whose values should be included.
 */
export function getValuesFromFields(
  data: NormalizedItemData,
  fields: Field[],
): TaggedScalar<ScalarType>[] {
  return fields.flatMap((field) => {
    const fieldValue = getFieldValueOrValues(data, field);
    return Array.isArray(fieldValue)
      ? fieldValue
      : fieldValue !== undefined
      ? [fieldValue]
      : [];
  });
}

export function getFieldValueOrValues<T extends FieldType>(
  data: NormalizedItemData,
  field: Field<T>,
) {
  const { name, type, container } = field;
  const values = !hasOwn(data, name)
    ? []
    : // NB: casting to `never` below is unambiguously wrong, but it's needed
      // because the type that TS infers when trying to generate a single,
      // callable signature for `getValues` is not correct (and has never as
      // its argument types).
      fieldTypeHandlers[type as FieldType]
        .getValues(data[name] as never, container as never)
        .map(
          (value) =>
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            ({ value, type: getScalarType(field) }) as TaggedScalar<ScalarType>,
        );

  return (isContainerType(type) ? values : values[0]) as
    | (T & ScalarType extends never
        ? never
        : TaggedScalar<FieldScalarType<T & ScalarType>>)
    | (T & ContainerType extends never
        ? never
        : TaggedScalar<FieldScalarType<T & ContainerType>>[])
    | undefined;
}

export function getFieldValueForRole<
  FieldRoles extends SchemaFieldRoles,
  Role extends keyof FieldRoles,
>(
  schema: ItemSchema,
  schemaFieldRoles: FieldRoles,
  role: Role,
  data: NormalizedItemData,
) {
  const fieldName = schemaFieldRoles[role];
  const field = schema.find((it) => it.name === fieldName);
  if (field === undefined) {
    return undefined;
  }
  const fieldValue = getFieldValueOrValues(data, field);
  if (fieldValue === undefined) {
    return undefined;
  }
  if (Array.isArray(fieldValue)) {
    throw new Error('Unexpected array when getting field value');
  }
  return fieldValue.value satisfies ScalarTypeRuntimeType<ScalarType> as ScalarTypeRuntimeType<
    FieldRoleToScalarType[Role & keyof FieldRoleToScalarType]
  >;
}
