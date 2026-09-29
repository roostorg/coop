import { type ItemIdentifier } from '@roostorg/coop-types';
import * as v from 'valibot';

import { type Dependencies } from '../../iocContainer/index.js';
import { inject } from '../../iocContainer/utils.js';
import { type GetItemTypesForOrgEventuallyConsistent } from '../../rule_engine/ruleEngineQueries.js';
import { jsonStringify } from '../../utils/encoding.js';
import {
  CoopError,
  ErrorType,
  type ErrorInstanceData,
} from '../../utils/errors.js';
import { safePick } from '../../utils/misc.js';
import { rawItemSubmissionSchema } from '../itemProcessingService/index.js';
import {
  rawItemSubmissionToItemSubmission,
  type ItemSubmission,
} from '../itemProcessingService/makeItemSubmission.js';
import { type GetItemTypeEventuallyConsistent } from '../moderationConfigService/moderationConfigServiceQueries.js';
import { type FetchHTTP } from '../networkingService/index.js';
import { type OrgSettingsService } from '../orgSettingsService/orgSettingsService.js';
import { isJsonParseFailure } from './isJsonParseFailure.js';

// Extra top-level keys are accepted but ignored.
const partialItemsResponseSchema = v.looseObject({
  items: v.array(rawItemSubmissionSchema),
});

function makePartialItemsService(
  orgSettingsService: OrgSettingsService,
  fetchHttp: FetchHTTP,
  getItemTypesForOrgEventuallyConsistent: GetItemTypesForOrgEventuallyConsistent,
  getItemTypeEventuallyConsistent: GetItemTypeEventuallyConsistent,
  signingKeyPairService: Dependencies['SigningKeyPairService'],
  tracer: Dependencies['Tracer'],
) {
  return {
    async getPartialItems(
      orgId: string,
      itemsToFetch: readonly ItemIdentifier[],
    ): Promise<ItemSubmission[]> {
      return tracer.addSpan(
        {
          resource: 'partialItemsService',
          operation: 'getPartialItemsOrThrow',
        },
        async (span) => {
          span.setAttribute('request.orgId', orgId);
          span.setAttribute(
            'request.itemsToFetch',
            jsonStringify(itemsToFetch),
          );

          const partialItemsInfo =
            await orgSettingsService.partialItemsInfo(orgId);

          const partialItemsEndpoint = partialItemsInfo?.partialItemsEndpoint;

          if (partialItemsEndpoint == null) {
            throw makePartialItemsEndpointMissingError({
              shouldErrorSpan: false,
            });
          }

          const partialItemsRequestHeaders =
            partialItemsInfo?.partialItemsRequestHeaders ?? {};

          const response = await fetchHttp({
            url: partialItemsEndpoint,
            method: 'post',
            headers: {
              'Content-Type': 'application/json',
              ...partialItemsRequestHeaders,
            },
            body: jsonStringify({
              items: itemsToFetch.map((it) => safePick(it, ['id', 'typeId'])),
            }),
            handleResponseBody: 'as-json',
            logRequestAndResponseBody: 'ON_FAILURE',
            signWith: signingKeyPairService.sign.bind(
              signingKeyPairService,
              orgId,
            ),
          }).catch((e: unknown) => {
            // Surface JSON parse failures as a typed GraphQL error instead of
            // letting them bubble up as an opaque "Unknown error".
            if (isJsonParseFailure(e)) {
              throw makePartialItemsEndpointInvalidResponseError({
                shouldErrorSpan: true,
                cause: e,
              });
            }
            throw e;
          });

          if (!response.ok) {
            throw makePartialItemsEndpointResponseError(response.status, {
              shouldErrorSpan: true,
            });
          }

          const responseBodyResult = v.safeParse(
            partialItemsResponseSchema,
            response.body,
          );
          if (!responseBodyResult.success) {
            span.setAttribute('response.body', jsonStringify(response.body));
            throw makePartialItemsEndpointInvalidResponseError({
              shouldErrorSpan: true,
            });
          }
          const responseBody = responseBodyResult.output;

          // Create a unique string "key" for each item that we can use to verify
          // that the returned items were the ones we requested.
          const keyForItem = (it: ItemIdentifier) =>
            jsonStringify({ id: it.id, typeId: it.typeId });

          const expectedItemKeys = new Set(
            itemsToFetch.map((it) => keyForItem(it)),
          );

          return Promise.all(
            responseBody.items
              // This step filters out any items returned that we didn't request
              .filter((it) =>
                expectedItemKeys.has(
                  keyForItem({
                    id: it.id,
                    typeId: 'type' in it ? it.type.id : it.typeId,
                  }),
                ),
              )
              .map(async (item) => {
                const { error, itemSubmission } =
                  await rawItemSubmissionToItemSubmission(
                    await getItemTypesForOrgEventuallyConsistent(orgId),
                    orgId,
                    getItemTypeEventuallyConsistent,
                    { ...item, typeSchemaVariant: 'partial' },
                  );

                if (error) {
                  throw makePartialItemsEndpointInvalidResponseError({
                    shouldErrorSpan: true,
                  });
                }

                return itemSubmission;
              }),
          );
        },
      );
    },

    async getPartialItem(orgId: string, itemIdentifier: ItemIdentifier) {
      const partialItems = await this.getPartialItems(orgId, [itemIdentifier]);
      return partialItems[0] as (typeof partialItems)[number] | undefined;
    },
  };
}

export default inject(
  [
    'OrgSettingsService',
    'fetchHTTP',
    'getItemTypesForOrgEventuallyConsistent',
    'getItemTypeEventuallyConsistent',
    'SigningKeyPairService',
    'Tracer',
  ],
  makePartialItemsService,
);
export type PartialItemsService = ReturnType<typeof makePartialItemsService>;

export const makePartialItemsEndpointMissingError = (data: ErrorInstanceData) =>
  new CoopError({
    status: 404,
    type: [ErrorType.NotFound],
    title: 'Get More Info Endpoint Missing',
    name: 'PartialItemsMissingEndpointError',
    ...data,
  });

export const makePartialItemsEndpointResponseError = (
  status: number,
  data: ErrorInstanceData,
) =>
  new CoopError({
    status,
    type: [ErrorType.NotFound],
    title: 'Get More Info Endpoint Returned Error',
    name: 'PartialItemsEndpointResponseError',
    ...data,
  });

export const makePartialItemsEndpointInvalidResponseError = (
  data: ErrorInstanceData,
) =>
  new CoopError({
    status: 404,
    type: [ErrorType.NotFound],
    title: 'Get More Info Endpoint Returned a malformed response',
    name: 'PartialItemsInvalidResponseError',
    ...data,
  });

export type PartialItemsServiceErrorType =
  | 'PartialItemsMissingEndpointError'
  | 'PartialItemsEndpointResponseError'
  | 'PartialItemsInvalidResponseError';
