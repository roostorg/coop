/**
 * Integration test for #343 — phase 2: Scylla outage scenario.
 *
 * Lives in its own file rather than appending to `outage.integ.test.ts`
 * because that file ships in #646 (still under review at the time of
 * writing) and a parallel-branch PR would conflict. Once both land we
 * can collapse the two files together.
 *
 * Verifies #649 path 1: the re-throw-and-retry contract.
 *
 *   `ItemProcessingWorker` surfaces Scylla insert errors instead of
 *   swallowing them, and item-submission jobs carry BullMQ `attempts` +
 *   exponential backoff. So a Scylla outage during item processing no
 *   longer drops the row: the failing attempt re-throws, BullMQ retries
 *   the job, and once the driver reconnects the insert lands in
 *   `item_submission_by_thread`.
 *
 * The test asserts:
 *
 *   1. The API still claims 202 while Scylla is down (the job is
 *      enqueued to BullMQ, which is backed by Redis — still up).
 *   2. After Scylla is restored, the row eventually lands in
 *      `item_submission_by_thread` (the retry succeeded).
 *
 * The recovery poll tolerates transient Cassandra errors thrown during
 * the driver's post-restart reconnect. `wait.ts`'s `waitForItemInScylla`
 * surfaces query errors by design, so we retry it until the row appears
 * or the outer deadline passes — a mid-reconnect throw just means "not
 * landed yet", which sidesteps the driver-reconnect-timing problem that
 * blocked asserting Scylla state directly.
 *
 * MUST run with `--runInBand`: same docker-compose-is-shared-state
 * caveat as `outage.integ.test.ts`. See #648 for the suite-level fix.
 *
 * Run with: npm run test:integ -- outage-scylla.integ.test.ts
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
} from './dockerCompose.js';
import {
  makeIntegrationServer,
  type IntegrationServer,
} from './setupIntegrationServer.js';
import { waitForItemInScylla } from './wait.js';

describe('Scylla outage (integration)', () => {
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
    // Belt-and-suspenders restore: even though `withServiceDown` restores
    // Scylla on the inner-fn exit, a harness crash could skip its finally
    // block. Restoring here keeps the rest of the integ suite running.
    try {
      await startService('scylla');
    } catch {
      /* already running */
    }
    try {
      await unpauseService('scylla');
    } catch {
      /* already unpaused */
    }
    const runStep = async (fn?: () => Promise<unknown>) => {
      if (!fn) return;
      try {
        await fn();
      } catch (err) {
        console.warn('[outage-scylla.integ] cleanup step failed', err);
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

  // ---------------------------------------------------------------------------
  // RE-THROW-AND-RETRY CONTRACT pinned by this test — implements #649 path 1.
  //
  // `ItemProcessingWorker` now surfaces Scylla insert errors instead of
  // swallowing them, and the item-submission jobs carry BullMQ `attempts` +
  // exponential backoff. So a Scylla outage during processing no longer drops
  // the `item_submission_by_thread` row: the failing attempt re-throws, BullMQ
  // retries the job with backoff, and once the Cassandra driver reconnects the
  // insert succeeds. No data loss as long as Scylla recovers within the retry
  // window.
  //
  // This test asserts:
  //   1. The API still returns 202 while Scylla is down (the job is enqueued to
  //      BullMQ, which is backed by Redis — still up).
  //   2. After Scylla is restored, the row eventually lands in
  //      `item_submission_by_thread` (the retry succeeded).
  //
  // The recovery poll tolerates transient Cassandra errors thrown during the
  // driver's post-restart reconnect: `wait.ts`'s `waitForItemInScylla` surfaces
  // query errors by design, so we retry it until the row appears or the outer
  // deadline passes — a mid-reconnect throw just means "not landed yet".
  // ---------------------------------------------------------------------------
  test('Scylla recovers: item is retried and lands in Scylla after restore (#649 path 1)', async () => {
    if (!harness) throw new Error('harness was not initialized');
    const itemId = uid();

    // Submit while Scylla is down. The API still accepts (202): the job goes
    // onto the BullMQ queue, and the worker's insert will fail-and-retry.
    await withServiceDown('scylla', async () => {
      const res = await harness!.request
        .post('/api/v1/items/async')
        .set('x-api-key', apiKey)
        .send({
          items: [
            { id: itemId, typeId: itemTypeId, data: { text: 'scylla-down' } },
          ],
        });
      expect(res.status).toBe(202);
    });

    // Scylla is restored now (withServiceDown restored it on exit). BullMQ
    // retries the job; once the driver reconnects, the insert lands the row.
    const recoveryDeadline = Date.now() + 90_000;
    let scyllaRow: unknown;
    for (;;) {
      try {
        scyllaRow = await waitForItemInScylla(harness.deps, {
          orgId,
          itemIdentifier: { id: itemId, typeId: itemTypeId },
          timeoutMs: 5_000,
        });
        break;
      } catch (e) {
        if (Date.now() >= recoveryDeadline) throw e;
        await new Promise((resolve) => setTimeout(resolve, 1_000));
      }
    }
    expect(scyllaRow).toBeDefined();
  }, 120_000);
});
