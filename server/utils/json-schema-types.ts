/**
 * @fileoverview These types help with typing JSON schemas. They're all copied
 * from AJV v7 (https://github.com/ajv-validator/ajv/blob/master/lib/types/json-schema.ts),
 * but then **modified for JSON Schema draft 4's format** where needed.
 */

// These types mostly come from the Ajv package and are just meant to be flexible
// to generate TS types from JSON Schema values, so it's fine for them to have `any`s.
/* eslint-disable  @typescript-eslint/no-explicit-any */

type UnionToIntersection<U> = (U extends any ? (_: U) => void : never) extends (
  _: infer I,
) => void
  ? I
  : never;

export type SomeJSONSchema = UncheckedJSONSchemaType<JSON, true>;

export type PartialSchema<T> = Partial<UncheckedJSONSchemaType<T, true>>;

type JSONType<
  T extends string,
  IsPartial extends boolean,
> = IsPartial extends true ? T | undefined : T;

interface NumberKeywords {
  minimum?: number;
  maximum?: number;
  // In JSON Schema draft 6, exclusiveMinimum and exclusiveMaximum are numbers.
  // But, for draft 4, they are bools that change the interpretation of max/min.
  exclusiveMinimum?: boolean;
  exclusiveMaximum?: boolean;
  multipleOf?: number;
  format?: string;
}

interface StringKeywords {
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
}

type UncheckedJSONSchemaType<T, IsPartial extends boolean> = (
  | // these two unions allow arbitrary unions of types
  {
      anyOf: readonly UncheckedJSONSchemaType<T, IsPartial>[];
    }
  | {
      oneOf: readonly UncheckedJSONSchemaType<T, IsPartial>[];
    }
  // this union allows for { type: (primitive)[] } style schemas
  | ({
      type: readonly (T extends number
        ? JSONType<'number' | 'integer', IsPartial>
        : T extends string
        ? JSONType<'string', IsPartial>
        : T extends boolean
        ? JSONType<'boolean', IsPartial>
        : T extends null
        ? JSONType<'null', IsPartial>
        : never)[];
    } & UnionToIntersection<
      T extends number
        ? NumberKeywords
        : T extends string
        ? StringKeywords
        : T extends boolean
        ? // eslint-disable-next-line @typescript-eslint/ban-types
          {}
        : never
    >)
  // this covers "normal" types; it's last so typescript looks to it first for errors
  | ((T extends number
      ? {
          type: JSONType<'number' | 'integer', IsPartial>;
        } & NumberKeywords
      : T extends string
      ? {
          type: JSONType<'string', IsPartial>;
        } & StringKeywords
      : T extends boolean
      ? {
          type: JSONType<'boolean', IsPartial>;
        }
      : T extends readonly [any, ...any[]]
      ? {
          // JSON AnySchema for tuple
          type: JSONType<'array', IsPartial>;
          items: {
            readonly [K in keyof T]-?: UncheckedJSONSchemaType<T[K], false> &
              Nullable<T[K]>;
          } & { length: T['length'] };
          minItems: T['length'];
        } & ({ maxItems: T['length'] } | { additionalItems: false })
      : T extends readonly any[]
      ? {
          type: JSONType<'array', IsPartial>;
          items: UncheckedJSONSchemaType<T[0], false>;
          minItems?: number;
          maxItems?: number;
          uniqueItems?: true;
          additionalItems?: never;
        }
      : T extends Record<string, any>
      ? {
          // JSON AnySchema for records and dictionaries
          // "required" is not optional because it is often forgotten
          // "properties" are optional for more concise dictionary schemas
          // "patternProperties" and can be only used with interfaces that have string index
          type: JSONType<'object', IsPartial>;
          additionalProperties?:
            | boolean
            | UncheckedJSONSchemaType<T[string], false>;
          properties?: IsPartial extends true
            ? Partial<PropertiesSchema<T>>
            : PropertiesSchema<T>;
          patternProperties?: Record<
            string,
            UncheckedJSONSchemaType<T[string], false>
          >;
          dependencies?: {
            [K in keyof T]?: Readonly<(keyof T)[]> | PartialSchema<T>;
          };
          dependentSchemas?: { [K in keyof T]?: PartialSchema<T> };
          minProperties?: number;
          maxProperties?: number;
        } & (IsPartial extends true // "required" is not necessary if it's a non-partial type with no required keys // are listed it only asserts that optional cannot be listed. // "required" type does not guarantee that all required properties
          ? { required: Readonly<(keyof T)[]> }
          : [RequiredMembers<T>] extends [never]
          ? { required?: Readonly<RequiredMembers<T>[]> }
          : { required: Readonly<RequiredMembers<T>[]> })
      : T extends null
      ? { type: JSONType<'null', IsPartial> }
      : never) & {
      allOf?: Readonly<PartialSchema<T>[]>;
      anyOf?: Readonly<PartialSchema<T>[]>;
      oneOf?: Readonly<PartialSchema<T>[]>;
      not?: PartialSchema<T>;
    })
) & {
  [keyword: string]: any;
  id?: string; // was not $id until draft 6.
  $ref?: string;
  definitions?: Record<string, UncheckedJSONSchemaType<JSON, true>>;
};

export type JSONSchemaV4<T> = UncheckedJSONSchemaType<T, false>;

export type JSON =
  | { [key: string]: JSON }
  | JSON[]
  | number
  | string
  | boolean
  | null;

export type PropertiesSchema<T> = {
  [K in keyof T]-?:
    | (UncheckedJSONSchemaType<T[K], false> & Nullable<T[K]>)
    | { $ref: string };
};

export type RequiredMembers<T> = {
  [K in keyof T]-?: undefined extends T[K] ? never : K;
}[keyof T];

type Nullable<T> = undefined extends T
  ? {
      enum?: Readonly<(T | null)[]>; // `null` must be explicitly included in "enum" for `null` to pass
      default?: T | null;
    }
  : {
      enum?: Readonly<T[]>;
      default?: T;
    };

/* eslint-enable  @typescript-eslint/no-explicit-any */
