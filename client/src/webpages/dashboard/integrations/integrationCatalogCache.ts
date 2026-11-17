import type { ApolloCache } from '@apollo/client';

/**
 * `myOrg.signals` is stored on the normalized `Org:<id>` entity, not on
 * ROOT_QUERY, so evicting without an id would leave every signal list stale.
 */
export function evictOrgSignals<T extends object>(cache: ApolloCache<T>) {
  const orgIds = Object.keys(cache.extract()).filter((id) =>
    id.startsWith('Org:'),
  );
  for (const id of orgIds) {
    cache.evict({ id, fieldName: 'signals' });
  }
  cache.gc();
}
