import fc from 'fast-check';

export function enumToArbitrary<T extends { [k: string]: string }>(e: T) {
  return fc.constantFrom(...Object.values(e)) as unknown as fc.Arbitrary<
    { [K in keyof T]: T[K] }[keyof T]
  >;
}
