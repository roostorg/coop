/* eslint-disable max-lines -- scenarios share the `makeIsolatedPublisher`
 * harness; splitting would duplicate ~100 lines of setup. */
/**
 * Unit tests for ActionPublisher to verify action execution logging behavior.
 *
 * This test file specifically verifies the fix for the double-logging bug where
 * N triggered actions would result in N² log entries due to logging all actions
 * on each iteration instead of just the current one.
 */

import getBottle, { type Dependencies } from '../iocContainer/index.js';
import { ActionType } from '../services/moderationConfigService/index.js';
import { type CorrelationId } from '../utils/correlationIds.js';
import { jsonParse } from '../utils/encoding.js';
import { ActionPublisher } from './ActionPublisher.js';
import { RuleEnvironment } from './RuleEngine.js';

type IsolatedPublisherOptions = {
  fetchHTTP: jest.Mock;
  manualReviewToolService?: Partial<Dependencies['ManualReviewToolService']>;
  ncmecService?: Partial<Dependencies['NcmecService']>;
  itemInvestigationService?: Partial<Dependencies['ItemInvestigationService']>;
  getItemTypeEventuallyConsistent?: Dependencies['getItemTypeEventuallyConsistent'];
  userStrikeService?: Partial<Dependencies['UserStrikeService']>;
};

function makeNoopTracer(): Dependencies['Tracer'] {
  return {
    addActiveSpan: (_meta: unknown, fn: (span: unknown) => unknown) =>
      fn({
        setAttribute: () => {},
        recordException: () => {},
        isRecording: () => false,
      }),
    getActiveSpan: () => undefined,
  } as unknown as Dependencies['Tracer'];
}

function makeIsolatedPublisher(opts: IsolatedPublisherOptions) {
  const logActionExecutions = jest.fn().mockResolvedValue(undefined);
  const actionExecutionLogger = {
    logActionExecutions,
  } as unknown as Dependencies['ActionExecutionLogger'];
  const signingKeyPairService = {
    sign: jest.fn().mockResolvedValue(undefined),
  } as unknown as Dependencies['SigningKeyPairService'];
  const itemInvestigationService = (opts.itemInvestigationService ?? {
    getItemByIdentifier: jest.fn().mockResolvedValue(undefined),
  }) as Dependencies['ItemInvestigationService'];
  const userStrikeService = {
    applyUserStrikeFromPublishedActions: jest.fn().mockResolvedValue(undefined),
    getUserStrikeValue: jest.fn().mockResolvedValue(0),
    findMostSeverePolicyViolationFromActions: jest
      .fn()
      .mockReturnValue(undefined),
    ...opts.userStrikeService,
  } as unknown as Dependencies['UserStrikeService'];
  const getItemTypeEventuallyConsistent =
    opts.getItemTypeEventuallyConsistent ??
    jest.fn().mockResolvedValue(undefined);
  const publisher = new ActionPublisher(
    actionExecutionLogger,
    makeNoopTracer(),
    opts.fetchHTTP,
    signingKeyPairService,
    (opts.manualReviewToolService ??
      {}) as Dependencies['ManualReviewToolService'],
    (opts.ncmecService ?? {}) as Dependencies['NcmecService'],
    itemInvestigationService,
    userStrikeService,
    getItemTypeEventuallyConsistent,
  );
  return { publisher, logActionExecutions };
}

describe('ActionPublisher', () => {
  let container: Dependencies;
  let actionPublisher: ActionPublisher;

  beforeAll(async () => {
    ({ container } = await getBottle());
    actionPublisher = container.ActionPublisher;
  });

  afterAll(async () => {
    await container.closeSharedResourcesForShutdown();
  });

  describe('publishActions', () => {
    it('should log each action execution exactly once (not N² times)', async () => {
      const logSpy = jest.spyOn(
        container.ActionExecutionLogger,
        'logActionExecutions',
      );

      // Use 2 actions to catch the N² bug
      // With the bug: 2 actions → 2² = 4 log entries
      // With the fix: 2 actions → 2 log entries
      const triggeredActions = [
        {
          action: {
            id: 'action-1',
            orgId: 'org-123',
            name: 'Action 1',
            description: null,
            applyUserStrikes: false,
            penalty: 'NONE' as const,
            actionType: ActionType.CUSTOM_ACTION,
            callbackUrl: 'https://example.com/action1',
            callbackUrlHeaders: null,
            callbackUrlBody: null,
            customMrtApiParams: null,
          },
          policies: [
            {
              id: 'policy-1',
              name: 'Policy 1',
              penalty: 'NONE' as const,
              userStrikeCount: 0,
            },
          ],
          matchingRules: [
            {
              id: 'rule-1',
              name: 'Rule 1',
              version: '1',
              tags: [],
              policies: [],
            },
          ],
          ruleEnvironment: RuleEnvironment.LIVE,
        },
        {
          action: {
            id: 'action-2',
            orgId: 'org-123',
            name: 'Action 2',
            description: null,
            applyUserStrikes: false,
            penalty: 'NONE' as const,
            actionType: ActionType.CUSTOM_ACTION,
            callbackUrl: 'https://example.com/action2',
            callbackUrlHeaders: null,
            callbackUrlBody: null,
            customMrtApiParams: null,
          },
          policies: [
            {
              id: 'policy-2',
              name: 'Policy 2',
              penalty: 'NONE' as const,
              userStrikeCount: 0,
            },
          ],
          matchingRules: [
            {
              id: 'rule-2',
              name: 'Rule 2',
              version: '1',
              tags: [],
              policies: [],
            },
          ],
          ruleEnvironment: RuleEnvironment.LIVE,
        },
      ];

      const executionContext = {
        orgId: 'org-123',
        correlationId: 'post-content:abc123' as CorrelationId<'post-content'>,
        targetItem: {
          itemId: 'item-123',
          itemType: {
            id: 'type-123',
            kind: 'CONTENT' as const,
            name: 'Social Post',
          },
        },
      };

      await actionPublisher.publishActions(triggeredActions, executionContext);

      // With the fix: called 2 times (once per action)
      expect(logSpy).toHaveBeenCalledTimes(2);

      // Each call should log exactly one execution
      logSpy.mock.calls.forEach((call) => {
        expect(call[0].executions).toHaveLength(1);
      });

      logSpy.mockRestore();
    });

    it('builds the CUSTOM_ACTION webhook body with parameters merged into `custom` and actorNote at the top level', async () => {
      const fetchHTTP = jest.fn().mockResolvedValue({ status: 200, ok: true });
      const { publisher } = makeIsolatedPublisher({ fetchHTTP });

      await publisher.publishActions(
        [
          {
            action: {
              id: 'action-webhook',
              orgId: 'org-789',
              name: 'Ban User',
              description: null,
              applyUserStrikes: false,
              penalty: 'NONE' as const,
              actionType: ActionType.CUSTOM_ACTION,
              callbackUrl: 'https://example.com/webhook',
              callbackUrlHeaders: null,
              callbackUrlBody: { source: 'mrt' },
              customMrtApiParams: null,
            },
            policies: [],
            matchingRules: undefined,
            ruleEnvironment: undefined,
            customMrtApiParamDecisionPayload: {
              num_days: 30,
              reason: 'spam',
            },
          },
        ],
        {
          orgId: 'org-789',
          correlationId:
            'manual-action-run:body-shape' as CorrelationId<'manual-action-run'>,
          targetItem: {
            itemId: 'item-789',
            itemType: {
              id: 'type-789',
              kind: 'CONTENT' as const,
              name: 'Social Post',
            },
          },
          actorEmail: 'mod@example.com',
          actorNote: 'Repeat offender',
        },
      );

      expect(fetchHTTP).toHaveBeenCalledTimes(1);
      const sentBody = jsonParse(fetchHTTP.mock.calls[0]?.[0].body);

      expect(sentBody.custom).toEqual({
        source: 'mrt',
        num_days: 30,
        reason: 'spam',
      });
      // `actorNote` is a top-level field, NOT under `custom`, so it can't
      // collide with a user-defined parameter named `actorNote`.
      expect(sentBody.actorNote).toBe('Repeat offender');
      expect(sentBody.custom.actorNote).toBeUndefined();
      expect(sentBody.actorEmail).toBe('mod@example.com');
    });

    it('includes the resolved creator for a USER target (the target itself)', async () => {
      const fetchHTTP = jest.fn().mockResolvedValue({ status: 200, ok: true });
      const { publisher } = makeIsolatedPublisher({ fetchHTTP });

      await publisher.publishActions(
        [
          {
            action: {
              id: 'action-user-target',
              orgId: 'org-789',
              name: 'Ban User',
              description: null,
              applyUserStrikes: false,
              penalty: 'NONE' as const,
              actionType: ActionType.CUSTOM_ACTION,
              callbackUrl: 'https://example.com/webhook',
              callbackUrlHeaders: null,
              callbackUrlBody: null,
              customMrtApiParams: null,
            },
            policies: [],
            matchingRules: undefined,
            ruleEnvironment: undefined,
          },
        ],
        {
          orgId: 'org-789',
          correlationId:
            'manual-action-run:user-target' as CorrelationId<'manual-action-run'>,
          targetItem: {
            itemId: 'user-123',
            itemType: {
              id: 'user-type-1',
              kind: 'USER' as const,
              name: 'User',
            },
          },
        },
      );

      const sentBody = jsonParse(fetchHTTP.mock.calls[0]?.[0].body);
      expect(sentBody.creator).toEqual({
        id: 'user-123',
        typeId: 'user-type-1',
      });
    });

    it('resolves and includes the creator for a CONTENT identifier-only target by fetching the submission', async () => {
      const fetchHTTP = jest.fn().mockResolvedValue({ status: 200, ok: true });
      const getItemByIdentifier = jest.fn().mockResolvedValue({
        latestSubmission: {
          itemId: 'message-456',
          submissionId: 'sub-1',
          data: { text: 'hi' },
          creator: { id: 'author-9', typeId: 'user-type-1' },
        },
      });
      const { publisher } = makeIsolatedPublisher({
        fetchHTTP,
        itemInvestigationService: { getItemByIdentifier },
      });

      await publisher.publishActions(
        [
          {
            action: {
              id: 'action-content-target',
              orgId: 'org-789',
              name: 'Remove Message',
              description: null,
              applyUserStrikes: false,
              penalty: 'NONE' as const,
              actionType: ActionType.CUSTOM_ACTION,
              callbackUrl: 'https://example.com/webhook',
              callbackUrlHeaders: null,
              callbackUrlBody: null,
              customMrtApiParams: null,
            },
            policies: [],
            matchingRules: undefined,
            ruleEnvironment: undefined,
          },
        ],
        {
          orgId: 'org-789',
          correlationId:
            'manual-action-run:content-target' as CorrelationId<'manual-action-run'>,
          targetItem: {
            itemId: 'message-456',
            itemType: {
              id: 'content-type-1',
              kind: 'CONTENT' as const,
              name: 'Message',
            },
          },
        },
      );

      expect(getItemByIdentifier).toHaveBeenCalledTimes(1);
      const sentBody = jsonParse(fetchHTTP.mock.calls[0]?.[0].body);
      expect(sentBody.creator).toEqual({
        id: 'author-9',
        typeId: 'user-type-1',
      });
    });

    it('omits the creator when a CONTENT target has no resolvable submission', async () => {
      const fetchHTTP = jest.fn().mockResolvedValue({ status: 200, ok: true });
      const { publisher } = makeIsolatedPublisher({
        fetchHTTP,
        itemInvestigationService: {
          getItemByIdentifier: jest.fn().mockResolvedValue(undefined),
        },
      });

      await publisher.publishActions(
        [
          {
            action: {
              id: 'action-no-creator',
              orgId: 'org-789',
              name: 'Action',
              description: null,
              applyUserStrikes: false,
              penalty: 'NONE' as const,
              actionType: ActionType.CUSTOM_ACTION,
              callbackUrl: 'https://example.com/webhook',
              callbackUrlHeaders: null,
              callbackUrlBody: null,
              customMrtApiParams: null,
            },
            policies: [],
            matchingRules: undefined,
            ruleEnvironment: undefined,
          },
        ],
        {
          orgId: 'org-789',
          correlationId:
            'manual-action-run:no-creator' as CorrelationId<'manual-action-run'>,
          targetItem: {
            itemId: 'phantom-content-id',
            itemType: {
              id: 'content-type-1',
              kind: 'CONTENT' as const,
              name: 'Message',
            },
          },
        },
      );

      const sentBody = jsonParse(fetchHTTP.mock.calls[0]?.[0].body);
      expect('creator' in sentBody).toBe(false);
    });

    it('still delivers the webhook (with creator omitted) when the creator lookup rejects', async () => {
      const fetchHTTP = jest.fn().mockResolvedValue({ status: 200, ok: true });
      const { publisher } = makeIsolatedPublisher({
        fetchHTTP,
        itemInvestigationService: {
          getItemByIdentifier: jest
            .fn()
            .mockRejectedValue(new Error('lookup failed')),
        },
      });

      await publisher.publishActions(
        [
          {
            action: {
              id: 'action-lookup-fail',
              orgId: 'org-789',
              name: 'Action',
              description: null,
              applyUserStrikes: false,
              penalty: 'NONE' as const,
              actionType: ActionType.CUSTOM_ACTION,
              callbackUrl: 'https://example.com/webhook',
              callbackUrlHeaders: null,
              callbackUrlBody: null,
              customMrtApiParams: null,
            },
            policies: [],
            matchingRules: undefined,
            ruleEnvironment: undefined,
          },
        ],
        {
          orgId: 'org-789',
          correlationId:
            'manual-action-run:lookup-fail' as CorrelationId<'manual-action-run'>,
          targetItem: {
            itemId: 'phantom-content-id',
            itemType: {
              id: 'content-type-1',
              kind: 'CONTENT' as const,
              name: 'Message',
            },
          },
        },
      );

      expect(fetchHTTP).toHaveBeenCalledTimes(1);
      const sentBody = jsonParse(fetchHTTP.mock.calls[0]?.[0].body);
      expect('creator' in sentBody).toBe(false);
    });

    it('omits actorNote from the webhook body entirely when no note is supplied', async () => {
      const fetchHTTP = jest.fn().mockResolvedValue({ status: 200, ok: true });
      const { publisher } = makeIsolatedPublisher({ fetchHTTP });

      await publisher.publishActions(
        [
          {
            action: {
              id: 'action-no-note',
              orgId: 'org-789',
              name: 'Action',
              description: null,
              applyUserStrikes: false,
              penalty: 'NONE' as const,
              actionType: ActionType.CUSTOM_ACTION,
              callbackUrl: 'https://example.com/webhook',
              callbackUrlHeaders: null,
              callbackUrlBody: null,
              customMrtApiParams: null,
            },
            policies: [],
            matchingRules: undefined,
            ruleEnvironment: undefined,
          },
        ],
        {
          orgId: 'org-789',
          correlationId:
            'manual-action-run:no-note' as CorrelationId<'manual-action-run'>,
          targetItem: {
            itemId: 'item-no-note',
            itemType: {
              id: 'type-789',
              kind: 'CONTENT' as const,
              name: 'Social Post',
            },
          },
        },
      );

      const sentBody = jsonParse(fetchHTTP.mock.calls[0]?.[0].body);
      expect('actorNote' in sentBody).toBe(false);
    });

    it('includes the decision reason as a top-level `decisionReason` field', async () => {
      const fetchHTTP = jest.fn().mockResolvedValue({ status: 200, ok: true });
      const { publisher } = makeIsolatedPublisher({ fetchHTTP });

      await publisher.publishActions(
        [
          {
            action: {
              id: 'action-reason',
              orgId: 'org-789',
              name: 'Remove',
              description: null,
              applyUserStrikes: false,
              penalty: 'NONE' as const,
              actionType: ActionType.CUSTOM_ACTION,
              callbackUrl: 'https://example.com/webhook',
              callbackUrlHeaders: null,
              callbackUrlBody: null,
              customMrtApiParams: null,
            },
            policies: [],
            matchingRules: undefined,
            ruleEnvironment: undefined,
          },
        ],
        {
          orgId: 'org-789',
          correlationId: 'mrt-decision:reason' as CorrelationId<'mrt-decision'>,
          targetItem: {
            itemId: 'item-reason',
            itemType: {
              id: 'type-789',
              kind: 'CONTENT' as const,
              name: 'Social Post',
            },
          },
          decisionReason: 'Violated spam policy',
        },
      );

      const sentBody = jsonParse(fetchHTTP.mock.calls[0]?.[0].body);
      expect(sentBody.decisionReason).toBe('Violated spam policy');
      // Top-level, not nested under `custom`.
      expect(sentBody.custom.decisionReason).toBeUndefined();
    });

    it('omits `decisionReason` from the webhook body when no decision reason is supplied', async () => {
      const fetchHTTP = jest.fn().mockResolvedValue({ status: 200, ok: true });
      const { publisher } = makeIsolatedPublisher({ fetchHTTP });

      await publisher.publishActions(
        [
          {
            action: {
              id: 'action-no-reason',
              orgId: 'org-789',
              name: 'Remove',
              description: null,
              applyUserStrikes: false,
              penalty: 'NONE' as const,
              actionType: ActionType.CUSTOM_ACTION,
              callbackUrl: 'https://example.com/webhook',
              callbackUrlHeaders: null,
              callbackUrlBody: null,
              customMrtApiParams: null,
            },
            policies: [],
            matchingRules: undefined,
            ruleEnvironment: undefined,
          },
        ],
        {
          orgId: 'org-789',
          correlationId:
            'manual-action-run:no-reason' as CorrelationId<'manual-action-run'>,
          targetItem: {
            itemId: 'item-no-reason',
            itemType: {
              id: 'type-789',
              kind: 'CONTENT' as const,
              name: 'Social Post',
            },
          },
        },
      );

      const sentBody = jsonParse(fetchHTTP.mock.calls[0]?.[0].body);
      expect('decisionReason' in sentBody).toBe(false);
    });

    it('includes the user strike total (current total plus strikes this event applies)', async () => {
      const fetchHTTP = jest.fn().mockResolvedValue({ status: 200, ok: true });
      const getUserStrikeValue = jest.fn().mockResolvedValue(2);
      const findMostSeverePolicyViolationFromActions = jest
        .fn()
        .mockReturnValue({ id: 'policy-1', userStrikeCount: 3 });
      const { publisher } = makeIsolatedPublisher({
        fetchHTTP,
        userStrikeService: {
          getUserStrikeValue,
          findMostSeverePolicyViolationFromActions,
        },
      });

      await publisher.publishActions(
        [
          {
            action: {
              id: 'action-strikes',
              orgId: 'org-789',
              name: 'Strike',
              description: null,
              applyUserStrikes: true,
              penalty: 'NONE' as const,
              actionType: ActionType.CUSTOM_ACTION,
              callbackUrl: 'https://example.com/webhook',
              callbackUrlHeaders: null,
              callbackUrlBody: null,
              customMrtApiParams: null,
            },
            policies: [
              {
                id: 'policy-1',
                name: 'Policy 1',
                penalty: 'NONE' as const,
                userStrikeCount: 3,
              },
            ],
            matchingRules: undefined,
            ruleEnvironment: undefined,
          },
        ],
        {
          orgId: 'org-789',
          correlationId:
            'manual-action-run:strikes' as CorrelationId<'manual-action-run'>,
          targetItem: {
            itemId: 'user-123',
            itemType: {
              id: 'user-type-1',
              kind: 'USER' as const,
              name: 'User',
            },
          },
        },
      );

      expect(getUserStrikeValue).toHaveBeenCalledWith('org-789', {
        id: 'user-123',
        typeId: 'user-type-1',
      });
      const sentBody = jsonParse(fetchHTTP.mock.calls[0]?.[0].body);
      // 2 existing + 3 applied this event = 5
      expect(sentBody.userStrikeCount).toBe(5);
    });

    it('omits the user strike total when there is no resolvable target user', async () => {
      const fetchHTTP = jest.fn().mockResolvedValue({ status: 200, ok: true });
      const getUserStrikeValue = jest.fn();
      const { publisher } = makeIsolatedPublisher({
        fetchHTTP,
        userStrikeService: { getUserStrikeValue },
        itemInvestigationService: {
          getItemByIdentifier: jest.fn().mockResolvedValue(undefined),
        },
      });

      await publisher.publishActions(
        [
          {
            action: {
              id: 'action-no-user',
              orgId: 'org-789',
              name: 'Action',
              description: null,
              applyUserStrikes: false,
              penalty: 'NONE' as const,
              actionType: ActionType.CUSTOM_ACTION,
              callbackUrl: 'https://example.com/webhook',
              callbackUrlHeaders: null,
              callbackUrlBody: null,
              customMrtApiParams: null,
            },
            policies: [],
            matchingRules: undefined,
            ruleEnvironment: undefined,
          },
        ],
        {
          orgId: 'org-789',
          correlationId:
            'manual-action-run:no-user' as CorrelationId<'manual-action-run'>,
          targetItem: {
            // Identifier-only CONTENT with no submission => no resolvable user.
            itemId: 'phantom-content-id',
            itemType: {
              id: 'content-type-1',
              kind: 'CONTENT' as const,
              name: 'Message',
            },
          },
        },
      );

      expect(getUserStrikeValue).not.toHaveBeenCalled();
      const sentBody = jsonParse(fetchHTTP.mock.calls[0]?.[0].body);
      expect('userStrikeCount' in sentBody).toBe(false);
    });

    it('reports the resolved creator strike total (no applied delta) for an identifier-only CONTENT target', async () => {
      const fetchHTTP = jest.fn().mockResolvedValue({ status: 200, ok: true });
      const getUserStrikeValue = jest.fn().mockResolvedValue(4);
      // A strike weight exists, but for identifier-only CONTENT no strike is
      // actually applied, so it must not be added to the reported total.
      const findMostSeverePolicyViolationFromActions = jest
        .fn()
        .mockReturnValue({ id: 'policy-1', userStrikeCount: 3 });
      const getItemByIdentifier = jest.fn().mockResolvedValue({
        latestSubmission: {
          itemId: 'message-77',
          submissionId: 'sub-77',
          data: { text: 'hi' },
          creator: { id: 'author-77', typeId: 'user-type-1' },
        },
      });
      const { publisher } = makeIsolatedPublisher({
        fetchHTTP,
        userStrikeService: {
          getUserStrikeValue,
          findMostSeverePolicyViolationFromActions,
        },
        itemInvestigationService: { getItemByIdentifier },
      });

      await publisher.publishActions(
        [
          {
            action: {
              id: 'action-content-strike',
              orgId: 'org-789',
              name: 'Strike',
              description: null,
              applyUserStrikes: true,
              penalty: 'NONE' as const,
              actionType: ActionType.CUSTOM_ACTION,
              callbackUrl: 'https://example.com/webhook',
              callbackUrlHeaders: null,
              callbackUrlBody: null,
              customMrtApiParams: null,
            },
            policies: [
              {
                id: 'policy-1',
                name: 'Policy 1',
                penalty: 'NONE' as const,
                userStrikeCount: 3,
              },
            ],
            matchingRules: undefined,
            ruleEnvironment: undefined,
          },
        ],
        {
          orgId: 'org-789',
          correlationId:
            'manual-action-run:content-strike' as CorrelationId<'manual-action-run'>,
          targetItem: {
            itemId: 'message-77',
            itemType: {
              id: 'content-type-1',
              kind: 'CONTENT' as const,
              name: 'Message',
            },
          },
        },
      );

      expect(getUserStrikeValue).toHaveBeenCalledWith('org-789', {
        id: 'author-77',
        typeId: 'user-type-1',
      });
      const sentBody = jsonParse(fetchHTTP.mock.calls[0]?.[0].body);
      // Current total (4) with no applied delta for identifier-only CONTENT.
      expect(sentBody.userStrikeCount).toBe(4);
      expect(sentBody.creator).toEqual({
        id: 'author-77',
        typeId: 'user-type-1',
      });
    });

    it('forwards moderator-supplied parameter values and actor note to the logger', async () => {
      const logSpy = jest.spyOn(
        container.ActionExecutionLogger,
        'logActionExecutions',
      );

      const triggeredActions = [
        {
          action: {
            id: 'action-with-params',
            orgId: 'org-456',
            name: 'Action With Params',
            description: null,
            applyUserStrikes: false,
            penalty: 'NONE' as const,
            actionType: ActionType.CUSTOM_ACTION,
            callbackUrl: 'https://example.com/action',
            callbackUrlHeaders: null,
            callbackUrlBody: null,
            customMrtApiParams: null,
          },
          policies: [],
          matchingRules: undefined,
          ruleEnvironment: undefined,
          // Mirrors what ActionApi.bulkExecuteActions hands to the publisher
          // after `validateActionParameterValues` runs.
          customMrtApiParamDecisionPayload: { num_days: 7, reason: 'spam' },
        },
      ];

      const executionContext = {
        orgId: 'org-456',
        correlationId:
          'manual-action-run:abc' as CorrelationId<'manual-action-run'>,
        targetItem: {
          itemId: 'item-456',
          itemType: {
            id: 'type-456',
            kind: 'CONTENT' as const,
            name: 'Social Post',
          },
        },
        actorId: 'actor-1',
        actorEmail: 'mod@example.com',
        actorNote: 'Repeat offender',
      };

      await container.ActionPublisher.publishActions(
        triggeredActions,
        executionContext,
      );

      expect(logSpy).toHaveBeenCalledTimes(1);
      const logged = logSpy.mock.calls[0]?.[0].executions[0];
      expect(logged?.parameterValues).toEqual({
        num_days: 7,
        reason: 'spam',
      });
      expect(logged?.actorNote).toBe('Repeat offender');

      logSpy.mockRestore();
    });

    it('enqueues to NCMEC for a synthetic USER target with no item submission record', async () => {
      const enqueueForHumanReviewIfApplicable = jest
        .fn()
        .mockResolvedValue({ status: 'ENQUEUED' });
      const userItemType = {
        id: 'user-type-1',
        kind: 'USER' as const,
        name: 'User',
        version: '1',
        schemaVariant: 'DEFAULT',
        schema: [],
        schemaFieldRoles: {},
      };
      const getItemTypeEventuallyConsistent = jest
        .fn()
        .mockResolvedValue(userItemType);
      const { publisher, logActionExecutions } = makeIsolatedPublisher({
        fetchHTTP: jest.fn(),
        ncmecService: { enqueueForHumanReviewIfApplicable },
        itemInvestigationService: {
          getItemByIdentifier: jest.fn().mockResolvedValue(undefined),
        },
        getItemTypeEventuallyConsistent,
      });

      const results = await publisher.publishActions(
        [
          {
            action: {
              id: 'action-ncmec',
              orgId: 'org-synth',
              name: 'Enqueue for NCMEC Review',
              description: null,
              applyUserStrikes: false,
              penalty: 'NONE' as const,
              actionType: ActionType.ENQUEUE_TO_NCMEC,
            },
            policies: [],
            matchingRules: undefined,
            ruleEnvironment: undefined,
          },
        ],
        {
          orgId: 'org-synth',
          correlationId:
            'manual-action-run:synthetic-ncmec' as CorrelationId<'manual-action-run'>,
          targetItem: {
            itemId: 'synthetic-user-id',
            itemType: {
              id: 'user-type-1',
              kind: 'USER' as const,
              name: 'User',
            },
          },
        },
      );

      expect(results).toEqual([
        expect.objectContaining({ success: true, actionId: 'action-ncmec' }),
      ]);
      expect(enqueueForHumanReviewIfApplicable).toHaveBeenCalledTimes(1);
      const enqueueArg = enqueueForHumanReviewIfApplicable.mock.calls[0]?.[0];
      expect(enqueueArg.item.itemId).toBe('synthetic-user-id');
      expect(enqueueArg.item.itemTypeIdentifier.id).toBe('user-type-1');
      expect(logActionExecutions).toHaveBeenCalledWith(
        expect.objectContaining({ failed: false }),
      );
    });

    it('enqueues to MRT for a synthetic USER target with no submission record', async () => {
      const enqueue = jest.fn().mockResolvedValue(undefined);
      const userItemType = {
        id: 'user-type-2',
        kind: 'USER' as const,
        name: 'User',
        version: '1',
        schemaVariant: 'DEFAULT',
        schema: [],
        schemaFieldRoles: {},
      };
      const getItemTypeEventuallyConsistent = jest
        .fn()
        .mockResolvedValue(userItemType);
      const { publisher, logActionExecutions } = makeIsolatedPublisher({
        fetchHTTP: jest.fn(),
        manualReviewToolService: { enqueue },
        itemInvestigationService: {
          getItemByIdentifier: jest.fn().mockResolvedValue(undefined),
        },
        getItemTypeEventuallyConsistent,
      });

      const results = await publisher.publishActions(
        [
          {
            action: {
              id: 'action-mrt',
              orgId: 'org-synth',
              name: 'Enqueue to MRT',
              description: null,
              applyUserStrikes: false,
              penalty: 'NONE' as const,
              actionType: ActionType.ENQUEUE_TO_MRT,
            },
            policies: [],
            matchingRules: undefined,
            ruleEnvironment: undefined,
          },
        ],
        {
          orgId: 'org-synth',
          correlationId:
            'manual-action-run:synthetic-mrt' as CorrelationId<'manual-action-run'>,
          targetItem: {
            itemId: 'synthetic-user-id',
            itemType: {
              id: 'user-type-2',
              kind: 'USER' as const,
              name: 'User',
            },
          },
        },
      );

      expect(results).toEqual([
        expect.objectContaining({ success: true, actionId: 'action-mrt' }),
      ]);
      expect(enqueue).toHaveBeenCalledTimes(1);
      expect(logActionExecutions).toHaveBeenCalledWith(
        expect.objectContaining({ failed: false }),
      );
    });

    it('infers the creator and enqueues to NCMEC for a CONTENT target with no submission', async () => {
      const enqueueForHumanReviewIfApplicable = jest
        .fn()
        .mockResolvedValue({ status: 'ENQUEUED' });
      const userItemType = {
        id: 'user-type-3',
        kind: 'USER' as const,
        name: 'User',
        version: '1',
        schemaVariant: 'DEFAULT',
        schema: [],
        schemaFieldRoles: {},
      };
      // The real helper resolves the creator id from ACTION_EXECUTIONS and
      // then synthesizes a submission keyed on *the creator's* id (not the
      // content's id). The mock mirrors that shape so the test exercises a
      // payload production can actually produce.
      const synthesizeUserItemFromContentTarget = jest.fn().mockResolvedValue({
        latestSubmission: {
          itemId: 'creator-user-id-7',
          itemType: userItemType,
          data: {},
          submissionId: 'synthetic:creator-user-id-7',
          submissionTime: undefined,
          creator: undefined,
        },
      });
      const { publisher, logActionExecutions } = makeIsolatedPublisher({
        fetchHTTP: jest.fn(),
        ncmecService: { enqueueForHumanReviewIfApplicable },
        itemInvestigationService: {
          getItemByIdentifier: jest.fn().mockResolvedValue(undefined),
          synthesizeUserItemFromContentTarget,
        },
      });

      const results = await publisher.publishActions(
        [
          {
            action: {
              id: 'action-ncmec-inferred',
              orgId: 'org-synth',
              name: 'Enqueue for NCMEC Review',
              description: null,
              applyUserStrikes: false,
              penalty: 'NONE' as const,
              actionType: ActionType.ENQUEUE_TO_NCMEC,
            },
            policies: [],
            matchingRules: undefined,
            ruleEnvironment: undefined,
          },
        ],
        {
          orgId: 'org-synth',
          correlationId:
            'manual-action-run:inferred-ncmec' as CorrelationId<'manual-action-run'>,
          targetItem: {
            itemId: 'phantom-content-id',
            itemType: {
              id: 'content-type-1',
              kind: 'CONTENT' as const,
              name: 'Post',
            },
          },
        },
      );

      expect(results).toEqual([expect.objectContaining({ success: true })]);
      expect(synthesizeUserItemFromContentTarget).toHaveBeenCalledWith({
        orgId: 'org-synth',
        itemId: 'phantom-content-id',
        itemTypeId: 'content-type-1',
      });
      expect(enqueueForHumanReviewIfApplicable).toHaveBeenCalledTimes(1);
      const enqueueArg = enqueueForHumanReviewIfApplicable.mock.calls[0]?.[0];
      expect(enqueueArg.item.itemId).toBe('creator-user-id-7');
      expect(enqueueArg.item.itemTypeIdentifier.id).toBe('user-type-3');
      expect(logActionExecutions).toHaveBeenCalledWith(
        expect.objectContaining({ failed: false }),
      );
    });

    it('fails loudly when ENQUEUE_TO_NCMEC targets a CONTENT item with no submission and no inferable creator', async () => {
      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const enqueueForHumanReviewIfApplicable = jest.fn();
      const synthesizeUserItemFromContentTarget = jest
        .fn()
        .mockResolvedValue(null);
      const { publisher, logActionExecutions } = makeIsolatedPublisher({
        fetchHTTP: jest.fn(),
        ncmecService: { enqueueForHumanReviewIfApplicable },
        itemInvestigationService: {
          getItemByIdentifier: jest.fn().mockResolvedValue(undefined),
          synthesizeUserItemFromContentTarget,
        },
      });

      const results = await publisher.publishActions(
        [
          {
            action: {
              id: 'action-ncmec-content',
              orgId: 'org-synth',
              name: 'Enqueue for NCMEC Review',
              description: null,
              applyUserStrikes: false,
              penalty: 'NONE' as const,
              actionType: ActionType.ENQUEUE_TO_NCMEC,
            },
            policies: [],
            matchingRules: undefined,
            ruleEnvironment: undefined,
          },
        ],
        {
          orgId: 'org-synth',
          correlationId:
            'manual-action-run:synthetic-ncmec-content' as CorrelationId<'manual-action-run'>,
          targetItem: {
            itemId: 'phantom-content-id',
            itemType: {
              id: 'content-type-1',
              kind: 'CONTENT' as const,
              name: 'Post',
            },
          },
        },
      );

      expect(results).toEqual([expect.objectContaining({ success: false })]);
      expect(synthesizeUserItemFromContentTarget).toHaveBeenCalled();
      expect(enqueueForHumanReviewIfApplicable).not.toHaveBeenCalled();
      expect(logActionExecutions).toHaveBeenCalledWith(
        expect.objectContaining({ failed: true }),
      );
      expect(consoleSpy).toHaveBeenCalled();
      const loggedLine = consoleSpy.mock.calls[0]?.[0];
      expect(loggedLine).toEqual(
        expect.stringContaining('action-ncmec-content'),
      );
      expect(loggedLine).toEqual(
        expect.stringContaining('actionPublisher.publishAction.failed'),
      );
      consoleSpy.mockRestore();
    });
  });
});
