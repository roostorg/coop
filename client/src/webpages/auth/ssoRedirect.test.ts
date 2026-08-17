import { describe, expect, it, vi } from 'vitest';

import { redirectToSsoUrl } from './ssoRedirect';

describe('redirectToSsoUrl', () => {
  it('navigates via window.location.href for GET', () => {
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
    });
    redirectToSsoUrl('/api/v1/saml/login/org_123', 'GET');
    expect(window.location.href).toBe('/api/v1/saml/login/org_123');
  });

  it('submits a form POST for OIDC initiation', () => {
    const formMock = {
      method: '',
      action: '',
      style: { display: '' },
      submit: vi.fn(),
    };
    vi.spyOn(document, 'createElement').mockReturnValueOnce(
      formMock as unknown as HTMLElement,
    );
    vi.spyOn(document.body, 'appendChild').mockImplementationOnce(
      () => formMock as unknown as Node,
    );

    redirectToSsoUrl(
      'https://api.example.com/api/v1/oidc/org_123/start',
      'POST',
    );

    expect(formMock.method).toBe('POST');
    expect(formMock.action).toBe(
      'https://api.example.com/api/v1/oidc/org_123/start',
    );
    expect(formMock.submit).toHaveBeenCalled();
  });
});
