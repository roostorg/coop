import { type Exception } from '@opentelemetry/api';
import { DataSource } from 'apollo-datasource';
import pLimit from 'p-limit';
import { uid } from 'uid';
import { v1 as uuidv1 } from 'uuid';

import { inject, type Dependencies } from '../../iocContainer/index.js';
import { isUniqueConstraintError } from '../../models/errors.js';
import {
  type CollapsedSequelizeAction,
  type CustomAction,
  type SequelizeAction,
} from '../../models/rules/ActionModel.js';
import {
  ActionType,
  type Action,
} from '../../services/moderationConfigService/index.js';
// TODO: delete the import below when we move the action mutation logic into the
// moderation config service, which is where it should be.
// eslint-disable-next-line import/no-restricted-paths
import { makeActionNameExistsError } from '../../services/moderationConfigService/modules/ActionOperations.js';
import { toCorrelationId } from '../../utils/correlationIds.js';
import { patchInPlace } from '../../utils/misc.js';
import { type CollapseCases } from '../../utils/typescript-types.js';
import {
  type GQLCreateActionInput,
  type GQLUpdateActionInput,
} from '../generated.js';

/**
 * GraphQL Object for an Action
 */
class ActionAPI extends DataSource {
  constructor(
    private readonly actionPublisher: Dependencies['ActionPublisher'],
    private readonly sequelize: Dependencies['Sequelize'],
    private readonly tracer: Dependencies['Tracer'],
    private readonly itemInvestigationService: Dependencies['ItemInvestigationService'],
    private readonly getItemTypeEventuallyConsistent: Dependencies['getItemTypeEventuallyConsistent'],
  ) {
    super();
  }

  async getGraphQLActionFromId(opts: { id: string; orgId: string }) {
    const { id, orgId } = opts;
    const action = await this.sequelize.Action.findOne({
      where: { id, orgId },
      rejectOnEmpty: true,
    });

    return action satisfies CollapsedSequelizeAction as SequelizeAction;
  }

  async getGraphQLActionsFromIds(orgId: string, ids: readonly string[]) {
    return (await this.sequelize.Action.findAll({
      where: { orgId, id: ids },
    })) satisfies CollapsedSequelizeAction[] as SequelizeAction[];
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
    const action = this.sequelize.Action.build({
      id: uid(),
      name,
      description,
      callbackUrl,
      callbackUrlHeaders,
      callbackUrlBody,
      orgId,
      penalty: 'NONE',
      applyUserStrikes: applyUserStrikes ?? false,
      actionType: ActionType.CUSTOM_ACTION,
      appliesToAllItemsOfKind: [],
    }) as CustomAction;

    try {
      await this.sequelize.transactionWithRetry(async () => {
        await action.save();
        await action.addContentTypes([...itemTypeIds]);
        await action.save();
      });
    } catch (e: unknown) {
      throw isUniqueConstraintError(e)
        ? makeActionNameExistsError({ shouldErrorSpan: true })
        : e;
    }

    return action;
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

    const action = (await this.sequelize.Action.findOne({
      where: { id, orgId, actionType: ActionType.CUSTOM_ACTION },
      rejectOnEmpty: true,
    })) as CustomAction;
    patchInPlace(action, {
      name: name ?? undefined,
      description,
      callbackUrl: callbackUrl ?? undefined,
      callbackUrlHeaders,
      callbackUrlBody,
      applyUserStrikes: applyUserStrikes ?? undefined,
    });

    try {
      await this.sequelize.transactionWithRetry(async () => {
        if (itemTypeIds) {
          await action.setContentTypes([...itemTypeIds]);
        }
        await action.save();
      });
    } catch (e: unknown) {
      throw isUniqueConstraintError(e)
        ? makeActionNameExistsError({ shouldErrorSpan: true })
        : e;
    }

    return action;
  }

  async deleteAction(orgId: string, id: string) {
    try {
      const action = await this.sequelize.Action.findOne({
        where: { id, orgId, actionType: ActionType.CUSTOM_ACTION },
      });
      await action?.destroy();
    } catch (exception) {
      const activeSpan = this.tracer.getActiveSpan();
      if (activeSpan?.isRecording()) {
        activeSpan.recordException(exception as Exception);
      }

      return false;
    }
    return true;
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
      this.sequelize.Action.findAll({
        where: { id: actionIds, orgId },
      }) satisfies Promise<CollapseCases<Action>[]> as Promise<Action[]>,
      this.sequelize.Policy.findAll({ where: { id: policyIds, orgId } }),
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
                  itemType: { id: itemType.id, kind: itemType.kind },
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
    'Sequelize',
    'Tracer',
    'ItemInvestigationService',
    'getItemTypeEventuallyConsistent',
  ],
  ActionAPI,
);
export type { ActionAPI };
