export function isOidcLoginStartUrl(redirectUrl: string): boolean {
  return redirectUrl.includes('/api/v1/oidc/login/');
}

export function redirectToSsoUrl(redirectUrl: string) {
  if (isOidcLoginStartUrl(redirectUrl)) {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = redirectUrl;
    form.style.display = 'none';
    document.body.appendChild(form);
    form.submit();
    return;
  }

  window.location.href = redirectUrl;
}
