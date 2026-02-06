import {
  type NormalizedMaxStale,
  type NormalizedParams,
  type NormalizedProducerResult,
  type NormalizedProducerResultResource,
  type NormalizedVary,
  type NormalizeParamName,
  type NormalizeParamValue,
} from "../types/06_Normalization.js";
import {
  type AnyParams,
  type AnyParamValue,
  type AnyValidators,
  type ProducerResult,
  type ProducerResultResource,
  type Vary,
} from "../types/index.js";

export function normalizeProducerResult<
  Content,
  Validators extends AnyValidators,
  Params extends AnyParams,
>(
  normalizeVary: (vary: Vary<Params>) => NormalizedVary<Params>,
  it: ProducerResult<Content, Validators, Params>,
  fallbackProducedAt?: Date,
): NormalizedProducerResult<Content, Validators, Params> {
  const { supplementalResources, ...rest } = it;
  return {
    ...normalizeProducerResultResource(normalizeVary, rest, fallbackProducedAt),
    supplementalResources: supplementalResources?.map((it) =>
      normalizeProducerResultResource(normalizeVary, it, fallbackProducedAt),
    ),
  };
}

export function normalizeProducerResultResource<
  Content,
  Validators extends AnyValidators,
  Params extends AnyParams,
>(
  normalizeVary: (vary: Vary<Params>) => NormalizedVary<Params>,
  resourceResult: ProducerResultResource<Content, Validators, Params>,
  fallbackProducedAt?: Date,
): NormalizedProducerResultResource<Content, Validators, Params> {
  const { maxStale, ...otherDirectives } = resourceResult.directives;

  return {
    ...resourceResult,
    initialAge: Math.max(resourceResult.initialAge ?? 0, 0),
    vary: normalizeVary(resourceResult.vary ?? {}),
    directives: {
      ...otherDirectives,
      ...(maxStale != null ? { maxStale: normalizeMaxStale(maxStale) } : {}),
    },
    validators: resourceResult.validators ?? {},
    date: resourceResult.date ?? fallbackProducedAt ?? new Date(),
  };
}

export function normalizeParams<Params extends AnyParams>(
  normalizeParamName: NormalizeParamName<Params>,
  normalizeParamValue: NormalizeParamValue<Params>,
  params: Partial<Params>,
): NormalizedParams<Params> {
  const entries = Object.entries(params) satisfies [string, any][] as [
    keyof Params & string,
    Params[keyof Params] | undefined,
  ][];

  const normalizedEntries = entries
    .filter(([_, v]) => v !== undefined)
    .map(([k, v]) => {
      const finalName = normalizeParamName(k);
      const finalVal = normalizeParamValue(finalName, v!);
      return [finalName, finalVal] as const;
    });

  return Object.fromEntries(normalizedEntries) satisfies {
    [k: string]: Params[keyof Params] & AnyParamValue;
  } as unknown as NormalizedParams<Params>;
}

/**
 * This is identical to `normalizeParams`, except that param values in `vary`
 * can be explicitly null, to indicate that the producer relied on the param
 * being missing.
 */
export function normalizeVary<Params extends AnyParams>(
  normalizeParamName: NormalizeParamName<Params>,
  normalizeParamValue: NormalizeParamValue<Params>,
  vary: Vary<Params>,
): NormalizedVary<Params> {
  const entries = Object.entries(vary) satisfies [string, any][] as [
    keyof Params & string,
    Params[keyof Params] | undefined,
  ][];

  const normalizedEntries = entries
    .filter(([_, v]) => v !== undefined)
    .map(([k, v]) => {
      const finalName = normalizeParamName(k);
      const finalVal = v === null ? v : normalizeParamValue(finalName, v!);
      return [finalName, finalVal] as const;
    });

  return Object.fromEntries(normalizedEntries) satisfies {
    [k: string]: (Params[keyof Params] & AnyParamValue) | null;
  } as unknown as NormalizedVary<Params>;
}

/**
 * Takes a provided maxStale directive value and normalizes it into its
 * canonical, valid form, namely by making sure that each number is >= the
 * previous one.
 */
export function normalizeMaxStale(maxStale: [number, number, number]) {
  return maxStale.reduce((acc, it) => {
    acc.push(Math.max(acc[acc.length - 1] || 0, it));
    return acc;
  }, [] as number[]) as NormalizedMaxStale;
}
