// Opt-in to various improvements to TS's built-in type definition for the JS
// standard library. These add a bit more safety/functionality. The most
// important is the `is-array` rule, which makes sure we don't end up with
// `any`s accidentally introduced into our code through `Array.isArray` checks.
// Note that we don't bother with the `json-parse` and `fetch` rules, since our
// utility functions already handle those in a more-strict way. If more rules
// are added in the future, though, we might wanna opt-in to them too. See
// https://github.com/total-typescript/ts-reset
import '@total-typescript/ts-reset/filter-boolean';
import '@total-typescript/ts-reset/array-includes';
import '@total-typescript/ts-reset/set-has';
import '@total-typescript/ts-reset/is-array';
