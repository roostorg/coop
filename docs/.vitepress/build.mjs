import { execFileSync } from 'node:child_process';
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { pagePath, redirectPage, releaseTags } from './site.mjs';

const tooling = dirname(fileURLToPath(import.meta.url));
const docs = resolve(tooling, '..');
const root = resolve(docs, '..');
const output = join(tooling, 'dist');
const work = join(tooling, 'work');
const base = '/coop/';
const git = (...args) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const tags = releaseTags(git('tag', '--list').split('\n'));
const stable = tags.find((tag) => !tag.includes('-'));
const manifest = { base, stable, versions: [] };

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map(async (entry) => {
        const path = join(directory, entry.name);
        return entry.isDirectory() ? files(path) : [path];
      }),
    )
  ).flat();
}

async function put(path, content) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}

await rm(output, { recursive: true, force: true });
await rm(work, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await mkdir(join(work, 'src'), { recursive: true });

try {
  for (const version of ['latest', ...tags]) {
    console.log(`Preparing documentation: ${version}`);
    let source = docs;
    if (version !== 'latest') {
      const archive = join(work, `${version}.tar`);
      git('archive', '--format=tar', `--output=${archive}`, version, 'docs');
      const checkout = join(work, 'extracted', version);
      await mkdir(checkout, { recursive: true });
      execFileSync('tar', ['-xf', archive, '-C', checkout]);
      source = join(checkout, 'docs');
    }
    const destination = join(work, 'public', version);
    const staged = join(work, 'archive', version);
    await cp(join(source, 'images'), join(staged, 'images'), {
      recursive: true,
    });
    await cp(join(source, 'images'), join(destination, 'images'), {
      recursive: true,
    });
    await cp(join(docs, 'theme'), join(destination, 'theme'), {
      recursive: true,
    });

    // Publish Markdown beside HTML, without copying build tools or dependencies.
    const tracked =
      version === 'latest'
        ? git('ls-files', '--cached', '--others', '--exclude-standard', 'docs')
        : git('ls-tree', '-r', '--name-only', version, 'docs');
    for (const path of tracked
      .split('\n')
      .filter(
        (path) => path.endsWith('.md') && !path.includes('/.vitepress/'),
      )) {
      await put(
        join(staged, path.slice(5)),
        await readFile(join(source, path.slice(5))),
      );
      await put(
        join(destination, path.slice(5)),
        await readFile(join(source, path.slice(5))),
      );
    }
    manifest.versions.push({ name: version });
  }

  await put(join(work, 'versions.json'), JSON.stringify(manifest));
  // Viteplus routes every staged version through one VitePress build and theme.
  execFileSync(
    process.execPath,
    [join(docs, 'node_modules/vitepress/bin/vitepress.js'), 'build', '.'],
    {
      cwd: docs,
      stdio: 'inherit',
    },
  );

  for (const entry of manifest.versions) {
    const version = entry.name;
    const destination = join(output, version);
    const pages = {};
    for (const path of (await files(destination)).filter((path) =>
      path.endsWith('.html'),
    )) {
      const page = relative(destination, path);
      if (['404.html', 'toc.html', 'print.html'].includes(page)) continue;
      let html = await readFile(path, 'utf8');
      const markdown = page
        .replace(/(^|\/)index\.html$/, '$1README.md')
        .replace(/\.html$/, '.md');
      html = html.replace(
        '</head>',
        `<link rel="alternate" type="text/markdown" href="${base}${version}/${markdown}"></head>`,
      );
      await writeFile(path, html);
      pages[page] = [...html.matchAll(/\bid="([^"]+)"/g)].map(
        (match) => match[1],
      );
    }
    // mdBook also exposes README.html aliases; preserve them for migrated pages.
    for (const page of Object.keys(pages).filter((page) =>
      /(^|\/)index\.html$/.test(page),
    )) {
      const alias = page.replace(/index\.html$/, 'README.html');
      await put(
        join(destination, alias),
        redirectPage(`${base}${version}/${page}`),
      );
      pages[alias] = pages[page];
    }
    const summary = await readFile(
      join(work, 'archive', version, 'SUMMARY.md'),
      'utf8',
    );
    for (const match of summary.matchAll(/\]\(([^)]+\.md)\)/g)) {
      if (!Object.hasOwn(pages, pagePath(match[1])))
        throw new Error(`Missing page in ${version}: ${match[1]}`);
    }
    entry.pages = pages;
  }

  // Static redirect files work on GitHub Pages without symlinks or server rules.
  const stableVersion = stable || 'latest';
  for (const page of Object.keys(
    manifest.versions.find((v) => v.name === stableVersion).pages,
  )) {
    await put(
      join(output, 'stable', page),
      redirectPage(`${base}${stableVersion}/${page}`),
    );
  }
  await put(join(output, 'index.html'), redirectPage(`${base}stable/`));
  await put(join(output, 'versions.json'), JSON.stringify(manifest));
  await put(join(output, '.nojekyll'), '');
  console.log(
    `Built ${manifest.versions.length} versions; stable: ${stableVersion}; output: ${output}`,
  );
} finally {
  await rm(work, { recursive: true, force: true });
}
