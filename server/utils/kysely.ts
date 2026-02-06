import {
  type InsertQueryBuilder,
  type Selection,
  type SelectQueryBuilder,
  type SelectType,
} from 'kysely';
import { type IfAny, type Simplify, type UnionToIntersection } from 'type-fest';

import { type PickEach } from './typescript-types.js';

export const isUniqueViolationError = isPgErrorWithCode.bind(null, '23505');
export const isForeignKeyViolationError = isPgErrorWithCode.bind(null, '23503');
export const isNotNullViolationError = isPgErrorWithCode.bind(null, '23502');
export const isCheckViolationError = isPgErrorWithCode.bind(null, '23514');

// See https://github.com/postgres/postgres/blob/eb81e8e7902f63c4d292638edc8b7e92b766a692/src/backend/utils/errcodes.txt#L227
function isPgErrorWithCode(code: string, error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === code
  );
}

type SelectionToAliasMap<T extends string> = Simplify<
  UnionToIntersection<
    T extends `${infer RawColumn} as ${infer Alias}`
      ? { [K in RawColumn]: Alias }
      : { [K in T]: K }
  >
>;

type PickEachNoAliasing<
  RowType,
  SelectionType extends readonly string[],
> = PickEach<
  RowType,
  keyof SelectionToAliasMap<SelectionType[number]> & keyof RowType
>;

type ApplyAliases<
  UnaliasedRowType,
  SelectionType extends readonly string[],
> = UnaliasedRowType extends object
  ? SelectionToAliasMap<SelectionType[number]> extends {
      [k: string]: string;
    }
    ? ApplyAlias<UnaliasedRowType, SelectionToAliasMap<SelectionType[number]>>
    : never
  : never;

type ApplyAlias<T extends object, AliasMap extends { [k: string]: string }> = {
  [K in keyof T as AliasMap[K & keyof AliasMap]]: SelectType<T[K]>;
};

/**
 * Kysely represents the type of each row as an object type (with the ability to
 * have different types per column on SELECT/INSERT/UPDATE). However, if certain
 * fields have correlated types (e.g., if column `a` can be type `X | Y` and
 * column `b` can be type `A | B`, but column `a` having type `X` implies column
 * `b` must have type `Y`), kysely has no way to capture this in query results,
 * because it computes the type of the returned selection (i.e., portion of a
 * row) on a column-by-column basis.
 *
 * This type is solely designed to work around that problem. You give it:
 *
 * - RowTypeUnion: a type for your row which contains a union type to capture
 *   the correlation between fields;
 * - SelectionType: a list of column names (optionally with aliases) matching
 *   exactly what you'd pass to `builder.select()` in kysely. This could also be
 *   a list of keys (with aliases and possibly partial) that are going to
 *   represent the row in an insert/update.
 * - ConditionalSelectionType: a kysely query can have columns that are _only
 *   sometimes_ selected using $if() calls. This type should be a list of column
 *   names (optionally with aliases) matching the conditional selection. See
 *   https://github.com/kysely-org/kysely/blob/e4de7bb8f7f22ad5d7af72dfe0285eb7a85cdd9a/site/docs/recipes/conditional-selects.md
 * - Mode: an indication of whether the produced type is supposed to represent
 *   the shape of the data as it's needed in an insert, update, or select.
 *
 * Then, it returns a union type, with only the keys in the selection and with
 * their aliases applied, for the row.
 */
export type FixKyselyRowCorrelation<
  RowTypeUnion,
  SelectionType extends readonly string[],
  ConditionalSelectionType extends readonly string[] = [],
> = Simplify<
  ApplyAliases<PickEachNoAliasing<RowTypeUnion, SelectionType>, SelectionType> &
    Partial<
      ApplyAliases<
        PickEachNoAliasing<RowTypeUnion, ConditionalSelectionType>,
        ConditionalSelectionType
      >
    >
>;

// When a kysely select query includes a $if() call, the type of the
// SelectQueryBuilder's third parameter, which reflects the shape of the query's
// returned rows, is set by Kysely to be:
// `MergePartial<RequiredSelection, SelectionWhenTheIfConditionIsTrue>`.
// In the FixSingleTableSelectRowType, we need to extract these two selections,
// so we duplicate Kysely's definition of MergePartial here so that we can use
// it FixSingleTableSelectRowType.
type MergePartial<T1, T2> = T1 & Partial<Omit<T2, keyof T1>>;

/**
 * A small abstraction over `FixKyselyRowCorrelation` that only works for SELECT
 * queries on single tables (no joins; no subqueries) or INSERT queries with
 * `RETURNING`, but that saves boilerplate in those cases, by taking the type of
 * the whole `SelectQueryBuilder`/`InsertQueryBuilder` as it's only required
 * parameter.
 */
export type FixSingleTableReturnedRowType<
  // prettier-ignore
  Builder extends
    | // eslint-disable-next-line @typescript-eslint/no-explicit-any
    SelectQueryBuilder<any, any, Selection<any, any, any>>
    | // eslint-disable-next-line @typescript-eslint/no-explicit-any
    InsertQueryBuilder<any, any, Selection<any, any, any>>,
  WhereClause = unknown,
> =
  // We need to destructure the two selections out of the MergePartial in order
  // to properly track that the second set of columns are optional in the
  // result. See `MergePartial` and https://github.com/roostorg/coop/pull/1248
  Builder extends SelectQueryBuilder<
    infer DB,
    infer TB,
    MergePartial<
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      infer Part1 extends Selection<any, any, any>,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      infer Part2 extends Selection<any, any, any>
    >
  >
    ? Part1 extends Selection<DB, TB, infer Sel1>
      ? Part2 extends Selection<DB, TB, infer Sel2>
        ? FixKyselyRowCorrelation<
            DB[TB] & WhereClause,
            readonly (Sel1 & string)[],
            IfAny<Sel2, readonly [], readonly (Sel2 & string)[]>
          >
        : never
      : never
    : Builder extends
        | SelectQueryBuilder<
            infer DB,
            infer TB,
            Selection<infer DB, infer TB, infer SelectionType>
          >
        | InsertQueryBuilder<
            infer DB,
            infer TB,
            Selection<infer DB, infer TB, infer SelectionType>
          >
    ? FixKyselyRowCorrelation<
        DB[TB] & WhereClause,
        readonly (SelectionType & string)[],
        []
      >
    : never;

/**
 * Creates an object with a key, where the type of the value for that key
 * excludes a given value.
 *
 * E.g., `Excluding<{ a: 'foo' | 'bar' }, 'a', 'foo'>` is `{ a: 'bar' }`.
 *
 * K can be a union type to exclude V from all keys in the union.
 *
 * Similarly, V can be a union type to exclude all values in the union, assuming
 * that the values being excluded are legal values for every given key.
 */
export type Excluding<O extends object, K extends keyof O, V extends O[K]> = {
  [K2 in K]: Exclude<O[K2], V>;
};
