import * as v from 'valibot';

import { rawItemSubmissionSchema } from '../../services/itemProcessingService/index.js';

// Request body of POST /api/v1/items/async (served by nest/rest/itemsController.ts).
export const submitItemsInputSchema = v.object({
  items: v.array(rawItemSubmissionSchema),
});

export type SubmitItemsInput = v.InferOutput<typeof submitItemsInputSchema>;
