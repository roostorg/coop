import type {
  Field,
  FieldType,
  FieldTypeRuntimeType,
  ItemTypeKind,
  ScalarType,
} from '@roostorg/types';

import {
  GQLScalarType,
  type GQLBaseField,
  type GQLContentSchemaFieldRoles,
  type GQLItemType,
  type GQLThreadSchemaFieldRoles,
  type GQLUserSchemaFieldRoles,
} from '../../../graphql/generated';
import type { WithoutTypename } from '../../../graphql/inputHelpers';

export type FieldRoles<T extends ItemTypeKind> = WithoutTypename<
  T extends 'CONTENT'
    ? GQLContentSchemaFieldRoles
    : T extends 'THREAD'
    ? GQLThreadSchemaFieldRoles
    : T extends 'USER'
    ? GQLUserSchemaFieldRoles
    : never
>;

export enum SchemaFieldRoles {
  NONE = 'none',
  CREATED_AT = 'createdAt',
  CREATOR_ID = 'creatorId',
  THREAD_ID = 'threadId',
  PROFILE_ICON = 'profileIcon',
  PARENT_ID = 'parentId',
  DISPLAY_NAME = 'displayName',
  BACKGROUND_IMAGE = 'backgroundImage',
  IS_DELETED = 'isDeleted',
}

export const schemaFieldRolesFieldTypes = {
  [SchemaFieldRoles.CREATED_AT]: GQLScalarType.Datetime,
  [SchemaFieldRoles.CREATOR_ID]: GQLScalarType.RelatedItem,
  [SchemaFieldRoles.THREAD_ID]: GQLScalarType.RelatedItem,
  [SchemaFieldRoles.PROFILE_ICON]: GQLScalarType.Image,
  [SchemaFieldRoles.PARENT_ID]: GQLScalarType.RelatedItem,
  [SchemaFieldRoles.DISPLAY_NAME]: GQLScalarType.String,
  [SchemaFieldRoles.BACKGROUND_IMAGE]: GQLScalarType.Image,
  [SchemaFieldRoles.IS_DELETED]: GQLScalarType.Boolean,
} satisfies Omit<
  { [key in SchemaFieldRoles]: GQLScalarType },
  SchemaFieldRoles.NONE
>;

export function getDisplayStringForRole(
  role: SchemaFieldRoles,
  itemTypeKind: ItemTypeKind,
): string {
  switch (role) {
    case SchemaFieldRoles.CREATED_AT:
      return 'Created At';
    case SchemaFieldRoles.CREATOR_ID:
      return 'Creator';
    case SchemaFieldRoles.THREAD_ID:
      return 'Thread';
    case SchemaFieldRoles.PROFILE_ICON:
      return 'Profile Photo';
    case SchemaFieldRoles.PARENT_ID:
      return 'Parent';
    case SchemaFieldRoles.DISPLAY_NAME:
      return itemTypeKind === 'USER' ? 'Display Name' : 'Title';
    case SchemaFieldRoles.BACKGROUND_IMAGE:
      return 'Cover Photo';
    case SchemaFieldRoles.IS_DELETED:
      return 'Is Deleted';
    case SchemaFieldRoles.NONE:
      return 'None';
  }
}

export function displayStringForItemTypeKind(kind: ItemTypeKind) {
  switch (kind) {
    case 'CONTENT':
      return 'Content';
    case 'THREAD':
      return 'Thread';
    case 'USER':
      return 'User';
  }
}

export type ItemTypeFieldFieldData<T extends FieldType = FieldType> = {
  [K in T]: Field<K> & { value: FieldTypeRuntimeType<K> | undefined };
}[T];

export function generateFakeItemsForItemType(
  itemType: GQLItemType,
  numItems: number,
) {
  return Array(numItems)
    .fill(0)
    .map(() => generateFakeItemForItemType(itemType));
}

const randomId = () => {
  let result = '';
  const chars = 'abcdef0123456789';
  for (let i = 0; i < 10; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
};

function generateFakeItemForItemType(itemType: GQLItemType) {
  const itemTypeFields = itemType.baseFields.map((field) => {
    if (field.type === 'ARRAY' || field.type === 'MAP') {
      return {
        name: field.name,
        value: generateFakeContainerFieldValue(field),
      };
    } else {
      return {
        name: field.name,
        value: generateFakeScalarFieldValue(field.type),
      };
    }
  });

  return {
    id: randomId(),
    typeId: itemType.id,
    data: itemTypeFields.reduce(
      (acc, it) => {
        acc[it.name] = it.value;
        return acc;
      },
      {} as { [key: string]: unknown },
    ),
  };
}

export function generateFakeContainerFieldValue(field: GQLBaseField) {
  if (!field.container || (field.type !== 'ARRAY' && field.type !== 'MAP')) {
    throw new Error(
      'Attempted to call generateFakeContainerFieldValue with a non-container field',
    );
  }

  const keyType = field.container.keyScalarType;
  const valueType = field.container.valueScalarType;

  switch (field.type) {
    case 'ARRAY':
      return Array(3)
        .fill(0)
        .map(() => generateFakeScalarFieldValue(valueType));
    case 'MAP':
      if (!keyType) {
        throw new Error('keyType must be defined for a map container type');
      }

      return Array(3)
        .fill(0)
        .reduce(
          (map) => {
            const key = generateFakeScalarFieldValue(keyType);
            const value = generateFakeScalarFieldValue(valueType);

            if (typeof key === 'string' || typeof key === 'number') {
              map[key] = value;
            }

            return map;
          },
          {} as { [key: string]: unknown },
        );
  }
}

export function generateFakeScalarFieldValue(fieldType: ScalarType) {
  switch (fieldType) {
    case 'AUDIO':
      return `https://url.com/${Math.floor(1000 * Math.random())}.mp3`;
    case 'BOOLEAN':
      return Math.random() < 0.5;
    case 'DATETIME':
      return new Date().toLocaleTimeString();
    case 'GEOHASH':
      // Geohashes are always 6 characters long, so we just hardcode this one
      // for example purposes. NB: not all 6 character strings are valid geohashes.
      return 'gbsuv7';
    case 'ID':
    case 'POLICY_ID':
    case 'USER_ID': {
      return randomId();
    }
    case 'IMAGE':
      return `https://picsum.photos/${Math.floor(300 * Math.random())}/${
        Math.floor(1000 * Math.random()) % 10
      }`;
    case 'VIDEO':
      return `https://url.com/${Math.floor(1000 * Math.random()) % 10}.mp4`;
    case 'NUMBER':
      return Math.floor(100 * Math.random());
    case 'RELATED_ITEM':
      const names = [
        'John Smith',
        'Jane Doe',
        'Frodo Baggins',
        'Harry Potter',
        'Snow White',
      ];
      return {
        id: randomId(),
        typeId: randomId(),
        name: names[Math.floor(Math.random() * names.length)],
      };
    case 'STRING':
      return 'Lorem ipsum dolor';
    case 'URL':
      return `https://url.com/some-path/${Math.floor(100 * Math.random())}`;
  }
}

export type ItemTypeScalarFieldData<T extends ScalarType = ScalarType> = {
  [K in T]: Field<K> & { value: FieldTypeRuntimeType<K> | undefined };
}[T];
