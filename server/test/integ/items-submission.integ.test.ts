/**
 * Integration test for #339: end-to-end item submission.
 *
 * Submits an item via POST /api/v1/items/async against a real running stack
 * (Postgres, Scylla, ClickHouse, Redis) and asserts the item lands in both
 * Scylla (item_submission_by_thread) and ClickHouse (CONTENT_API_REQUESTS).
 *
 * Run with: npm run test:integ
 * Requires: `npm run up && npm run db:update`
 */
import { ScalarTypes } from '@roostorg/types';
import { uid } from 'uid';

import createContentItemTypes from '../fixtureHelpers/createContentItemTypes.js';
import createOrg from '../fixtureHelpers/createOrg.js';
import {
  makeIntegrationServer,
  type IntegrationServer,
} from './setupIntegrationServer.js';
import { waitForItemInClickHouse, waitForItemInScylla } from './wait.js';

describe('Items submission (integration)', () => {
  const orgId = uid();
  let harness: IntegrationServer;
  let apiKey: string;
  let orgCleanup: () => Promise<void>;
  let itemTypeCleanup: () => Promise<void>;
  let itemTypeId: string;

  beforeAll(async () => {
    harness = await makeIntegrationServer();

    const orgFixture = await createOrg(
      {
        KyselyPg: harness.deps.KyselyPg,
        ModerationConfigService: harness.deps.ModerationConfigService,
        ApiKeyService: harness.deps.ApiKeyService,
      },
      orgId,
    );
    apiKey = orgFixture.apiKey;
    orgCleanup = orgFixture.cleanup;

    const itemTypeFixture = await createContentItemTypes({
      moderationConfigService: harness.deps.ModerationConfigService,
      orgId,
      extra: {
        fields: [
          {
            name: 'text',
            type: ScalarTypes.STRING,
            required: true,
            container: null,
          },
        ],
      },
    });
    itemTypeId = itemTypeFixture.itemTypes[0].id;
    itemTypeCleanup = itemTypeFixture.cleanup;
  }, 60_000);

  afterAll(async () => {
    await itemTypeCleanup();
    await orgCleanup();
    await harness.shutdown();
  }, 30_000);

  test('submitted item lands in Scylla and ClickHouse', async () => {
    const itemId = uid();

    await harness.request
      .post('/api/v1/items/async')
      .set('x-api-key', apiKey)
      .send({
        items: [
          { id: itemId, typeId: itemTypeId, data: { text: 'hello integ' } },
        ],
      })
      .expect(202);

    const scyllaItem = await waitForItemInScylla(harness.deps, {
      orgId,
      itemIdentifier: { id: itemId, typeId: itemTypeId },
    });
    expect(scyllaItem.latestSubmission).toBeDefined();

    const chRow = await waitForItemInClickHouse(harness.deps, {
      orgId,
      itemIdentifier: { id: itemId, typeId: itemTypeId },
    });
    expect(chRow).toBeDefined();
  }, 60_000);
});
