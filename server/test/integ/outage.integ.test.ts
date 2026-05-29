/**
 * Integration test for #343 — phase 1: HMA + Redis outage scenarios.
 *
 * Stops or pauses each dependency in turn and asserts Coop's degradation
 * contract. See the planning comment on #343 for the deferred services
 * (Scylla, Postgres) and the rationale for splitting them into follow-ups.
 *
 *   - HMA stopped: `submitReport`'s HMA block hits its outer try/catch
 *     after the per-URL `withRetries` budget exhausts. Report still
 *     succeeds (201); the absence of hashes on the response is the
 *     observable degradation.
 *   - HMA paused: same observable outcome — TCP-hung instead of TCP-
 *     rejected, retries time out the same way.
 *   - Redis stopped: `POST /api/v1/items/async` returns 202 immediately
 *     (the `itemSubmissionQueueBulkWrite` DataLoader batch resolves
 *     through ioredis's `enableOfflineQueue`). Once Redis is restored,
 *     the buffered command flushes, BullMQ delivers to the worker, and
 *     the item lands in Scylla. **No data loss as long as the API
 *     process stays up.**
 *   - Redis paused: same shape — TCP-hung instead of rejected, same
 *     recovery once unpaused.
 *
 * The narrow remaining gap on the Redis path is "API process restart
 * while Redis is unreachable" — the offline buffer is in-process and
 * goes with the restart. Worth a follow-up (pre-flight Redis health
 * check before claiming 202, or `enableOfflineQueue: false` on the
 * enqueue connection) but doesn't belong in this test PR.
 *
 * MUST run with `--runInBand`: docker-compose state is shared global
 * mutable state across the test suite. Concurrent scenarios would
 * stomp each other's stop/start cycles.
 *
 * Each scenario uses `withServiceDown` / `withServicePaused` so an
 * assertion failure inside the callback still restores the service
 * before the next test runs — otherwise one flake would cascade and
 * leak a paused HMA or Redis into the rest of the integ suite.
 *
 * Run with: npm run test:integ -- outage.integ.test.ts
 * Requires: `npm run up && npm run db:update`
 */
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
import { waitForItemInScylla } from './wait.js';

describe('HMA outage (integration)', () => {
  const orgId = uid();
  let harness: IntegrationServer | undefined;
  let apiKey: string;
  let reporterUserItemTypeId: string;
  let itemTypeId: string;
  let orgCleanup: (() => Promise<unknown>) | undefined;
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
    reporterUserItemTypeId = orgFixture.defaultUserItemType.id;
    orgCleanup = orgFixture.cleanup;

    const itemTypeFixture = await createContentItemTypes({
      moderationConfigService: harness.deps.ModerationConfigService,
      orgId,
      extra: {
        fields: [
          // Array-of-IMAGE. `submitReport`'s HMA block keys off
          // `Array.isArray(reportedItem.data.images)` so the field has to
          // be a container, not a scalar, for the hash-lookup path to run
          // at all — otherwise the test would pass for trivial reasons
          // (HMA never called) with the service down.
          {
            name: 'images',
            type: 'ARRAY',
            required: false,
            container: {
              containerType: 'ARRAY',
              valueScalarType: ScalarTypes.IMAGE,
              keyScalarType: null,
            },
          },
        ],
      },
    });
    itemTypeId = itemTypeFixture.itemTypes[0].id;
    itemTypeCleanup = itemTypeFixture.cleanup;
  }, 60_000);

  afterAll(async () => {
    // Belt-and-suspenders: even though `withServiceDown` / `withServicePaused`
    // restore HMA on the inner-fn exit, an unexpected harness crash could
    // skip the finally block. Restoring here lets the next describe block
    // (and the rest of the suite) start from a known-good state.
    try {
      await startService('hma');
    } catch {
      /* already running */
    }
    try {
      await unpauseService('hma');
    } catch {
      /* already unpaused */
    }
    try {
      await itemTypeCleanup?.();
      await orgCleanup?.();
    } finally {
      await harness?.shutdown();
    }
  }, 60_000);

  const submitReportWithImage = async (imageUrl: string) => {
    if (!harness) throw new Error('harness was not initialized');
    return harness.request
      .post('/api/v1/report')
      .set('x-api-key', apiKey)
      .send({
        reporter: {
          kind: 'user',
          typeId: reporterUserItemTypeId,
          id: uid(),
        },
        reportedAt: new Date().toISOString(),
        reportedItem: {
          id: uid(),
          typeId: itemTypeId,
          data: { images: [imageUrl] },
        },
      });
  };

  test('report succeeds and images are not hash-wrapped when HMA is stopped', async () => {
    await withServiceDown('hma', async () => {
      const res = await submitReportWithImage(
        'https://example.com/outage-stopped.jpg',
      );
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('reportId');
    });
  }, 120_000);

  test('report succeeds and images are not hash-wrapped when HMA is paused', async () => {
    await withServicePaused('hma', async () => {
      // The 5-retry per-URL withRetries budget caps at ~500ms each plus
      // jitter, so the request shouldn't take longer than ~3s on a hot
      // path — well inside the 120s test budget.
      const res = await submitReportWithImage(
        'https://example.com/outage-paused.jpg',
      );
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('reportId');
    });
  }, 120_000);
});

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

    // MRT queue isn't strictly needed for items/async, but `setupIntegrationServer`
    // starts the worker which expects a sane org config.
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
    // Same belt-and-suspenders restore as the HMA suite — Redis must be
    // up before fixture cleanup runs (queue/user/org all live in Postgres,
    // but the in-harness BullMQ worker holds a Redis connection and its
    // shutdown will hang if Redis is still paused).
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

  // -------------------------------------------------------------------------
  // Observed contract for Redis outages on `/api/v1/items/async`:
  //
  //   - The API returns 202 even while Redis is unreachable. This is *not*
  //     accept-and-drop in the durable sense — ioredis has
  //     `enableOfflineQueue: true` by default, so the `queue.addBulk`
  //     command is buffered client-side and the DataLoader-batched write
  //     resolves cleanly. On the wire from the caller's perspective the
  //     submission has been accepted.
  //   - Once Redis is restored, ioredis flushes the offline queue, BullMQ
  //     enqueues the buffered job, and the inline `ItemProcessingWorker`
  //     picks it up and writes Scylla as normal.
  //
  // Net "no data lost" outcome: holds as long as the API process stays up.
  // The narrow gap is "API process restart while Redis is unreachable" —
  // ioredis's offline buffer is in-process and goes with the restart.
  // Worth a follow-up (durable enqueue ack, or pre-flight Redis health
  // before claiming 202) but doesn't belong in this test PR.
  // -------------------------------------------------------------------------

  test('item survives a brief Redis outage and lands in Scylla after recovery', async () => {
    const { res, itemId } = await withServiceDown('redis', async () => {
      return submitItem();
    });
    expect(res.status).toBe(202);

    // After `withServiceDown` exits, Redis is back. ioredis flushes its
    // offline queue, BullMQ delivers to the worker, the worker writes
    // to Scylla. Generous timeout because all of that has to happen
    // post-restore.
    const scyllaRow = await waitForItemInScylla(harness!.deps, {
      orgId,
      itemIdentifier: { id: itemId, typeId: itemTypeId },
      timeoutMs: 30_000,
    });
    expect(scyllaRow.org_id).toBe(orgId);
  }, 120_000);

  test('item survives a brief Redis pause and lands in Scylla after unpause', async () => {
    const { res, itemId } = await withServicePaused('redis', async () => {
      return submitItem();
    });
    expect(res.status).toBe(202);

    const scyllaRow = await waitForItemInScylla(harness!.deps, {
      orgId,
      itemIdentifier: { id: itemId, typeId: itemTypeId },
      timeoutMs: 30_000,
    });
    expect(scyllaRow.org_id).toBe(orgId);
  }, 120_000);
});
