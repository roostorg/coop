export function isValidRegexString(regex: string) {
  try {
    // eslint-disable-next-line no-new
    new RegExp(regex);
    return true;
  } catch (_) {
    return false;
  }
}
