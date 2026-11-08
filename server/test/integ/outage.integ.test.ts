// MUST run with `--runInBand`: docker-compose state is shared mutable state
// across the suite. Run: `npm run test:integ -- outage.integ.test.ts`.
import { ScalarTypes } from '@roostorg/coop-types';
import { uid } from 'uid';

import createContentItemTypes from '../fixtureHelpers/createContentItemTypes.js';
import createMrtQueue from '../fixtureHelpers/createMrtQueue.js';
import createOrg from '../fixtureHelpers/createOrg.js';
import createUser from '../fixtureHelpers/createUser.js';
import {
  startService,
  unpauseService,
  withServiceDown,
  withServicePaused,
} from './dockerCompose.js';
import {
  makeIntegrationServer,
  type IntegrationServer,
} from './setupIntegrationServer.js';
import { getItemFromScylla } from './wait.js';

describe('Redis outage (integration)', () => {
  const orgId = uid();
  let harness: IntegrationServer | undefined;
  let apiKey: string;
  let itemTypeId: string;
  let coopUserId: string;
  let orgCleanup: (() => Promise<unknown>) | undefined;
  let userCleanup: (() => Promise<unknown>) | undefined;
  let queueCleanup: (() => Promise<unknown>) | undefined;
  let itemTypeCleanup: (() => Promise<unknown>) | undefined;

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

    const userFixture = await createUser(harness.deps.KyselyPg, orgId);
    coopUserId = userFixture.user.id;
    userCleanup = userFixture.cleanup;

    // Worker started by `setupIntegrationServer` expects a configured MRT queue.
    const queueFixture = await createMrtQueue({
      orgId,
      mrtService: harness.deps.ManualReviewToolService,
      userId: coopUserId,
    });
    queueCleanup = queueFixture.cleanup;

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
    // Restore Redis before cleanup — the in-harness BullMQ worker's shutdown
    // hangs if Redis is still paused.
    try {
      await startService('redis');
    } catch {
      /* already running */
    }
    try {
      await unpauseService('redis');
    } catch {
      /* already unpaused */
    }
    const runStep = async (fn?: () => Promise<unknown>) => {
      if (!fn) return;
      try {
        await fn();
      } catch (err) {
        console.warn('[outage.integ] cleanup step failed', err);
      }
    };
    try {
      await runStep(queueCleanup);
      await runStep(userCleanup);
      await runStep(itemTypeCleanup);
      await runStep(orgCleanup);
    } finally {
      await harness?.shutdown();
    }
  }, 60_000);

  const submitItem = async () => {
    if (!harness) throw new Error('harness was not initialized');
    const itemId = uid();
    const res = await harness.request
      .post('/api/v1/items/async')
      .set('x-api-key', apiKey)
      .send({
        items: [
          { id: itemId, typeId: itemTypeId, data: { text: 'outage-test' } },
        ],
      });
    return { res, itemId };
  };

  test('item submission fails with 5xx and no Scylla row when Redis is stopped', async () => {
    const { res, itemId } = await withServiceDown('redis', async () => {
      return submitItem();
    });
    expect(res.status).toBeGreaterThanOrEqual(500);

    const scyllaRow = await getItemFromScylla(harness!.deps, {
      itemIdentifier: { id: itemId, typeId: itemTypeId },
    });
    expect(scyllaRow).toBeNull();
  }, 120_000);

  test('item submission fails with 5xx and no Scylla row when Redis is paused', async () => {
    const { res, itemId } = await withServicePaused('redis', async () => {
      return submitItem();
    });
    expect(res.status).toBeGreaterThanOrEqual(500);

    const scyllaRow = await getItemFromScylla(harness!.deps, {
      itemIdentifier: { id: itemId, typeId: itemTypeId },
    });
    expect(scyllaRow).toBeNull();
  }, 120_000);
});
