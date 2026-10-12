/**
 * Filters Git tags to numeric release names (major.minor or major.minor.patch,
 * with optional prerelease suffixes) and returns them newest first.
 * Missing patch numbers count as zero; stable releases precede prereleases with
 * the same numeric version. Remaining ties use numeric-aware string ordering.
 *
 * @param {string[]} tags - Git tag names.
 * @returns {string[]} Release tags in documentation navigation order.
 */
export function releaseTags(tags) {
  return tags
    .filter((tag) => /^\d+\.\d+(?:\.\d+)?(?:-[A-Za-z0-9.-]+)?$/.test(tag))
    .sort((a, b) => {
      const [av, ap] = a.split('-');
      const [bv, bp] = b.split('-');
      const an = av.split('.').map(Number);
      const bn = bv.split('.').map(Number);
      // Compare version components numerically, so 1.10 sorts ahead of 1.9.
      for (let i = 0; i < 3; i++) {
        const diff = (bn[i] ?? 0) - (an[i] ?? 0);
        if (diff) return diff;
      }
      if (!!ap !== !!bp) return ap ? 1 : -1;
      return b.localeCompare(a, 'en', { numeric: true });
    });
}

/** Maps a Markdown source path to its published HTML path. */
export function pagePath(source) {
  return source
    .replace(/(^|\/)README\.md$/, '$1index.md')
    .replace(/\.md$/, '.html');
}

// Match mdBook's id_from_content so published section links stay valid.
export function headingId(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{Alphabetic}\p{Number}_\-\p{White_Space}]/gu, '')
    .replace(/\p{White_Space}/gu, '-');
}

/**
 * Configures Markdown rendering to repair release-specific links and escape
 * placeholders that would otherwise be interpreted as Vue components.
 * Repairs affect rendered HTML only; Markdown downloads retain their source.
 *
 * @param {object} md - VitePress's Markdown renderer. The version plugin supplies
 * the documentation version in each page's `state.env.localeIndex`.
 */
export function configureMarkdown(md) {
  // Run after inline parsing so links are available as tokens with href attributes.
  md.core.ruler.after('inline', 'documentation-links', (state) => {
    const version = state.env.localeIndex;
    for (const block of state.tokens) {
      for (const token of block.children || []) {
        if (token.type !== 'link_open') continue;
        let href = token.attrGet('href');
        // These releases link outside docs to the repository's root README.
        if (['0.0', '0.1'].includes(version) && href === '../README.md') {
          href = `https://github.com/roostorg/coop/blob/${version}/README.md`;
        }
        if (
          ['1.0', '1.0.0'].includes(version) &&
          href === '../api/appeals.md'
        ) {
          href = '../api/appeal.md';
        }
        if (
          version === '0.1' &&
          href ===
            md.normalizeLink(
              '[https://github.com/facebook/ThreatExchange/tree/main/hasher-matcher-actioner](https://github.com/facebook/ThreatExchange/tree/main/hasher-matcher-actioner/docs)',
            )
        ) {
          href =
            'https://github.com/facebook/ThreatExchange/tree/main/hasher-matcher-actioner/docs';
        }
        if (
          version === '0.1' &&
          /^\/docs\/(?:NCMEC|USER_GUIDE)\.md(?:#|$)/.test(href)
        ) {
          href = href.replace('/docs/', './');
        }
        // Keep source README names while linking to their published index pages.
        if (!/^[a-z]+:/i.test(href)) {
          href = href.replace(/(^|\/)README\.md(?=#|$)/, '$1index.md');
        }
        // These releases link to Settings under a filename absent from their docs.
        if (version === '1.0.2' && href === 'settings.md#other') {
          href = 'administration.md#other';
        }
        token.attrSet('href', href);
      }
    }
  });
  const renderHtml = md.renderer.rules.html_inline;
  md.renderer.rules.html_inline = (tokens, index, ...args) => {
    // Bank-name placeholders are text, not Vue components. Code tokens stay untouched.
    if (/^<(?:ORGID|NORMALIZED_NAME)>$/.test(tokens[index].content)) {
      return md.utils.escapeHtml(tokens[index].content);
    }
    return renderHtml(tokens, index, ...args);
  };
}

/** Converts indented Markdown links in SUMMARY.md into a VitePress sidebar. */
export function sidebar(summary) {
  const items = [];
  const parents = [{ depth: -1, items }];
  for (const line of summary.split('\n')) {
    const match = /^(\s*)- \[([^\]]+)\]\(([^)]+\.md)\)/.exec(line);
    if (!match) continue;
    const depth = match[1].length;
    // Keep the ancestor stack aligned with this item's indentation level.
    while (parents.at(-1).depth >= depth) parents.pop();
    const item = { text: match[2], link: `/${pagePath(match[3])}` };
    parents.at(-1).items.push(item);
    item.items = [];
    parents.push({ depth, items: item.items });
  }
  function prune(entries) {
    for (const item of entries) {
      if (item.items.length) prune(item.items);
      else delete item.items;
    }
    return entries;
  }
  return prune(items);
}

/**
 * Creates a static redirect page. JavaScript preserves query strings and hashes;
 * the meta refresh and link provide fallbacks when JavaScript is unavailable.
 */
export function redirectPage(target) {
  // Targets are generated from validated version names and repository page paths.
  const escaped = target
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Coop documentation</title><meta http-equiv="refresh" content="0;url=${escaped}">
<script>location.replace(${JSON.stringify(target).replaceAll('<', '\\u003c')} + location.search + location.hash)</script>
</head><body><a href="${escaped}">Continue to Coop documentation</a></body></html>`;
}
