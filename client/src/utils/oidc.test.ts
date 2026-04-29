import { isValidIssuerDomain, normalizeIssuerDomain } from './oidc';

describe('normalizeIssuerDomain', () => {
  test('keeps a bare domain unchanged', () => {
    expect(normalizeIssuerDomain('your-tenant.auth0.com')).toBe(
      'your-tenant.auth0.com',
    );
  });

  test('strips protocol and path from a discovery URL', () => {
    expect(
      normalizeIssuerDomain(
        'https://your-tenant.auth0.com/.well-known/openid-configuration',
      ),
    ).toBe('your-tenant.auth0.com');
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

  test('rejects an invalid domain', () => {
    expect(isValidIssuerDomain('not-a-domain')).toBe(false);
  });
});
