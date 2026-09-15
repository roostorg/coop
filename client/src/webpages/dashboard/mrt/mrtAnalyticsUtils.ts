import { TimeWindow } from '../rules/dashboard/visualization/RulesDashboardInsights';

/**
 * Previous period of equal inclusive duration, ending 1ms before the current
 * window so inclusive filters do not overlap.
 */
export function getPreviousInclusiveTimeWindow(
  timeWindow: TimeWindow,
): TimeWindow {
  const durationMs = timeWindow.end.getTime() - timeWindow.start.getTime() + 1;
  return {
    start: new Date(timeWindow.start.getTime() - durationMs),
    end: new Date(timeWindow.start.getTime() - 1),
  };
}

export function filterCountsInTimeWindow<
  T extends { readonly date: string | Date; count: number },
>(arr: readonly T[] | null | undefined, window: TimeWindow) {
  return arr?.filter((elemWithDate) => {
    const time = new Date(elemWithDate.date).getTime();
    return time >= window.start.getTime() && time <= window.end.getTime();
  });
}

export function secondsBetween(
  later: string | Date,
  earlier: string | Date,
): number {
  return Math.round(
    (new Date(later).getTime() - new Date(earlier).getTime()) / 1000,
  );
}

export function getDecisionTimingFields(decision: {
  createdAt: string | Date;
  assignedAt?: string | Date | null;
  jobCreatedAt?: string | Date | null;
}): { handleTimeSeconds: number | ''; waitTimeSeconds: number | '' } {
  return {
    handleTimeSeconds:
      decision.assignedAt != null
        ? secondsBetween(decision.createdAt, decision.assignedAt)
        : '',
    waitTimeSeconds:
      decision.assignedAt != null && decision.jobCreatedAt != null
        ? secondsBetween(decision.assignedAt, decision.jobCreatedAt)
        : '',
  };
}

export const RECENT_DECISIONS_CSV_HEADERS = [
  'Decisions',
  'Policies',
  'Reviewer',
  'Queue',
  'Job Created At',
  'Claimed At',
  'Decision Time',
  'Wait Time (sec)',
  'Handle Time (sec)',
  'Decision Reason',
  'Link',
] as const;
