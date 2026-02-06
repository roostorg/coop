import unhomoglyph from 'unhomoglyph';

const replacements = {
  '0': 'o',
  $: 's',
  '5': 's',
  '3': 'e',
  ꞓ: 'e',
  '€': 'e',
  '4': 'a',
  '@': 'a',
  '()': 'o',
  '(': 'c',
  '!': 'i',
  '¡': 'i',
  l: 'i',
  L: 'i',
  '|': 'i',
  '1': 'i',
  '¶': 'p',
  '+': 't',
};

/**
 * Replace all potential character replacements/obfuscations. This function
 * relies on the [unhomoglyph module](https://www.npmjs.com/package/unhomoglyph)
 * and a series of common character replacements that we've created.
 *
 * @param str - a string with potential character replacements, e.g. 'h3l|0'
 * @returns - a normalized string that is likely what a human would read the
 * original string as - e.g. 'hello'
 */
export function replaceHomoglyphs(str: string): string {
  let unhomoglyphed = unhomoglyph(str).toLowerCase();
  Object.keys(replacements).forEach((glyph) => {
    if (unhomoglyphed.includes(glyph)) {
      unhomoglyphed = unhomoglyphed
        .replaceAll(glyph, replacements[glyph as keyof typeof replacements])
        .toLowerCase();
    }
  });
  return unhomoglyphed;
}
