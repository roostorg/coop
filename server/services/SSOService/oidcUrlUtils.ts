export function normalizeIssuerUrl(raw: string): string {
  return `https://${raw.replace(/^https?:\/\//, '').replace(/\/$/, '')}`;
}
