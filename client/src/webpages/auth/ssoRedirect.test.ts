import { describe, expect, it } from 'vitest';

import { isOidcLoginStartUrl } from './ssoRedirect';

describe('isOidcLoginStartUrl', () => {
  it('returns true for OIDC login start URLs', () => {
    expect(
      isOidcLoginStartUrl('https://api.example.com/api/v1/oidc/login/org_123'),
    ).toBe(true);
  });

  it('returns false for non-OIDC redirect URLs', () => {
    expect(isOidcLoginStartUrl('/api/v1/saml/login/org_123')).toBe(false);
  });
});
