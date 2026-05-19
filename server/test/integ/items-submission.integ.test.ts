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
  let harness: IntegrationServer | undefined;
  let apiKey: string;
  let orgCleanup: (() => Promise<void>) | undefined;
  let itemTypeCleanup: (() => Promise<void>) | undefined;
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
    // Guard each step so a failure in `beforeAll` doesn't trigger a second,
    // misleading "X is not a function" error here that masks the root cause.
    try {
      await itemTypeCleanup?.();
      await orgCleanup?.();
    } finally {
      await harness?.shutdown();
    }
  }, 30_000);

  test('submitted item lands in Scylla and ClickHouse', async () => {
    if (!harness) throw new Error('harness was not initialized');
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

    const scyllaRow = await waitForItemInScylla(harness.deps, {
      orgId,
      itemIdentifier: { id: itemId, typeId: itemTypeId },
    });
    expect(scyllaRow).toBeDefined();
    expect(scyllaRow.org_id).toBe(orgId);

    const chRow = await waitForItemInClickHouse(harness.deps, {
      orgId,
      itemIdentifier: { id: itemId, typeId: itemTypeId },
    });
    expect(chRow).toBeDefined();
  }, 60_000);
});
