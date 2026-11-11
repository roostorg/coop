import type { CatalogSignalEntry } from '@roostorg/coop-types';

import { type Dependencies } from '../../../iocContainer/index.js';
import createOrg from '../../../test/fixtureHelpers/createOrg.js';
import { getBottleContainerWithIOMocks } from '../../../test/setupMockedServer.js';
import {
  makePostgresPluginCatalogRepository,
  type StoredPluginCatalog,
} from './pluginCatalogRepository.js';

const entry: CatalogSignalEntry = {
  signalTypeId: 'POLICY_SCORE',
  displayName: 'Policy score',
  description: 'Scores text against a provider policy.',
  docsUrl: null,
  recommendedThresholds: null,
  supportedLanguages: 'ALL',
  pricingStructure: { type: 'FREE' },
  eligibleInputs: ['STRING'],
  outputType: { scalarType: 'NUMBER' },
  eligibleSubcategories: [
    { id: 'harassment', label: 'Harassment', childrenIds: [] },
  ],
  needsMatchingValues: false,
  needsActionPenalties: false,
  allowedInAutomatedRules: true,
  metadata: { model: 'model-1' },
};

describe('makePostgresPluginCatalogRepository', () => {
  let container: Dependencies;
  let orgId: string;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    container = await getBottleContainerWithIOMocks();
    const fixture = await createOrg(container);
    orgId = fixture.org.id;
    cleanup = fixture.cleanup;
  });

  afterAll(async () => {
    await cleanup();
    await container.closeSharedResourcesForShutdown();
  });

  it('round-trips, upserts, and lists catalogs per org', async () => {
    const repository = makePostgresPluginCatalogRepository(container.KyselyPg);
    const fetchedAt = new Date('2026-01-01T00:00:00.000Z');
    const catalog: StoredPluginCatalog = {
      orgId,
      integrationId: 'TEST_INTEGRATION',
      version: 'v1',
      entries: [entry],
      removedEntries: [],
      status: 'OK',
      errorMessage: null,
      fetchedAt,
    };

    await repository.save(catalog);
    expect(await repository.get(orgId, 'TEST_INTEGRATION')).toEqual(catalog);

    const updated: StoredPluginCatalog = {
      ...catalog,
      version: 'v2',
      entries: [],
      removedEntries: [entry],
      status: 'ERROR',
      errorMessage: 'PLUGIN_ERROR',
    };
    await repository.save(updated);
    expect(await repository.get(orgId, 'TEST_INTEGRATION')).toEqual(updated);

    expect(await repository.listForOrg(orgId)).toEqual([updated]);
    expect(await repository.get(orgId, 'OTHER_INTEGRATION')).toBeUndefined();
  });
});
