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
