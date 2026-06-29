// Pure helpers for describing how job-priority weights bias review order.
// Kept free of React/DOM imports so it can be unit-tested in a node env.

// Joins labels into a natural-language list ("A", "A and B", "A, B, and C").
export function joinWithAnd(items: ReadonlyArray<string>): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

// Plain-English summary of how the current weights bias review order.
// Data-driven so it scales automatically as more properties are added.
export function summarizeWeighting(
  entries: ReadonlyArray<{ label: string; weight: number }>,
): string {
  const active = entries
    .filter((e) => e.weight > 0)
    .sort((a, b) => b.weight - a.weight);

  if (active.length === 0) {
    return 'All weights are 0, so these queues fall back to first-in, first-out order — nothing here changes review priority.';
  }
  if (active.length === 1) {
    return `Your queue order is weighted entirely toward ${active[0].label}.`;
  }

  const total = active.reduce((sum, e) => sum + e.weight, 0);
  const allEqual = active.every((e) => e.weight === active[0].weight);
  if (allEqual) {
    return `Your queue order is weighted evenly across ${joinWithAnd(
      active.map((e) => e.label),
    )}.`;
  }

  const [top, ...rest] = active;
  const intensity = top.weight / total >= 0.7 ? 'heavily toward' : 'toward';
  return `Your queue order is weighted ${intensity} ${top.label}, with some weight on ${joinWithAnd(
    rest.map((e) => e.label),
  )}.`;
}
