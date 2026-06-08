/* eslint-disable no-console */

// A small, one-time ASCII banner printed at server startup. It is intentionally
// only emitted to an interactive terminal (TTY) so it never clutters
// structured/JSON logs in production or CI environments.

const LOGO = [
  '            +########++ ',
  '              +#+    +# ',
  '                +#+  +# ',
  ' +#######+      +#+  +# ',
  '   +#+   +#+   +#+   +# ',
  '     +#+   +#+ +#    +# ',
  '       +#+  +#+#+    +# ',
  '         +#####+   +#+ ',
  '          +#+ +###++   ',
  '           +#+    +#+  ',
  '       +++++#+++++++#+ ',
  '       +#+   +#+   +#+ ',
  '       +#+   +#+  +#+  ',
  '         ++#++#++#++   ',
  '           +###+       ',
];

const LINKS = [
  ['ROOST', 'https://roost.tools'],
  ['GitHub', 'https://github.com/roostorg/coop'],
  ['Docs', 'https://roostorg.github.io/coop/latest'],
  ['Discord', 'https://discord.gg/5Csqnw2FSQ'],
] as const;

/**
 * Prints a compact Coop banner with project links. No-op unless stdout is an
 * interactive terminal, so it stays out of aggregated logs.
 */
export function printStartupBanner(): void {
  if (!process.stdout.isTTY) {
    return;
  }

  const labelWidth = Math.max(...LINKS.map(([label]) => label.length));
  const linkLines = [
    'ROOST · Open Source Trust & Safety',
    'Coop · Review and enforcement tool',
    '',
    ...LINKS.map(([label, url]) => `  ${label.padEnd(labelWidth)}  ${url}`),
  ];

  const lines = LOGO.map((logoLine, i) => {
    const text = linkLines[i] ?? '';
    return `  ${logoLine}   ${text}`;
  });

  console.log(`\n${lines.join('\n')}\n`);
}
