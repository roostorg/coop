import { type Exception } from '@opentelemetry/api';
import pLimit from 'p-limit';
import { v1 as uuidv1 } from 'uuid';

import { inject, type Dependencies } from '../../iocContainer/index.js';
import { toCorrelationId } from '../../utils/correlationIds.js';
import { makeNotFoundError } from '../../utils/errors.js';
import {
  type GQLCreateActionInput,
  type GQLUpdateActionInput,
} from '../generated.js';

/**
 * GraphQL Object for an Action
 */
class ActionAPI {
  constructor(
    private readonly actionPublisher: Dependencies['ActionPublisher'],
    private readonly moderationConfigService: Dependencies['ModerationConfigService'],
    private readonly tracer: Dependencies['Tracer'],
    private readonly itemInvestigationService: Dependencies['ItemInvestigationService'],
    private readonly getItemTypeEventuallyConsistent: Dependencies['getItemTypeEventuallyConsistent'],
  ) {}

  async getGraphQLActionFromId(opts: { id: string; orgId: string }) {
    const { id, orgId } = opts;
    const actions = await this.moderationConfigService.getActions({
      orgId,
      ids: [id],
      readFromReplica: false,
    });
    const action = actions.at(0);
    if (action === undefined) {
      throw makeNotFoundError('Action not found', { shouldErrorSpan: true });
    }
    return action;
  }

  async getGraphQLActionsFromIds(orgId: string, ids: readonly string[]) {
    if (ids.length === 0) {
      return [];
    }
    return this.moderationConfigService.getActions({
      orgId,
      ids,
      readFromReplica: false,
    });
  }

  async createAction(input: GQLCreateActionInput, orgId: string) {
    const {
      name,
      description,
      itemTypeIds,
      callbackUrl,
      callbackUrlHeaders,
      callbackUrlBody,
      applyUserStrikes,
    } = input;

    return this.moderationConfigService.createAction(orgId, {
      name,
      description: description ?? null,
      type: 'CUSTOM_ACTION',
      callbackUrl,
      callbackUrlHeaders: callbackUrlHeaders ?? null,
      callbackUrlBody: callbackUrlBody ?? null,
      applyUserStrikes: applyUserStrikes ?? undefined,
      itemTypeIds,
    });
  }

  async updateAction(input: GQLUpdateActionInput, orgId: string) {
    const {
      id,
      name,
      description,
      itemTypeIds,
      callbackUrl,
      callbackUrlHeaders,
      callbackUrlBody,
      applyUserStrikes,
    } = input;

    return this.moderationConfigService.updateCustomAction(orgId, {
      actionId: id,
      patch: {
        name: name ?? undefined,
        description,
        callbackUrl: callbackUrl ?? undefined,
        callbackUrlHeaders,
        callbackUrlBody,
        applyUserStrikes: applyUserStrikes ?? undefined,
      },
      itemTypeIds: itemTypeIds ?? undefined,
    });
  }

  async deleteAction(orgId: string, id: string) {
    try {
      return await this.moderationConfigService.deleteCustomAction({
        orgId,
        actionId: id,
      });
    } catch (exception) {
      const activeSpan = this.tracer.getActiveSpan();
      if (activeSpan?.isRecording()) {
        activeSpan.recordException(exception as Exception);
      }

      return false;
    }
  }

  async bulkExecuteActions(
    itemIds: readonly string[],
    actionIds: readonly string[],
    itemTypeId: string,
    policyIds: readonly string[],
    orgId: string,
    actorId: string,
    actorEmail: string,
  ) {
    const [actions, policies, itemType] = await Promise.all([
      this.moderationConfigService.getActions({
        orgId,
        ids: actionIds,
        readFromReplica: false,
      }),
      this.moderationConfigService.getPoliciesByIds({
        orgId,
        ids: policyIds,
        readFromReplica: false,
      }),
      this.getItemTypeEventuallyConsistent({
        orgId,
        typeSelector: { id: itemTypeId },
      }),
    ]);

    if (itemType === undefined) {
      throw new Error(`Item type ${itemTypeId} not found for org ${orgId}`);
    }

    const correlationId = toCorrelationId({
      type: 'manual-action-run',
      id: uuidv1(),
    });
    // Limit the number of concurrent requests to avoid overwhelming the
    // custom action endpoints
    const limit = pLimit(10);
    return Promise.all(
      itemIds.map(async (itemId) =>
        limit(async () => {
          const itemSubmission = (
            await this.itemInvestigationService.getItemByIdentifier({
              orgId,
              itemIdentifier: {
                id: itemId,
                typeId: itemTypeId,
              },
              latestSubmissionOnly: true,
            })
          )?.latestSubmission;

          // If the item isn't found, pass it along to the action publisher anyway
          // without the full submission. In this case, we'll be losing some
          // information in the logging but it's better than not submitting the
          // action at all, and it's possible that the item was never submitted to
          // us at all.
          if (itemSubmission === undefined) {
            return this.actionPublisher.publishActions(
              actions.map((action) => ({
                action,
                matchingRules: undefined,
                ruleEnvironment: undefined,
                policies,
              })),
              {
                orgId,
                correlationId,
                targetItem: {
                  itemId,
                  itemType: { id: itemType.id, kind: itemType.kind, name: itemType.name },
                },
                actorId,
                actorEmail,
              },
            );
          }
          return this.actionPublisher.publishActions(
            actions.map((action) => ({
              action,
              matchingRules: undefined,
              ruleEnvironment: undefined,
              policies,
            })),
            {
              orgId,
              correlationId,
              targetItem: itemSubmission,
              actorId,
              actorEmail,
            },
          );
        }),
      ),
    );
  }
}

export default inject(
  [
    'ActionPublisher',
    'ModerationConfigService',
    'Tracer',
    'ItemInvestigationService',
    'getItemTypeEventuallyConsistent',
  ],
  ActionAPI,
);
export type { ActionAPI };
