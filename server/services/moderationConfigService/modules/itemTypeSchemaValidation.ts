import { ContainerTypes, ScalarTypes } from '@roostorg/coop-types';

import { type SnakeToCamelCase } from '../../../utils/typescript-types.js';
import { type ModerationConfigServicePg } from '../dbTypes.js';
import {
  makeInvalidItemTypeHiddenFieldsError,
  makeInvalidItemTypeSchemaError,
} from '../errors.js';
import {
  itemTypeRoleNames,
  type FieldRoleToScalarType,
  type ItemSchema,
  type ItemTypeKind,
} from '../types/itemTypes.js';

export function assertValidItemSchema(schema: ItemSchema): void {
  const scalarTypes = new Set<unknown>(Object.values(ScalarTypes));
  const fieldNames = new Set<string>();
  for (const field of schema) {
    if (fieldNames.has(field.name)) {
      throw makeInvalidItemTypeSchemaError({
        shouldErrorSpan: false,
        detail: `Field name "${field.name}" appears more than once.`,
      });
    }
    fieldNames.add(field.name);

    const container = field.container;
    const hasNoKey = container?.keyScalarType === null;
    if (field.type === ContainerTypes.ARRAY) {
      if (
        container == null ||
        container.containerType !== ContainerTypes.ARRAY ||
        !hasNoKey ||
        !scalarTypes.has(container.valueScalarType)
      ) {
        throwInvalidSchema(field.name, 'has an invalid container definition');
      }
    } else if (field.type === ContainerTypes.MAP) {
      if (
        container == null ||
        container.containerType !== ContainerTypes.MAP ||
        !scalarTypes.has(container.keyScalarType) ||
        !scalarTypes.has(container.valueScalarType)
      ) {
        throwInvalidSchema(field.name, 'has an invalid container definition');
      }
    } else if (!scalarTypes.has(field.type) || container != null) {
      throwInvalidSchema(field.name, 'has an invalid scalar definition');
    }
  }
}

export type ItemTypeRoleColumns = Partial<
  Pick<
    ModerationConfigServicePg['public.item_types'],
    | 'display_name_field'
    | 'creator_id_field'
    | 'thread_id_field'
    | 'parent_id_field'
    | 'created_at_field'
    | 'profile_icon_field'
    | 'background_image_field'
    | 'is_deleted_field'
    | 'ip_address_field'
    | 'email_field'
  >
>;

const roleDefinitions = {
  display_name_field: { role: 'displayName', type: 'STRING' },
  creator_id_field: { role: 'creatorId', type: 'RELATED_ITEM' },
  thread_id_field: { role: 'threadId', type: 'RELATED_ITEM' },
  parent_id_field: { role: 'parentId', type: 'RELATED_ITEM' },
  created_at_field: { role: 'createdAt', type: 'DATETIME' },
  profile_icon_field: { role: 'profileIcon', type: 'IMAGE' },
  background_image_field: { role: 'backgroundImage', type: 'IMAGE' },
  is_deleted_field: { role: 'isDeleted', type: 'BOOLEAN' },
  ip_address_field: { role: 'ipAddress', type: 'IP_ADDRESS' },
  email_field: { role: 'email', type: 'EMAIL_ADDRESS' },
} as const satisfies {
  [Column in keyof Required<ItemTypeRoleColumns>]: {
    role: SnakeToCamelCase<
      Column extends `${infer Name}_field` ? Name : never
    > &
      keyof FieldRoleToScalarType &
      (typeof itemTypeRoleNames)[ItemTypeKind][number];
    type: string;
  };
};

export function mergeItemTypeRoleColumns(
  current: Required<ItemTypeRoleColumns>,
  patch: ItemTypeRoleColumns,
): Required<ItemTypeRoleColumns>;
export function mergeItemTypeRoleColumns(
  current: ItemTypeRoleColumns,
  patch: ItemTypeRoleColumns,
): ItemTypeRoleColumns;
export function mergeItemTypeRoleColumns(
  current: ItemTypeRoleColumns,
  patch: ItemTypeRoleColumns,
): ItemTypeRoleColumns {
  return {
    ...current,
    ...Object.fromEntries(
      Object.entries(patch as Record<string, string | null | undefined>).filter(
        (entry) => entry[1] !== undefined,
      ),
    ),
  };
}

export function assertValidItemTypeFieldRoles(
  schema: ItemSchema,
  kind: ItemTypeKind,
  roles: ItemTypeRoleColumns,
): void {
  assertValidItemSchema(schema);
  assertRoleFieldsExistWithExpectedTypes(schema, roles);
  assertRolesAllowedForKind(kind, roles);
  assertValidRoleDependencies(kind, roles);
}

function assertRoleFieldsExistWithExpectedTypes(
  schema: ItemSchema,
  roles: ItemTypeRoleColumns,
): void {
  const fieldsByName = new Map(schema.map((field) => [field.name, field]));
  for (const [column, { role, type }] of Object.entries(roleDefinitions)) {
    const fieldName = roles[column as keyof ItemTypeRoleColumns];
    if (fieldName == null) continue;
    const field = fieldsByName.get(fieldName);
    if (!field) {
      throwInvalidRole(
        role,
        `references field "${fieldName}", which does not exist`,
      );
    }
    if (field.type !== type) {
      throwInvalidRole(
        role,
        `must reference a ${type} field; "${fieldName}" is ${field.type}`,
      );
    }
  }
}

function assertRolesAllowedForKind(
  kind: ItemTypeKind,
  roles: ItemTypeRoleColumns,
): void {
  const allowed: readonly string[] = itemTypeRoleNames[kind];
  for (const [column, { role }] of Object.entries(roleDefinitions)) {
    if (
      roles[column as keyof ItemTypeRoleColumns] != null &&
      !allowed.includes(role)
    ) {
      throwInvalidRole('kind', `contains a role that is not valid for ${kind}`);
    }
  }
}

function assertValidRoleDependencies(
  kind: ItemTypeKind,
  roles: ItemTypeRoleColumns,
): void {
  if (
    kind === 'CONTENT' &&
    roles.parent_id_field != null &&
    (roles.thread_id_field == null || roles.created_at_field == null)
  ) {
    throwInvalidRole('parentId', 'requires threadId and createdAt');
  }
  if (
    kind === 'CONTENT' &&
    roles.thread_id_field != null &&
    roles.created_at_field == null
  ) {
    throwInvalidRole('threadId', 'requires createdAt');
  }
}

export function assertHiddenFieldsExist(
  schema: ItemSchema,
  hiddenFields: readonly string[],
): void {
  assertValidItemSchema(schema);

  const fieldNames = new Set(schema.map(({ name }) => name));
  for (const hiddenField of hiddenFields) {
    if (!fieldNames.has(hiddenField)) {
      throw makeInvalidItemTypeHiddenFieldsError({
        shouldErrorSpan: false,
        detail: `Hidden field "${hiddenField}" does not exist in the item type schema.`,
      });
    }
  }
}

function throwInvalidSchema(fieldName: string, reason: string): never {
  throw makeInvalidItemTypeSchemaError({
    shouldErrorSpan: false,
    detail: `Field "${fieldName}" ${reason}.`,
  });
}

function throwInvalidRole(role: string, reason: string): never {
  throw makeInvalidItemTypeSchemaError({
    shouldErrorSpan: false,
    pointer: '/schemaFieldRoles',
    detail: `Field role "${role}" ${reason}.`,
  });
}
