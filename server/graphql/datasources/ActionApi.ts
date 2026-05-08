import { type Exception } from '@opentelemetry/api';
import pLimit from 'p-limit';
import { v1 as uuidv1 } from 'uuid';

import { inject, type Dependencies } from '../../iocContainer/index.js';
import {
  parseStoredParameters,
  validateActionParameterValues,
  validateActorNote,
  type Action,
} from '../../services/moderationConfigService/index.js';
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
      parameters,
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
      parameters: parameters ?? undefined,
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
      parameters,
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
        parameters: parameters === undefined ? undefined : (parameters ?? []),
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

  async bulkExecuteActions(opts: {
    itemIds: readonly string[];
    actionIds: readonly string[];
    itemTypeId: string;
    policyIds: readonly string[];
    orgId: string;
    actorId: string;
    actorEmail: string;
    /**
     * Map of `actionId` -> `{ paramName: value }` carrying moderator-supplied
     * runtime parameter values. Validated per-action against each action's
     * stored spec; rejects with a 400 if any value is missing/wrong-type.
     */
    actionIdToParameters?: Record<string, Record<string, unknown>> | null;
    /**
     * Optional moderator note. Forwarded to the action's webhook as
     * `actorNote` and persisted in the audit log (PR 3).
     */
    actorNote?: string | null;
  }) {
    const {
      itemIds,
      actionIds,
      itemTypeId,
      policyIds,
      orgId,
      actorId,
      actorEmail,
      actionIdToParameters,
      actorNote,
    } = opts;

    validateActorNote(actorNote);

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

    // Validate moderator-supplied parameter values once per action up front;
    // throws BadRequestError before any side-effecting publish if any value
    // doesn't match its spec.
    const validatedParameters = this.#validateParametersForActions(
      actions,
      actionIdToParameters ?? null,
    );

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

          const triggered = actions.map((action) => ({
            action,
            matchingRules: undefined,
            ruleEnvironment: undefined,
            policies,
            customMrtApiParamDecisionPayload: validatedParameters.get(
              action.id,
            ),
          }));

          // If the item isn't found, pass it along to the action publisher
          // anyway without the full submission. We lose some logging fidelity
          // but it's better than refusing to submit, and the item may have
          // never been submitted to us at all.
          const targetItem = itemSubmission ?? {
            itemId,
            itemType: {
              id: itemType.id,
              kind: itemType.kind,
              name: itemType.name,
            },
          };
          return this.actionPublisher.publishActions(triggered, {
            orgId,
            correlationId,
            targetItem,
            actorId,
            actorEmail,
            actorNote: actorNote ?? undefined,
          });
        }),
      ),
    );
  }

  /**
   * Validate the supplied per-action parameter map against each action's
   * stored spec and return a Map of `actionId -> validated values`. Actions
   * with no supplied values and no required parameters get `undefined` (no
   * entry in the result Map) so the publisher can treat absence as
   * "no runtime params for this action".
   */
  #validateParametersForActions(
    actions: readonly Action[],
    rawByActionId: Readonly<Record<string, Record<string, unknown>>> | null,
  ): Map<string, Record<string, unknown> | undefined> {
    const out = new Map<string, Record<string, unknown> | undefined>();
    for (const action of actions) {
      const spec = parseStoredParameters(
        action.actionType === 'CUSTOM_ACTION'
          ? action.customMrtApiParams
          : null,
      );
      const supplied = rawByActionId?.[action.id];
      if (
        spec.length === 0 &&
        (supplied === undefined || Object.keys(supplied).length === 0)
      ) {
        // No spec, no values — nothing to do for this action.
        continue;
      }
      // Throws BadRequestError on missing required, type mismatch, unknown
      // keys, etc. Validation runs even when no values are supplied so that
      // missing-required-with-no-default is caught.
      const validated = validateActionParameterValues(spec, supplied ?? null);
      out.set(
        action.id,
        Object.keys(validated).length > 0 ? validated : undefined,
      );
    }
    return out;
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
export { ActionAPI };
