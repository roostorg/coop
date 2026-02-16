/* eslint-disable max-lines */
/* eslint-disable better-mutation/no-mutation */
import { ScalarTypes } from '@roostorg/types';
import { uid } from 'uid';

import getBottle from '../../../iocContainer/index.js';
import { UserPermission } from '../../../models/types/permissioning.js';
import createContentItemTypes from '../../../test/fixtureHelpers/createContentItemTypes.js';
import createOrg from '../../../test/fixtureHelpers/createOrg.js';
import { makeTestWithFixture } from '../../../test/utils.js';
import { toCorrelationId } from '../../../utils/correlationIds.js';
import { jsonStringify } from '../../../utils/encoding.js';
import { type NonEmptyString } from '../../../utils/typescript-types.js';
import {
  makeSubmissionId,
  submissionDataToItemSubmission,
} from '../../itemProcessingService/makeItemSubmission.js';
import { itemSubmissionToItemSubmissionWithTypeIdentifier } from '../../itemProcessingService/makeItemSubmissionWithTypeIdentifier.js';
import { toNormalizedItemDataOrErrors } from '../../itemProcessingService/toNormalizedItemDataOrErrors.js';
import { SignalType } from '../../signalsService/index.js';

describe('JobRouting tests', () => {
  const jobRoutingTestWithFixtures = makeTestWithFixture(async () => {
    const { container } = await getBottle();
    const { Org } = container.Sequelize;
    const manualReviewToolService = container.ManualReviewToolService;
    const { org, cleanup: orgCleanup } = await createOrg(
      { Org },
      container.ModerationConfigService,
      container.ApiKeyService,
      uid(),
    );
    const userId = uid();
    const { itemTypes, cleanup: itemTypesCleanup } =
      await createContentItemTypes({
        moderationConfigService: container.ModerationConfigService,
        orgId: org.id,
        extra: {
          fields: [
            {
              name: 'text',
              type: ScalarTypes.STRING,
              required: false,
              container: null,
            },
          ],
        },
      });
    const itemType = itemTypes[0];

    const defaultQueue = await manualReviewToolService.createManualReviewQueue({
      name: 'Default Queue',
      description: null,
      userIds: [userId],
      hiddenActionIds: [],
      isAppealsQueue: false,
      invokedBy: {
        userId,
        permissions: [UserPermission.EDIT_MRT_QUEUES],
        orgId: org.id,
      },
    });
    const anotherQueue = await manualReviewToolService.createManualReviewQueue({
      name: 'Another Queue',
      description: null,
      userIds: [userId],
      hiddenActionIds: [],
      isAppealsQueue: false,
      invokedBy: {
        userId,
        permissions: [UserPermission.EDIT_MRT_QUEUES],
        orgId: org.id,
      },
    });
    const policyQueue = await manualReviewToolService.createManualReviewQueue({
      name: 'Policy Queue',
      description: null,
      userIds: [userId],
      hiddenActionIds: [],
      isAppealsQueue: false,
      invokedBy: {
        userId,
        permissions: [UserPermission.EDIT_MRT_QUEUES],
        orgId: org.id,
      },
    });
    const noPolicyQueue = await manualReviewToolService.createManualReviewQueue(
      {
        name: 'No Policy Queue',
        description: null,
        userIds: [userId],
        hiddenActionIds: [],
        isAppealsQueue: false,
        invokedBy: {
          userId,
          permissions: [UserPermission.EDIT_MRT_QUEUES],
          orgId: org.id,
        },
      },
    );

    const rule = await manualReviewToolService.createRoutingRule({
      orgId: org.id,
      name: 'Some rule',
      status: 'LIVE',
      itemTypeIds: [itemType.id as NonEmptyString],
      creatorId: '',
      conditionSet: {
        conjunction: 'AND',
        conditions: [
          {
            input: {
              type: 'CONTENT_FIELD',
              name: 'text',
              contentTypeId: itemType.id,
            },
            signal: {
              id: jsonStringify({
                type: SignalType.TEXT_MATCHING_CONTAINS_TEXT,
              }),
              type: SignalType.TEXT_MATCHING_CONTAINS_TEXT,
            },
            matchingValues: { strings: ['test'] },
          },
        ],
      },
      destinationQueueId: anotherQueue.id,
    });

    const policyRule = await manualReviewToolService.createRoutingRule({
      orgId: org.id,
      name: 'Policy ID rule',
      status: 'LIVE',
      itemTypeIds: [itemType.id as NonEmptyString],
      creatorId: '',
      conditionSet: {
        conjunction: 'OR',
        conditions: [
          {
            input: {
              type: 'CONTENT_COOP_INPUT',
              name: 'Relevant Policy',
            },
            threshold: 'testPolicyId',
            comparator: 'EQUALS',
          },
        ],
      },
      destinationQueueId: policyQueue.id,
    });

    const policyNotProvidedRule =
      await manualReviewToolService.createRoutingRule({
        orgId: org.id,
        name: 'Policy ID not provided rule',
        status: 'LIVE',
        itemTypeIds: [itemType.id as NonEmptyString],
        creatorId: '',
        conditionSet: {
          conditions: [
            {
              input: {
                type: 'CONTENT_COOP_INPUT',
                name: 'Relevant Policy',
              },
              comparator: 'IS_NOT_PROVIDED',
            },
            {
              input: {
                type: 'CONTENT_FIELD',
                contentTypeId: itemType.id,
                name: 'text',
              },
              signal: {
                id: jsonStringify({
                  type: SignalType.TEXT_MATCHING_CONTAINS_TEXT,
                }),
                type: SignalType.TEXT_MATCHING_CONTAINS_TEXT,
              },
              matchingValues: { strings: ['garbage'] },
            },
          ],
          conjunction: 'AND',
        },
        destinationQueueId: noPolicyQueue.id,
      });

    const sourceTypeRule = await manualReviewToolService.createRoutingRule({
      orgId: org.id,
      name: 'Source Type rule',
      status: 'LIVE',
      itemTypeIds: [itemType.id as NonEmptyString],
      creatorId: '',
      conditionSet: {
        conjunction: 'OR',
        conditions: [
          {
            input: {
              type: 'CONTENT_COOP_INPUT',
              name: 'Source',
            },
            threshold: 'post-actions',
            comparator: 'EQUALS',
          },
        ],
      },
      destinationQueueId: anotherQueue.id,
    });

    return {
      manualReviewToolService,
      org,
      itemType,
      defaultQueue,
      anotherQueue,
      policyQueue,
      noPolicyQueue,
      async cleanup() {
        await manualReviewToolService.deleteRoutingRule({ id: rule.id });
        await manualReviewToolService.deleteRoutingRule({ id: policyRule.id });
        await manualReviewToolService.deleteRoutingRule({
          id: policyNotProvidedRule.id,
        });
        await manualReviewToolService.deleteRoutingRule({
          id: sourceTypeRule.id,
        });
        await manualReviewToolService.deleteManualReviewQueueForTestsDO_NOT_USE(
          org.id,
          anotherQueue.id,
        );
        await manualReviewToolService.deleteManualReviewQueueForTestsDO_NOT_USE(
          org.id,
          policyQueue.id,
        );
        await manualReviewToolService.deleteManualReviewQueueForTestsDO_NOT_USE(
          org.id,
          defaultQueue.id,
        );
        await manualReviewToolService.deleteManualReviewQueueForTestsDO_NOT_USE(
          org.id,
          noPolicyQueue.id,
        );
        await itemTypesCleanup();
        await orgCleanup();
        await container.closeSharedResourcesForShutdown();
      },
    };
  });

  jobRoutingTestWithFixtures(
    'Should enqueue based off of routing rule',
    async ({ manualReviewToolService, org, itemType, anotherQueue }) => {
      const normalizedDataOrError = toNormalizedItemDataOrErrors(
        [itemType.id],
        itemType,
        { text: 'test' },
      );
      if (Array.isArray(normalizedDataOrError)) {
        throw new Error('Error validating item data');
      }

      const itemSubmission = await submissionDataToItemSubmission(
        async () => itemType,
        {
          orgId: org.id,
          submissionId: makeSubmissionId(),
          itemId: uid(),
          itemTypeId: itemType.id,
          itemTypeVersion: '',
          itemTypeSchemaVariant: 'original',
          data: normalizedDataOrError,
          creatorId: null,
          creatorTypeId: null,
        },
      );
      if (itemSubmission instanceof Error) {
        throw new Error('Error creating item submission');
      }

      const item =
        itemSubmissionToItemSubmissionWithTypeIdentifier(itemSubmission);
      await manualReviewToolService.enqueue({
        enqueueSource: 'RULE_EXECUTION',
        enqueueSourceInfo: { kind: 'RULE_EXECUTION', rules: ['abc'] },
        createdAt: new Date(),
        orgId: org.id,
        correlationId: toCorrelationId({ type: 'submit-report', id: uid() }),
        policyIds: [],
        payload: {
          kind: 'DEFAULT',
          reportHistory: [],
          item,
        },
      });

      const pendingJobCount = await manualReviewToolService.getPendingJobCount({
        orgId: org.id,
        queueId: anotherQueue.id,
      });
      expect(pendingJobCount).toBe(1);
    },
  );

  jobRoutingTestWithFixtures(
    'Should match on policy rule',
    async ({ manualReviewToolService, org, itemType, policyQueue }) => {
      const normalizedDataOrError = toNormalizedItemDataOrErrors(
        [itemType.id],
        itemType,
        { text: '12345' },
      );
      if (Array.isArray(normalizedDataOrError)) {
        throw new Error('Error validating item data');
      }

      const itemSubmission = await submissionDataToItemSubmission(
        async () => itemType,
        {
          orgId: org.id,
          submissionId: makeSubmissionId(),
          itemId: uid(),
          itemTypeId: itemType.id,
          itemTypeVersion: '',
          itemTypeSchemaVariant: 'original',
          data: normalizedDataOrError,
          creatorId: null,
          creatorTypeId: null,
        },
      );
      if (itemSubmission instanceof Error) {
        throw new Error('Error creating item submission');
      }

      const item =
        itemSubmissionToItemSubmissionWithTypeIdentifier(itemSubmission);
      await manualReviewToolService.enqueue({
        enqueueSource: 'RULE_EXECUTION',
        enqueueSourceInfo: { kind: 'RULE_EXECUTION', rules: ['abc'] },
        createdAt: new Date(),
        orgId: org.id,
        correlationId: toCorrelationId({ type: 'submit-report', id: uid() }),
        policyIds: ['testPolicyId', 'testPolicyId2'],
        payload: {
          kind: 'DEFAULT',
          reportHistory: [],
          item,
        },
      });

      const pendingJobCount = await manualReviewToolService.getPendingJobCount({
        orgId: org.id,
        queueId: policyQueue.id,
      });
      expect(pendingJobCount).toBe(1);
    },
  );

  jobRoutingTestWithFixtures(
    'Should not match on policy rule',
    async ({
      manualReviewToolService,
      org,
      itemType,
      defaultQueue,
      policyQueue,
    }) => {
      const initialJobCount = await manualReviewToolService.getPendingJobCount({
        orgId: org.id,
        queueId: policyQueue.id,
      });
      const initialDefaultJobCount =
        await manualReviewToolService.getPendingJobCount({
          orgId: org.id,
          queueId: defaultQueue.id,
        });
      const normalizedDataOrError = toNormalizedItemDataOrErrors(
        [itemType.id],
        itemType,
        { text: '12345' },
      );
      if (Array.isArray(normalizedDataOrError)) {
        throw new Error('Error validating item data');
      }

      const itemSubmission = await submissionDataToItemSubmission(
        async () => itemType,
        {
          orgId: org.id,
          submissionId: makeSubmissionId(),
          itemId: uid(),
          itemTypeId: itemType.id,
          itemTypeVersion: '',
          itemTypeSchemaVariant: 'original',
          data: normalizedDataOrError,
          creatorId: null,
          creatorTypeId: null,
        },
      );
      if (itemSubmission instanceof Error) {
        throw new Error('Error creating item submission');
      }

      const item =
        itemSubmissionToItemSubmissionWithTypeIdentifier(itemSubmission);
      await manualReviewToolService.enqueue({
        enqueueSource: 'RULE_EXECUTION',
        enqueueSourceInfo: { kind: 'RULE_EXECUTION', rules: ['abc'] },
        createdAt: new Date(),
        orgId: org.id,
        correlationId: toCorrelationId({ type: 'submit-report', id: uid() }),
        policyIds: ['notTestPolicyId'],
        payload: {
          kind: 'DEFAULT',
          reportHistory: [],
          item,
        },
      });

      const pendingJobCount = await manualReviewToolService.getPendingJobCount({
        orgId: org.id,
        queueId: policyQueue.id,
      });
      expect(pendingJobCount).toBe(initialJobCount);

      const pendingDefaultJobCount =
        await manualReviewToolService.getPendingJobCount({
          orgId: org.id,
          queueId: defaultQueue.id,
        });
      expect(pendingDefaultJobCount).toBe(initialDefaultJobCount + 1);
    },
  );

  jobRoutingTestWithFixtures(
    'When queueId is passed to enqueue, job is added to that queue (skips routing)',
    async ({
      manualReviewToolService,
      org,
      itemType,
      defaultQueue,
      anotherQueue,
    }) => {
      const initialDefault = await manualReviewToolService.getPendingJobCount({
        orgId: org.id,
        queueId: defaultQueue.id,
      });
      const initialAnother =
        await manualReviewToolService.getPendingJobCount({
          orgId: org.id,
          queueId: anotherQueue.id,
        });

      const normalizedDataOrError = toNormalizedItemDataOrErrors(
        [itemType.id],
        itemType,
        { text: 'other' },
      );
      if (Array.isArray(normalizedDataOrError)) {
        throw new Error('Error validating item data');
      }

      const itemSubmission = await submissionDataToItemSubmission(
        async () => itemType,
        {
          orgId: org.id,
          submissionId: makeSubmissionId(),
          itemId: uid(),
          itemTypeId: itemType.id,
          itemTypeVersion: '',
          itemTypeSchemaVariant: 'original',
          data: normalizedDataOrError,
          creatorId: null,
          creatorTypeId: null,
        },
      );
      if (itemSubmission instanceof Error) {
        throw new Error('Error creating item submission');
      }

      const item =
        itemSubmissionToItemSubmissionWithTypeIdentifier(itemSubmission);
      // Pass explicit queueId so routing is skipped (e.g. NCMEC default queue).
      await manualReviewToolService.enqueue(
        {
          enqueueSource: 'RULE_EXECUTION',
          enqueueSourceInfo: { kind: 'RULE_EXECUTION', rules: ['abc'] },
          createdAt: new Date(),
          orgId: org.id,
          correlationId: toCorrelationId({ type: 'submit-report', id: uid() }),
          policyIds: [],
          payload: {
            kind: 'DEFAULT',
            reportHistory: [],
            item,
          },
        },
        anotherQueue.id,
      );

      const defaultQueueCount = await manualReviewToolService.getPendingJobCount(
        { orgId: org.id, queueId: defaultQueue.id },
      );
      const anotherQueueCount =
        await manualReviewToolService.getPendingJobCount({
          orgId: org.id,
          queueId: anotherQueue.id,
        });
      expect(defaultQueueCount).toBe(initialDefault);
      expect(anotherQueueCount).toBe(initialAnother + 1);
    },
  );

  jobRoutingTestWithFixtures(
    'Should match on source type',
    async ({ manualReviewToolService, org, itemType, anotherQueue }) => {
      const normalizedDataOrError = toNormalizedItemDataOrErrors(
        [itemType.id],
        itemType,
        { text: '12345' },
      );
      if (Array.isArray(normalizedDataOrError)) {
        throw new Error('Error validating item data');
      }

      const itemSubmission = await submissionDataToItemSubmission(
        async () => itemType,
        {
          orgId: org.id,
          submissionId: makeSubmissionId(),
          itemId: uid(),
          itemTypeId: itemType.id,
          itemTypeVersion: '',
          itemTypeSchemaVariant: 'original',
          data: normalizedDataOrError,
          creatorId: null,
          creatorTypeId: null,
        },
      );
      if (itemSubmission instanceof Error) {
        throw new Error('Error creating item submission');
      }

      const item =
        itemSubmissionToItemSubmissionWithTypeIdentifier(itemSubmission);
      await manualReviewToolService.enqueue({
        enqueueSource: 'POST_ACTIONS',
        enqueueSourceInfo: { kind: 'POST_ACTIONS' },
        createdAt: new Date(),
        orgId: org.id,
        correlationId: toCorrelationId({ type: 'post-actions', id: uid() }),
        policyIds: ['testPolicyId2091283102398'],
        payload: {
          kind: 'DEFAULT',
          reportHistory: [],
          item,
        },
      });

      const pendingJobCount = await manualReviewToolService.getPendingJobCount({
        orgId: org.id,
        queueId: anotherQueue.id,
      });
      expect(pendingJobCount).toBe(1);
    },
  );

  jobRoutingTestWithFixtures(
    "Should fall back to default queue when run rules no longer match db's queue list",
    async ({
      manualReviewToolService,
      org,
      itemType,
      defaultQueue,
      anotherQueue,
    }) => {
      const initialPendingJobCount =
        await manualReviewToolService.getPendingJobCount({
          orgId: org.id,
          queueId: defaultQueue.id,
        });
      // Deleting the queue will also delete the routing rule, via cascading
      // delete. However, the old routing rules will still be in the MRT Service's
      // cache, meaning that running the rules will now point to a queue that
      // doesn't exist. In this case, it should fall back to the default.
      await manualReviewToolService.deleteManualReviewQueueForTestsDO_NOT_USE(
        org.id,
        anotherQueue.id,
      );

      const normalizedDataOrError = toNormalizedItemDataOrErrors(
        [itemType.id],
        itemType,
        { text: 'test' },
      );
      if (Array.isArray(normalizedDataOrError)) {
        throw new Error('Error validating item data');
      }

      const itemSubmission = await submissionDataToItemSubmission(
        async () => itemType,
        {
          orgId: org.id,
          submissionId: makeSubmissionId(),
          itemId: uid(),
          itemTypeId: itemType.id,
          itemTypeVersion: '',
          itemTypeSchemaVariant: 'original',
          data: normalizedDataOrError,
          creatorId: null,
          creatorTypeId: null,
        },
      );
      if (itemSubmission instanceof Error) {
        throw new Error('Error creating item submission');
      }

      await manualReviewToolService.enqueue({
        enqueueSource: 'RULE_EXECUTION',
        enqueueSourceInfo: { kind: 'RULE_EXECUTION', rules: ['abc'] },
        createdAt: new Date(),
        orgId: org.id,
        correlationId: toCorrelationId({ type: 'submit-report', id: uid() }),
        policyIds: [],
        payload: {
          kind: 'DEFAULT',
          reportHistory: [],
          item: itemSubmissionToItemSubmissionWithTypeIdentifier(
            itemSubmission,
          ),
        },
      });

      const pendingJobCount = await manualReviewToolService.getPendingJobCount({
        orgId: org.id,
        queueId: defaultQueue.id,
      });
      expect(pendingJobCount).toBe(initialPendingJobCount + 1);
    },
  );

  jobRoutingTestWithFixtures(
    'Should not allow to save a routing rule for a queue that does not exist',
    async ({ manualReviewToolService, org, itemType }) => {
      await manualReviewToolService
        .createRoutingRule({
          orgId: org.id,
          name: 'Some rule',
          status: 'LIVE',
          itemTypeIds: [itemType.id as NonEmptyString],
          creatorId: '',
          conditionSet: {
            conjunction: 'AND',
            conditions: [
              {
                input: {
                  type: 'CONTENT_FIELD',
                  name: 'text',
                  contentTypeId: itemType.id,
                },
                signal: {
                  id: jsonStringify({
                    type: SignalType.TEXT_MATCHING_CONTAINS_TEXT,
                  }),
                  type: SignalType.TEXT_MATCHING_CONTAINS_TEXT,
                },
                matchingValues: { strings: ['test'] },
              },
            ],
          },
          destinationQueueId: uid(),
        })
        .then(
          async (result) => {
            await manualReviewToolService.deleteRoutingRule({ id: result.id });
            throw new Error("Promise should've rejected!");
          },
          (_e) => {
            /* swallow error as it's expected */
          },
        );
    },
  );

  jobRoutingTestWithFixtures(
    'Route to correct queue if policy Id is not provided',
    async ({ manualReviewToolService, noPolicyQueue, org, itemType }) => {
      const normalizedDataOrError = toNormalizedItemDataOrErrors(
        [itemType.id],
        itemType,
        { text: 'garbage' },
      );
      if (Array.isArray(normalizedDataOrError)) {
        throw new Error('Error validating item data');
      }

      const itemSubmission = await submissionDataToItemSubmission(
        async () => itemType,
        {
          orgId: org.id,
          submissionId: makeSubmissionId(),
          itemId: uid(),
          itemTypeId: itemType.id,
          itemTypeVersion: '',
          itemTypeSchemaVariant: 'original',
          data: normalizedDataOrError,
          creatorId: null,
          creatorTypeId: null,
        },
      );
      if (itemSubmission instanceof Error) {
        throw new Error('Error creating item submission');
      }

      const item =
        itemSubmissionToItemSubmissionWithTypeIdentifier(itemSubmission);
      await manualReviewToolService.enqueue({
        enqueueSource: 'RULE_EXECUTION',
        enqueueSourceInfo: { kind: 'RULE_EXECUTION', rules: ['abc'] },
        createdAt: new Date(),
        orgId: org.id,
        correlationId: toCorrelationId({ type: 'submit-report', id: uid() }),
        policyIds: [],
        payload: {
          kind: 'DEFAULT',
          reportHistory: [],
          item,
        },
      });

      const pendingJobCount = await manualReviewToolService.getPendingJobCount({
        orgId: org.id,
        queueId: noPolicyQueue.id,
      });
      expect(pendingJobCount).toBe(1);
    },
  );
});
