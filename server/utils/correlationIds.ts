/**
 * @fileoverview For now, we define correlation ids as hierarchical strings,
 * with two parts: a type (which can be the event type that triggered the full
 * execution flow that we're trying to correlate/log) and an id (which must be
 * unique within the type). The functions in this file generate and parse these
 * hierarchical strings, and return "branded" strings for type safety, using
 * opaque types from type-fest.
 */
import { type Opaque } from 'type-fest';

export type CorrelationId<Type extends string> = Opaque<Type, 'CorrelationId'>;

export type CorrelationIdType<T extends CorrelationId<string>> =
  T extends CorrelationId<infer U> ? U : never;

/**
 * @param source The identity of the flow that's being traced.
 */
export function toCorrelationId<Type extends string>(source: {
  type: Type;
  id: string;
}) {
  return `${source.type}:${source.id}` as CorrelationId<Type>;
}

export function fromCorrelationId<Type extends string>(
  it: CorrelationId<Type>,
) {
  return it as unknown as string;
}

export function getSourceType<T extends string>(it: CorrelationId<T>): T {
  return fromCorrelationId(it).split(':')[0] as T;
}
