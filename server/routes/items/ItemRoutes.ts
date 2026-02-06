import {
  rawItemSubmissionSchema,
  type RawItemSubmission,
} from '../../services/itemProcessingService/index.js';
import { route } from '../../utils/route-helpers.js';
import { createApiKeyMiddleware } from '../../utils/apiKeyMiddleware.js';
import { type Controller } from '../index.js';
import submitItems from './submitItems.js';

export type SubmitItemsInput = {
  items: RawItemSubmission[];
};

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
export default {
  pathPrefix: '/items',
  routes: [
    route.post<SubmitItemsInput, undefined>(
      '/async/',
      {
        bodySchema: {
          $schema: 'http://json-schema.org/draft-04/schema#',
          title: 'SubmitItemsInputModel',
          type: 'object',
          properties: {
            items: {
              type: 'array',
              // This 'items' key is defined by our JSON schema checker library, so we can't change it
              items: rawItemSubmissionSchema,
            },
          },
          required: ['items'],
        },
      },
      (deps) => [createApiKeyMiddleware<SubmitItemsInput, undefined>(deps), submitItems(deps)],
    ),
  ],
} as Controller;
