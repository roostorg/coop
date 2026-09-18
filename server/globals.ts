// Global type augmentations for types we don't own.
//
// These live in a regular module (rather than an ambient `.d.ts`) so they're
// picked up by `include` like any other source file. Ambient *module*
// declarations for untyped packages still have to live in `decs.d.ts`, because
// `declare module 'pkg'` is only an ambient declaration inside a script file —
// inside a module it means "augment this module", which requires the package to
// already have types.
export {};

declare global {
  // `@types/express` declares `User` inside the `Express` namespace, so
  // augmenting it requires the namespace form. There is no ES-module
  // equivalent.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    // Extend Express.User so passport callbacks (serializeUser, etc.) see the
    // fields we actually use without per-call `as any` casts.
    interface User {
      id: string;
    }
  }

  // Preserve string literal types through case conversion, so
  // `('a' as 'a' | 'b').toUpperCase()` is `'A' | 'B'` rather than `string`.
  // Several call sites depend on this to keep unions assignable to the literal
  // types they came from.
  // Augmenting the global `String` interface requires this exact name. The rule
  // exists to stop `String` being used as a variable or type annotation, which
  // this isn't.
  // eslint-disable-next-line id-denylist
  interface String {
    toUpperCase<T extends string>(this: T): Uppercase<T>;
    toLowerCase<T extends string>(this: T): Lowercase<T>;
  }
}
