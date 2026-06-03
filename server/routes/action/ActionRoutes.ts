import { type ItemIdentifier } from '@roostorg/coop-types';
import { type JsonObject, type JsonValue } from 'type-fest';

import { MAX_ACTOR_NOTE_LENGTH } from '../../services/moderationConfigService/index.js';
import { createApiKeyMiddleware } from '../../utils/apiKeyMiddleware.js';
import { type JSONSchemaV4 } from '../../utils/json-schema-types.js';
import { route } from '../../utils/route-helpers.js';
import { type Controller } from '../index.js';
import submitAction from './submitAction.js';

export type SubmitActionInput = JsonObject & {
  actionId: string;
  itemId: string;
  itemTypeId: string;
  policyIds?: string[];
  reportedItems?: ItemIdentifier[];
  actorId?: string;
  /**
   * Optional moderator-supplied parameter values. Validated against the
   * action's parameter spec server-side in `submitAction.ts` before publish;
   * the body schema only enforces it's a JSON object so the imperative
   * validator has something well-formed to inspect.
   */
  parameters?: Record<string, JsonValue>;
  /** Optional moderator note. Sent to the webhook as `actorNote`. */
  note?: string;
};

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
export default {
  pathPrefix: '/actions',
  routes: [
    route.post<SubmitActionInput, undefined>(
      '/',
      {
        // The `parameters` property accepts an arbitrary JSON object whose
        // shape is validated imperatively in `submitAction.ts` against the
        // action's stored spec. AJV draft-04 forbids `required: []`, but the
        // inferred TS schema type for `Record<string, JsonValue>` demands a
        // (non-empty) `required` array, so we cast the whole `bodySchema`
        // once and rely on the runtime AJV check to catch any drift.
        bodySchema: {
          $schema: 'http://json-schema.org/draft-04/schema#',
          title: 'ActionInputModel',
          type: 'object',
          properties: {
            actionId: {
              type: 'string',
            },
            itemId: {
              type: 'string',
            },
            itemTypeId: {
              type: 'string',
            },
            policyIds: {
              type: 'array',
              items: {
                type: 'string',
              },
            },
            reportedItems: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: {
                    type: 'string',
                  },
                  typeId: {
                    type: 'string',
                  },
                },
                required: ['id', 'typeId'],
              },
            },
            actorId: {
              type: 'string',
            },
            parameters: {
              type: 'object',
              additionalProperties: true,
            },
            note: {
              type: 'string',
              maxLength: MAX_ACTOR_NOTE_LENGTH,
            },
          },
          required: ['actionId', 'itemId', 'itemTypeId'],
        } as unknown as JSONSchemaV4<SubmitActionInput>,
      },
      (deps) => [
        createApiKeyMiddleware<SubmitActionInput, undefined>(deps),
        submitAction(deps),
      ],
    ),
  ],
} as Controller;
