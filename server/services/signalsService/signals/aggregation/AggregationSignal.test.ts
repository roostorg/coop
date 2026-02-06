import { uid } from 'uid';
import { v1 as uuidv1 } from 'uuid';

import { TestDateProvider } from '../../../../test/dateProvider.js';
import createContentItemTypes from '../../../../test/fixtureHelpers/createContentItemTypes.js';
import createOrg from '../../../../test/fixtureHelpers/createOrg.js';
import createUser from '../../../../test/fixtureHelpers/createUser.js';
import { makeMockedServer } from '../../../../test/setupMockedServer.js';
import { makeTestWithFixture } from '../../../../test/utils.js';
import { toCorrelationId } from '../../../../utils/correlationIds.js';
import SafeTracer from '../../../../utils/SafeTracer.js';
import {
  makeSubmissionId,
  submissionDataToItemSubmission,
  toNormalizedItemDataOrErrors,
} from '../../../itemProcessingService/index.js';

describe('AggregationSignal', () => {
  const testWithFixture = makeTestWithFixture(async () => {
    const { server, deps, shutdown } = await makeMockedServer();

    const {
      Sequelize: models,
      ModerationConfigService,
      AggregationsService,
      RuleAPIDataSource,
      ApiKeyService,
    } = deps;

    const { org, cleanup: orgCleanup } = await createOrg(
      models,
      ModerationConfigService,
      ApiKeyService,
      uid(),
    );

    const { user, cleanup: userCleanup } = await createUser(models, org.id, {});

    const { itemTypes, cleanup: itemTypesCleanup } =
      await createContentItemTypes({
        moderationConfigService: ModerationConfigService,
        orgId: org.id,
        includeCreator: true,
        extra: {},
      });

    // Spy on aggregation service functions.
    const aggregationsServiceSpy = AggregationsService;
    // eslint-disable-next-line better-mutation/no-mutation
    aggregationsServiceSpy.updateAggregation = jest.fn(
      aggregationsServiceSpy.updateAggregation.bind(aggregationsServiceSpy),
    );
    // eslint-disable-next-line better-mutation/no-mutation
    aggregationsServiceSpy.evaluateAggregation = jest.fn(
      aggregationsServiceSpy.evaluateAggregation.bind(aggregationsServiceSpy),
    );

    const dateProvider = new TestDateProvider();
    // eslint-disable-next-line better-mutation/no-mutation
    deps['ActionPublisher'].publishAction = jest.fn().mockReturnValue(true);

    const rule = await RuleAPIDataSource.createContentRule(
      {
        name: 'AggregationSignal Unit Test Spam Rule',
        description: 'spam rule for testing',
        status: 'LIVE',
        contentTypeIds: [itemTypes[0].id],
        conditionSet: {
          conjunction: 'OR',
          conditions: [
            {
              input: {
                type: 'FULL_ITEM',
              },
              signal: {
                id: '{"type":"AGGREGATION"}',
                type: 'AGGREGATION',
                name: 'Aggregation',
                args: {
                  AGGREGATION: {
                    aggregationClause: {
                      aggregation: {
                        type: 'COUNT',
                      },
                      conditionSet: {
                        conjunction: 'OR',
                        conditions: [
                          {
                            input: {
                              type: 'CONTENT_COOP_INPUT',
                              name: 'All text',
                            },
                            signal: {
                              id: '{"type":"TEXT_MATCHING_CONTAINS_TEXT"}',
                              type: 'TEXT_MATCHING_CONTAINS_TEXT',
                              name: 'Contains text',
                            },
                            matchingValues: {
                              strings: ['nword'],
                            },
                            threshold: null,
                          },
                        ],
                      },
                      groupBy: [{ type: 'USER_ID' }],
                      window: {
                        sizeMs: 10000,
                        hopMs: 2000,
                      },
                    },
                  },
                },
              },
              matchingValues: null,
              comparator: 'GREATER_THAN',
              threshold: 2,
            },
          ],
        },
        actionIds: ['73b2f15cc91'],
        policyIds: [],
        tags: [],
        maxDailyActions: null,
      },
      user.id,
      org.id,
    );

    return {
      server,
      deps,
      rule,
      itemType: itemTypes[0],
      org,
      dateProvider,
      async cleanup() {
        await rule.destroy();
        await itemTypesCleanup();
        await userCleanup();
        await orgCleanup();
        await shutdown();
      },
    };
  });

  testWithFixture(
    'rule should evaluate and update aggregation signal',
    async ({ itemType, org, dateProvider, deps }) => {
      // Clear Redis to ensure clean state for aggregation counters
      await deps.IORedis.flushdb();
      
      const creatorId = 'some-creator-id';
      const creatorTypeId = 'some-creator-type-id';

      const normalizedDataOrError = toNormalizedItemDataOrErrors(
        [itemType.id, creatorTypeId, 'd25f2b993a3', '5f2b993a340'],
        itemType,
        {
          field1: 'some text uploaded by a user with nword',
          creatorId: {
            id: creatorId,
            typeId: creatorTypeId,
          },
        },
      );
      if (Array.isArray(normalizedDataOrError)) {
        const message = normalizedDataOrError.map((e) => e.message).join(', ');
        throw new Error(`Error validating item data ${message}`);
      }

      const itemSubmission = await submissionDataToItemSubmission(
        async () => itemType,
        {
          orgId: org.id,
          submissionId: makeSubmissionId(),
          itemId: uid(),
          itemTypeId: itemType.id,
          itemTypeVersion: '123',
          itemTypeSchemaVariant: 'original',
          data: normalizedDataOrError,
          creatorId,
          creatorTypeId,
        },
      );

      // Assert that aggregation service is updated and evaluated with the correct arguments.
      const ruleResults = await deps.RuleEngine.runEnabledRules(
        itemSubmission,
        toCorrelationId({
          type: 'post-items',
          id: uuidv1(),
        }),
      );

      // The first item for the user should not trigger actions.
      const actionsTriggered = await ruleResults.actionsTriggered;
      expect(actionsTriggered).toHaveLength(0);

      expect(deps.AggregationsService.updateAggregation).toBeCalledTimes(1);
      expect(deps.AggregationsService.updateAggregation).toBeCalledWith(
        expect.objectContaining({
          id: expect.any(String),
          aggregation: { type: 'COUNT' },
        }),
        expect.objectContaining({
          createdAt: expect.any(Date),
          groupByValueStrings: [creatorId],
        }),
        expect.any(SafeTracer),
      );

      expect(deps.AggregationsService.evaluateAggregation).toBeCalledTimes(1);
      expect(deps.AggregationsService.evaluateAggregation).toBeCalledWith(
        expect.objectContaining({
          id: expect.any(String),
          aggregation: { type: 'COUNT' },
        }),
        expect.objectContaining({
          createdAt: expect.any(Date),
          groupByValueStrings: [creatorId],
        }),
      );

      // The second item for the user should not trigger actions.
      const itemSubmission2 = await submissionDataToItemSubmission(
        async () => itemType,
        {
          orgId: org.id,
          submissionId: makeSubmissionId(),
          itemId: uid(),
          itemTypeId: itemType.id,
          itemTypeVersion: '123',
          itemTypeSchemaVariant: 'original',
          data: normalizedDataOrError,
          creatorId,
          creatorTypeId,
        },
      );
      
      const ruleResultsAfter2 = await deps.RuleEngine.runEnabledRules(
        itemSubmission2,
        toCorrelationId({
          type: 'post-items',
          id: uuidv1(),
        }),
      );
      const actionsTriggeredAfter2 = await ruleResultsAfter2.actionsTriggered;
      expect(actionsTriggeredAfter2).toHaveLength(0);

      // An item for a different user should not trigger actions.
      const itemSubmissionAnotherUser = await submissionDataToItemSubmission(
        async () => itemType,
        {
          orgId: org.id,
          submissionId: makeSubmissionId(),
          itemId: uid(),
          itemTypeId: itemType.id,
          itemTypeVersion: '123',
          itemTypeSchemaVariant: 'original',
          data: normalizedDataOrError,
          creatorId: 'another-creator-id',
          creatorTypeId,
        },
      );
      
      const ruleResultsAnotherUser = await deps.RuleEngine.runEnabledRules(
        itemSubmissionAnotherUser,
        toCorrelationId({
          type: 'post-items',
          id: uuidv1(),
        }),
      );
      const actionResultsAnotherUser =
        await ruleResultsAnotherUser.actionsTriggered;
      expect(actionResultsAnotherUser).toHaveLength(0);

      // An item for the same user with different text should not trigger actions (fails inner conditionSet).
      const itemSubmissionFailCondition = await submissionDataToItemSubmission(
        async () => itemType,
        {
          orgId: org.id,
          submissionId: makeSubmissionId(),
          itemId: uid(),
          itemTypeId: itemType.id,
          itemTypeVersion: '123',
          itemTypeSchemaVariant: 'original',
          data: {
            ...normalizedDataOrError,
            field1: 'some other text',
          },
          creatorId,
          creatorTypeId,
        },
      );
      
      const ruleResultsFailCondition = await deps.RuleEngine.runEnabledRules(
        itemSubmissionFailCondition,
        toCorrelationId({
          type: 'post-items',
          id: uuidv1(),
        }),
      );
      const actionResultsFailCondition =
        await ruleResultsFailCondition.actionsTriggered;
      expect(actionResultsFailCondition).toHaveLength(0);

      // Third item for the same user with the same text should trigger actions.
      const itemSubmission3 = await submissionDataToItemSubmission(
        async () => itemType,
        {
          orgId: org.id,
          submissionId: makeSubmissionId(),
          itemId: uid(),
          itemTypeId: itemType.id,
          itemTypeVersion: '123',
          itemTypeSchemaVariant: 'original',
          data: normalizedDataOrError,
          creatorId,
          creatorTypeId,
        },
      );
      
      const ruleResultsAfter3 = await deps.RuleEngine.runEnabledRules(
        itemSubmission3,
        toCorrelationId({
          type: 'post-items',
          id: uuidv1(),
        }),
      );
      const actionsTriggeredAfter3 = await ruleResultsAfter3.actionsTriggered;
      expect(actionsTriggeredAfter3).toHaveLength(1);

      // Fourth item should trigger actions.
      const itemSubmission4 = await submissionDataToItemSubmission(
        async () => itemType,
        {
          orgId: org.id,
          submissionId: makeSubmissionId(),
          itemId: uid(),
          itemTypeId: itemType.id,
          itemTypeVersion: '123',
          itemTypeSchemaVariant: 'original',
          data: normalizedDataOrError,
          creatorId,
          creatorTypeId,
        },
      );
      
      const actionsTriggeredAfter4 = await (
        await deps.RuleEngine.runEnabledRules(
          itemSubmission4,
          toCorrelationId({
            type: 'post-items',
            id: uuidv1(),
          }),
        )
      ).actionsTriggered;
      expect(actionsTriggeredAfter4).toHaveLength(1);

      // Advance time. Items at T=0 are still within the aggregation window.
      dateProvider.advanceTimeByMs(11999);
      const itemSubmission5 = await submissionDataToItemSubmission(
        async () => itemType,
        {
          orgId: org.id,
          submissionId: makeSubmissionId(),
          itemId: uid(),
          itemTypeId: itemType.id,
          itemTypeVersion: '123',
          itemTypeSchemaVariant: 'original',
          data: normalizedDataOrError,
          creatorId,
          creatorTypeId,
        },
      );
      const actionsTriggeredAfter5 = await (
        await deps.RuleEngine.runEnabledRules(
          itemSubmission5,
          toCorrelationId({
            type: 'post-items',
            id: uuidv1(),
          }),
        )
      ).actionsTriggered;
      expect(actionsTriggeredAfter5).toHaveLength(1);

      // Advance time. Items at T=0 now fall out of the aggregation window.
      dateProvider.advanceTimeByMs(1);
      const itemSubmission6 = await submissionDataToItemSubmission(
        async () => itemType,
        {
          orgId: org.id,
          submissionId: makeSubmissionId(),
          itemId: uid(),
          itemTypeId: itemType.id,
          itemTypeVersion: '123',
          itemTypeSchemaVariant: 'original',
          data: normalizedDataOrError,
          creatorId,
          creatorTypeId,
        },
      );
      const actionsTriggeredAfter6 = await (
        await deps.RuleEngine.runEnabledRules(
          itemSubmission6,
          toCorrelationId({
            type: 'post-items',
            id: uuidv1(),
          }),
        )
      ).actionsTriggered;
      expect(actionsTriggeredAfter6).toHaveLength(1);
    },
  );
});
