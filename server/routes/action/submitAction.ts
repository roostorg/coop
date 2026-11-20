import { v1 as uuidv1 } from 'uuid';

import { type Dependencies } from '../../iocContainer/index.js';
import {
  parseStoredParameters,
  validateActionParameterValues,
} from '../../services/moderationConfigService/index.js';
import { hasOrgId } from '../../utils/apiKeyMiddleware.js';
import {
  fromCorrelationId,
  toCorrelationId,
} from '../../utils/correlationIds.js';
import { ErrorType, makeUnauthorizedError } from '../../utils/errors.js';
import { type RouteHandler } from '../../utils/route-helpers.js';
import { type SubmitActionInput } from './ActionRoutes.js';

export default function submitAction({
  ActionPublisher,
  ModerationConfigService,
  getItemTypeEventuallyConsistent,
  UserAPIDataSource,
}: // @ts-ignore
Dependencies): RouteHandler<SubmitActionInput, undefined> {
  return async (ctx, body) => {
    const requestId = toCorrelationId({ type: 'post-actions', id: uuidv1() });

    // Get orgId from request (set by API key middleware)
    if (!hasOrgId(ctx)) {
      throw makeUnauthorizedError('Invalid API Key', {
        detail:
          'Something went wrong finding or validating your API key. ' +
          'Make sure the proper key is provided in the x-api-key header.',
        requestId: fromCorrelationId(requestId),
        shouldErrorSpan: true,
      });
    }

    const { orgId } = ctx;

    const {
      itemId,
      itemTypeId,
      actionId,
      policyIds,
      actorId,
      reportedItems,
      parameters,
      note,
    } = body;
    const action = (
      await ModerationConfigService.getActions({
        orgId,
        ids: [actionId],
        readFromReplica: true,
      })
    )[0];
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (action === undefined) {
      // Plain error objects, serialized as-is by the exception handler, as
      // they were when passed to Express' `next()`.
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw {
        status: 400,
        type: [ErrorType.InvalidUserInput],
        title: 'Invalid Action',
        detail: `Couldn\'t find an action for your org with ID: ${actionId}`,
        requestId: fromCorrelationId(requestId),
      };
    }

    const itemType = await getItemTypeEventuallyConsistent({
      orgId,
      typeSelector: { id: itemTypeId },
    });
    if (itemType === undefined) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw {
        status: 400,
        type: [ErrorType.InvalidUserInput],
        title: 'Invalid Item Type ID',
        detail: `Couldn\'t find an Item Type for your org with ID: ${itemTypeId}`,
        requestId: fromCorrelationId(requestId),
      };
    }
    const policies = await (async () => {
      if (policyIds === undefined) {
        return [];
      }
      const allPolicies = await ModerationConfigService.getPolicies({
        orgId,
        readFromReplica: true,
      });
      return allPolicies.filter((it) => policyIds.includes(it.id));
    })();

    const user = actorId
      ? await UserAPIDataSource.getGraphQLUserFromId({ id: actorId, orgId })
      : undefined;

    // Validate moderator-supplied parameter values against the action's
    // stored spec before publish. Throws BadRequestError (400) which the
    // exception handler serializes for the client.
    const spec = parseStoredParameters(
      action.actionType === 'CUSTOM_ACTION' ? action.customMrtApiParams : null,
    );
    const validated = validateActionParameterValues(spec, parameters ?? null);
    const validatedParameters =
      Object.keys(validated).length > 0 ? validated : undefined;

    await ActionPublisher.publishActions(
      [
        {
          action,
          matchingRules: undefined,
          ruleEnvironment: undefined,
          policies,
          reportedItems,
          customMrtApiParamDecisionPayload: validatedParameters,
        },
      ],
      {
        orgId,
        correlationId: requestId,
        targetItem: { itemId, itemType },
        actorNote: note,
        ...(user ? { actorId: user.id, actorEmail: user.email } : {}),
      },
    );

    ctx.response.status(202);
    return;
  };
}
