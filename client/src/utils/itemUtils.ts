import type { ItemTypeFieldFieldData } from '@/webpages/dashboard/item_types/itemTypeUtils';
import {
  isContainerType,
  ScalarType,
  ScalarTypeRuntimeType,
  ScalarTypes,
  TaggedScalar,
  type FieldType,
} from '@roostorg/types';
import { JsonObject } from 'type-fest';

import { GQLBaseField, GQLSchemaFieldRoles } from '../graphql/generated';

export type FieldRoleToScalarType = {
  creatorId: ScalarTypes['RELATED_ITEM'];
  parentId: ScalarTypes['RELATED_ITEM'];
  threadId: ScalarTypes['RELATED_ITEM'];
  createdAt: ScalarTypes['DATETIME'];
  displayName: ScalarTypes['STRING'];
  profileIcon: ScalarTypes['IMAGE'];
  backgroundImage: ScalarTypes['IMAGE'];
};

export function getFieldValueOrValues(
  content: JsonObject,
  field: GQLBaseField,
): TaggedScalar<ScalarType> | TaggedScalar<ScalarType>[] | undefined {
  const { name } = field;
  if (!Object.hasOwn(content, name)) {
    return undefined;
  }
  const fieldValue = content[name]!;
  if (isContainerType(field.type)) {
    const values = Array.isArray(fieldValue)
      ? fieldValue
      : Object.values(fieldValue);
    return values.map((it) => ({
      value: it,
      type: field.container!.valueScalarType,
    })) as TaggedScalar<ScalarType>[];
  }
  return {
    value: fieldValue,
    type: field.type,
  } as TaggedScalar<ScalarType>;
}

/**
 * This function gets the value of a given field with a particular field role.
 * See GQLSchemaFieldRoles for a list of field roles per item type.
 */
export function getFieldValueForRole<
  FieldRoles extends GQLSchemaFieldRoles,
  Role extends keyof FieldRoles,
>(
  item: {
    type: {
      baseFields: Readonly<GQLBaseField[]>;
      schemaFieldRoles: FieldRoles;
    };
    data: JsonObject;
  },
  role: Role,
) {
  const { type, data } = item;
  const { baseFields: schema, schemaFieldRoles } = type;

  const fieldName = schemaFieldRoles[role];
  const field = schema.find((it) => it.name === fieldName);
  if (field === undefined) {
    return undefined;
  }

  const fieldValue = getFieldValueOrValues(data, field);
  if (fieldValue === undefined) {
    return undefined;
  }

  // We throw an error here because we aren't yet handling containers (because
  // we have no field roles that are containers yet). If you hit this error,
  // this function needs to be updated to handle containers properly.
  if (Array.isArray(fieldValue)) {
    throw new Error('Unexpected array when getting field value');
  }
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  return fieldValue.value satisfies ScalarTypeRuntimeType<ScalarType> as ScalarTypeRuntimeType<
    FieldRoleToScalarType[Role & keyof FieldRoleToScalarType]
  >;
}

/**
 * This function pulls out all string, url, image, video, audio, and URL
 * fields from a piece of content. This is a 'best effort' function, essentially
 * grabbing all data that might be worth displaying from a piece of reported
 * content.
 * @returns All data of the types listed above from the content.
 */
export function getPrimaryContentFields(
  schema:
    | ReadonlyArray<{
        name: string;
        type: FieldType;
        container:
          | {
              valueScalarType: ScalarType;
            }
          | undefined;
      }>
    | ReadonlyArray<GQLBaseField>,
  content: JsonObject,
) {
  const primaryContentFieldTypes = [
    ScalarTypes.STRING,
    ScalarTypes.URL,
    ScalarTypes.IMAGE,
    ScalarTypes.VIDEO,
    ScalarTypes.AUDIO,
  ] as ScalarType[];

  const primaryContentFields = schema.filter(
    (it) =>
      (isContainerType(it.type) &&
        primaryContentFieldTypes.includes(it.container!.valueScalarType)) ||
      (!isContainerType(it.type) && primaryContentFieldTypes.includes(it.type)),
  );

  return primaryContentFields.map((field) => ({
    ...field,
    value: content[field.name],
  })) as ItemTypeFieldFieldData[];
}
