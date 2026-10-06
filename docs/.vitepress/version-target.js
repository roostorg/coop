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
