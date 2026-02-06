import { v1 as uuidv1 } from 'uuid';

import { type Dependencies } from '../../iocContainer/index.js';
import {
  fromCorrelationId,
  toCorrelationId,
} from '../../utils/correlationIds.js';
import { ErrorType, makeUnauthorizedError } from '../../utils/errors.js';
import { type RequestHandlerWithBodies } from '../../utils/route-helpers.js';
import { hasOrgId } from '../../utils/apiKeyMiddleware.js';
import { type SubmitActionInput } from './ActionRoutes.js';

export default function submitAction({
  ActionPublisher,
  ModerationConfigService,
  getItemTypeEventuallyConsistent,
  UserAPIDataSource,
}: // @ts-ignore
Dependencies): RequestHandlerWithBodies<SubmitActionInput, undefined> {
  return async (req, res, next) => {
    const requestId = toCorrelationId({ type: 'post-actions', id: uuidv1() });

    // Get orgId from request (set by API key middleware)
    if (!hasOrgId(req)) {
      return next(
        makeUnauthorizedError('Invalid API Key', {
          detail:
            'Something went wrong finding or validating your API key. ' +
            'Make sure the proper key is provided in the x-api-key header.',
          requestId: fromCorrelationId(requestId),
          shouldErrorSpan: true,
        }),
      );
    }
    
    const { orgId } = req;

    const { body } = req;
    const { itemId, itemTypeId, actionId, policyIds, actorId, reportedItems } =
      body;
    const action = (
      await ModerationConfigService.getActions({
        orgId,
        ids: [actionId],
        readFromReplica: true,
      })
    )[0];
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (action === undefined) {
      return next({
        status: 400,
        type: [ErrorType.InvalidUserInput],
        title: 'Invalid Action',
        detail: `Couldn\'t find an action for your org with ID: ${actionId}`,
        requestId: fromCorrelationId(requestId),
      });
    }

    const itemType = await getItemTypeEventuallyConsistent({
      orgId,
      typeSelector: { id: itemTypeId },
    });
    if (itemType === undefined) {
      return next({
        status: 400,
        type: [ErrorType.InvalidUserInput],
        title: 'Invalid Item Type ID',
        detail: `Couldn\'t find an Item Type for your org with ID: ${itemTypeId}`,
        requestId: fromCorrelationId(requestId),
      });
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

    await ActionPublisher.publishActions(
      [
        {
          action,
          matchingRules: undefined,
          ruleEnvironment: undefined,
          policies,
          reportedItems,
        },
      ],
      {
        orgId,
        correlationId: requestId,
        targetItem: { itemId, itemType },
        ...(user ? { actorId: user.id, actorEmail: user.email } : {}),
      },
    );

    res.status(202).end();
    return;
  };
}
