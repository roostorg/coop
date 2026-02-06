import {
  ContainerTypes,
  isContainerType,
  ScalarTypes,
  type ContainerType,
  type Field,
  type ScalarType,
} from '@roostorg/types';
import fc from 'fast-check';

import { FieldArbitrary } from '../../test/arbitraries/ContentType.js';
import { fieldTypeHandlers } from './fieldTypeHandlers.js';

describe('Content type schemas', () => {
  describe('fieldTypeHandlers', () => {
    test('should never accept null as a valid field value', () => {
      for (const [fieldType, handlers] of Object.entries(fieldTypeHandlers)) {
        if (!isContainerType(fieldType as keyof typeof fieldTypeHandlers)) {
          expect(
            (handlers as (typeof fieldTypeHandlers)[ScalarType]).coerce(
              null,
              [],
            ),
          ).toBeInstanceOf(Error);
        } else {
          const dummyContainerFieldArb = FieldArbitrary.filter(
            (it) => it.type === fieldType,
          ) as fc.Arbitrary<Field<ContainerType>>;

          fc.assert(
            // eslint-disable-next-line no-loop-func
            fc.property(dummyContainerFieldArb, (containerField) => {
              expect(
                (handlers as (typeof fieldTypeHandlers)[ContainerType]).coerce(
                  null as never,
                  [],
                  containerField.container as never,
                ),
              ).toBeInstanceOf(Error);
            }),
          );
        }
      }

      // Check in values of container types too.
      expect(
        fieldTypeHandlers[ContainerTypes.MAP].coerce({ hello: null }, [], {
          containerType: ContainerTypes.MAP,
          keyScalarType: ScalarTypes.STRING,
          valueScalarType: ScalarTypes.STRING,
        }),
      ).toBeInstanceOf(Error);
      expect(
        fieldTypeHandlers[ContainerTypes.ARRAY].coerce([null], [], {
          containerType: ContainerTypes.ARRAY,
          keyScalarType: null,
          valueScalarType: ScalarTypes.STRING,
        }),
      ).toBeInstanceOf(Error);
    });
  });
});
