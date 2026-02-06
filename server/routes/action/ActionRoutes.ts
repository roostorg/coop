import { type ItemIdentifier } from '@roostorg/types';

import { route } from '../../utils/route-helpers.js';
import { createApiKeyMiddleware } from '../../utils/apiKeyMiddleware.js';
import { type Controller } from '../index.js';
import submitAction from './submitAction.js';

export type SubmitActionInput = {
  actionId: string;
  itemId: string;
  itemTypeId: string;
  policyIds?: string[];
  reportedItems?: ItemIdentifier[];
  actorId?: string;
};

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
export default {
  pathPrefix: '/actions',
  routes: [
    route.post<SubmitActionInput, undefined>(
      '/',
      {
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
          },
          required: ['actionId', 'itemId', 'itemTypeId'],
        },
      },
      (deps) => [createApiKeyMiddleware<SubmitActionInput, undefined>(deps), submitAction(deps)],
    ),
  ],
} as Controller;
