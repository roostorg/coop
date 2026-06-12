/* eslint-disable max-lines */
import { type Exception } from '@opentelemetry/api';
import { type ItemIdentifier } from '@roostorg/coop-types';
import { type JsonObject, type ReadonlyDeep } from 'type-fest';

import { type Dependencies } from '../iocContainer/index.js';
import { inject } from '../iocContainer/utils.js';
import {
  type ActionExecutionCorrelationId,
  type ActionExecutionSourceType,
  type MatchingRule,
  type Policy,
} from '../services/analyticsLoggers/index.js';
import { makeSyntheticUserSubmission } from '../services/itemInvestigationService/index.js';
import {
  getFieldValueForRole,
  itemSubmissionToItemSubmissionWithTypeIdentifier,
  type ItemSubmission,
} from '../services/itemProcessingService/index.js';
import {
  ActionType,
  type Action,
  type ItemType,
} from '../services/moderationConfigService/index.js';
import { asyncIterableToArray } from '../utils/collections.js';
import { getSourceType, type CorrelationId } from '../utils/correlationIds.js';
import { jsonStringify } from '../utils/encoding.js';
import { assertUnreachable, safePick, withRetries } from '../utils/misc.js';
import { type RuleEnvironment } from './RuleEngine.js';

export type ActionExecutionData<
  T extends ActionExecutionCorrelationId = ActionExecutionCorrelationId,
> = {
  orgId: string;
  action: Readonly<{ id: string; name: string }>;

  targetItem: ActionTargetItem;

  // Actions can also be invoked manually, without any rules having matched to
  // trigger the action. Therefore the rule data can be missing in that case.
  matchingRules: T extends
    | CorrelationId<'manual-action-run'>
    | CorrelationId<'mrt-decision'>
    | CorrelationId<'post-actions'>
    | CorrelationId<'user-strike-action-execution'>
    ? undefined
    : ReadonlyDeep<MatchingRule[]>;
  ruleEnvironment: T extends
    | CorrelationId<'manual-action-run'>
    | CorrelationId<'mrt-decision'>
    | CorrelationId<'post-actions'>
    | CorrelationId<'user-strike-action-execution'>
    ? undefined
    : RuleEnvironment;
  correlationId: T;
  policies: ReadonlyDeep<Policy[]>;
  actorId?: string;
  reportedItems?: ItemIdentifier[];
  jobId?: string;
  /**
   * Validated moderator-supplied runtime parameter values for this action,
   * propagated into the audit log alongside the action itself. Persisted as
   * JSON in `analytics.ACTION_EXECUTIONS.parameters` so reviewers can see
   * exactly what the action ran with.
   */
  parameterValues?: Record<string, unknown>;
  /** Optional moderator note. Persisted in `analytics.ACTION_EXECUTIONS.actor_note`. */
  actorNote?: string;
};

export type ActionResult<T extends ActionTargetItem> = {
  actionId: string;
  targetItem: T;
  success: boolean;
};

export function getUserFromActionTarget(it: ActionTargetItem) {
  return it.itemType.kind === 'USER'
    ? { id: it.itemId, typeId: it.itemType.id }
    : isFullSubmission(it)
      ? it.creator
      : undefined;
}

/**
 * This type represents the types that the Action Publisher can feasibly action on.
 * For now, this is a duplicate type of RuleEngine but are separate in case they
 * diverge.
 */
export type ActionTargetItem =
  | ItemSubmission
  | { itemId: string; itemType: Pick<ItemType, 'id' | 'kind' | 'name'> };

export function isFullSubmission(
  input: ActionTargetItem,
): input is ItemSubmission {
  return 'data' in input && 'submissionId' in input && Boolean(input.data);
}

export function getUserFromActionTargetItem(it: ActionTargetItem) {
  return it.itemType.kind === 'USER'
    ? { id: it.itemId, typeId: it.itemType.id }
    : isFullSubmission(it)
      ? it.creator
      : undefined;
}

/**
 * The class that publishes Actions back to users after Rules have
 * finished running.
 *
 * Eventually, we'll inject the dependency that's used to actually make the
 * HTTP call, so we can unit test this logic.
 */
class ActionPublisher {
  constructor(
    private readonly actionExecutionLogger: Dependencies['ActionExecutionLogger'],
    private readonly tracer: Dependencies['Tracer'],
    private readonly fetchHTTP: Dependencies['fetchHTTP'],
    private signingKeyPairService: Dependencies['SigningKeyPairService'],
    private manualReviewToolService: Dependencies['ManualReviewToolService'],
    private ncmecService: Dependencies['NcmecService'],
    private itemInvestigationService: Dependencies['ItemInvestigationService'],
    private userStrikeService: Dependencies['UserStrikeService'],
    private getItemTypeEventuallyConsistent: Dependencies['getItemTypeEventuallyConsistent'],
  ) {}

  /**
   * Publishes a set of actions.
   *
   * Right now, we require all these actions to be related somehow: to have the
   * same event (w/ a single correlation id) that triggered them; to be associated
   * with the same content submission (if any) and the same user; etc. Therefore,
   * we take the values that are constant across all actions as dedicated args.
   */
  async publishActions<
    T extends ActionExecutionCorrelationId,
    U extends ActionTargetItem,
  >(
    triggeredActions: Omit<
      Omit<ActionExecutionData<T>, 'action' | 'customMrtApiParams'> & {
        action: Action;
        customMrtApiParamDecisionPayload?: Record<
          string,
          string | boolean | unknown
        >;
      },
      'orgId' | 'correlationId' | 'targetItem'
    >[],
    executionContext: {
      orgId: string;
      correlationId: T;
      targetItem: U;
      sync?: boolean;
      actorId?: string;
      actorEmail?: string;
      decisionReason?: string;
      /**
       * Optional moderator-authored note explaining why the action(s) ran.
       * Forwarded to CUSTOM_ACTION webhooks as `actorNote` and persisted by
       * the audit logger (PR 3).
       */
      actorNote?: string;
    },
  ): Promise<ActionResult<U>[]> {
    const {
      orgId,
      correlationId,
      targetItem,
      sync,
      actorId,
      actorEmail,
      actorNote,
      decisionReason,
    } = executionContext;

    // Resolve the action user once and reuse it for both `creator` and the
    // strike total. Only needed when a CUSTOM_ACTION webhook will carry them.
    const hasWebhook = triggeredActions.some(
      (it) => it.action.actionType === ActionType.CUSTOM_ACTION,
    );
    const { user: actionUser, isDirect: isDirectUser } = hasWebhook
      ? await this.resolveActionUser(orgId, targetItem)
      : { user: undefined, isDirect: false };
    const userStrikeCount = await this.getUserStrikeCountForWebhook(
      orgId,
      actionUser,
      isDirectUser,
      triggeredActions,
    );

    // Apply user strikes from the actions that were triggered.
    // we do this without awaiting to not block the action publishing
    // and similarly don't blow up if the user strike application fails
    this.tracer
      .addActiveSpan(
        {
          resource: 'actionPublisher',
          operation: 'applyUserStrikeFromPublishedActions',
        },
        async (span) => {
          span.setAttribute('org.id', orgId);
          span.setAttribute(
            'actions',
            triggeredActions.map((it) => it.action.id).toString(),
          );
          await this.userStrikeService
            .applyUserStrikeFromPublishedActions(
              triggeredActions,
              executionContext,
            )
            .catch((e) => {
              span.recordException(e as Exception);
            });
        },
      )
      .catch(() => {});

    return Promise.all([
      ...triggeredActions.map(
        async ({
          action,
          policies,
          matchingRules,
          reportedItems,
          customMrtApiParamDecisionPayload,
          ruleEnvironment,
          jobId,
        }) => {
          const relatedRules = matchingRules
            ? matchingRules.map((rule) => safePick(rule, ['id', 'name']))
            : undefined;

          const publishActionWithRetries = withRetries(
            {
              maxRetries: 5,
              initialTimeMsBetweenRetries: 5,
              maxTimeMsBetweenRetries: 500,
              jitter: true,
            },
            async () => {
              return this.publishAction(
                orgId,
                action,
                policies.map((policy) =>
                  safePick(policy, ['id', 'name', 'penalty']),
                ),
                targetItem,
                correlationId,
                actorEmail,
                reportedItems,
                relatedRules,
                customMrtApiParamDecisionPayload,
                actorNote,
                decisionReason,
                userStrikeCount,
                actionUser,
              );
            },
          );
          const success = await (async () => {
            try {
              return await publishActionWithRetries();
            } catch (e) {
              return false;
            }
          })();

          await this.actionExecutionLogger.logActionExecutions({
            executions: [
              {
                action,
                matchingRules,
                ruleEnvironment,
                policies: policies.map((policy) =>
                  safePick(policy, [
                    'id',
                    'name',
                    'userStrikeCount',
                    'penalty',
                  ]),
                ),
                orgId,
                targetItem,
                correlationId,
                actorId,
                jobId,
                // Audit-trail context: persist what the moderator supplied
                // alongside the action itself so reviewers can see why and
                // with what values it ran (PR 3 for #377).
                parameterValues: customMrtApiParamDecisionPayload,
                actorNote,
              },
            ],
            failed: success === false,
            sync,
          });

          return {
            success,
            targetItem: executionContext.targetItem,
            actionId: action.id,
          };
        },
      ),
    ]);
  }

  /**
   * Resolves the user a webhook action concerns, once per batch. `isDirect` is
   * true when the target resolves the way the strike service resolves it (USER
   * target or a full submission's creator); for identifier-only CONTENT we fall
   * back to fetching the latest submission's creator (`isDirect` false).
   * Best-effort: a failed fetch yields no user rather than throwing.
   */
  private async resolveActionUser(
    orgId: string,
    targetItem: ActionTargetItem,
  ): Promise<{ user: ItemIdentifier | undefined; isDirect: boolean }> {
    const directUser = getUserFromActionTargetItem(targetItem);
    if (directUser) {
      return { user: directUser, isDirect: true };
    }
    if (targetItem.itemType.kind !== 'CONTENT') {
      return { user: undefined, isDirect: false };
    }
    if (isFullSubmission(targetItem)) {
      return { user: targetItem.creator, isDirect: false };
    }
    try {
      const submission = (
        await this.itemInvestigationService.getItemByIdentifier({
          orgId,
          itemIdentifier: {
            id: targetItem.itemId,
            typeId: targetItem.itemType.id,
          },
          latestSubmissionOnly: true,
        })
      )?.latestSubmission;
      return { user: submission?.creator, isDirect: false };
    } catch {
      return { user: undefined, isDirect: false };
    }
  }

  /**
   * The user's cumulative strike total after this event (current total + strikes
   * this event applies), for CUSTOM_ACTION webhooks. The applied delta is only
   * added when the user resolved directly (`isDirect`) — i.e. when the strike
   * service actually applies a strike. Best-effort; undefined when unresolvable.
   */
  private async getUserStrikeCountForWebhook<
    T extends ActionExecutionCorrelationId,
  >(
    orgId: string,
    user: ItemIdentifier | undefined,
    isDirect: boolean,
    triggeredActions: Omit<
      Omit<ActionExecutionData<T>, 'action'> & { action: Action },
      'orgId' | 'correlationId' | 'targetItem'
    >[],
  ): Promise<number | undefined> {
    if (!user) {
      return undefined;
    }
    try {
      const currentTotal = await this.userStrikeService.getUserStrikeValue(
        orgId,
        user,
      );
      const appliedStrikes = isDirect
        ? (this.userStrikeService.findMostSeverePolicyViolationFromActions(
            triggeredActions,
          )?.userStrikeCount ?? 0)
        : 0;
      return currentTotal + appliedStrikes;
    } catch {
      return undefined;
    }
  }

  async publishAction(
    orgId: string,
    action: Action,
    policies: Pick<Policy, 'id' | 'name' | 'penalty'>[],
    targetItem: ActionTargetItem,
    correlationId: ActionExecutionCorrelationId,
    actorEmail?: string,
    reportedItems?: ItemIdentifier[],
    // coerce to empty array in the case rules is undefined
    // so the request body does not have an undefined object key
    rules: ReadonlyDeep<Pick<MatchingRule, 'id' | 'name'>[]> = [],
    customMrtApiParamDecisionPayload?: Record<
      string,
      string | boolean | unknown
    >,
    actorNote?: string,
    decisionReason?: string,
    userStrikeCount?: number,
    creator?: ItemIdentifier,
  ): Promise<boolean> {
    return this.tracer.addActiveSpan(
      { resource: 'actionPublisher', operation: 'publishAction' },
      // eslint-disable-next-line complexity
      async (span) => {
        span.setAttribute('org.id', orgId);
        span.setAttribute('action.id', action.id);
        span.setAttribute('action.name', action.name);

        const getFullItem = async () => {
          if (isFullSubmission(targetItem)) {
            return targetItem;
          }
          return (
            await this.itemInvestigationService.getItemByIdentifier({
              orgId,
              itemIdentifier: {
                id: targetItem.itemId,
                typeId: targetItem.itemType.id,
              },
              latestSubmissionOnly: true,
            })
          )?.latestSubmission;
        };

        // USER target with no record: synthesize a minimal submission from
        // the id. Returns undefined for non-USER targets — MRT needs the
        // real content submission, so it must fail loudly for CONTENT.
        const getFullItemOrSyntheticUserForUserTarget = async () => {
          const fullItem = await getFullItem();
          if (fullItem) {
            return fullItem;
          }
          if (targetItem.itemType.kind !== 'USER') {
            return undefined;
          }
          const userItemType = await this.getItemTypeEventuallyConsistent({
            orgId,
            typeSelector: { id: targetItem.itemType.id },
          });
          if (!userItemType || userItemType.kind !== 'USER') {
            return undefined;
          }
          return makeSyntheticUserSubmission(targetItem.itemId, userItemType);
        };

        // NCMEC fallback: USER target → synthetic user (as above); CONTENT
        // target → resolve the creator via ACTION_EXECUTIONS and synthesize a
        // user submission keyed on the creator id. THREAD has no single
        // owner, so we refuse.
        const getFullItemOrSyntheticUserForNcmec = async () => {
          const userTarget = await getFullItemOrSyntheticUserForUserTarget();
          if (userTarget) {
            return userTarget;
          }
          if (targetItem.itemType.kind !== 'CONTENT') {
            return undefined;
          }
          const inferred =
            await this.itemInvestigationService.synthesizeUserItemFromContentTarget(
              {
                orgId,
                itemId: targetItem.itemId,
                itemTypeId: targetItem.itemType.id,
              },
            );
          return inferred?.latestSubmission;
        };
        const actionSource = getSourceType(
          correlationId,
        ) as ActionExecutionSourceType;
        try {
          switch (action.actionType) {
            case ActionType.CUSTOM_ACTION:
              const customHeaders = action.callbackUrlHeaders;
              const customBody = action.callbackUrlBody;

              const customBodyWithMrtParams = {
                ...customBody,
                ...customMrtApiParamDecisionPayload,
              };

              const body = {
                item: {
                  id: targetItem.itemId,
                  typeId: targetItem.itemType.id,
                  typeName: targetItem.itemType.name,
                },
                policies,
                rules,
                action: { id: action.id },
                custom: customBodyWithMrtParams,
                actorEmail,
                // Top-level (not nested under `custom`) so the moderator note
                // can't collide with a user-defined parameter named
                // `actorNote`. Omitted from the body entirely when absent.
                ...(actorNote !== undefined ? { actorNote } : {}),
                ...(creator !== undefined ? { creator } : {}),
                // The moderator's decision reason, top-level for the same
                // collision-safety reason as `actorNote`. Omitted when absent.
                ...(decisionReason !== undefined ? { decisionReason } : {}),
                // The user's cumulative strike total after this event. Omitted
                // when there's no resolvable user.
                ...(userStrikeCount !== undefined ? { userStrikeCount } : {}),
              };

              const response = await this.fetchHTTP({
                url: action.callbackUrl,
                method: 'post',
                body: jsonStringify(body),
                logRequestAndResponseBody: 'ALWAYS',
                headers: {
                  // TODO: We should make sure that there's no value a user
                  // could provide that would have security implications when blindly fed
                  // in here -- like something that would somehow lead fetch to do something
                  // unexpected.

                  ...((customHeaders as JsonObject | undefined) ?? undefined),
                  // Put this header last so customHeaders can't override it, which I
                  // think makes sense, since there's no way for users to effect the
                  // body in a way that would change the content type.
                  'Content-Type': 'application/json',
                },
                handleResponseBody: 'discard',
                signWith: this.signingKeyPairService.sign.bind(
                  this.signingKeyPairService,
                  orgId,
                ),
              });

              span.setAttribute('response.status', response.status);
              if (response.status >= 400 && response.status < 500) {
                return false;
              }
              if (!response.ok) {
                throw Error(`User's server returned non-success status`);
              }

              return true;
            case ActionType.ENQUEUE_TO_MRT: {
              const fullItemForMrt =
                await getFullItemOrSyntheticUserForUserTarget();
              if (!fullItemForMrt) {
                throw new Error(
                  `Cannot enqueue to MRT: no submission record for ${targetItem.itemType.kind} ` +
                    `item ${targetItem.itemId} (type ${targetItem.itemType.id}). ` +
                    `POST the item to the items endpoint first.`,
                );
              }

              await this.manualReviewToolService.enqueue({
                orgId,
                payload: {
                  reportHistory: [],
                  kind: 'DEFAULT',
                  item: itemSubmissionToItemSubmissionWithTypeIdentifier(
                    fullItemForMrt,
                  ),
                  reportedForReason: null,
                  reportedForReasons: [],
                  reportedItems,
                },
                createdAt: new Date(),
                // TODO: Fix enqueue source for non-Post Actions/Rule Execution sources
                ...(actionSource === 'post-actions'
                  ? {
                      enqueueSource: 'POST_ACTIONS',
                      enqueueSourceInfo: {
                        kind: 'POST_ACTIONS',
                      },
                    }
                  : {
                      enqueueSource: 'RULE_EXECUTION',
                      enqueueSourceInfo: {
                        kind: 'RULE_EXECUTION',
                        rules: rules.map((x) => x.id),
                      },
                    }),
                correlationId,
                policyIds: policies.map((it) => it.id),
              });

              return true;
            }
            case ActionType.ENQUEUE_TO_NCMEC: {
              const fullItemForNcmec =
                await getFullItemOrSyntheticUserForNcmec();
              if (!fullItemForNcmec) {
                throw new Error(
                  `Cannot enqueue to NCMEC: no submission record for ${targetItem.itemType.kind} ` +
                    `item ${targetItem.itemId} (type ${targetItem.itemType.id}). ` +
                    `POST the item to the items endpoint first.`,
                );
              }

              await this.ncmecService.enqueueForHumanReviewIfApplicable({
                orgId,
                item: itemSubmissionToItemSubmissionWithTypeIdentifier(
                  fullItemForNcmec,
                ),
                createdAt: new Date(),
                // TODO: Fix enqueue source for non-Post Actions/Rule Execution sources
                ...(actionSource === 'post-actions'
                  ? {
                      enqueueSource: 'POST_ACTIONS',
                      enqueueSourceInfo: {
                        kind: 'POST_ACTIONS',
                      },
                    }
                  : {
                      enqueueSource: 'RULE_EXECUTION',
                      enqueueSourceInfo: {
                        kind: 'RULE_EXECUTION',
                        rules: rules.map((x) => x.id),
                      },
                    }),
                correlationId,
              });

              return true;
            }
            case ActionType.ENQUEUE_AUTHOR_TO_MRT:
              const fullItemForAuthor = await getFullItem();
              if (
                !fullItemForAuthor ||
                fullItemForAuthor.itemType.kind !== 'CONTENT'
              ) {
                throw new Error(
                  "Actions without full item submissions can't have their author enqueued to MRT yet",
                );
              }
              const author = getFieldValueForRole(
                fullItemForAuthor.itemType.schema,
                fullItemForAuthor.itemType.schemaFieldRoles,
                'creatorId',
                fullItemForAuthor.data,
              );
              if (!author) {
                throw new Error('No author found to be enqueued to MRT');
              }

              const fullAuthor = (
                await this.itemInvestigationService.getItemByIdentifier({
                  orgId,
                  itemIdentifier: { id: author.id, typeId: author.typeId },
                  latestSubmissionOnly: true,
                })
              )?.latestSubmission;
              if (!fullAuthor) {
                throw new Error('No author found to be enqueued to MRT');
              }
              // Attempt to get surrounding context of the item, and put it into
              // item thread content items.
              const threadItems = await (async () => {
                if (fullItemForAuthor.itemType.kind !== 'CONTENT') {
                  throw new Error(
                    "Actions without full item submissions can't have their author enqueued to MRT yet",
                  );
                }
                const thread = getFieldValueForRole(
                  fullItemForAuthor.itemType.schema,
                  fullItemForAuthor.itemType.schemaFieldRoles,
                  'threadId',
                  fullItemForAuthor.data,
                );
                const createdAt = getFieldValueForRole(
                  fullItemForAuthor.itemType.schema,
                  fullItemForAuthor.itemType.schemaFieldRoles,
                  'createdAt',
                  fullItemForAuthor.data,
                );
                if (!thread || !createdAt) {
                  return undefined;
                }
                const submissionsStream =
                  this.itemInvestigationService.getThreadSubmissionsByTime({
                    orgId,
                    threadId: thread,
                  });
                return (await asyncIterableToArray(submissionsStream)).map(
                  (it) =>
                    itemSubmissionToItemSubmissionWithTypeIdentifier(
                      it.latestSubmission,
                    ),
                );
              })();
              await this.manualReviewToolService.enqueue({
                orgId,
                payload: {
                  kind: 'DEFAULT',
                  reportHistory: [],
                  item: itemSubmissionToItemSubmissionWithTypeIdentifier(
                    fullAuthor,
                  ),
                  reportedForReason: null,
                  reportedForReasons: [],
                  itemThreadContentItems: threadItems,
                  reportedItems: [
                    {
                      id: fullItemForAuthor.itemId,
                      typeId: fullItemForAuthor.itemType.id,
                    },
                    ...(reportedItems ? reportedItems : []),
                  ],
                },
                createdAt: new Date(),
                // TODO: Fix enqueue source for non-Post Actions/Rule Execution sources
                ...(actionSource === 'post-actions'
                  ? {
                      enqueueSource: 'POST_ACTIONS',
                      enqueueSourceInfo: {
                        kind: 'POST_ACTIONS',
                      },
                    }
                  : {
                      enqueueSource: 'RULE_EXECUTION',
                      enqueueSourceInfo: {
                        kind: 'RULE_EXECUTION',
                        rules: rules.map((x) => x.id),
                      },
                    }),
                correlationId,
                policyIds: policies.map((it) => it.id),
              });

              return true;
            default:
              assertUnreachable(action);
          }
        } catch (e) {
          span.recordException(e as Exception);
          // Log to stderr so operators see action failures without having
          // to pull traces. Identifiers only, no item `data`.
          // eslint-disable-next-line no-console
          console.error(
            jsonStringify({
              event: 'actionPublisher.publishAction.failed',
              orgId,
              actionId: action.id,
              actionName: action.name,
              actionType: action.actionType,
              itemId: targetItem.itemId,
              itemTypeId: targetItem.itemType.id,
              itemTypeKind: targetItem.itemType.kind,
              correlationId,
              error: e instanceof Error ? e.message : String(e),
            }),
          );
          return false;
        }
      },
    );
  }
}

export default inject(
  [
    'ActionExecutionLogger',
    'Tracer',
    'fetchHTTP',
    'SigningKeyPairService',
    'ManualReviewToolService',
    'NcmecService',
    'ItemInvestigationService',
    'UserStrikeService',
    'getItemTypeEventuallyConsistent',
  ],
  ActionPublisher,
);
export { ActionPublisher };
