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

/**
 * The correlation ids returned by {@see toCorrelationId} are heirarchical;
 * i.e., they encode the type of event that triggered the flow, and an id for
 * that event (which must be unique only within that event type).
 * Normally, we want to use/store this full hierarchical id everywhere, even
 * where the event type might be obvious from the context. Sometimes, though,
 * we store the id without the prefix (e.g., in postgres, where the prefix would
 * make the id inconsistent with our other primary keys), so this helper function
 * can remove the prefix from the full id to let us do an equality comparison.
 */
export function getSourceId(it: CorrelationId<string>) {
  return fromCorrelationId(it).split(':')[1];
}

export function getSourceType<T extends string>(it: CorrelationId<T>): T {
  return fromCorrelationId(it).split(':')[0] as T;
}
