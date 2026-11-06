export function validateUrl(value: string) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Invalid scheme');
  }
  if (['localhost', '127.0.0.1'].includes(url.hostname)) {
    throw new Error('Blocked host');
  }
}
