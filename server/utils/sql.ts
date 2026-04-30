import type { Kysely, SelectQueryBuilder } from 'kysely';

/**
 * When paginating backwards (i.e., the user's on page 5 and asks for page 4
 * by requesting `last: n, before: "firstCursorOnPage5"`), we need to take
 * results _from the end_. E.g., imagine the paginated collection is
 * [1, 2, 3, 4, 5], and let's say each page has 2 items. If the user starts on
 * the last page ([4, 5]), then the prior page should be [2, 3]. This means
 * first filtering the the results to exclude those that are >= 4, but then
 * taking two items _from the end_ of those results that remain.
 *
 * However, SQL doesn't have a "take from the end" operation (i.e., LIMIT always
 * takes from the start, and drops the remaining). So, to implement "take the
 * last 2" generically, you need to sort the items in reverse order, apply a
 * LIMIT, then reverse the result.
 *
 * This function implements that pattern on a Kysely select query.
 *
 * @param db Kysely instance used only to build the outer `select * from (…)`.
 *   It must use the same dialect as `unsortedSelectQuery`.
 *
 * @param unsortedSelectQuery The query that selects the set of items (without
 *   them being sorted) from which we want to take the last n, after sorting.
 *
 * @param sortCriteria The criteria that should be used to sort the items
 *   returned by unsortedSelectQuery, before we can take the last n items.
 *   NB: the column names provided here must refer to one of the columns
 *   selected by `unsortedSelectQuery`, under that column's final alias. E.g.,
 *   if the select is `DS as date`, then sort criteria must use `date`, not
 *   `DS`.
 *
 * @param size How many items to take.
 *
 * @returns A Kysely query that selects the last n items, after sorting.
 */
const SUBQUERY_ALIAS = 'dc2d41a9-082e-48b0-a66f-345a22696b02';

export function takeLast<
  DB,
  TB extends keyof DB,
  O extends Record<string, unknown>,
>(
  db: Kysely<DB>,
  unsortedSelectQuery: SelectQueryBuilder<DB, TB, O>,
  sortCriteria: readonly { column: keyof O & string; order: 'desc' | 'asc' }[],
  size: number,
) {
  let inner = unsortedSelectQuery.clearOrderBy();
  for (const it of sortCriteria) {
    inner = inner.orderBy(
      it.column,
      it.order === 'desc' ? 'asc' : 'desc',
    );
  }
  inner = inner.limit(size);

  // Chaining `orderBy` in a loop widens `outer` to an incompatible union; the
  // builder is still the same concrete Kysely select at runtime.
  let outer = db.selectFrom(inner.as(SUBQUERY_ALIAS)).selectAll() as SelectQueryBuilder<
    DB & { [K in typeof SUBQUERY_ALIAS]: O },
    typeof SUBQUERY_ALIAS,
    O
  >;
  for (const it of sortCriteria) {
    outer = outer.orderBy(it.column, it.order);
  }
  return outer;
}
