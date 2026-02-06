import { isContainerField } from '@roostorg/types';
import fc from 'fast-check';

import {
  ArrayFieldWithValueArbitrary,
  FieldArbitrary,
  MapFieldWithValueArbitrary,
  ScalarFieldWithValueArbitrary,
  ValidItemDataWithSchema,
} from '../../test/arbitraries/ContentType.js';
import { instantiateOpaqueType } from '../../utils/typescript-types.js';
import {
  getFieldValueOrValues,
  getValuesFromFields,
} from './extractItemDataValues.js';
import { type NormalizedItemData } from './toNormalizedItemDataOrErrors.js';

describe('getFieldValueOrValues', () => {
  test('should return single values for scalar type fields', () => {
    fc.assert(
      fc.property(ScalarFieldWithValueArbitrary, ([field, value]) => {
        // Manually instantiate opaque type because we trust our arbitraries to
        // return field values that match the field type's normalized form.
        const normalizedContent = instantiateOpaqueType<NormalizedItemData>({
          x: true,
          [field.name]: value,
        });

        expect(getFieldValueOrValues(normalizedContent, field)).toEqual({
          type: field.type,
          value,
        });
      }),
    );
  });

  test('should return arrays for array type fields', () => {
    fc.assert(
      fc.property(ArrayFieldWithValueArbitrary, ([field, value]) => {
        const normalizedContent = instantiateOpaqueType<NormalizedItemData>({
          x: true,
          [field.name]: value,
        });

        expect(getFieldValueOrValues(normalizedContent, field)).toEqual(
          value.map((it) => ({
            type: field.container.valueScalarType,
            value: it,
          })),
        );
      }),
    );
  });

  test('should return value arrays for map type fields', () => {
    fc.assert(
      fc.property(MapFieldWithValueArbitrary, ([field, value]) => {
        const normalizedContent = instantiateOpaqueType<NormalizedItemData>({
          x: true,
          [field.name]: value,
        });

        expect(getFieldValueOrValues(normalizedContent, field)).toEqual(
          Object.values(value).map((it) => ({
            type: field.container.valueScalarType,
            value: it,
          })),
        );
      }),
    );
  });

  test("should return undefined or empty array if a field is missing in the submission, based on field's scalar-ness", () => {
    fc.assert(
      fc.property(FieldArbitrary, (field) => {
        expect(
          getFieldValueOrValues(
            instantiateOpaqueType<NormalizedItemData>({}),
            field,
          ),
        ).toEqual(isContainerField(field) ? [] : undefined);
      }),
    );
  });
});

describe('getValuesFromFields', () => {
  test("should always return an array that's the concatenation of the individual results", () => {
    fc.assert(
      fc.property(ValidItemDataWithSchema, ({ schema, data }) => {
        // some subset of the final (merged) keys to check
        const fieldsToCheck = schema.slice(0, 3);
        const allValues = getValuesFromFields(data, fieldsToCheck);

        const valuesOneByOne = fieldsToCheck.flatMap(
          (field) => getFieldValueOrValues(data, field) ?? [],
        );

        expect(allValues).toEqual(valuesOneByOne);
      }),
    );
  });
});
