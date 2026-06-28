/**
 * Integration test for #343 — phase 2: Scylla outage scenario.
 *
 * Lives in its own file rather than appending to `outage.integ.test.ts`
 * because that file ships in #646 (still under review at the time of
 * writing) and a parallel-branch PR would conflict. Once both land we
 * can collapse the two files together.
 *
 * Pins today's known-lossy contract for #649:
 *
 *   `ItemProcessingWorker` wraps the Scylla insert in a try/catch that
 *   silently swallows write errors (`// swallow error for now if an
 *   item fails to make it into scylla`). So a Scylla outage during item
 *   processing means the BullMQ job completes "successfully," the
 *   worker moves on to log to ClickHouse, and the row never lands in
 *   `item_submission_by_thread`.
 *
 * The test asserts:
 *
 *   1. The API still claims 202 (we never told the client there was a
 *      problem).
 *   2. The worker still reaches `CONTENT_API_REQUESTS` in ClickHouse
 *      (the swallow let it continue past the insert).
 *
 * We deliberately don't assert "row absent in Scylla" after restore.
 * The in-harness Cassandra driver doesn't recover cleanly within a
 * reasonable window after a Scylla container restart (stale
 * connections, prepared-statement re-prepare); a direct query there
 * ends up testing the driver's reconnect timing rather than the
 * worker's behaviour. The CH row landing in assertion 2 is sufficient
 * proof of the contract — it can only get written if the worker
 * reached past the swallowed insert.
 *
 * #649 tracks the decision about whether to escalate from this
 * swallow-and-continue contract to a re-throw-and-retry one. The
 * desired assertion at that point flips to "row lands in Scylla after
 * recovery" (same shape as the Redis-recovery test in phase 1).
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
import { waitForItemInClickHouse } from './wait.js';

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
  // KNOWN-LOSSY CONTRACT pinned by this test — tracking issue: #649.
  //
  // Today's `ItemProcessingWorker` swallows Scylla insert errors:
  //
  //   try {
  //     await insertWithRetries({ ... });
  //   } catch (e) {
  //     // swallow error for now if an item fails to make it into scylla
  //   }
  //
  // So a Scylla outage during the worker's processing window drops the
  // row in `item_submission_by_thread` without retry. The job completes
  // "successfully," the worker logs to ClickHouse, the API has long
  // since returned 202 to the client. Nothing surfaces the loss.
  //
  // This test pins that contract: API still 202, ClickHouse row still
  // lands. When #649 flips the worker to re-throw-and-retry, a third
  // assertion is added: row lands in Scylla after recovery (same shape
  // as the Redis recovery test in `outage.integ.test.ts`).
  // ---------------------------------------------------------------------------
  test('Scylla stopped: API claims 202, ClickHouse row lands, Scylla row is dropped — known-lossy contract (#649)', async () => {
    if (!harness) throw new Error('harness was not initialized');
    const itemId = uid();

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

      // Gate on `CONTENT_API_REQUESTS` (logged after Scylla insert + rule
      // eval in `ItemProcessingWorker`). Its presence proves the worker
      // got past the insert — i.e. the swallow happened and execution
      // continued. If the worker were re-throwing on insert failure
      // instead, this wait would time out.
      const chRow = await waitForItemInClickHouse(harness!.deps, {
        orgId,
        itemIdentifier: { id: itemId, typeId: itemTypeId },
        timeoutMs: 30_000,
      });
      expect(chRow).toBeDefined();
    });

    // We deliberately don't assert "row absent in Scylla" after restore.
    // The in-harness Cassandra driver doesn't recover cleanly within a
    // reasonable test window after a Scylla container restart (stale
    // connections, prepared-statement re-prepare, etc.), so a direct
    // `Scylla.select` here ends up testing the driver's reconnect timing
    // rather than the worker's behaviour. The CONTENT_API_REQUESTS row
    // landing above is sufficient proof of the contract — it can only
    // get written if the worker reached past the swallowed insert.
    //
    // DESIRED (#649 path 1): when the worker is changed to re-throw on
    // insert failure, the new assertion becomes "row eventually lands in
    // Scylla once BullMQ retries the job after recovery" — same shape as
    // the Redis-recovery test in outage.integ.test.ts. At that point the
    // driver-recovery-timing problem either goes away (because we'd be
    // polling for presence, which tolerates transient errors as just
    // "not yet") or gets solved alongside.
  }, 120_000);
});
