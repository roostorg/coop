import {
  GQLConditionOutcome,
  GQLReportingRuleStatus,
  GQLRuleStatus,
  GQLUserPenaltySeverity,
  GQLUserRole,
} from '../../../../graphql/generated';
import { TableRow } from './tableFeatures';

interface RowWithValues extends Object {
  values: { [key: string]: any };
}
type Row<TData extends RowWithValues> = TableRow<TData>;

export function stringSort<TData extends RowWithValues>(
  rowA: Row<TData>,
  rowB: Row<TData>,
  columnId: string,
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

export function integerSort<TData extends RowWithValues>(
  rowA: Row<TData>,
  rowB: Row<TData>,
  columnId: string,
) {
  const parseInteger = (value: unknown) => {
    if (typeof value === 'number') {
      return Number.isNaN(value) ? 0 : value;
    }
    if (typeof value === 'string') {
      const parsed = Number(value.replaceAll(',', ''));
      return Number.isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  };

  const s1 = parseInteger(rowA.original.values[columnId]);
  const s2 = parseInteger(rowB.original.values[columnId]);
  return s1 > s2 ? 1 : s2 > s1 ? -1 : 0;
}

export function boolSort<TData extends RowWithValues>(
  rowA: Row<TData>,
  rowB: Row<TData>,
  columnId: string,
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
function enumSort<TData extends RowWithValues>(
  precedence: any[],
  rowA: Row<TData>,
  rowB: Row<TData>,
  columnId: string,
) {
  const s1 = rowA.original.values[columnId];
  const s2 = rowB.original.values[columnId];
  if (s1 === s2) {
    return 0;
  }
  return precedence.indexOf(s1) > precedence.indexOf(s2) ? 1 : -1;
}

export function ruleStatusSort<TData extends RowWithValues>(
  rowA: Row<TData>,
  rowB: Row<TData>,
  columnId: string,
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

export function reportingRuleStatusSort<TData extends RowWithValues>(
  rowA: Row<TData>,
  rowB: Row<TData>,
  columnId: string,
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

export function userRoleSort<TData extends RowWithValues>(
  rowA: Row<TData>,
  rowB: Row<TData>,
  columnId: string,
) {
  return enumSort(
    [GQLUserRole.Admin, GQLUserRole.RulesManager, GQLUserRole.Analyst],
    rowA,
    rowB,
    columnId,
  );
}

export function conditionOutcomeSort<TData extends RowWithValues>(
  rowA: Row<TData>,
  rowB: Row<TData>,
  columnId: string,
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

export function userPenaltySeveritySort<TData extends RowWithValues>(
  rowA: Row<TData>,
  rowB: Row<TData>,
  columnId: string,
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
 * Creates a date sort function that sorts by a raw date field from the row values
 * @param dateKey - the key to access the raw date value from rowA.original.values/rowB.original.values
 * @returns a sort function compatible with react-table
 */
export function dateSort(dateKey: string) {
  return <TData extends RowWithValues>(
    rowA: Row<TData>,
    rowB: Row<TData>,
    _columnId: string,
  ) => {
    const a = rowA.original.values[dateKey];
    const b = rowB.original.values[dateKey];

    // Handle null/undefined - push to bottom
    if (!a && !b) return 0;
    if (!a) return 1;
    if (!b) return -1;

    // Sort by timestamp (oldest first = smaller timestamp first)
    return (
      new Date(a as string | Date).getTime() -
      new Date(b as string | Date).getTime()
    );
  };
}
