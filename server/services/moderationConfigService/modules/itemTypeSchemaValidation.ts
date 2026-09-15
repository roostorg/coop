import {
  makeInvalidItemTypeHiddenFieldsError,
  makeInvalidItemTypeSchemaError,
  makeItemTypeSchemaIncompatibleError,
} from '../errors.js';
import { type ItemSchema } from '../types/itemTypes.js';

export function assertValidItemSchema(schema: ItemSchema): void {
  const fieldNames = new Set<string>();
  for (const field of schema) {
    if (fieldNames.has(field.name)) {
      throw makeInvalidItemTypeSchemaError({
        shouldErrorSpan: false,
        detail: `Field name "${field.name}" appears more than once.`,
      });
    }
    fieldNames.add(field.name);
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
    if (
      (currentField.container === null) !==
      (proposedField.container === null)
    ) {
      throwIncompatible(currentField.name, 'cannot change container shape');
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
