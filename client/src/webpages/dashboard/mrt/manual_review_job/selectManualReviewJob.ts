export function selectManualReviewJob<T extends { id: string }>({
  closedJob,
  currentJobId,
  queriedJob,
  dequeuedJob,
}: {
  closedJob: T | null | undefined;
  currentJobId: string | undefined;
  queriedJob: T | null | undefined;
  // undefined means no dequeue result yet; null means the queue was exhausted.
  dequeuedJob: T | null | undefined;
}): T | undefined {
  if (closedJob != null) return closedJob;
  if (dequeuedJob === null) return undefined;
  if (currentJobId == null) return dequeuedJob;
  if (queriedJob?.id === currentJobId) return queriedJob;
  if (dequeuedJob?.id === currentJobId) return dequeuedJob;
  return undefined;
}
