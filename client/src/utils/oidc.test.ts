import { isValidIssuerDomain, normalizeIssuerDomain } from './oidc';

describe('normalizeIssuerDomain', () => {
  test('keeps a bare domain unchanged', () => {
    expect(normalizeIssuerDomain('your-tenant.auth0.com')).toBe(
      'your-tenant.auth0.com',
    );
  });

  test('strips protocol and discovery suffix from an Auth0 discovery URL', () => {
    expect(
      normalizeIssuerDomain(
        'https://your-tenant.auth0.com/.well-known/openid-configuration',
      ),
    ).toBe('your-tenant.auth0.com');
  });

  test('preserves realm path for Keycloak issuers', () => {
    expect(
      normalizeIssuerDomain('https://auth.site.example/realms/myrealm'),
    ).toBe('auth.site.example/realms/myrealm');
  });

  test('strips discovery suffix from a Keycloak discovery URL, keeping realm path', () => {
    expect(
      normalizeIssuerDomain(
        'https://auth.site.example/realms/myrealm/.well-known/openid-configuration',
      ),
    ).toBe('auth.site.example/realms/myrealm');
  });

  test('preserves non-standard port with realm path', () => {
    expect(
      normalizeIssuerDomain('https://auth.site.example:8443/realms/myrealm'),
    ).toBe('auth.site.example:8443/realms/myrealm');
  });
});

describe('isValidIssuerDomain', () => {
  test('accepts a normalized domain', () => {
    expect(isValidIssuerDomain('your-tenant.auth0.com')).toBe(true);
  });

  test('accepts a discovery URL by normalizing it first', () => {
    expect(
      isValidIssuerDomain(
        'https://your-tenant.auth0.com/.well-known/openid-configuration',
      ),
    ).toBe(true);
  });

  test('accepts a Keycloak realm issuer with path', () => {
    expect(isValidIssuerDomain('auth.site.example/realms/myrealm')).toBe(true);
  });

  test('accepts a Keycloak discovery URL', () => {
    expect(
      isValidIssuerDomain(
        'https://auth.site.example/realms/myrealm/.well-known/openid-configuration',
      ),
    ).toBe(true);
  });

  test('rejects an invalid domain', () => {
    expect(isValidIssuerDomain('not-a-domain')).toBe(false);
  });
});
