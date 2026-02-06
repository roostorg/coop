import {
  ContainerTypes,
  makeDateString,
  ScalarTypes,
  type Field,
  type ScalarType,
  type ScalarTypeRuntimeType,
} from '@roostorg/types';
import fc from 'fast-check';
import Geohash from 'latlon-geohash';
import _ from 'lodash';

import { derivedFieldTypes } from '../../services/derivedFieldsService/index.js';
import { type NormalizedItemData } from '../../services/itemProcessingService/index.js';
import { instantiateOpaqueType } from '../../utils/typescript-types.js';
import { enumToArbitrary } from '../propertyTestingHelpers.js';
import { CoopInputArbitrary } from './Shared.js';

export const ScalarTypeArbitrary = enumToArbitrary(ScalarTypes);
export const ContainerTypeArbitrary = enumToArbitrary(ContainerTypes);
export const FieldTypeArbitrary = fc.oneof(
  ScalarTypeArbitrary,
  ContainerTypeArbitrary,
);

// ScalarTypeRuntimeTypes
export const LocationAreaArbitrary = fc.record({
  id: fc.uuid(),
  geometry: fc.record({
    center: fc.record({ lat: fc.double(), lng: fc.double() }),
    radius: fc.double({ min: 0 }),
  }),
});

export const GeohashArbitrary = fc
  .tuple(
    fc.double({ min: -90, max: 90, noNaN: true }),
    fc.double({ min: -180, max: 180, noNaN: true }),
  )
  .map(([lat, lng]) => {
    try {
      return Geohash.encode(lat, lng);
    } catch (e) {
      console.error(e, lat, lng);
      throw e;
    }
  });

export const DateStringArbitrary = fc
  .date()
  .map((date) => makeDateString(date.toISOString())!);

// Id-like fields allow numbers and strings as inputs, but the normalized
// representation always has them coerced to a string.
export const IdLikeArbitrary = fc.string();

export const MediaUrlArbitrary = fc.record({ url: fc.string() /* todo */ });

export const RelatedItemArbitrary = fc.record({
  id: fc.string(),
  typeId: fc.string(),
  name: fc.string(),
});

export const ScalarValidValuesArbitraries = {
  [ScalarTypes.AUDIO]: MediaUrlArbitrary,
  [ScalarTypes.BOOLEAN]: fc.boolean(),
  [ScalarTypes.GEOHASH]: GeohashArbitrary,
  [ScalarTypes.ID]: IdLikeArbitrary,
  [ScalarTypes.IMAGE]: MediaUrlArbitrary,
  [ScalarTypes.NUMBER]: fc.oneof(
    fc.integer(),
    fc.float({ noNaN: true, noDefaultInfinity: true }),
  ),
  [ScalarTypes.STRING]: fc.string(),
  [ScalarTypes.URL]: fc.webUrl({ validSchemes: ['http', 'https'] }),
  [ScalarTypes.USER_ID]: IdLikeArbitrary,
  [ScalarTypes.VIDEO]: MediaUrlArbitrary,
  [ScalarTypes.DATETIME]: DateStringArbitrary,
  [ScalarTypes.RELATED_ITEM]: RelatedItemArbitrary,
  [ScalarTypes.POLICY_ID]: IdLikeArbitrary,
};

export const ScalarFieldArbitrary = fc
  .tuple(ScalarTypeArbitrary, fc.string(), fc.boolean())
  .map<Field<ScalarType>>(([scalarType, name, required]) => ({
    name,
    required,
    type: scalarType,
    container: null,
  }));

export const ScalarFieldWithValueArbitrary = ScalarFieldArbitrary.chain(
  (field) =>
    fc.tuple(fc.constant(field), ScalarValidValuesArbitraries[field.type]),
);

export const ArrayFieldArbitrary = fc
  .tuple(ScalarTypeArbitrary, fc.string(), fc.boolean())
  .map<Field<ContainerTypes['ARRAY']>>(([scalarType, name, required]) => ({
    name,
    required,
    type: ContainerTypes.ARRAY,
    container: {
      containerType: ContainerTypes.ARRAY,
      keyScalarType: null,
      valueScalarType: scalarType,
    },
  }));

export const ArrayFieldWithValueArbitrary = ArrayFieldArbitrary.chain((field) =>
  fc.tuple(
    fc.constant(field),
    fc.array<ScalarTypeRuntimeType>(
      ScalarValidValuesArbitraries[field.container.valueScalarType],
    ),
  ),
);

export const MapFieldArbitrary = fc
  .tuple(
    ScalarTypeArbitrary,
    fc.oneof(fc.constant(ScalarTypes.STRING), fc.constant(ScalarTypes.NUMBER)),
    fc.string(),
    fc.boolean(),
  )
  .map<Field<ContainerTypes['MAP']>>(
    ([valueScalarType, keyScalarType, name, required]) => ({
      name,
      required,
      type: ContainerTypes.MAP,
      container: {
        containerType: ContainerTypes.MAP,
        keyScalarType,
        valueScalarType,
      },
    }),
  );

export const MapFieldWithValueArbitrary = MapFieldArbitrary.chain((field) =>
  fc.tuple(
    fc.constant(field),
    fc
      .array(
        fc.tuple(
          ScalarValidValuesArbitraries[field.container.keyScalarType],
          ScalarValidValuesArbitraries[field.container.valueScalarType],
        ),
      )
      .map(
        (entries) =>
          // TODO: there actually is something wrong here, because the key
          // scalar types, need to be more limited in the schemas we accept.
          Object.fromEntries(entries) as {
            [k: string]: ScalarTypeRuntimeType;
          },
      ),
  ),
);

export const FieldArbitrary = fc.oneof(
  ScalarFieldArbitrary,
  ArrayFieldArbitrary,
  MapFieldArbitrary,
);

export const FieldWithValidValueArbitrary = fc.oneof(
  ScalarFieldWithValueArbitrary,
  ArrayFieldWithValueArbitrary,
  MapFieldWithValueArbitrary,
);

export const ValidItemDataWithSchema = fc
  .array(FieldWithValidValueArbitrary)
  .map((it) => _.uniqBy(it, ([f]) => f.name))
  .map((fieldsWithValues) => ({
    schema: fieldsWithValues.map((it) => it[0]),
    data: instantiateOpaqueType<NormalizedItemData>(
      Object.fromEntries(
        fieldsWithValues
          .filter(([field]) => (field.required ? true : Math.random() > 0.5))
          .map(([field, value]) => [field.name, value] as const),
      ),
    ),
  }));

export const DeriviationTypeArbitrary = fc.constantFrom(...derivedFieldTypes);

export const DerivedFieldSpecSourceArbitrary = fc.oneof(
  fc.record({ type: fc.constant('FULL_ITEM' as const) }),
  fc.record({
    type: fc.constant('CONTENT_FIELD' as const),
    name: fc.string(),
    contentTypeId: fc.string(),
  }),
  fc.record({
    type: fc.constant('CONTENT_COOP_INPUT' as const),
    name: CoopInputArbitrary,
  }),
);

export const DerivedFieldSpecArbitrary = fc.record({
  derivationType: DeriviationTypeArbitrary,
  source: DerivedFieldSpecSourceArbitrary,
});
