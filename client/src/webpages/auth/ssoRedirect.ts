export function redirectToSsoUrl(redirectUrl: string, method: 'GET' | 'POST') {
  if (method === 'POST') {
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
