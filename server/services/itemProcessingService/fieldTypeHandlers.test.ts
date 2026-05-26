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
    describe('IP_ADDRESS', () => {
      const { coerce } = fieldTypeHandlers[ScalarTypes.IP_ADDRESS];

      test('accepts valid IPv4 addresses', () => {
        expect(coerce('192.0.2.1', [])).toBe('192.0.2.1');
        expect(coerce('203.0.113.255', [])).toBe('203.0.113.255');
      });

      test('accepts valid IPv6 addresses', () => {
        expect(coerce('2001:db8::1', [])).toBe('2001:db8::1');
        expect(coerce('::1', [])).toBe('::1');
      });

      test('treats empty / whitespace-only strings as field omitted (returns null)', () => {
        expect(coerce('', [])).toBeNull();
        expect(coerce('   ', [])).toBeNull();
        expect(coerce('\t\n', [])).toBeNull();
      });

      test('strips leading/trailing whitespace before validating', () => {
        expect(coerce(' 192.0.2.1', [])).toBe('192.0.2.1');
        expect(coerce('192.0.2.1 ', [])).toBe('192.0.2.1');
        expect(coerce(' 2600:1700:10f0:6d60:7007:c2c9:d164:bb47', [])).toBe(
          '2600:1700:10f0:6d60:7007:c2c9:d164:bb47',
        );
      });

      test('rejects malformed IPs and non-string inputs', () => {
        expect(coerce('not-an-ip', [])).toBeInstanceOf(Error);
        expect(coerce('999.999.999.999', [])).toBeInstanceOf(Error);
        expect(coerce('192.0.2.1 extra', [])).toBeInstanceOf(Error);
        expect(coerce(42, [])).toBeInstanceOf(Error);
        expect(coerce({ ip: '192.0.2.1' }, [])).toBeInstanceOf(Error);
      });
    });

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
            fc.property(dummyContainerFieldArb, (containerField) => {
              expect(
                (handlers as (typeof fieldTypeHandlers)[ContainerType]).coerce(
                  null,
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
