import { type JsonObject } from 'type-fest';
import * as v from 'valibot';

import { MAX_ACTOR_NOTE_LENGTH } from '../../services/moderationConfigService/index.js';
import { createApiKeyMiddleware } from '../../utils/apiKeyMiddleware.js';
import { route } from '../../utils/route-helpers.js';
import { type Controller } from '../index.js';
import getActions, { type GetActionsOutput } from './getActions.js';
import submitAction from './submitAction.js';

const itemIdentifierSchema = v.object({
  id: v.string(),
  typeId: v.string(),
});
const submitActionInputSchema = v.object({
  actionId: v.string(),
  itemId: v.string(),
  itemTypeId: v.string(),
  policyIds: v.optional(v.array(v.string())),
  reportedItems: v.optional(v.array(itemIdentifierSchema)),
  actorId: v.optional(v.string()),
  // Parameter values are checked against the stored action spec in the handler.
  parameters: v.optional(
    v.custom<JsonObject>(
      (input) =>
        typeof input === 'object' && input !== null && !Array.isArray(input),
      'must be object',
    ),
  ),
  note: v.optional(v.pipe(v.string(), v.maxLength(MAX_ACTOR_NOTE_LENGTH))),
});

export type SubmitActionInput = v.InferInput<typeof submitActionInputSchema>;

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
export default {
  pathPrefix: '/actions',
  routes: [
    route.get<GetActionsOutput>('/', (deps) => [
      createApiKeyMiddleware<never, GetActionsOutput>(deps),
      getActions(deps),
    ]),
    route.post<SubmitActionInput, undefined>(
      '/',
      {
        bodySchema: submitActionInputSchema,
      },
      (deps) => [
        createApiKeyMiddleware<SubmitActionInput, undefined>(deps),
        submitAction(deps),
      ],
    ),
  ],
} as Controller;
