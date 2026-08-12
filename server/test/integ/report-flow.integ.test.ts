/**
 * Integration test for #341: report flow.
 *
 * Submits a report via POST /api/v1/report against a real running stack and
 * asserts it flows through every system named in the issue:
 *
 *   - Scylla (`item_submission_by_thread`) — reported item submission
 *   - ClickHouse (`REPORTING_SERVICE.REPORTS`) — analytics row written by
 *     `ReportingService.submitReport`
 *   - Postgres (`manual_review_tool.job_creations`) — review queue membership
 *   - "Simulated" NCMEC: when `reportedForReason.csam = true`, the report is
 *     routed through `NcmecService.enqueueForHumanReviewIfApplicable`, which
 *     extracts the content's creator and enqueues the USER (not the content).
 *     The `job_creations` row's `item_id` flipping from the content item to
 *     the creator is the observable difference from the standard path. The
 *     actual NCMEC HTTP submission is a downstream reviewer-triggered flow
 *     and is intentionally out of scope.
 *
 * Each test provisions its own content item type. The report path reads
 * `ModerationConfigService.getItemTypes` with `maxAge: 10`, so item types
 * created in an earlier test can stay cached and mask resolution problems.
 *
 * Run with: npm run test:integ
 * Requires: `npm run up && npm run db:update`
 */
import { ScalarTypes } from '@roostorg/coop-types';
import { uid } from 'uid';

import createContentItemTypes from '../fixtureHelpers/createContentItemTypes.js';
import createMrtQueue from '../fixtureHelpers/createMrtQueue.js';
import createOrg from '../fixtureHelpers/createOrg.js';
import createUser from '../fixtureHelpers/createUser.js';
import {
  makeIntegrationServer,
  type IntegrationServer,
} from './setupIntegrationServer.js';
import {
  waitForItemInScylla,
  waitForJobCreationInPostgres,
  waitForReportInClickHouse,
} from './wait.js';

describe('Report flow (integration)', () => {
  const orgId = uid();
  let harness: IntegrationServer | undefined;
  let apiKey: string;
  let reporterUserItemTypeId: string;
  let orgCleanup: (() => Promise<unknown>) | undefined;
  let userCleanup: (() => Promise<unknown>) | undefined;
  let queueCleanup: (() => Promise<unknown>) | undefined;

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

    // A coop user is required to own the MRT queue. This is separate from the
    // USER *item type* used as the reporter / content creator below — coop
    // users authenticate into the dashboard; item-type users are reported
    // entities in the customer's product.
    const userFixture = await createUser(harness.deps.KyselyPg, orgId);
    userCleanup = userFixture.cleanup;

    // The submitReport handler's MRT enqueue silently fails if no default queue
    // exists for the org, which would turn a missing-row assertion into a
    // misleading timeout. First queue created for an org becomes the default
    // (per QueueOperations.createManualReviewQueue).
    const queueFixture = await createMrtQueue({
      orgId,
      mrtService: harness.deps.ManualReviewToolService,
      userId: userFixture.user.id,
    });
    queueCleanup = queueFixture.cleanup;
  }, 60_000);

  afterAll(async () => {
    // Best-effort: run every cleanup even if an earlier one throws. Guards
    // against (a) `beforeAll` failures leaving some `*Cleanup` undefined and
    // (b) a flaky known issue in `deleteManualReviewQueueForTestsDO_NOT_USE`
    // — it deletes `manual_review_queues` and `users_and_accessible_queues`
    // inside `Promise.all`, so the FK delete can race the parent delete and
    // raise a `users_and_accessible_queues_queue_id_fkey` violation. Letting
    // the suite fail on that would turn a green test into a red one.
    const runStep = async (fn?: () => Promise<unknown>) => {
      if (!fn) return;
      try {
        await fn();
      } catch (err) {
        console.warn('[report-flow.integ] cleanup step failed', err);
      }
    };
    try {
      await runStep(queueCleanup);
      await runStep(userCleanup);
      await runStep(orgCleanup);
    } finally {
      await harness?.shutdown();
    }
  }, 30_000);

  test('standard report (non-CSAM) lands in Scylla, ClickHouse, and the review queue', async () => {
    if (!harness) throw new Error('harness was not initialized');

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
    const itemTypeId = itemTypeFixture.itemTypes[0].id;

    try {
      const itemId = uid();
      const reporterId = uid();

      // First put the item in the system the normal way. The report endpoint
      // also calls `ItemInvestigationService.insertItem` for the reported
      // item, but going through /items/async exercises the same worker path a
      // real client would, and gives the Scylla assertion below something
      // unambiguous to wait on.
      await harness.request
        .post('/api/v1/items/async')
        .set('x-api-key', apiKey)
        .send({
          items: [
            {
              id: itemId,
              typeId: itemTypeId,
              data: { text: 'something bad' },
            },
          ],
        })
        .expect(202);

      await waitForItemInScylla(harness.deps, {
        orgId,
        itemIdentifier: { id: itemId, typeId: itemTypeId },
      });

      const reportRes = await harness.request
        .post('/api/v1/report')
        .set('x-api-key', apiKey)
        .send({
          reporter: {
            kind: 'user',
            typeId: reporterUserItemTypeId,
            id: reporterId,
          },
          reportedAt: new Date().toISOString(),
          reportedItem: {
            id: itemId,
            typeId: itemTypeId,
            data: { text: 'something bad' },
          },
        })
        .expect(201);

      expect(reportRes.body).toHaveProperty('reportId');

      const reportRow = await waitForReportInClickHouse(harness.deps, {
        orgId,
        reportedItemIdentifier: { id: itemId, typeId: itemTypeId },
      });
      expect(reportRow.reporter_kind).toBe('user');

      // Standard path: the enqueued item is the reported content itself.
      const jobRow = await waitForJobCreationInPostgres(harness.deps, {
        orgId,
        itemIdentifier: { id: itemId, typeId: itemTypeId },
      });
      expect(jobRow.org_id).toBe(orgId);
    } finally {
      await itemTypeFixture.cleanup();
    }
  }, 60_000);

  test('CSAM report enqueues the content creator via the NCMEC path', async () => {
    if (!harness) throw new Error('harness was not initialized');

    // Content type needs a media-class field and a creator reference. The
    // NCMEC enqueue path is media-scalar-agnostic: `isMediaType` returns true
    // for IMAGE / AUDIO / VIDEO / MEDIA, `getValuesFromFields` uses the same
    // generic `scalarGetValues` handler for each, and the enqueued
    // `contentItem` doesn't inspect the field type — so picking any one of
    // those scalars exercises the same code path. IMAGE here keeps the test
    // runnable today; MEDIA wires through the same way once #632 lands.
    //
    // `includeCreator: true` adds the `creatorId: 'creatorId'` schema field
    // role so `getFieldValueForRole(..., 'creatorId', ...)` can resolve the
    // creator off the content item.
    const itemTypeFixture = await createContentItemTypes({
      moderationConfigService: harness.deps.ModerationConfigService,
      orgId,
      includeCreator: true,
      extra: {
        fields: [
          {
            name: 'image',
            type: ScalarTypes.IMAGE,
            required: false,
            container: null,
          },
          {
            name: 'creatorId',
            type: ScalarTypes.RELATED_ITEM,
            required: true,
            container: null,
          },
        ],
      },
    });
    const itemTypeId = itemTypeFixture.itemTypes[0].id;

    try {
      const contentItemId = uid();
      const creatorUserId = uid();
      const reporterId = uid();

      await harness.request
        .post('/api/v1/items/async')
        .set('x-api-key', apiKey)
        .send({
          items: [
            {
              id: contentItemId,
              typeId: itemTypeId,
              data: {
                image: 'https://example.com/sample.jpg',
                creatorId: {
                  id: creatorUserId,
                  typeId: reporterUserItemTypeId,
                },
              },
            },
          ],
        })
        .expect(202);

      await waitForItemInScylla(harness.deps, {
        orgId,
        itemIdentifier: { id: contentItemId, typeId: itemTypeId },
      });

      const reportRes = await harness.request
        .post('/api/v1/report')
        .set('x-api-key', apiKey)
        .send({
          reporter: {
            kind: 'user',
            typeId: reporterUserItemTypeId,
            id: reporterId,
          },
          reportedAt: new Date().toISOString(),
          reportedForReason: { csam: true },
          reportedItem: {
            id: contentItemId,
            typeId: itemTypeId,
            data: {
              media: 'https://example.com/sample.jpg',
              creatorId: { id: creatorUserId, typeId: reporterUserItemTypeId },
            },
          },
        })
        .expect(201);

      expect(reportRes.body).toHaveProperty('reportId');

      // Analytics row is written for CSAM reports too (the analytics write
      // happens before the MRT enqueue branch).
      await waitForReportInClickHouse(harness.deps, {
        orgId,
        reportedItemIdentifier: { id: contentItemId, typeId: itemTypeId },
      });

      // NCMEC path: the enqueued item is the *creator user*, not the content.
      const jobRow = await waitForJobCreationInPostgres(harness.deps, {
        orgId,
        itemIdentifier: {
          id: creatorUserId,
          typeId: reporterUserItemTypeId,
        },
      });
      expect(jobRow.org_id).toBe(orgId);
      expect(jobRow.item_id).toBe(creatorUserId);
      expect(jobRow.item_type_id).toBe(reporterUserItemTypeId);
    } finally {
      await itemTypeFixture.cleanup();
    }
  }, 60_000);
});
