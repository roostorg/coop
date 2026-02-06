import * as knexPkg from 'knex';
import type { Knex } from 'knex';

const { knex } = knexPkg.default;

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
 * To do that generically, we need to use a query builder that'll let us build
 * queries programmatically/work with them as data structures, so we use knex.
 * This function, then implements the "take last n" operation given an unsorted
 * knex select query and some sort criteria.
 *
 * @param unsortedSelectQuery The query that selects the set of items (without
 *   them being sorted) from which we want to take the last n, after sorting.
 *
 * @param sortCriteria The criteria that should be used to sort the items
 *   returned by unsortedSelectQuery, before we can take the last n items.
 *   NB: the column names provided here must refer to one of the columns
 *   selected by `unsortedSelectQuery`, under that column's final alias. E.g.,
 *   if unsortedSelectQuery is `SELECT a as "hello" from table`, then you can
 *   only provide "hello" as the sort criteria; not "a", and not some unselected
 *   column "b".
 *
 * @param size How many items to take.
 *
 * @param client The name of the knex client to use. This effects the
 *   SQL-dialect-specific settings that knex might apply to the generated query.
 *   NB: these dialect-specific settings potentially include data escaping rules
 *   that could be relevant for SQL injection.
 *
 * @param subqueryAlias Internally, this query generates a subquery, and SQL
 *   mandates that that subquery be given an alias. In theory, there's maybe
 *   some risk of that alias
 *
 * @returns A new knex query that selects the last n items, after sorting.
 */
export function takeLast<T extends object>(
  unsortedSelectQuery: Knex.QueryBuilder<T>,
  sortCriteria: {
    column: (keyof T & string) | Knex.Raw;
    order: 'desc' | 'asc';
  }[],
  size: number,
  client: string = 'pg',
) {
  // SQL requires that the subquery we create have an alias. I don't _think_
  // there's risk of that name causing a naming conflict, but I haven't thought
  // too hard about all the scoping implications, so, to be safe, we give this
  // alias a very-unlikely-to-conflict name.
  const subqueryAlias = 'dc2d41a9-082e-48b0-a66f-345a22696b02';

  const inner = unsortedSelectQuery
    .clone()
    .orderBy(
      sortCriteria.map((it) => ({
        // Cast here is because I think the knex typings are just wrong.
        // They suggest that `column` has to be a string, but, actually,
        // we can sort on arbitrary expressesions contained in a `knex.raw`.
        column: it.column as keyof T & string,
        order: it.order === 'desc' ? ('asc' as const) : ('desc' as const),
      })),
    )
    .limit(size);

  return knex({ client })
    .select('*')
    .from<T>(inner.as(subqueryAlias))
    .orderBy(
      // Cast here is same as above.
      sortCriteria as ((typeof sortCriteria)[number] & { column: string })[],
    );
}
