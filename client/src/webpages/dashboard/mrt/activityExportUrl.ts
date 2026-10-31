import { type GQLRecentModerationActivityInput } from '../../../graphql/generated';
import { jsonParse, type JsonOf } from '../../../utils/typescript-types';
import { type DecisionOrAction } from './ManualReviewRecentDecisionsFilter';

export const ACTIVITY_EXPORT_PATH = '/api/v1/moderation_activity/export';

type ExportDecision = { type: string; actionIds?: string[] };

export function toExportDecisions(
  decisions: readonly JsonOf<DecisionOrAction>[] | undefined,
): ExportDecision[] | undefined {
  return decisions?.map((it) => {
    const decision = jsonParse(it);
    return decision.type === 'CUSTOM_ACTION'
      ? { type: decision.type, actionIds: [decision.actionId] }
      : { type: decision.type };
  });
}

export function buildActivityExportUrl(
  input: Omit<
    GQLRecentModerationActivityInput,
    'cursor' | 'limit' | 'decisions'
  > & { decisions?: ExportDecision[] },
): string {
  const params = new URLSearchParams({ input: JSON.stringify(input) });
  return `${ACTIVITY_EXPORT_PATH}?${params.toString()}`;
}

const MAX_EXPORT_SPAN_DAYS = 400;

export function exportRangeProblem(
  range: { startDate?: Date; endDate?: Date } | undefined,
  now: Date = new Date(),
): string | undefined {
  if (range?.startDate == null) {
    return 'Set a date range to download.';
  }
  const end = range.endDate ?? now;
  if (
    end.getTime() - range.startDate.getTime() >
    MAX_EXPORT_SPAN_DAYS * 86_400_000
  ) {
    return `Downloads are limited to ${MAX_EXPORT_SPAN_DAYS} days. Narrow the date range.`;
  }
  return undefined;
}
