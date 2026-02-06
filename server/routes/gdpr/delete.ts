import { type Kysely } from 'kysely';
import { v1 as uuidv1 } from 'uuid';

import { type Dependencies } from '../../iocContainer/index.js';
import { makeInternalServerError, makeUnauthorizedError } from '../../utils/errors.js';
import { type RequestHandlerWithBodies } from '../../utils/route-helpers.js';
import { hasOrgId } from '../../utils/apiKeyMiddleware.js';
import { type GDPRServicePg } from './dbTypes.js';
import {
  type DeleteRequestInput,
  type DeleteRequestOutput,
} from './gdprRoutes.js';

class itemTypeError extends Error {}
export default function requestDelete({
  KyselyPg,
  getItemTypeEventuallyConsistent,
}: Dependencies): RequestHandlerWithBodies<
  DeleteRequestInput,
  DeleteRequestOutput
> {
  return async (req, res, next) => {
    // Get orgId from request (set by API key middleware)
    if (!hasOrgId(req)) {
      return next(
        makeUnauthorizedError('Invalid API Key', {
          detail:
            'Something went wrong finding or validating your API key. ' +
            'Make sure the proper key is provided in the x-api-key header.',
          shouldErrorSpan: true,
        }),
      );
    }
    
    const { orgId } = req;
    const requestId = uuidv1();
    const { userIds } = req.body;

    try {
      const requestRows = await Promise.all(
        userIds.map(async (userId) => {
          const itemType = await getItemTypeEventuallyConsistent({
            orgId,
            typeSelector: { id: userId.typeId },
          });
          if (!itemType) {
            throw new itemTypeError(
              `typeId '${userId.typeId}', associated with itemId '${userId.id}' does not exist.`,
            );
          }
          return {
            request_id: requestId,
            org_id: orgId,
            item_id: userId.id,
            item_type_id: userId.typeId,
          };
        }),
      );

      await (KyselyPg as Kysely<GDPRServicePg>)
        .insertInto('gdpr_delete_requests')
        .values(requestRows)
        .execute();

      res.status(202).json({
        requestId,
      });
    } catch (e: unknown) {
      if (e instanceof itemTypeError) {
        return next(
          makeInternalServerError(`Failed to submit data deletion request.`, {
            detail: e.message,
            shouldErrorSpan: true,
          }),
        );
      } else {
        return next(
          makeInternalServerError('Failed to submit data deletion request', {
            shouldErrorSpan: true,
          }),
        );
      }
    }
  };
}
