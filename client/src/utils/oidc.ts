export function normalizeIssuerDomain(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';

  try {
    const url = new URL(
      /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`,
    );
    return url.hostname;
  } catch (_) {
    return trimmed
      .replace(/^https?:\/\//i, '')
      .split('/')[0]
      ?.trim()
      .replace(/\/$/, '') ?? trimmed;
  }
}

export function isValidIssuerDomain(value: string) {
  try {
    const normalized = normalizeIssuerDomain(value);
    if (!normalized) return false;

    const url = new URL(`https://${normalized}`);
    return url.hostname.includes('.') && url.hostname === normalized;
  } catch (_) {
    return false;
  }
}
