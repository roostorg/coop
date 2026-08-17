export function normalizeIssuerDomain(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  if (!URL.canParse(withScheme)) {
    // Not a parseable URL — strip scheme and take host segment only as best effort
    return (
      trimmed
        .replace(/^https?:\/\//i, '')
        .split('/')[0]
        ?.trim() ?? trimmed
    );
  }

  const url = new URL(withScheme);
  // Strip discovery suffix if the user pasted a full discovery URL
  const path = url.pathname.replace(
    /\/\.well-known\/openid-configuration\/?$/,
    '',
  );
  // Keep the path (critical for Keycloak realms: /realms/myrealm); strip trailing slash
  return url.host + path.replace(/\/$/, '');
}

export function isValidIssuerDomain(value: string) {
  const normalized = normalizeIssuerDomain(value);
  if (!normalized) return false;

  if (!URL.canParse(`https://${normalized}`)) return false;

  const url = new URL(`https://${normalized}`);
  // Reconstruct host+path to compare — normalized may include a path for Keycloak realms
  const reconstructed = url.host + url.pathname.replace(/\/$/, '');
  return url.hostname.includes('.') && reconstructed === normalized;
}
