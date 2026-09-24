import { ContainerTypes, ScalarTypes } from '@roostorg/coop-types';

import { type ModerationConfigServicePg } from '../dbTypes.js';
import {
  makeInvalidItemTypeHiddenFieldsError,
  makeInvalidItemTypeSchemaError,
  makeItemTypeSchemaIncompatibleError,
} from '../errors.js';
import {
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

export function assertBackwardCompatibleItemSchema(
  currentSchema: ItemSchema,
  proposedSchema: ItemSchema,
): void {
  assertValidItemSchema(currentSchema);
  assertValidItemSchema(proposedSchema);

  const proposedByName = new Map(
    proposedSchema.map((field) => [field.name, field]),
  );
  for (const currentField of currentSchema) {
    const proposedField = proposedByName.get(currentField.name);
    if (!proposedField) {
      throwIncompatible(currentField.name, 'cannot be removed or renamed');
    }
    if (currentField.type !== proposedField.type) {
      throwIncompatible(currentField.name, 'cannot change type');
    }
    if (currentField.container && proposedField.container) {
      if (
        currentField.container.containerType !==
          proposedField.container.containerType ||
        currentField.container.keyScalarType !==
          proposedField.container.keyScalarType ||
        currentField.container.valueScalarType !==
          proposedField.container.valueScalarType
      ) {
        throwIncompatible(currentField.name, 'cannot change container shape');
      }
    }
    if (!currentField.required && proposedField.required) {
      throwIncompatible(currentField.name, 'cannot become required');
    }
  }

  const currentNames = new Set(currentSchema.map(({ name }) => name));
  for (const proposedField of proposedSchema) {
    if (!currentNames.has(proposedField.name) && proposedField.required) {
      throwIncompatible(proposedField.name, 'must be optional when added');
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
} as const satisfies Record<
  keyof Required<ItemTypeRoleColumns>,
  { role: keyof FieldRoleToScalarType; type: string }
>;

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
  if (
    kind !== 'USER' &&
    (roles.profile_icon_field != null ||
      roles.background_image_field != null ||
      roles.email_field != null)
  ) {
    throwInvalidRole('kind', `contains a role that is not valid for ${kind}`);
  }
  if (
    kind !== 'CONTENT' &&
    (roles.thread_id_field != null || roles.parent_id_field != null)
  ) {
    throwInvalidRole('kind', `contains a role that is not valid for ${kind}`);
  }
  if (kind === 'USER' && roles.creator_id_field != null) {
    throwInvalidRole('kind', `contains a role that is not valid for ${kind}`);
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

function throwIncompatible(fieldName: string, reason: string): never {
  throw makeItemTypeSchemaIncompatibleError({
    shouldErrorSpan: false,
    detail: `Field "${fieldName}" ${reason}.`,
  });
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
    detail: `Field role "${role}" ${reason}.`,
  });
}
