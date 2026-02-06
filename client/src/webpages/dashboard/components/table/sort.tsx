import capitalize from 'lodash/capitalize';
import { IdType, Row } from 'react-table';

import {
  GQLConditionOutcome,
  GQLReportingRuleStatus,
  GQLRuleStatus,
  GQLUserPenaltySeverity,
  GQLUserRole,
} from '../../../../graphql/generated';

interface RowWithValues extends Object {
  values: { [key: string]: any };
}

export function stringSort(
  rowA: Row<RowWithValues>,
  rowB: Row<RowWithValues>,
  columnId: IdType<RowWithValues>,
  desc?: boolean,
) {
  const s1 = rowA.original.values[columnId];
  const s2 = rowB.original.values[columnId];
  if (s1 == null) {
    return -1;
  }
  if (s2 == null || s1 > s2) {
    return 1;
  }
  if (s2 > s1) {
    return -1;
  }
  return 0;
}

export function integerSort(
  rowA: Row<RowWithValues>,
  rowB: Row<RowWithValues>,
  columnId: IdType<RowWithValues>,
  desc?: boolean,
) {
  // the values come formatted with commas, so we remove all
  // comma characters before doing any parsing or comparison
  const s1 = parseInt(rowA.original.values[columnId].replaceAll(',', ''));
  const s2 = parseInt(rowB.original.values[columnId].replaceAll(',', ''));
  return s1 > s2 ? 1 : s2 > s1 ? -1 : 0;
}

export function boolSort(
  rowA: Row<RowWithValues>,
  rowB: Row<RowWithValues>,
  columnId: IdType<RowWithValues>,
  desc?: boolean,
) {
  const s1 = rowA.original.values[columnId];
  const s2 = rowB.original.values[columnId];
  if (s1 == null) {
    return -1;
  }
  if (s2 == null) {
    return 1;
  }
  if (s1 && !s2) {
    return 1;
  }
  if (!s1 && s2) {
    return -1;
  }
  return 0;
}

/**
 * Allows us to sort columns with enum values according to a predetermined
 * precedence, rather than alphabetical/numerical order of the enum values
 * @param precedence - an ordered array containing all the enum values in a
 * particular enum
 * @param rowA - the first row containing the enum value to compare in a
 * standard sorting function
 * @param rowB - the second row containing the enum value to compare in a
 * standard sorting function
 * @param columnId - the ID (aka the accessor prop) of the column we're sorting
 * @returns - -1, 0, or 1 corresponding to the standard sorting return value
 */
function enumSort(
  precedence: any[],
  rowA: Row<RowWithValues>,
  rowB: Row<RowWithValues>,
  columnId: IdType<RowWithValues>,
) {
  const s1 = rowA.original.values[columnId];
  const s2 = rowB.original.values[columnId];
  if (s1 === s2) {
    return 0;
  }
  precedence = precedence.map((val) => capitalize(val.toLowerCase()));
  return precedence.indexOf(s1) > precedence.indexOf(s2) ? 1 : -1;
}

export function ruleStatusSort(
  rowA: Row<RowWithValues>,
  rowB: Row<RowWithValues>,
  columnId: IdType<RowWithValues>,
  __?: boolean,
) {
  return enumSort(
    [
      GQLRuleStatus.Live,
      GQLRuleStatus.Background,
      GQLRuleStatus.Draft,
      GQLRuleStatus.Expired,
    ],
    rowA,
    rowB,
    columnId,
  );
}

export function reportingRuleStatusSort(
  rowA: Row<RowWithValues>,
  rowB: Row<RowWithValues>,
  columnId: IdType<RowWithValues>,
  __?: boolean,
) {
  return enumSort(
    [
      GQLReportingRuleStatus.Live,
      GQLReportingRuleStatus.Background,
      GQLReportingRuleStatus.Draft,
      GQLReportingRuleStatus.Archived,
    ],
    rowA,
    rowB,
    columnId,
  );
}

export function userRoleSort(
  rowA: Row<RowWithValues>,
  rowB: Row<RowWithValues>,
  columnId: IdType<RowWithValues>,
  __?: boolean,
) {
  return enumSort(
    [GQLUserRole.Admin, GQLUserRole.RulesManager, GQLUserRole.Analyst],
    rowA,
    rowB,
    columnId,
  );
}

export function conditionOutcomeSort(
  rowA: Row<RowWithValues>,
  rowB: Row<RowWithValues>,
  columnId: IdType<RowWithValues>,
  __?: boolean,
) {
  return enumSort(
    [
      GQLConditionOutcome.Passed,
      GQLConditionOutcome.Failed,
      GQLConditionOutcome.Inapplicable,
      GQLConditionOutcome.Errored,
    ],
    rowA,
    rowB,
    columnId,
  );
}

export function userPenaltySeveritySort(
  rowA: Row<RowWithValues>,
  rowB: Row<RowWithValues>,
  columnId: IdType<RowWithValues>,
  __?: boolean,
) {
  return enumSort(
    [
      GQLUserPenaltySeverity.Severe,
      GQLUserPenaltySeverity.High,
      GQLUserPenaltySeverity.Medium,
      GQLUserPenaltySeverity.Low,
      GQLUserPenaltySeverity.None,
    ],
    rowA,
    rowB,
    columnId,
  );
}

/**
 * Creates a date sort function that sorts by a raw date field from the original row data
 * @param dateKey - the key to access the raw date value from rowA.original/rowB.original
 * @returns a sort function compatible with react-table
 */
export function dateSort(dateKey: string) {
  return (
    rowA: Row<RowWithValues>,
    rowB: Row<RowWithValues>,
    columnId: IdType<RowWithValues>,
    desc?: boolean,
  ) => {
    const a = (rowA.original as unknown as Record<string, unknown>)[dateKey];
    const b = (rowB.original as unknown as Record<string, unknown>)[dateKey];

    // Handle null/undefined - push to bottom
    if (!a && !b) return 0;
    if (!a) return 1;
    if (!b) return -1;

    // Sort by timestamp (oldest first = smaller timestamp first)
    return new Date(a as string | Date).getTime() - new Date(b as string | Date).getTime();
  };
}
