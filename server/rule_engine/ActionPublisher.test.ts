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
import ActionPublisherDefault, {
  type ActionPublisher,
} from './ActionPublisher.js';
import { RuleEnvironment } from './RuleEngine.js';

// Hand-rolled mocks for `makeIsolatedPublisher` below — used by tests that
// need to inspect outgoing webhook bodies without mutating the bottle's
// shared `ActionPublisher` instance.
type SpanLike = {
  setAttribute: () => void;
  recordException: () => void;
  isRecording: () => boolean;
};
type TracerLike = {
  addActiveSpan: (_meta: unknown, fn: (span: SpanLike) => unknown) => unknown;
  getActiveSpan: () => undefined;
};

function makeIsolatedPublisher(opts: { fetchHTTP: jest.Mock }) {
  const tracer: TracerLike = {
    addActiveSpan: (_meta, fn) =>
      fn({
        setAttribute: () => {},
        recordException: () => {},
        isRecording: () => false,
      }),
    getActiveSpan: () => undefined,
  };
  const PublisherCtor = ActionPublisherDefault as unknown as new (
    actionExecutionLogger: { logActionExecutions: jest.Mock },
    tracer: TracerLike,
    fetchHTTP: jest.Mock,
    signingKeyPairService: { sign: jest.Mock },
    manualReviewToolService: object,
    ncmecService: object,
    itemInvestigationService: { getItemByIdentifier: jest.Mock },
    userStrikeService: { applyUserStrikeFromPublishedActions: jest.Mock },
  ) => ActionPublisher;
  const logActionExecutions = jest.fn().mockResolvedValue(undefined);
  const publisher = new PublisherCtor(
    { logActionExecutions },
    tracer,
    opts.fetchHTTP,
    { sign: jest.fn().mockResolvedValue(undefined) },
    {},
    {},
    { getItemByIdentifier: jest.fn().mockResolvedValue(undefined) },
    {
      applyUserStrikeFromPublishedActions: jest
        .fn()
        .mockResolvedValue(undefined),
    },
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
      const fetchHTTP = jest
        .fn()
        .mockResolvedValue({ status: 200, ok: true });
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

    it('omits actorNote from the webhook body entirely when no note is supplied', async () => {
      const fetchHTTP = jest
        .fn()
        .mockResolvedValue({ status: 200, ok: true });
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
  });
});
