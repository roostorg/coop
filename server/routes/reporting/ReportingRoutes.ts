import { type JsonObject } from 'type-fest';
import * as v from 'valibot';

import {
  rawItemSubmissionSchema,
  type RawItemSubmission,
} from '../../services/itemProcessingService/index.js';

// Request bodies of POST /api/v1/report and /report/appeal (served by
// nest/rest/reportingController.ts).
const itemIdentifierSchema = v.object({
  id: v.string(),
  typeId: v.string(),
});
// The shared schema starts from unknown to enforce its exclusive alternatives;
// REST route handlers receive the validated submission type.
const rawItemBodySchema = rawItemSubmissionSchema as v.GenericSchema<
  RawItemSubmission,
  RawItemSubmission
>;
export const reportItemInputSchema = v.object({
  reporter: v.object({
    kind: v.pipe(v.literal('user'), v.metadata({ jsonSchemaType: 'string' })),
    typeId: v.string(),
    id: v.string(),
  }),
  reportedAt: v.string(),
  reportedForReason: v.optional(
    v.pipe(
      v.custom<JsonObject>(
        (input) =>
          typeof input === 'object' && input !== null && !Array.isArray(input),
        'must be object',
      ),
      v.object({
        policyId: v.optional(v.nullable(v.string())),
        reason: v.optional(v.nullable(v.string())),
        csam: v.optional(v.nullable(v.boolean())),
      }),
    ),
  ),
  reportedItem: rawItemBodySchema,
  reportedItemThread: v.optional(v.array(rawItemBodySchema)),
  reportedItemsInThread: v.optional(v.array(itemIdentifierSchema)),
  additionalItems: v.optional(v.array(rawItemBodySchema)),
});
export const appealItemInputSchema = v.pipe(
  v.object({
    appealId: v.string(),
    appealedBy: v.object({ typeId: v.string(), id: v.string() }),
    appealedAt: v.string(),
    actionedItem: rawItemBodySchema,
    additionalItems: v.optional(v.array(rawItemBodySchema)),
    actionsTaken: v.array(v.string()),
    appealReason: v.optional(v.string()),
    violatingPolicies: v.optional(v.array(v.object({ id: v.string() }))),
  }),
  v.metadata({
    requiredOrder: [
      'appealId',
      'appealedAt',
      'actionedItem',
      'appealedBy',
      'actionsTaken',
    ],
  }),
);

export type ReportItemInput = v.InferOutput<typeof reportItemInputSchema>;
export type AppealItemInput = v.InferOutput<typeof appealItemInputSchema>;

export type ReportItemOutput = { reportId: string };
export type AppealItemOutput = never;
