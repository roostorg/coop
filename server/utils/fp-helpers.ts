import lodash from 'lodash';

const { isPlainObject: _isPlainObject, unzip, zip } = lodash;

/**
 * A type-safe wrapper around lodash unzip, that only works for arrays of
 * 2-tuples, but also handles inverting a `zip([], []) => []`, which callers
 * rely on and which _.unzip can't do, because it doesn't know how many source
 * arrays there would've been.
 */
export function unzip2<T, U>(it: readonly (readonly [T, U])[]) {
  return (it.length ? (unzip(it) as unknown) : [[], []]) as [T[], U[]];
}

/**
 * A wrapper around lodash.zip that checks that the two arrays are of equal
 * length first, and thereby allows the return type to exclude undefined (which
 * is used to pad the zipped pairs only when the arrays are of unequal lengths).
 */
export function equalLengthZip<T, U>(
  a: readonly T[],
  b: readonly U[],
): [T, U][] {
  if (a.length !== b.length) {
    throw new Error("Can't zip arrays of different lengths");
  }

  return zip(a, b) as [T, U][];
}

export async function someAsync<T>(
  arr: T[],
  predicate: (v: T) => Promise<boolean>,
) {
  for (const e of arr) {
    if (await predicate(e)) {
      return true;
    }
  }
  return false;
}

export async function everyAsync<T>(
  arr: T[],
  predicate: (v: T) => Promise<boolean>,
) {
  for (const e of arr) {
    if (!(await predicate(e))) {
      return false;
    }
  }
  return true;
}
