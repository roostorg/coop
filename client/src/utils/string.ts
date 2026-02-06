import { JsonValue, type Opaque } from 'type-fest';

// Split by newline and by commas, see https://stackoverflow.com/a/34316181
export function splitByWhitespaceAndCommas(input: string): string[] {
  return input.trim().split(/[\s,]+/);
}

function ucFirst(s: string): string {
  return (s[0] ?? '').toUpperCase() + s.slice(1);
}

/**
 * If the string s is formatted like an 'ENUM_VALUE',
 * then change it to 'Enum Value'.
 */
export function titleCaseEnumString(s: string): string {
  return s
    .split('_')
    .map((word) => word.toLowerCase())
    .map(ucFirst)
    .join(' ');
}

export function titleCaseEnumStringWithArticle(s: string): string {
  const titleCased = titleCaseEnumString(s);
  return ['A', 'a', 'E', 'e', 'I', 'i', 'O', 'o', 'U', 'u'].includes(
    titleCased[0],
  )
    ? `an ${titleCased}`
    : `a ${titleCased}`;
}

export function prettyPrintJson(it: string) {
  return prettyPrintJsonValue(JSON.parse(it));
}

export function prettyPrintJsonValue(it: JsonValue) {
  return JSON.stringify(it, undefined, 4);
}

export function isValidJson(it: string) {
  try {
    JSON.parse(it);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Converts a string to a human readable label with a 'best effort' approach,
 * specifically looking for snake case, camel case, and spaces. Full disclosure,
 * this was written by ChatGPT.
 */
export function toHumanReadableLabel(input: string): string {
  // Define regular expressions for different cases
  const camelCase = /([a-z])([A-Z])/g;
  const snakeCase = /_/g;
  const spaceCase = / /g;
  const kebabCase = /^[a-z]+(-[a-z]+)*$/;
  const pascalCase = /^[A-Z][a-zA-Z]*$/;

  if (camelCase.test(input)) {
    return input
      .replace(camelCase, '$1 $2')
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  } else if (snakeCase.test(input) || spaceCase.test(input)) {
    return input
      .replace(snakeCase, ' ')
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  } else if (kebabCase.test(input)) {
    return input
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  } else if (pascalCase.test(input)) {
    return input.charAt(0).toUpperCase() + input.slice(1);
  }

  // If not any of the above cases, just return the original string with first character capitalized
  return input.charAt(0).toUpperCase() + input.slice(1);
}

export function truncateIdIfNeeded(id: string | undefined, maxLength: number) {
  return id && id.length > maxLength ? id.substring(0, maxLength) + '...' : id;
}

export type NonEmptyString = Opaque<string, 'NonEmptyString'>;

export function isNonEmptyString(it: unknown): it is NonEmptyString {
  return typeof it === 'string' && it !== '';
}
