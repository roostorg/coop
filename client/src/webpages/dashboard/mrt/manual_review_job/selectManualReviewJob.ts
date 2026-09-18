export function selectManualReviewJob<T>({
  closedJob,
  queriedJob,
  dequeuedJob,
}: {
  closedJob: T | null | undefined;
  queriedJob: T | null | undefined;
  dequeuedJob: T | null | undefined;
}): T | undefined {
  return closedJob ?? queriedJob ?? dequeuedJob ?? undefined;
}
