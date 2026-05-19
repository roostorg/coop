/** Pure helpers for filtering NCMEC submission lists. Lives in its own file
 * (no deps on the wider service container) so it can be unit-tested without
 * pulling in DB clients or the IoC bottle. */

/** Subtracts the set of successful submission keys from a list of NCMEC
 * decisions, returning only decisions whose `(userId, userItemTypeId)` pair
 * does NOT have a corresponding successful report row. */
export function filterDecisionsToFailedSubmissions<
  D extends { userId: string; userItemTypeId: string },
>(
  decisions: readonly D[],
  successfulKeys: readonly { userId: string; userItemTypeId: string }[],
): D[] {
  // NUL is a delimiter chosen because real userId / userItemTypeId values
  // never contain it; this avoids ambiguity between e.g. ('a','bc') and
  // ('ab','c') that a naive concatenation would conflate.
  const successfulKeySet = new Set(
    successfulKeys.map((k) => `${k.userId}\u0000${k.userItemTypeId}`),
  );
  return decisions.filter(
    (d) => !successfulKeySet.has(`${d.userId}\u0000${d.userItemTypeId}`),
  );
}
