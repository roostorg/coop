/**
 * Integration test: e2e testing for NCMEC
 *
 * Tests the full NCMEC flow including reporting with csam: true
 * to the moderator dequeueing and then finally submitting the decision.
 *
 * Asserts that all types of media are correctly submitted to Cybertips.
 *
 * Run with: npm run test:integration
 * Requires: `npm run up && npm run db:update`
 */
import { ScalarTypes } from '@roostorg/coop-types';
import { uid } from 'uid';

import { jsonStringify } from '../../utils/encoding.js';
import createContentItemTypes from '../fixtureHelpers/createContentItemTypes.js';
import createMrtQueue from '../fixtureHelpers/createMrtQueue.js';
import createOrg from '../fixtureHelpers/createOrg.js';
import createThreadItemTypes from '../fixtureHelpers/createThreadItemTypes.js';
import createUser from '../fixtureHelpers/createUser.js';
import { makeStubFetchHTTP } from '../fixtureHelpers/makeStubFetchHTTP.js';
import {
  makeIntegrationServer,
  type IntegrationServer,
} from './setupIntegrationServer.js';
import {
  waitFor,
  waitForItemInScylla,
  waitForJobCreationInPostgres,
} from './wait.js';

const MEDIA_URL = 'https://example.com/ncmec-submit-decision.jpg';
const REVIEWER_PASSWORD = 'integ-reviewer-password-1';

describe('NCMEC report and submission (integration)', () => {
  const orgId = uid();
  const ncmecReportId = uid();
  let harness: IntegrationServer | undefined;
  let fetchStub: ReturnType<typeof makeStubFetchHTTP>;
  let apiKey: string;
  let userItemTypeId: string;
  let queueId: string;
  let reviewerEmail: string;
  let reviewerId: string;
  let orgCleanup: (() => Promise<unknown>) | undefined;
  let reviewerCleanup: (() => Promise<unknown>) | undefined;
  let queueCleanup: (() => Promise<unknown>) | undefined;

  beforeAll(async () => {
    fetchStub = makeStubFetchHTTP(ncmecReportId, 'f1');
    harness = await makeIntegrationServer({
      mockedDeps: { fetchHTTP: fetchStub.fetchHTTP },
    });

    const orgFixture = await createOrg(
      {
        KyselyPg: harness.deps.KyselyPg,
        ModerationConfigService: harness.deps.ModerationConfigService,
        ApiKeyService: harness.deps.ApiKeyService,
      },
      orgId,
    );
    apiKey = orgFixture.apiKey;
    userItemTypeId = orgFixture.defaultUserItemType.id;
    orgCleanup = orgFixture.cleanup;

    const reviewerFixture = await createUser(harness.deps.KyselyPg, orgId, {
      password: REVIEWER_PASSWORD,
      loginMethods: ['password'],
      approvedByAdmin: true,
    });
    reviewerEmail = reviewerFixture.user.email;
    reviewerId = reviewerFixture.user.id;
    reviewerCleanup = reviewerFixture.cleanup;

    const queueFixture = await createMrtQueue({
      orgId,
      mrtService: harness.deps.ManualReviewToolService,
      userId: reviewerId,
    });
    queueId = queueFixture.queue.id;
    queueCleanup = queueFixture.cleanup;

    await harness.deps.NcmecService.updateNcmecOrgSettings({
      orgId,
      username: 'espuser',
      password: 'esppass',
      contactEmail: 'reporter@example.com',
      moreInfoUrl: null,
      companyTemplate: 'AcmeESP',
      legalUrl: 'https://acme.example/legal',
      ncmecPreservationEndpoint: null,
      ncmecAdditionalInfoEndpoint: null,
      defaultNcmecQueueId: null,
      defaultInternetDetailType: 'WEB_PAGE',
      termsOfService: null,
      contactPersonEmail: null,
      contactPersonFirstName: null,
      contactPersonLastName: null,
      contactPersonPhone: null,
      mediaReviewRequirement: 'ALL',
      minMediaToReview: null,
    });
  }, 60_000);

  afterAll(async () => {
    try {
      await queueCleanup?.();
      await reviewerCleanup?.();
      await orgCleanup?.();
    } finally {
      await harness?.shutdown();
    }
  }, 30_000);

  test('submitManualReviewDecision SUBMIT_NCMEC_REPORT via GQL triggers CyberTip submit', async () => {
    if (!harness) throw new Error('harness was not initialized');

    const contentTypeFixture = await createContentItemTypes({
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
    const contentTypeId = contentTypeFixture.itemTypes[0].id;

    const threadTypeFixture = await createThreadItemTypes({
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
    const threadTypeId = threadTypeFixture.itemTypes[0].id;

    const contentItemId = uid();
    const threadItemId = uid();
    const creatorUserId = uid();
    const reporterId = uid();
    const creatorRef = { id: creatorUserId, typeId: userItemTypeId };
    const THREAD_MEDIA_URL =
      'https://example.com/ncmec-submit-decision-thread.jpg';

    try {
      await harness.request
        .post('/api/v1/items/async')
        .set('x-api-key', apiKey)
        .send({
          items: [
            {
              id: contentItemId,
              typeId: contentTypeId,
              data: { image: MEDIA_URL, creatorId: creatorRef },
            },
            {
              id: threadItemId,
              typeId: threadTypeId,
              data: { image: THREAD_MEDIA_URL, creatorId: creatorRef },
            },
          ],
        })
        .expect(202);

      await waitForItemInScylla(harness.deps, {
        orgId,
        itemIdentifier: { id: contentItemId, typeId: contentTypeId },
      });
      await waitForItemInScylla(harness.deps, {
        orgId,
        itemIdentifier: { id: threadItemId, typeId: threadTypeId },
      });

      await harness.request
        .post('/api/v1/report')
        .set('x-api-key', apiKey)
        .send({
          reporter: {
            kind: 'user',
            typeId: userItemTypeId,
            id: reporterId,
          },
          reportedAt: new Date().toISOString(),
          reportedForReason: { csam: true },
          reportedItem: {
            id: contentItemId,
            typeId: contentTypeId,
            data: { image: MEDIA_URL, creatorId: creatorRef },
          },
        })
        .expect(201);

      await waitForJobCreationInPostgres(harness.deps, {
        orgId,
        itemIdentifier: { id: creatorUserId, typeId: userItemTypeId },
      });

      // --- Submit decision via GraphQL API ---
      const loginRes = await harness.request.post('/api/v1/graphql').send({
        query: `mutation {
          login(input: { email: ${jsonStringify(reviewerEmail)}, password: ${jsonStringify(REVIEWER_PASSWORD)} }) {
            __typename
          }
        }`,
      });
      expect(loginRes.status).toBe(200);
      expect(loginRes.body?.data?.login?.__typename).toBe(
        'LoginSuccessResponse',
      );

      const dequeueRes = await harness.request.post('/api/v1/graphql').send({
        query: `mutation {
          dequeueManualReviewJob(queueId: ${jsonStringify(queueId)}) {
            ... on DequeueManualReviewJobSuccessResponse {
              job {
                id
                payload {
                  ... on NcmecManualReviewJobPayload {
                    allMediaItems {
                      isReported
                      contentItem {
                        __typename
                        ... on ItemBase {
                          id
                          type { id }
                          data
                        }
                      }
                    }
                  }
                }
              }
              lockToken
            }
          }
        }`,
      });
      if (dequeueRes.status !== 200) {
        throw new Error(
          `dequeueManualReviewJob failed: HTTP ${dequeueRes.status} — ${jsonStringify(dequeueRes.body)}`,
        );
      }
      expect(dequeueRes.body.errors).toBeUndefined();
      const dequeueData = dequeueRes.body.data?.dequeueManualReviewJob;
      if (!dequeueData) {
        throw new Error('expected a job to dequeue');
      }

      const {
        job: { id: jobId, payload },
        lockToken,
      } = dequeueData;

      type AllMediaItem = {
        isReported: boolean;
        contentItem: {
          __typename: string;
          id: string;
          type: { id: string };
          data: Record<string, unknown>;
        };
      };

      const mediaByItemId = new Map<string, AllMediaItem>(
        (payload.allMediaItems as AllMediaItem[]).map((m) => [
          m.contentItem.id,
          m,
        ]),
      );
      expect(mediaByItemId.get(contentItemId)?.isReported).toBe(true);
      expect(mediaByItemId.get(threadItemId)?.isReported).toBe(false);
      expect(mediaByItemId.get(contentItemId)?.contentItem.__typename).toBe(
        'ContentItem',
      );
      expect(mediaByItemId.get(threadItemId)?.contentItem.__typename).toBe(
        'ThreadItem',
      );

      // Build reportedMedia from the items the server returned
      const reportedMediaGql = payload.allMediaItems
        .map((m: AllMediaItem) => {
          const url =
            (m.contentItem.data['image'] as { url?: string } | undefined)
              ?.url ?? '';
          return (
            `{ id: ${jsonStringify(m.contentItem.id)} ` +
            `typeId: ${jsonStringify(m.contentItem.type.id)} ` +
            `url: ${jsonStringify(url)} ` +
            `industryClassification: A1 ` +
            `fileAnnotations: [] }`
          );
        })
        .join('\n');

      const submitRes = await harness.request.post('/api/v1/graphql').send({
        query: `mutation {
          submitManualReviewDecision(input: {
            queueId: ${jsonStringify(queueId)}
            jobId: ${jsonStringify(jobId)}
            lockToken: ${jsonStringify(lockToken)}
            reportHistory: []
            relatedItemActions: []
            reportedItemDecisionComponents: [
              {
                submitNcmecReport: {
                  incidentType: CHILD_PORNOGRAPHY
                  reportedMessages: []
                  reportedMedia: [${reportedMediaGql}]
                }
              }
            ]
          }) {
            ... on SubmitDecisionSuccessResponse {
              success
            }
          }
        }`,
      });
      if (submitRes.status !== 200) {
        throw new Error(
          `submitManualReviewDecision failed: HTTP ${submitRes.status} — ${jsonStringify(submitRes.body)}`,
        );
      }
      expect(submitRes.body.errors).toBeUndefined();
      expect(submitRes.body.data?.submitManualReviewDecision?.success).toBe(
        true,
      );

      // The IoC onRecordDecision handler fires asynchronously after the GQL
      // response, so we poll until the expected CyberTip calls appear.
      await waitFor('CyberTip /finish call', async () => {
        const calls = fetchStub.calls
          .filter((c) => c.url.includes('cybertip.org'))
          .map((c) => c.url.replace(/^.*\/ispws/, ''));
        if (!calls.includes('/finish')) return undefined;
        return calls;
      });

      const cybertipPaths = fetchStub.calls
        .filter((c) => c.url.includes('cybertip.org'))
        .map((c) => c.url.replace(/^.*\/ispws/, ''));
      expect(cybertipPaths.filter((p) => p === '/submit')).toHaveLength(1);
      expect(cybertipPaths.filter((p) => p === '/finish')).toHaveLength(1);

      const newCalls = fetchStub.calls;

      // Both media items were downloaded from storage before upload
      const downloadedUrls = newCalls
        .filter((c) => c.method === 'get')
        .map((c) => c.url);
      expect(downloadedUrls).toContain(MEDIA_URL);
      expect(downloadedUrls).toContain(THREAD_MEDIA_URL);

      const submitCall = newCalls.find(
        (c) => c.url.endsWith('/ispws/submit') && typeof c.body === 'string',
      );
      expect(submitCall?.headers?.Authorization).toMatch(/^Basic /);
      expect(String(submitCall?.body)).toContain('<incidentType>');

      // Each /fileinfo XML includes the originalFileName derived from the
      // media URL, confirming the correct per-item data was sent to NCMEC
      const fileinfoXmls = newCalls
        .filter((c) => c.url.endsWith('/ispws/fileinfo'))
        .map((c) => String(c.body));
      expect(
        fileinfoXmls.some((xml) => xml.includes('ncmec-submit-decision.jpg')),
      ).toBe(true);
      expect(
        fileinfoXmls.some((xml) =>
          xml.includes('ncmec-submit-decision-thread.jpg'),
        ),
      ).toBe(true);

      // Both media items are persisted in the ncmec_reports row
      const reportRow = await waitFor(
        `ncmec_reports row for user ${creatorUserId}`,
        async () =>
          harness!.deps.KyselyPg.selectFrom('ncmec_reporting.ncmec_reports')
            .select(['report_id', 'is_test', 'reviewer_id', 'reported_media'])
            .where('org_id', '=', orgId)
            .where('user_id', '=', creatorUserId)
            .executeTakeFirst(),
      );

      expect(reportRow.report_id).toBe(ncmecReportId);
      expect(reportRow.reviewer_id).toBe(reviewerId);
      expect(reportRow.is_test).toBe(process.env.NCMEC_ENV !== 'production');

      const reportedMediaIds = (
        reportRow.reported_media as Array<{ id: string; typeId: string }>
      ).map((m) => m.id);
      expect(reportedMediaIds).toContain(contentItemId);
      expect(reportedMediaIds).toContain(threadItemId);
    } finally {
      await contentTypeFixture.cleanup();
      await threadTypeFixture.cleanup();
    }
  }, 60_000);
});
