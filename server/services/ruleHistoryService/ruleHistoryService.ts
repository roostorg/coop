/**
 * @fileoverview This service exports various functions for querying rule
 * history/versions.
 *
 * Making the rule_versions view into a sequelize model wouldn't really make
 * sense, since the view is read-only, so many of the sequelize static methods
 * (`Model.update()` et al, plus the general idea of mutable instances to later
 * `save()`) don't apply. So we just expose these queries.
 */
import { sql, type Kysely } from 'kysely';
import _ from 'lodash';
import { type CamelCasedProperties, type Simplify } from 'type-fest';

import { inject } from '../../iocContainer/index.js';
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

// The db tables that this service should be able to "see"/query.
type RuleHistoryServicePg = { rule_versions: RuleVersion };

type VersionedField = Exclude<
  keyof PublicRuleVersion,
  'id' | 'isCurrent' | 'approxVersion' | 'exactVersion'
>;

export const makeGetSimplifiedRuleHistory = inject(
  ['KyselyPg'],
  function (db: Kysely<RuleHistoryServicePg>) {
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

  return startDate
    ? allVersions.filter(
        (_, i) =>
          // Always keep the last version (which is what we're looking at if
          // i == allVersions.length - 1), because that's definitely still
          // in effect at the start date. Then, if we're not looking at the
          // last version, keep this version if the _next_ version was
          // created after the start date (which'd mean this was the version
          // in effect _at_ the start date). The overall result here is to
          // keep last version created at or before the start date, plus all
          // created after it.
          i === allVersions.length - 1 ||
          allVersions[i + 1].approxVersion > startDate,
      )
    : allVersions;
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
  db: Kysely<RuleHistoryServicePg>,
  fields: readonly K[],
  ruleIds?: readonly string[],
  numVersions?: number,
) {
  // To build our query, we convert the camelCased fields from the public
  // interface to their snake_case names in the db. In terms of the types, we:
  //
  // 1. want TS to verify that  `CamelToSnakeCase<K> extends keyof RuleVersion`.
  //    I.e., we want TS to check that each snake_cased-version of an incoming
  //    field actually corresponds to a column in the db. Unfortunately, TS
  //    isn't smart enough for this. But, it can check that
  //    `CamelToSnakeCase<VersionedField> extends keyof RuleVersion`, so we'll
  //    have it do that. We then know that `K extends VersionedField`.
  //
  // 2. We want `K` to influence the return type. E.g., if K is `'name'`, then
  //    the returned object can't have any other PublicRuleVersion fields
  //    (except `id` and `exactVersion`). However, we have to throw away some
  //    type information about exactly which fields we're selecting by "up
  //    casting" from CamelToSnakeCase<K>[] to simply (keyof RuleVersion)[],
  //    because `CamelToSnakeCase<K>` is too dynamic for kysely (which'll try to
  //    inspect these strings to verify that they're valid column names,
  //    possibly with aliases).
  //
  // The type annotation on `dbFields` has TS verify point (1) above, and the
  // cast on the return type from `execute()` recovers the info about which
  // fields might have been selected in our final results.
  const dbFieldsAndAliases = _.uniq(fields).map((publicField) => [
    camelToSnakeCase(publicField),
    publicField,
  ]);

  const dbFields: readonly (keyof RuleVersion)[] = dbFieldsAndAliases.map(
    ([dbField]) => dbField,
  ) as readonly CamelToSnakeCase<VersionedField>[];

  // The idea here is to select all version rows for the relevant rules, but
  // then add a column to each result that identifies all rows that have the
  // same values for the consumer's `fields` of interest. This group identifier
  // is just the first version that had that set of values for the given fields.
  // This choice of identifier proves convenient below, since we want to merge
  // the first version that had each set of `fields` values with version rows
  // that immediately follow it, when the only changes in the immediately
  // following rows are irrelevant from the POV of our consumer's `fields`.
  const versionsWithFirstVersionGroupId = db
    .selectFrom('rule_versions')
    .select([
      ...dbFields,
      'id',
      'version',
      sql<string>`first_value(version)
          OVER (
            PARTITION BY id, ${sql.join(dbFields.map((it) => sql.ref(it)))}
            ORDER BY version asc
          )`.as('first_version'),
    ])
    .$if(ruleIds != null, (qb) => qb.where('id', 'in', ruleIds!))
    .orderBy('version', 'asc');

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
  const simplifiedHistoryQuery = db
    .selectFrom(
      db
        .selectFrom(versionsWithFirstVersionGroupId.as('t1'))
        .select([
          'id',
          ...dbFields,
          sql<string | null>`CASE
              WHEN lag(first_version, 1, version)
                      OVER (PARTITION BY id ORDER BY version asc) <> first_version
                THEN version
              WHEN first_version = version THEN version
              ELSE NULL
            END`.as('version'),
        ])
        .as('t2'),
    )
    .select([
      'id',
      ...dbFieldsAndAliases.map(([field, alias]) => sql.ref(field).as(alias)),
      sql<string>`version::text`.as('exactVersion'),
    ])
    .where('version', 'is not', null);

  if (numVersions) {
    simplifiedHistoryQuery.limit(numVersions);
  }

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
      return simplifiedHistoryQuery.compile();
    },
  };
}

export type GetSimplifiedRuleHistory = ReturnType<
  typeof makeGetSimplifiedRuleHistory
>;
