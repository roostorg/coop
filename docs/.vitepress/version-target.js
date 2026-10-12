/**
 * Builds a URL for switching documentation versions, preserving the current page
 * and hash only when they exist in the target version. Missing pages fall back to
 * the target version's introduction with `?missing-page=1` to show a notice.
 *
 * @param {object} manifest - Version manifest with a base path and per-version
 * page maps, keyed by HTML path with arrays of heading IDs as values.
 * @param {string} version - Target version name; must exist in the manifest.
 * @param {string} pathname - Current URL pathname, including the base and version.
 * @param {string} [hash=''] - Current URL hash, including the leading `#`.
 * @returns {string} The target documentation URL.
 */
export function versionTarget(manifest, version, pathname, hash = '') {
  const relative = pathname.startsWith(manifest.base)
    ? pathname.slice(manifest.base.length)
    : '';
  let page = relative.split('/').slice(1).join('/');
  if (!page || page.endsWith('/')) page += 'index.html';
  const pages = manifest.versions.find((entry) => entry.name === version).pages;
  const exists = Object.hasOwn(pages, page);
  const anchor =
    exists && pages[page].includes(decodeURIComponent(hash.slice(1)))
      ? hash
      : '';
  return `${manifest.base}${version}/${exists ? page : 'index.html'}${exists ? anchor : '?missing-page=1'}`;
}
