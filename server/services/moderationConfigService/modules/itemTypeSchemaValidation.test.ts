import { type Field, type ScalarType } from '@roostorg/coop-types';

import { ErrorType } from '../../../utils/errors.js';
import { type ItemSchema } from '../types/itemTypes.js';
import {
  assertBackwardCompatibleItemSchema,
  assertHiddenFieldsExist,
  assertValidItemSchema,
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
  test('accepts unique field names', () => {
    expect(() =>
      assertValidItemSchema(schema(scalar('one'), scalar('two'))),
    ).not.toThrow();
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
      'an existing container definition is missing',
      schema(array('field')),
      schema({
        name: 'field',
        type: 'ARRAY',
        required: false,
        container: null,
      } as unknown as Field),
      'field',
    ],
    [
      'a container definition is added to an existing malformed field',
      schema({
        name: 'field',
        type: 'ARRAY',
        required: false,
        container: null,
      } as unknown as Field),
      schema(array('field')),
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
