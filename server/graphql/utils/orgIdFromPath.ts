/**
 * Read the `orgId` path param (e.g. `/saml/login/:orgId/callback`), returning
 * `undefined` when it is missing or not a string. Callers decide how to handle
 * its absence (typically a not-found error).
 */
export function getOrgIdFromPath(req: {
  params: Record<string, unknown>;
}): string | undefined {
  const rawOrgId = req.params['orgId'];
  return typeof rawOrgId === 'string' ? rawOrgId : undefined;
}
