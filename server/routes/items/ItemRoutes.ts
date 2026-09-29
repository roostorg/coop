import * as v from 'valibot';

import { rawItemSubmissionSchema } from '../../services/itemProcessingService/index.js';
import { createApiKeyMiddleware } from '../../utils/apiKeyMiddleware.js';
import { route } from '../../utils/route-helpers.js';
import { type Controller } from '../index.js';
import submitItems from './submitItems.js';

const submitItemsInputSchema = v.object({
  items: v.array(rawItemSubmissionSchema),
});

export type SubmitItemsInput = v.InferOutput<typeof submitItemsInputSchema>;

export default {
  pathPrefix: '/items',
  routes: [
    route.post<SubmitItemsInput, undefined>(
      '/async/',
      {
        bodySchema: submitItemsInputSchema,
      },
      (deps) => [
        createApiKeyMiddleware<SubmitItemsInput, undefined>(deps),
        submitItems(deps),
      ],
    ),
  ],
} satisfies Controller;
