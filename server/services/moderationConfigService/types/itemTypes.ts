import { ItemTypeKind, type Field, type ScalarTypes } from '@roostorg/types';

import { type NonEmptyArray } from '../../../utils/typescript-types.js';
// Imported w/ underscore for use in a jsdoc @link/@see w/o it being flagged as
// unused. See https://github.com/microsoft/TypeScript/issues/43950
import { type ModerationConfigService as _ModerationConfigService } from '../moderationConfigService.js';

export type ItemSchema = Readonly<NonEmptyArray<Field>>;
export type ItemTypeSchemaVariant = 'original' | 'partial';

export { ItemTypeKind };

export type ItemType =
  | Readonly<UserItemType>
  | Readonly<ContentItemType>
  | Readonly<ThreadItemType>;

type ItemTypeBase = {
  id: string;
  kind: ItemTypeKind;
  name: string;
  schema: ItemSchema;
  description: string | null;
  version: string;
  schemaVariant: ItemTypeSchemaVariant;
  orgId: string;
};

export type UserItemType = ItemTypeBase & {
  kind: 'USER';
  isDefaultUserType: boolean;
  schemaFieldRoles: UserSchemaFieldRoles;
};

export type ContentItemType = ItemTypeBase & {
  kind: 'CONTENT';
  schemaFieldRoles: ContentSchemaFieldRoles;
};

export type ThreadItemType = ItemTypeBase & {
  kind: 'THREAD';
  schemaFieldRoles: ThreadSchemaFieldRoles;
};

export type UserSchemaFieldRoles = {
  displayName?: string;
  profileIcon?: string;
  backgroundImage?: string;
  createdAt?: string;
  isDeleted?: string;
};

export type ThreadSchemaFieldRoles = {
  displayName?: string;
  createdAt?: string;
  creatorId?: string;
  isDeleted?: string;
};

export type ContentSchemaFieldRoles = {
  createdAt?: string;
  displayName?: string;
  creatorId?: string;
  isDeleted?: string;
} & (
  | {
      parentId?: string;
      threadId: string;
      createdAt: string;
    }
  | {
      parentId?: undefined;
      threadId?: undefined;
      createdAt?: undefined;
    }
);

export type SchemaFieldRoles =
  | UserSchemaFieldRoles
  | ThreadSchemaFieldRoles
  | ContentSchemaFieldRoles;

/**
 * These three fields uniquely identify a particular "incarnation" of a given
 * item type (where an incarnation refers to both a version of the item type, in
 * where each user edit creates a new version; and a 'schema variant', where
 * different schema variants can be derived from the same version). These three
 * fields are enough to deduce the item type's schema, schema field roles, etc.
 * or that incarnation. (I.e., they form a key in the SQL sense, w/ all the
 * other attributes being functional dependencies of these three:
 * https://monday.com/blog/project-management/functional-dependencies-2/.)
 */
export type ItemTypeIdentifier = {
  id: string;
  version: string;
  schemaVariant: ItemTypeSchemaVariant;
};

/**
 * Instances of this type can be _resolved_ to a particular item type
 * "incarnation". I.e., the caller can pass in an item type selector, and a
 * concrete item type with a globally unique ItemTypeIdentifier can be chosen
 * based on the selector, to use in the logic that follows.
 *
 * @see _ModerationConfigService.getItemType
 */
export type ItemTypeSelector = {
  id: string;
  version?: string;
  schemaVariant?: ItemTypeSchemaVariant;
};

export type FieldRoleToScalarType = {
  creatorId: ScalarTypes['RELATED_ITEM'];
  parentId: ScalarTypes['RELATED_ITEM'];
  threadId: ScalarTypes['RELATED_ITEM'];
  createdAt: ScalarTypes['DATETIME'];
  displayName: ScalarTypes['STRING'];
  profileIcon: ScalarTypes['IMAGE'];
  backgroundImage: ScalarTypes['IMAGE'];
  isDeleted: ScalarTypes['BOOLEAN'];
};

export function getPartialSchemaFromOriginal(schema: ItemSchema) {
  return schema.map(
    (field) => ({ ...field, required: false }) as const,
  ) satisfies Field[] as NonEmptyArray<Field>;
}
