import { type Exception } from '@opentelemetry/api';
import { type UnwrapOpaque } from 'type-fest';
import { v1 as uuidv1 } from 'uuid';

import { type Dependencies } from '../../iocContainer/index.js';
import { isTaggedItemData } from '../../models/rules/item-type-fields.js';
import {
  parseDerivedFieldSpec,
  type DerivedFieldSpec,
} from '../../services/derivedFieldsService/index.js';
import {
  makeSubmissionId,
  toNormalizedItemDataOrErrors,
  type ItemSubmission,
  type RawItemData,
} from '../../services/itemProcessingService/index.js';
import {
  CoopInput,
  type ItemType,
} from '../../services/moderationConfigService/index.js';
import {
  fromCorrelationId,
  toCorrelationId,
} from '../../utils/correlationIds.js';
import { type B64UrlOf, type JsonOf } from '../../utils/encoding.js';
import {
  CoopError,
  ErrorType,
  makeBadRequestError,
  makeInternalServerError,
  sanitizeError,
  type SerializableError,
} from '../../utils/errors.js';
import { safeGet, safePick, sleep } from '../../utils/misc.js';
import { type RequestHandlerWithBodies } from '../../utils/route-helpers.js';
import { instantiateOpaqueType } from '../../utils/typescript-types.js';
import { hasOrgId } from '../../utils/apiKeyMiddleware.js';
import {
  type EvaluateContentInputCamelCase,
  type EvaluateContentOutput,
} from './ContentRoutes.js';

export default function submitContent({
  ContentApiLogger,
  RuleEngine,
  Tracer,
  ModerationConfigService,
  Meter,
}: // @ts-ignore
Dependencies): RequestHandlerWithBodies<
  EvaluateContentInputCamelCase,
  EvaluateContentOutput
> {
  return async (req, res, next) => {
    const replyNowPromise = sleep(24_000);

    // Generate an id for this request to correlate logs. It doesn't need to be
    // random for security (i.e., uuidv4), and making it time-based could
    // actually be convenient, so that's what we do. We'll eventually get much
    // more sophisticated about how we pass this around (continuation local
    // storage? injected logger instances?), but this is fine for now.
    const requestId = toCorrelationId({ type: 'post-content', id: uuidv1() });

    Meter.itemSubmissionsCounter.add(1);

    // If the caller asks for derived field values to be returned, validate and
    // determine the specs they're asking for.
    const requestedDerivedFields = (() => {
      try {
        // NB: here, we parse the url w/ UrlSearchParams for simplicity and
        // safety, as qs has lots of edge cases. We pass a dummy base url
        // (example.com) because `req.originalUrl` will be a relative url, which
        // will cause the URL constructor to throw if no base is given.
        //
        // Rather than make our own syntax for passing an array (with
        // comma-separated lists or some `param[]=` syntax like qs uses), we'll
        // just make callers repeat the query param name, and `getAll` will
        // return an array of the values.
        return new URL(req.originalUrl, 'http://example.com/').searchParams
          .getAll('includeDerivedField')
          .map(
            (it) =>
              [
                it,
                // NB: cast here is definitely not guaranteed to be accurate,
                // but, if the runtime value doesn't match the expected type,
                // parseDerivedFieldSpec will just throw.
                parseDerivedFieldSpec(it as B64UrlOf<JsonOf<DerivedFieldSpec>>),
              ] as const,
          );
      } catch (e) {
        return makeBadRequestError('Invalid derived field requested.', {
          requestId: fromCorrelationId(requestId),
          cause: e,
          shouldErrorSpan: true,
        });
      }
    })();

    if (requestedDerivedFields instanceof CoopError) {
      return next(requestedDerivedFields);
    }

    // Get orgId from request (set by API key middleware)
    if (!hasOrgId(req)) {
      return next(
        makeBadRequestError('Invalid API Key', {
          detail:
            'Something went wrong finding or validating your API key. ' +
            'Make sure the proper key is provided in the x-api-key header.',
          requestId: fromCorrelationId(requestId),
          shouldErrorSpan: true,
        }),
      );
    }
    
    const { orgId } = req;
    const activeSpan = Tracer.getActiveSpan();
    if (activeSpan?.isRecording()) {
      activeSpan.setAttribute('orgId', orgId);
    }

    // We have two cases to handle:
    // 1. The request has sync = false. In this case, we should execute this request asynchronously,
    //    which means we should return a `202` response immediately, and then continue executing our
    //     RuleEngine logic.
    // 2. The request has sync = true. In this case, we should execute the request synchronously AND
    //    skip batching when we write to the outbox table. This supports our low volume, low latency
    //    requirements for smaller, latency-sensitive users.

    const shouldReturnImmediately =
      'contentId' in req.body && !Boolean(req.body.sync);
    const skipSnowflakeEventualWriteBatch =
      'contentId' in req.body && Boolean(req.body.sync);

    const { body } = req;

    // Fetch ContentType from the passed in content_type string
    // TODO: error handling. Our controllers still need much better error
    // handling abstractions.
    const contentTypeName = body.contentType;
    const itemTypes = await ModerationConfigService.getItemTypes({
      orgId,
      directives: { maxAge: 10 },
    });
    const defaultUserType = await ModerationConfigService.getDefaultUserType({
      orgId,
      directives: { maxAge: 10 },
    });
    const contentItemType = itemTypes.find((it) => it.name === contentTypeName);

    if (contentItemType == null) {
      // TODO: Also log an error in the cases where we couldn't find the itemType
      // which is when itemSubmission is undefined
      return next(
        makeBadRequestError('Content type not found', {
          type: [ErrorType.UnrecognizedContentType],
          detail: `We could not find a ContentType created by your organization called ${contentTypeName}`,
          requestId: fromCorrelationId(requestId),
          shouldErrorSpan: true,
        }),
      );
    }

    // TODO: Let caller pass in a content type version to use.
    // For now, we always use the latest version.
    const itemSubmissionOrError = rawContentSubmissionToItemSubmission(
      itemTypes.map((it) => it.id),
      body,
      defaultUserType.id,
      contentItemType,
    );

    if (itemSubmissionOrError.error) {
      await ContentApiLogger.logContentApiRequest<true>(
        {
          requestId,
          orgId,
          itemSubmission: itemSubmissionOrError.itemSubmission,
          failureReason: `Content submission failed validation: ${itemSubmissionOrError.error.errors
            .map((it) => (it instanceof Error ? it.message : ''))
            .join('\n')}`,
        },
        skipSnowflakeEventualWriteBatch,
      );

      return next(itemSubmissionOrError.error);
    }

    // See comment above definition of shouldReturnImmediately - return 202 immediately,
    // then keep executing other code
    if (shouldReturnImmediately) {
      res.status(202).end();
    }

    // Run rules
    try {
      const results = await RuleEngine.runEnabledRules(
        itemSubmissionOrError.itemSubmission,
        requestId,
        skipSnowflakeEventualWriteBatch,
      );

      await ContentApiLogger.logContentApiRequest(
        {
          requestId,
          orgId,
          itemSubmission: itemSubmissionOrError.itemSubmission,
          failureReason: undefined,
        },
        skipSnowflakeEventualWriteBatch,
      );

      // Load the requested derived fields
      const derivedFieldEntries = await Promise.race([
        Promise.all(
          requestedDerivedFields.map(async ([fieldId, fieldSpec]) => {
            const derivedValue = await results.getDerivedFieldValue(fieldSpec);
            const finalValue = (() => {
              if (derivedValue instanceof CoopError) {
                return sanitizeError(
                  derivedValue,
                ) satisfies SerializableError as SerializableError;
              } else if (derivedValue === undefined) {
                // JSON doesn't have undefined, ofc, so we have to decide whether
                // to omit the key or return null. For clients, it's probably more
                // intuitive to get null.
                return null;
              } else if (isTaggedItemData(derivedValue)) {
                return derivedValue.data;
              } else {
                // For tagged scalars, we return the value only, because, the
                // overwhelming majority of the time, the consumer will not need
                // the type tag and (at least for now) I think it's more valuable
                // not make our tagged scalar format a part of the public API
                // contract than it is to help clients handle edge cases where
                // they might benefit from having the type tag.
                return Array.isArray(derivedValue)
                  ? derivedValue.map((it) => it.value)
                  : derivedValue.value;
              }
            })();

            return [fieldId, { value: finalValue, field: fieldSpec }] as const;
          }),
        ),
        replyNowPromise.then(() => {
          const transcription =
            'eyJzb3VyY2UiOnsidHlwZSI6IkNPTlRFTlRfUFJPVEVHT19JTlBVVCIsIm5hbWUiOiJBbnkgdmlkZW8ifSwiZGVyaXZhdGlvblR5cGUiOiJWSURFT19UUkFOU0NSSVBUSU9OIn0=';
          return [
            [
              transcription,
              {
                value: [''],
                field: {
                  source: {
                    type: 'CONTENT_COOP_INPUT',
                    name: CoopInput.ANY_VIDEO,
                  },
                  derivationType: 'VIDEO_TRANSCRIPTION',
                },
              },
            ],
          ];
        }),
      ]);

      const actionsTriggered = await Promise.race([
        replyNowPromise.then(() => []),
        results.actionsTriggered,
      ]);

      if (!shouldReturnImmediately) {
        return res.status(200).send({
          // TODO: make nullable or otherwise able to reflect the reality that
          // this actions list is "best effort" (i.e., we might not have the
          // real list before the time limit's up).
          actionsTriggered: actionsTriggered.map((it) =>
            safePick(it, ['id', 'name']),
          ),
          derivedFields: Object.fromEntries(derivedFieldEntries),
        });
      }
    } catch (e: unknown) {
      const activeSpan = Tracer.getActiveSpan();
      if (activeSpan?.isRecording()) {
        activeSpan.recordException(e as Exception);
      }
      await ContentApiLogger.logContentApiRequest(
        {
          requestId,
          orgId,
          itemSubmission: itemSubmissionOrError.itemSubmission,
          failureReason: `Rules failed to run for content: ${String(
            safeGet(e, ['message']),
          )}`,
        },
        skipSnowflakeEventualWriteBatch,
      );

      return next(
        makeInternalServerError(
          'One or more rules failed to run on the provided content.',
          { requestId: fromCorrelationId(requestId), shouldErrorSpan: true },
        ),
      );
    }
  };
}

function rawContentSubmissionToItemSubmission(
  legalItemTypeIds: readonly string[],
  rawContentSubmission: {
    userId?: string | undefined;
    contentType: string;
    contentId: string;
    content: RawItemData;
  },
  defaultUserTypeId: string,
  itemType: ItemType,
):
  | {
      itemSubmission: Omit<UnwrapOpaque<ItemSubmission>, 'data'> & {
        data: RawItemData;
      };
      error: AggregateError;
    }
  | { itemSubmission: ItemSubmission; error?: undefined } {
  const submissionTime = new Date();

  // Validate content JSON
  const normalizedDataOrValidationErrors = toNormalizedItemDataOrErrors(
    legalItemTypeIds,
    itemType,
    rawContentSubmission.content,
  );

  return Array.isArray(normalizedDataOrValidationErrors)
    ? {
        itemSubmission: {
          submissionId: makeSubmissionId(),
          submissionTime,
          itemId: rawContentSubmission.contentId,
          data: rawContentSubmission.content,
          // NB: this truthiness check on userId intentionally covers undefined,
          // null, _and the empty string_, which users sometimes send us,
          // but which we don't want to treat as a user id.
          creator: rawContentSubmission.userId
            ? { id: rawContentSubmission.userId, typeId: defaultUserTypeId }
            : undefined,
          itemType,
        },
        error: new AggregateError(normalizedDataOrValidationErrors),
      }
    : {
        itemSubmission: instantiateOpaqueType<ItemSubmission>({
          submissionId: makeSubmissionId(),
          submissionTime,
          itemId: rawContentSubmission.contentId,
          data: normalizedDataOrValidationErrors,
          // NB: this truthiness check on userId intentionally covers undefined,
          // null, _and the empty string_, which users sometimes send us,
          // but which we don't want to treat as a user id.
          creator: rawContentSubmission.userId
            ? { id: rawContentSubmission.userId, typeId: defaultUserTypeId }
            : undefined,
          itemType,
        }),
      };
}
