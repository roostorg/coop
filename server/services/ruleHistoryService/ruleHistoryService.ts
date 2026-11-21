/**
 * @fileoverview This service exports various functions for querying rule
 * history/versions. The underlying `rule_versions` view is read-only, so this
 * surface intentionally only exposes queries — no mutations.
 */
import { asc, inArray, isNotNull, sql, type SQLWrapper } from 'drizzle-orm';
import { type PgColumn } from 'drizzle-orm/pg-core';
import _ from 'lodash';
import { type CamelCasedProperties, type Simplify } from 'type-fest';

import { inject } from '../../iocContainer/utils.js';
import { schema, type CoopDb } from '../../storage/postgres/drizzle.js';
import { camelToSnakeCase } from '../../utils/misc.js';
import {
  type Bind1,
  type CamelToSnakeCase,
} from '../../utils/typescript-types.js';
import {
  type ConditionSet,
  type RuleStatus,
} from '../moderationConfigService/index.js';

// A rule version as stored in the db.
type RuleVersion = {
  id: string;
  version: Date;
  name: string;
  status_if_unexpired: Exclude<RuleStatus, typeof RuleStatus.EXPIRED>;
  tags: string[];
  max_daily_actions: number;
  org_id: string;
  creator_id: string;
  expiration_time?: Date;
  condition_set: ConditionSet;
  action_ids: string[];
  item_type_ids: string[];
  is_current: boolean;
};

// A rule version as exposed from this service. We pick so that new properties
// on RuleVersion don't automatically become part of the public interface.
// NB: `version` explicitly excluded, in favor of the two versioning keys below.
type PublicRuleVersion = Simplify<
  CamelCasedProperties<
    Pick<
      RuleVersion,
      | 'id'
      | 'name'
      | 'status_if_unexpired'
      | 'tags'
      | 'max_daily_actions'
      | 'org_id'
      | 'creator_id'
      | 'expiration_time'
      | 'condition_set'
      | 'action_ids'
      | 'item_type_ids'
      | 'is_current'
    >
  > & {
    approxVersion: Date;
    exactVersion: string;
  }
>;

type VersionedField = Exclude<
  keyof PublicRuleVersion,
  'id' | 'isCurrent' | 'approxVersion' | 'exactVersion'
>;

export const makeGetSimplifiedRuleHistory = inject(
  ['DrizzlePg'],
  function (db: CoopDb) {
    return async function <K extends VersionedField>(
      ...getHistoryArgs: Parameters<Bind1<typeof getSimplifiedRuleHistory<K>>>
    ) {
      return getSimplifiedRuleHistory<K>(
        async (...buildQueryArgs) =>
          buildSimplifiedHistoryQuery(db, ...buildQueryArgs).execute(),
        ...getHistoryArgs,
      );
    };
  },
);

/**
 * Returns a simplified version history that only reports a new version for
 * when a field of interest changed. The versions are returned in
 * chronological order (i.e., older versions first).
 *
 * Lots and lots of types of changes can create a new rule version, but each
 * user of the rule version history is only gonna care about changes to a
 * subset of the fields. E.g., one consumer might just wanna know when a
 * rule's actions changed, while another might wanna know when its conditions
 * changed. So, this function allows consumers to specify a subset of fields
 * they're interested in, and get a condensed version history that only notes
 * the new versions resulting from a change to one of those fields.
 *
 * @param getRawHistory A function that knows how to query the underlying data.
 *   This is only passed in to facilitate mocking it during testing. When the
 *   service function is registered for DI, it'll have been partially applied
 *   away (see above).
 * @param fields - The fields to look for changes in.
 * @param ruleIds - The rules to get the history for (defaults to all rules).
 * @param startDate - If given, we'll only return versions created later than
 *   this date.
 */
export async function getSimplifiedRuleHistory<K extends VersionedField>(
  getRawHistory: (
    fields: readonly K[],
    ruleIds?: readonly string[],
    numVersions?: number,
  ) => Promise<
    (Partial<Pick<PublicRuleVersion, K>> &
      Pick<PublicRuleVersion, 'id' | 'exactVersion'>)[]
  >,
  fields: readonly K[],
  ruleIds?: readonly string[],
  startDate?: Date,
) {
  // NB: if given a start date, it's tricky to filter in the db, because the
  // version in effect at the start date could've been created an arbitrary
  // amount of time before the start date. E.g., if the start date is
  // 2022-06-01, we can't just ask for versions created on or after
  // 2022-06-01, because that will exclude the version that was in effect on
  // 2022-06-01, which could've been created any time before that. So, we
  // want to return "all versions created on or after the start date, plus
  // one version right before that", which is hard to experss in sql [though
  // we could do it by issuing two queries, if not filtering in the db
  // eventually becomes a perf issue]. For now, though, we get back all
  // the versions and filter here, client-side.
  const allVersions = (await getRawHistory(fields, ruleIds)).map((it) => ({
    ...it,
    approxVersion: new Date(it.exactVersion),
  }));

  if (!startDate) {
    return allVersions;
  }

  // "Version in effect at startDate, plus later versions" is per rule. The
  // raw list is every rule concatenated; applying the neighbor check globally
  // drops a rule whose next *row* belongs to a different, older rule.
  return Object.values(_.groupBy(allVersions, (it) => it.id))
    .flatMap((versions) => {
      const ordered = [...versions].sort(
        (a, b) => a.approxVersion.getTime() - b.approxVersion.getTime(),
      );
      return ordered.filter(
        (_, i) =>
          i === ordered.length - 1 || ordered[i + 1].approxVersion > startDate,
      );
    })
    .sort((a, b) => a.approxVersion.getTime() - b.approxVersion.getTime());
}

/**
 * This function builds a SQL query that'll be run as part of determining the
 * version history of a rule with respect to the given fields.
 *
 * It's really an internal implementation detail, but it's exported for testing,
 * since we don't have a great way to mock kysely right now that'll let us see
 * the query being executed and sub in a mock return value.
 *
 * The return value only exposes the `execute()` and `compile()` methods, which
 * is justified by the fact that we don't want callers to be able to modify the
 * query further (as it is an implementation detail), but is actually motivated
 * by the fact that throwing away all the interim kysely SelectQueryBuilder type
 * params makes it easier for us to make TS happy when we partially apply
 * getSimplifiedRuleHistory with this.
 */
export function buildSimplifiedHistoryQuery<K extends VersionedField>(
  db: CoopDb,
  fields: readonly K[],
  ruleIds?: readonly string[],
  // Never applied: the Kysely version called `.limit()` without using the
  // (immutable) builder it returned. Kept that way to preserve behaviour.
  _numVersions?: number,
) {
  // To build our query, we convert the camelCased fields from the public
  // interface to their snake_case names in the db. The type annotation on
  // `dbFields` has TS verify that every snake_cased VersionedField is a
  // column of the view; `versionColumns` maps each name to its model column,
  // so the selected values keep the column's decoding (e.g. timestamptz ->
  // Date), which raw `sql` fragments would lose. The cast on the return type
  // from `execute()` recovers the info about which fields were selected.
  const dbFieldsAndAliases = _.uniq(fields).map(
    (publicField) =>
      [
        camelToSnakeCase(publicField) as CamelToSnakeCase<VersionedField>,
        publicField,
      ] as const,
  );

  const dbFields: readonly CamelToSnakeCase<VersionedField>[] =
    dbFieldsAndAliases.map(([dbField]) => dbField);

  const v = schema.ruleVersions;

  // The idea here is to select all version rows for the relevant rules, but
  // then add a column to each result that identifies all rows that have the
  // same values for the consumer's `fields` of interest. This group identifier
  // is just the first version that had that set of values for the given fields.
  // This choice of identifier proves convenient below, since we want to merge
  // the first version that had each set of `fields` values with version rows
  // that immediately follow it, when the only changes in the immediately
  // following rows are irrelevant from the POV of our consumer's `fields`.
  const t1 = db
    .select({
      ...pickColumns(dbFields),
      id: v.id,
      version: v.version,
      firstVersion: sql<Date>`first_value(${v.version})
          OVER (
            PARTITION BY ${v.id}, ${sql.join(
              dbFields.map((it) => versionColumns[it]),
              sql`, `,
            )}
            ORDER BY ${v.version} asc
          )`.as('first_version'),
    })
    .from(v)
    .where(ruleIds != null ? inArray(v.id, [...ruleIds]) : undefined)
    .orderBy(asc(v.version))
    .as('t1');

  // When we build our condensed version history, unfortunately we can't just
  // return the first row that had each set of `fields` values (with
  // first_version as it's version), because a set of values could come up
  // twice, with a change in between, and we need to reflect that. E.g.,
  // imagine the user's interested in one field `name`; the version history
  // could be:
  //
  //   { name: 'xyz', version: date1, first_version: date1 }
  //   { name: 'xyz', version: date2, first_version: date1 } // something besides name changed; first_version still good.
  //   { name: 'abc', version: date3, first_version: date3 } // new name, but also a new first_version
  //   { name: 'xyz', version: date4, first_version: date1 } // whoops, can't use first version for this
  //
  // So, the final history needs `('xyz', date1), ('abc', date3), ('xyz', date4)`.
  // To do that, there are a lot of edge cases, but we basically identify the
  // moments that a version changes in a salient way (i.e., when the set of
  // salient fields differs between adjacent raw versions), and only track the
  // versions of those moments (setting other rows to have a null version).
  // Then, we discard the null-versioned rows.
  const t1Fields = t1 as unknown as Record<string, SQLWrapper>;
  const t2 = db
    .select({
      id: t1.id,
      ...Object.fromEntries(dbFields.map((it) => [it, t1Fields[it]])),
      version: sql<Date | null>`CASE
              WHEN lag(${t1.firstVersion}, 1, ${t1.version})
                      OVER (PARTITION BY ${t1.id} ORDER BY ${t1.version} asc) <> ${t1.firstVersion}
                THEN ${t1.version}
              WHEN ${t1.firstVersion} = ${t1.version} THEN ${t1.version}
              ELSE NULL
            END`.as('version'),
    })
    .from(t1)
    .as('t2');

  const t2Fields = t2 as unknown as Record<string, SQLWrapper>;
  const simplifiedHistoryQuery = db
    .select({
      id: t2.id,
      ...Object.fromEntries(
        dbFieldsAndAliases.map(([field, alias]) => [
          alias,
          sql`${t2Fields[field]}`.mapWith(versionColumns[field]),
        ]),
      ),
      exactVersion: sql<string>`${t2.version}::text`,
    })
    .from(t2)
    .where(isNotNull(t2.version));

  return {
    async execute() {
      return simplifiedHistoryQuery.execute() as Promise<
        // NB: this is partial because K could be 'name' | 'tags' when the
        // fields array is actually just ['name'], for example.
        (Partial<Pick<PublicRuleVersion, K>> &
          Pick<PublicRuleVersion, 'id' | 'exactVersion'>)[]
      >;
    },
    compile() {
      const { sql, params } = simplifiedHistoryQuery.toSQL();
      return { sql, parameters: params };
    },
  };
}

const versionColumns = {
  name: schema.ruleVersions.name,
  status_if_unexpired: schema.ruleVersions.statusIfUnexpired,
  tags: schema.ruleVersions.tags,
  max_daily_actions: schema.ruleVersions.maxDailyActions,
  org_id: schema.ruleVersions.orgId,
  creator_id: schema.ruleVersions.creatorId,
  expiration_time: schema.ruleVersions.expirationTime,
  condition_set: schema.ruleVersions.conditionSet,
  action_ids: schema.ruleVersions.actionIds,
  item_type_ids: schema.ruleVersions.itemTypeIds,
} satisfies Record<CamelToSnakeCase<VersionedField>, PgColumn>;

function pickColumns(names: readonly (keyof typeof versionColumns)[]) {
  return Object.fromEntries(names.map((it) => [it, versionColumns[it]]));
}

export type GetSimplifiedRuleHistory = ReturnType<
  typeof makeGetSimplifiedRuleHistory
>;
