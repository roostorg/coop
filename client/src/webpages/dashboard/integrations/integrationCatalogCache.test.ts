import { InMemoryCache } from '@apollo/client';
import { describe, expect, it } from 'vitest';

import { evictOrgSignals } from './integrationCatalogCache';

describe('evictOrgSignals', () => {
  it('evicts signals stored on the normalized Org entity', () => {
    const cache = new InMemoryCache();
    cache.restore({
      ROOT_QUERY: { __typename: 'Query', myOrg: { __ref: 'Org:org-1' } },
      'Org:org-1': {
        __typename: 'Org',
        id: 'org-1',
        name: 'Test Org',
        signals: [{ __ref: 'Signal:signal-1' }],
      },
      'Signal:signal-1': { __typename: 'Signal', id: 'signal-1' },
    });

    evictOrgSignals(cache);

    const org = cache.extract()['Org:org-1'];
    expect(org).toBeDefined();
    expect(org).not.toHaveProperty('signals');
    expect(org).toHaveProperty('name', 'Test Org');
  });
});
