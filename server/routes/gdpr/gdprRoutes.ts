import { route } from '../../utils/route-helpers.js';
import { createApiKeyMiddleware } from '../../utils/apiKeyMiddleware.js';
import { type Controller } from '../index.js';
import requestDelete from './delete.js';

export type DeleteRequestInput = {
  userIds: { id: string; typeId: string }[];
};

export type DeleteRequestOutput = {
  requestId: string;
};

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
export default {
  pathPrefix: '/gdpr/delete',
  routes: [
    route.post<DeleteRequestInput, DeleteRequestOutput>(
      '/',
      {
        bodySchema: {
          $schema: 'http://json-schema.org/draft-04/schema#',
          title: 'SubmitGDPRDeleteRequestInputModel',
          type: 'object',
          properties: {
            userIds: {
              type: 'array',
              minItems: 1,
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  typeId: { type: 'string' },
                },
                required: ['id', 'typeId'],
              },
            },
          },
          required: ['userIds'],
        },
      },
      (deps) => [createApiKeyMiddleware<DeleteRequestInput, DeleteRequestOutput>(deps), requestDelete(deps)],
    ),
  ],
} as Controller;
