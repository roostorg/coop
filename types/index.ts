import { isValid, parseJSON } from 'date-fns';
import { type Opaque } from 'type-fest';

// Simple way to make sure that a type T always extends a type U
// as the types change over time (and to get a type error if not).
// This is kinda analogous to the `satisfies` operator, but at the type level.
// See https://github.com/microsoft/TypeScript/issues/52222
type Satisfies<T extends U, U> = T;

// TODO: Representing geographical _points_ and _areas_ with the same scalar
// type is probably not ideal.
//
// NB: the ID type refers to ids for any type of entity, but USER_ID should be
// used instead for fields that hold ids of users coop might know about. E.g.,
// imagine a `Message` content type. Both the `to` and `from` fields could hold
// ScalarTypes.USER_IDs, and then a rule could flag the message if _either_ the
// sender or the recipient satisfies some condition (after passing the user id
// to a user-related signal).
export const ScalarTypes = makeEnumLike([
  'USER_ID',
  'ID',
  'STRING',
  'BOOLEAN',
  'NUMBER',
  'AUDIO',
  'IMAGE',
  'VIDEO',
  'DATETIME',
  'GEOHASH',
  'RELATED_ITEM',
  'URL',
  'POLICY_ID',
]);
export type ScalarTypes = typeof ScalarTypes;
export type ScalarType = keyof typeof ScalarTypes;

export const ContainerTypes = makeEnumLike(['ARRAY', 'MAP']);
export type ContainerTypes = typeof ContainerTypes;
export type ContainerType = keyof ContainerTypes;

const containerTypes = new Set(Object.values(ContainerTypes));

type ScalarTypeRuntimeTypeMapping = Satisfies<
  {
    [ScalarTypes.STRING]: string;
    [ScalarTypes.ID]: string;
    [ScalarTypes.USER_ID]: ItemIdentifier;
    [ScalarTypes.GEOHASH]: string;
    [ScalarTypes.URL]: UrlString;
    [ScalarTypes.BOOLEAN]: boolean;
    [ScalarTypes.NUMBER]: number;
    [ScalarTypes.DATETIME]: DateString;
    [ScalarTypes.AUDIO]: { url: string };
    [ScalarTypes.IMAGE]: { url: string };
    [ScalarTypes.VIDEO]: { url: string };
    [ScalarTypes.RELATED_ITEM]: RelatedItem;
    [ScalarTypes.POLICY_ID]: string;
  },
  { [K in ScalarType]: unknown }
>;

type ContainerTypeRuntimeTypeMapping<
  ValueType extends ScalarType = ScalarType,
> = Satisfies<
  {
    [ContainerTypes.ARRAY]: ScalarTypeRuntimeType<ValueType>[];
    // can just use a js object (not a Map) b/c the content came from JSON,
    // so the keys will have been strings
    [ContainerTypes.MAP]: { [key: string]: ScalarTypeRuntimeType<ValueType> };
  },
  { [K in ContainerType]: unknown }
>;

export type ScalarTypeRuntimeType<T extends ScalarType = ScalarType> =
  ScalarTypeRuntimeTypeMapping[T];

export type FieldType = ScalarType | ContainerType;

export type Container<T extends ContainerType> = Readonly<{
  // TODO: delete this key? (That would prevent mismatches between field.type
  // and field.container.containerType, but would require a migration and make
  // these item descriptions harder to process independently of the owning Field.)
  containerType: T;

  // NB: because the input content is JSON, the key types can really only be
  // types that are strings or losslessly/unambiguously convertible to strings.
  // Currently, though, the frontend (and so also our types here) don't perform
  // any validation and allow all types.
  keyScalarType: Satisfies<
    { [ContainerTypes.MAP]: ScalarType; [ContainerTypes.ARRAY]: null },
    { [K in ContainerType]: unknown }
  >[T];
  valueScalarType: ScalarType;
}>;

export type Field<T extends FieldType = FieldType> =
  | {
      [Type in ScalarType]: {
        name: string;
        type: Type;
        required: boolean;
        container: null;
      };
    }[ScalarType & T]
  | {
      [Type in ContainerType]: {
        name: string;
        type: Type;
        required: boolean;
        // NB: `container` is a misnomer, since really the _Field_ is the container.
        // This should be called "items" or similar, as it describes the shape of the items.
        container: Container<Type>;
      };
    }[ContainerType & T];

export type ContainerTypeRuntimeType<
  T extends ContainerType,
  V extends ScalarType = ScalarType,
> = ContainerTypeRuntimeTypeMapping<V>[T];

export type FieldTypeRuntimeType<
  T extends FieldType,
  ContainerValueType extends ScalarType = ScalarType,
> =
  | ScalarTypeRuntimeType<T & ScalarType>
  | ContainerTypeRuntimeType<T & ContainerType, ContainerValueType>;

/**
 * In the case of scalar fields, this returns the ScalarType of their single
 * value; in the case of container fields, it gives the type of the scalars in
 * the container (i.e., the ScalarType for the array's items or map's values).
 * With container fields, we don't track details at the type level of what
 * scalars they contain, so this type assumes it could be anything.
 */
export type FieldScalarType<T extends FieldType> = T extends ScalarType
  ? T
  : ScalarType;

/**
 * A TaggedScalar holds a scalar value, along with a label identifying its
 * ScalarTypes. This label is necessary because not all scalar values have a
 * unique js runtime representation (e.g., ScalarTypes.STRING and
 * ScalarTypes.GEOHASH are both represented as strings), so, without the label,
 * we wouldn't know unambiguously which ScalarType a value belongs to, which we
 * need sometimes (e.g., when deciding whether we can pass it to a signal).
 */
type EnumScalarType = ScalarTypes['STRING'] | ScalarTypes['NUMBER'];

export type TaggedScalar<T extends ScalarType> = {
  [K in ScalarType]:
    | { type: K; value: ScalarTypeRuntimeType<K> }
    | (K extends EnumScalarType
        ? {
            type: K;
            value: ScalarTypeRuntimeType<K>;
            enum: readonly ScalarTypeRuntimeType<K>[];
            ordered: boolean;
          }
        : never);
}[T];

export function isContainerField(it: Field): it is Field<ContainerType> {
  return isContainerType(it.type);
}

export function isContainerType(it: FieldType): it is ContainerType {
  return containerTypes.has(it as ContainerType);
}

export function getScalarType<T extends FieldType>(it: Field<T>) {
  return (
    isContainerField(it) ? it.container.valueScalarType : it.type
  ) as FieldScalarType<T>;
}

export function isMediaType(it: ScalarType): boolean {
  return (
    it === ScalarTypes.AUDIO ||
    it === ScalarTypes.VIDEO ||
    it === ScalarTypes.IMAGE
  );
}

export function isMediaValue<T extends ScalarType>(
  it: TaggedScalar<T>,
): it is TaggedScalar<
  T & (ScalarTypes['IMAGE'] | ScalarTypes['VIDEO'] | ScalarTypes['AUDIO'])
> {
  return isMediaType(it.type);
}

/**
 * Takes an array of strings and returns an object with a property for each
 * string in the array, where the string is used as both the name and value for
 * the property.
 *
 * This is useful to get type safety and automatic refactoring in some cases.
 * E.g., imagine you're setting the default value for a field on a Sequelize
 * model. Let's say the field can have three legal values: 'a', 'b', or 'c'.
 * So, you'll initialize the model with some config object for the field, like
 * `{ defaultValue: 'a' }`. Now, the type that this `defaultValue` key expects
 * will be very vague -- likely `string` or maybe even `any` -- because it was
 * defined by Sequelize and doesn't know about your field's specific legal
 * values. Therefore, you could write `{ defaultValue: 'invalid' }` and TS
 * wouldn't complain; moreover, even if you wrote `{ defaultValue: 'a' }`, which
 * would be correct at the time, a rename on the value 'a' would not
 * automatically rename the value here, because they're not linked by type.
 *
 * To fix these issues, it can be very helpful to have an object like
 * `const legalValues = { 'a': 'a', 'b': 'b', 'c': 'c' };` because, then,
 * you can do `{ defaultValues: legalValues.a }`, and you're guaranteed a typo-
 * free and rename-friendly value. That `legalValues` object is what this
 * function makes.
 *
 * Obviously, such an object is similar to a TS enum (hence this function's
 * name). The key difference, though, is that the values in this object are
 * typed as string literals, whereas the value for each case in an enum is
 * treated by the type system as intentionally opaque. So, having that
 * visibility in an 'enum-like' can help a lot with assignability, when the
 * source value is a string literal type (rather than the source having to have
 * been constructed with the same enum).
 *
 * We also exploit this for assigning values that come in from GraphQL. The
 * GraphQL value is an enum; we want to use a different type in our inner layers
 * (which shouldn't be coupled to GraphQL); but, if our internal type were an
 * enum, the GraphQL enum wouldn't be assignable to it (even if their runtime
 * values match). However, if the internal type is an "enum like", then TS will
 * allow GraphQL enum to be assignable to it iff the enum's runtime values are
 * legal values in the enum like.
 */
export function makeEnumLike<T extends string>(strings: readonly T[]) {
  return Object.fromEntries(strings.map((it) => [it, it])) as { [K in T]: K };
}

// This is a helper type for classifiers with subcategories. Different services
// have different structures. We will always compare a rule's subcategory
// value using the 'id' field.
export type SignalSubcategory = {
  id: string;
  label: string;
  description?: string;
  children: SignalSubcategory[];
};

export type DateString = Opaque<string, 'DateString'>;
export function parseDateString(it: DateString): Date {
  return new Date(it);
}
/**
 * Returns a DateString if the input string can be parsed
 * as a date; else undefined. Accepts strings in a rather limited set
 * of formats for now. (See {@link parseJSON} docs for details.)
 */
export function makeDateString(it: string) {
  const potentialDate = parseJSON(it);

  // check if the parsing succeeded; return accordingly
  return isValid(potentialDate)
    ? (potentialDate.toISOString() as DateString)
    : undefined;
}

export type RelatedItem = Satisfies<
  { id: string; typeId: string; name?: string },
  ItemIdentifier
>;

/**
 * UrlString represents a string that's known to be parsable into a valid URL;
 * analogous to DateString.
 */
export type UrlString = Opaque<string, 'UrlString'>;

// Items
export type ItemIdentifier = Readonly<{ id: string; typeId: string }>;

export const ItemTypeKind = makeEnumLike(['CONTENT', 'THREAD', 'USER']);
export type ItemTypeKind = keyof typeof ItemTypeKind;

// Integration plugin types (for third-party integrations and adopters' config)
export type {
  CoopIntegrationConfigEntry,
  CoopIntegrationPlugin,
  CoopIntegrationsConfig,
  IntegrationCredentialField,
  IntegrationId,
  IntegrationManifest,
  ModelCard,
  ModelCardField,
  ModelCardSection,
  ModelCardSubsection,
  StoredIntegrationConfigPayload,
} from './integration.js';
export {
  assertModelCardHasRequiredSections,
  isCoopIntegrationPlugin,
  REQUIRED_MODEL_CARD_SECTION_IDS,
} from './integration.js';
