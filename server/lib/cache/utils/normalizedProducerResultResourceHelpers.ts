import _ from "lodash";

import {
  type AnyParams,
  type AnyValidators,
  type ConsumerDirectives,
} from "../index.js";
import {
  type NormalizedMaxStale,
  type NormalizedProducerResultResource,
} from "../types/06_Normalization.js";
import { normalizeMaxStale } from "./normalization.js";
import { mapTuple } from "./utils.js";

const { zipWith } = _;

type AnyNormalizedProducerResultResource = NormalizedProducerResultResource<
  unknown,
  AnyValidators,
  AnyParams
>;

/**
 * Returns the moment when the resource's value was generated _by the origin_.
 * This may be different from the date that the NormalizedProducerResultResource
 * was created, if the NormalizedProducerResultResource was created by a cache
 * that had already been holding the origin's result for some time.
 */
export function birthDate(it: AnyNormalizedProducerResultResource) {
  return new Date(it.date.valueOf() - it.initialAge * 1000);
}

/**
 * Returns the amount of time between the time when the resource was generated
 * _at the origin_ and the provided date.
 */
export function age(it: AnyNormalizedProducerResultResource, at: Date) {
  return (at.valueOf() - birthDate(it).valueOf()) / 1000;
}

/**
 * How many seconds remain until the entry could not even potentially satisfy
 * an incoming request. This will often be infinite, because the consumer can
 * request arbitrarily stale entries (via maxStale).
 */
export function potentiallyUsefulFor(
  it: AnyNormalizedProducerResultResource,
  at: Date,
) {
  return it.directives.maxStale && !isValidatable(it)
    ? it.directives.freshUntilAge + it.directives.maxStale[2] - age(it, at)
    : Infinity;
}

/**
 * Returns whether the entry has data that can be used for revalidation.
 */
export function isValidatable(it: AnyNormalizedProducerResultResource) {
  return Object.keys(it.validators).length > 0;
}

export function isFresh(it: AnyNormalizedProducerResultResource, at: Date) {
  const ageAt = age(it, at);
  return ageAt >= 0 && ageAt <= it.directives.freshUntilAge;
}

// Note: Unusable entries may still have validation info; in that way, they
// could be helpful in fetching an updated ProducerResult that is usable.
// This was originally a numeric enum, but strings made for way better logs.
export const enum EntryClassification {
  Usable = "Usable",
  UsableWhileRevalidate = "UsableWhileRevalidate",
  UsableIfError = "UsableIfError",
  Unusable = "Unusable",
}

/**
 * Returns a results applicability/usability, for a set of consumer directives,
 * and at a given date, based on its stored age etc.
 *
 * Note: this does **not** factor in the entry's `id` or `vary` value; its
 * assumed that the entry is a valid candidate for the request's params.
 */
export function classify(
  entry: AnyNormalizedProducerResultResource,
  dirs: ConsumerDirectives,
  at: Date,
) {
  // Exact logic here may change if I get more clarity on HTTP directive
  // interactions and those interactons can't be simulated with these rules
  // (after some transformation of the input producer + consumer directives).
  // Context: https://twitter.com/ethanresnick/status/1200154215756312580
  const ageAtDate = age(entry, at);

  // An entry exceeding the consumer's maxAge can _never_ be usable,
  // even when the origin is unreachable.
  if (dirs.maxAge !== undefined && ageAtDate > dirs.maxAge) {
    return EntryClassification.Unusable;
  }

  // A fresh entry, which we've already checked satisifies
  // the consumer's maxAge, is always usable.
  if (isFresh(entry, at)) {
    return EntryClassification.Usable;
  }

  // For stale entries, it gets a bit more complicated. There are 4 cases,
  // corresponding to whether or not each of (consumer, producer) did or
  // didn't provide a maxStale directive. The simples case is when no
  // maxStale is given, in which case the crazy process described in the
  // docs for synthesizing default maxStale directive values results in
  // stale responses simply not being usable.
  if (!entry.directives.maxStale && !dirs.maxStale) {
    return EntryClassification.Unusable;
  }

  // But, if we do have at least one maxStale, apply the logic below for
  // figuring out (from the normalized versions of the explicitly given
  // `maxStale` directives of each party) what final maxStale value to apply.

  const givenProducerMaxStale = entry.directives.maxStale;
  const givenConsumerMaxStale =
    dirs.maxStale && normalizeMaxStale(dirs.maxStale);

  const defaultConsumerMaxStale = (
    !givenProducerMaxStale
      ? [0, 0, 0]
      : [0, givenProducerMaxStale[1], givenProducerMaxStale[2]]
  ) as NormalizedMaxStale;

  const finalConsumerMaxStale =
    givenConsumerMaxStale ?? defaultConsumerMaxStale;

  // NB: this logic gets crazy -- the final producer value can come from the
  // final consumer value, which gets defaulted, but that default is different
  // when there's no producer value -- but it works.
  const finalProducerMaxStale = givenProducerMaxStale ?? finalConsumerMaxStale;

  // The used maxStale value holds the minimums of the consumer and producer's
  // respective maxStale entries, to make sure we're satisfying both parties'
  // requirements. Note: after zipping, we don't need to normalize again [will
  // be a noop].
  const finalMaxStale = zipWith(
    finalConsumerMaxStale,
    finalProducerMaxStale,
    Math.min.bind(Math),
  ) satisfies number[] as [number, number, number] as NormalizedMaxStale;

  const freshnessLifetime = entry.directives.freshUntilAge;
  const finalAgeLimits = mapTuple(
    finalMaxStale,
    (it) => it + freshnessLifetime,
  );

  if (ageAtDate <= finalAgeLimits[0]) {
    return EntryClassification.Usable;
  }

  if (ageAtDate <= finalAgeLimits[1]) {
    return EntryClassification.UsableWhileRevalidate;
  }

  if (ageAtDate <= finalAgeLimits[2]) {
    return EntryClassification.UsableIfError;
  }

  return EntryClassification.Unusable;
}
