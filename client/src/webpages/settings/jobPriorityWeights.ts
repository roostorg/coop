import { GQLJobPriorityProperty } from '@/graphql/generated';

// Human-readable labels + per-property help text, plus a note shown only when a
// weight is set to 0 (i.e. the property is disabled). Shared by the Review
// Console settings tab and its Job Priority Weights section.
export const JOB_PRIORITY_PROPERTY_LABELS: ReadonlyArray<{
  property: GQLJobPriorityProperty;
  label: string;
  help: string;
  example: (weight: number) => string;
}> = [
  {
    property: GQLJobPriorityProperty.NumReports,
    label: '# of User Reports',
    help: 'Items with more user reports are reviewed sooner. Each report adds the weight to the item’s score. Set to 0 to ignore.',
    example: (w) =>
      w === 0
        ? "Currently disabled: report counts won't affect queue order."
        : '',
  },
  {
    property: GQLJobPriorityProperty.UserScore,
    label: 'User Score',
    help: "Items from users with a history of policy violations are reviewed sooner. Coop assigns each user a moderation score from 1 to 5 based on the ratio of penalties they've received to total submissions. 1 means many penalties (likely a repeat offender), 5 is the default for new or clean users. Set to 0 to ignore user history.",
    example: (w) =>
      w === 0
        ? "Currently disabled: user history won't affect queue order."
        : '',
  },
];

export type JobPriorityWeightMap = Map<GQLJobPriorityProperty, number>;

export function jobPriorityRowsToMap(
  rows: ReadonlyArray<{ property: GQLJobPriorityProperty; weight: number }>,
): JobPriorityWeightMap {
  return new Map(rows.map((r) => [r.property, r.weight]));
}

// Build the mutation input from the current form state: one entry per known
// property (properties left blank/zero are still persisted so an admin's intent
// to explicitly disable a property survives).
export function jobPriorityWeightsInput(weights: JobPriorityWeightMap): {
  weights: ReadonlyArray<{ property: GQLJobPriorityProperty; weight: number }>;
} {
  return {
    weights: JOB_PRIORITY_PROPERTY_LABELS.map(({ property }) => ({
      property,
      weight: weights.get(property) ?? 0,
    })),
  };
}

// True when the form state diverges from the persisted rows for any known
// property (treating a missing/blank value as 0).
export function jobPriorityWeightsChanged(
  saved: ReadonlyArray<{ property: GQLJobPriorityProperty; weight: number }>,
  current: JobPriorityWeightMap,
): boolean {
  const savedMap = jobPriorityRowsToMap(saved);
  return JOB_PRIORITY_PROPERTY_LABELS.some(
    ({ property }) =>
      (current.get(property) ?? 0) !== (savedMap.get(property) ?? 0),
  );
}
