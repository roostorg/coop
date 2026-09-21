import { type Field, type ScalarType } from '@roostorg/coop-types';

import { ErrorType } from '../../../utils/errors.js';
import { type ItemSchema } from '../types/itemTypes.js';
import {
  assertBackwardCompatibleItemSchema,
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

describe('assertBackwardCompatibleItemSchema', () => {
  const current = schema(scalar('required', true), scalar('optional'));

  test.each([
    ['current', schema(scalar('duplicate'), scalar('duplicate')), current],
    ['proposed', current, schema(scalar('duplicate'), scalar('duplicate'))],
  ])(
    'rejects duplicate field names in the %s schema',
    (_side, old, proposed) => {
      expectDomainError(
        () => assertBackwardCompatibleItemSchema(old, proposed),
        {
          name: 'InvalidItemTypeSchemaError',
          status: 400,
          type: ErrorType.InvalidUserInput,
          field: 'duplicate',
        },
      );
    },
  );

  test.each([
    ['an identical schema', current],
    ['field reordering', schema(scalar('optional'), scalar('required', true))],
    [
      'relaxing an existing required field',
      schema(scalar('required'), scalar('optional')),
    ],
    [
      'adding an optional scalar field',
      schema(...current, scalar('newScalar')),
    ],
    ['adding an optional ARRAY field', schema(...current, array('newArray'))],
    ['adding an optional MAP field', schema(...current, map('newMap'))],
  ])('accepts %s', (_description, proposed) => {
    expect(() =>
      assertBackwardCompatibleItemSchema(current, proposed),
    ).not.toThrow();
  });

  test.each([
    [
      'an existing field is removed',
      current,
      schema(scalar('required', true)),
      'optional',
    ],
    [
      'an old name is replaced by a new name',
      current,
      schema(scalar('required', true), scalar('renamed')),
      'optional',
    ],
    [
      'a scalar type changes',
      schema(scalar('field')),
      schema(scalar('field', false, 'NUMBER')),
      'field',
    ],
    [
      'a scalar changes to a container',
      schema(scalar('field')),
      schema(array('field')),
      'field',
    ],
    [
      'a container changes to a scalar',
      schema(array('field')),
      schema(scalar('field')),
      'field',
    ],
    [
      'a container type changes',
      schema(array('field')),
      schema(map('field')),
      'field',
    ],
    [
      'a MAP key scalar changes',
      schema(map('field')),
      schema(map('field', false, 'NUMBER')),
      'field',
    ],
    [
      'a container value scalar changes',
      schema(array('field')),
      schema(array('field', false, 'NUMBER')),
      'field',
    ],
    [
      'a new required field is added',
      current,
      schema(...current, scalar('newRequired', true)),
      'newRequired',
    ],
    [
      'an existing optional field becomes required',
      current,
      schema(scalar('required', true), scalar('optional', true)),
      'optional',
    ],
  ])('rejects when %s', (_description, oldSchema, proposed, field) => {
    expectDomainError(
      () => assertBackwardCompatibleItemSchema(oldSchema, proposed),
      {
        name: 'ItemTypeSchemaIncompatibleError',
        status: 409,
        type: ErrorType.Conflict,
        field,
      },
    );
  });

  test.each([
    [
      'proposed container definition is missing',
      schema(array('field')),
      schema({
        name: 'field',
        type: 'ARRAY',
        required: false,
        container: null,
      } as unknown as Field),
    ],
    [
      'current container definition is missing',
      schema({
        name: 'field',
        type: 'ARRAY',
        required: false,
        container: null,
      } as unknown as Field),
      schema(array('field')),
    ],
  ])(
    'rejects when the %s as invalid schema',
    (_description, oldSchema, proposed) => {
      expectDomainError(
        () => assertBackwardCompatibleItemSchema(oldSchema, proposed),
        {
          name: 'InvalidItemTypeSchemaError',
          status: 400,
          type: ErrorType.InvalidUserInput,
          field: 'field',
        },
      );
    },
  );
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
