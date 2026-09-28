import { type Field, type ScalarType } from '@roostorg/coop-types';

import { ErrorType } from '../../../utils/errors.js';
import { type ItemSchema } from '../types/itemTypes.js';
import {
  assertHiddenFieldsExist,
  assertValidItemSchema,
  assertValidItemTypeFieldRoles,
  mergeItemTypeRoleColumns,
} from './itemTypeSchemaValidation.js';

const scalar = (
  name: string,
  required = false,
  type: ScalarType = 'STRING',
): Field => ({ name, type, required, container: null });

const array = (
  name: string,
  required = false,
  valueScalarType: ScalarType = 'STRING',
): Field => ({
  name,
  type: 'ARRAY',
  required,
  container: {
    containerType: 'ARRAY',
    keyScalarType: null,
    valueScalarType,
  },
});

const map = (
  name: string,
  required = false,
  keyScalarType: ScalarType = 'STRING',
  valueScalarType: ScalarType = 'STRING',
): Field => ({
  name,
  type: 'MAP',
  required,
  container: { containerType: 'MAP', keyScalarType, valueScalarType },
});

const schema = (
  first: ItemSchema[number],
  ...rest: ItemSchema[number][]
): ItemSchema => [first, ...rest];

const expectDomainError = (
  operation: () => void,
  expected: {
    name: string;
    status: number;
    type: ErrorType;
    field: string;
  },
) => {
  expect(operation).toThrow(
    expect.objectContaining({
      name: expected.name,
      status: expected.status,
      type: [expected.type],
      detail: expect.stringContaining(expected.field),
    }),
  );
};

describe('assertValidItemSchema', () => {
  test.each([
    ['scalar with null container', scalar('scalar')],
    [
      'scalar with omitted container',
      { name: 'scalar', type: 'STRING', required: false } as unknown as Field,
    ],
    ['ARRAY with scalar value and null key', array('array')],
    ['MAP with scalar key and value', map('map')],
  ])('accepts a valid %s', (_description, field) => {
    expect(() => assertValidItemSchema(schema(field))).not.toThrow();
  });

  test('rejects duplicate field names as invalid schema', () => {
    expectDomainError(
      () =>
        assertValidItemSchema(schema(scalar('duplicate'), scalar('duplicate'))),
      {
        name: 'InvalidItemTypeSchemaError',
        status: 400,
        type: ErrorType.InvalidUserInput,
        field: 'duplicate',
      },
    );
  });

  test.each([
    [
      'MAP with an omitted key scalar type',
      {
        name: 'invalidMap',
        type: 'MAP',
        required: false,
        container: { containerType: 'MAP', valueScalarType: 'STRING' },
      },
    ],
    [
      'MAP with an invalid key scalar type',
      {
        ...map('invalidMap'),
        container: { ...map('invalidMap').container, keyScalarType: 'MAP' },
      },
    ],
    [
      'MAP with an invalid value scalar type',
      {
        ...map('invalidMap'),
        container: { ...map('invalidMap').container, valueScalarType: 'MAP' },
      },
    ],
    [
      'ARRAY with a non-null key scalar type',
      {
        ...array('invalidArray'),
        container: {
          ...array('invalidArray').container,
          keyScalarType: 'STRING',
        },
      },
    ],
    [
      'field and container type mismatch',
      { ...map('mismatch'), type: 'ARRAY' },
    ],
    [
      'scalar with a container',
      { ...scalar('scalar'), container: map('map').container },
    ],
  ])('rejects a %s as invalid schema', (_description, field) => {
    expectDomainError(
      () => assertValidItemSchema(schema(field as unknown as Field)),
      {
        name: 'InvalidItemTypeSchemaError',
        status: 400,
        type: ErrorType.InvalidUserInput,
        field: field.name,
      },
    );
  });
});

describe('item type field roles', () => {
  const roleSchema = schema(
    scalar('created', false, 'DATETIME'),
    scalar('thread', false, 'RELATED_ITEM'),
    scalar('parent', false, 'RELATED_ITEM'),
    scalar('title'),
  );

  test('merges retained roles and explicitly cleared roles', () => {
    expect(
      mergeItemTypeRoleColumns(
        { created_at_field: 'created', display_name_field: 'title' },
        { created_at_field: undefined, display_name_field: null },
      ),
    ).toMatchObject({
      created_at_field: 'created',
      display_name_field: null,
    });
  });

  test.each([
    ['missing', { display_name_field: 'absent' }, 'does not exist'],
    [
      'wrong type',
      { display_name_field: 'created' },
      'must reference a STRING',
    ],
  ])('rejects a %s role field', (_case, roles, detail) => {
    expect(() =>
      assertValidItemTypeFieldRoles(roleSchema, 'CONTENT', roles),
    ).toThrow(
      expect.objectContaining({
        name: 'InvalidItemTypeSchemaError',
        detail: expect.stringContaining(detail),
      }),
    );
  });

  test('rejects invalid content role dependencies', () => {
    expect(() =>
      assertValidItemTypeFieldRoles(roleSchema, 'CONTENT', {
        parent_id_field: 'parent',
        created_at_field: 'created',
      }),
    ).toThrow(
      expect.objectContaining({
        name: 'InvalidItemTypeSchemaError',
        detail: expect.stringContaining('requires threadId and createdAt'),
      }),
    );
  });

  test('accepts valid content role dependencies', () => {
    expect(() =>
      assertValidItemTypeFieldRoles(roleSchema, 'CONTENT', {
        parent_id_field: 'parent',
        thread_id_field: 'thread',
        created_at_field: 'created',
      }),
    ).not.toThrow();
  });
});

describe('assertHiddenFieldsExist', () => {
  const itemSchema = schema(scalar('visible'), scalar('hidden'));

  test('accepts hidden fields present in the resulting schema', () => {
    expect(() => assertHiddenFieldsExist(itemSchema, ['hidden'])).not.toThrow();
  });

  test('rejects a hidden field absent from the schema', () => {
    expectDomainError(() => assertHiddenFieldsExist(itemSchema, ['missing']), {
      name: 'InvalidItemTypeHiddenFieldsError',
      status: 400,
      type: ErrorType.InvalidUserInput,
      field: 'missing',
    });
  });

  test('rejects duplicate schema field names before checking hidden fields', () => {
    expectDomainError(
      () =>
        assertHiddenFieldsExist(
          schema(scalar('duplicate'), scalar('duplicate')),
          ['duplicate'],
        ),
      {
        name: 'InvalidItemTypeSchemaError',
        status: 400,
        type: ErrorType.InvalidUserInput,
        field: 'duplicate',
      },
    );
  });
});
