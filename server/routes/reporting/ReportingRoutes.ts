import * as v from 'valibot';

import {
  rawItemSubmissionSchema,
  type RawItemSubmission,
} from '../../services/itemProcessingService/index.js';
import { createApiKeyMiddleware } from '../../utils/apiKeyMiddleware.js';
import { route } from '../../utils/route-helpers.js';
import { type Controller } from '../index.js';
import submitAppeal from './submitAppeal.js';
import submitReport from './submitReport.js';

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
const reportItemInputSchema = v.object({
  reporter: v.object({
    kind: v.literal('user'),
    typeId: v.string(),
    id: v.string(),
  }),
  reportedAt: v.string(),
  reportedForReason: v.optional(
    v.object({
      policyId: v.optional(v.nullable(v.string())),
      reason: v.optional(v.nullable(v.string())),
      csam: v.optional(v.nullable(v.boolean())),
    }),
  ),
  reportedItem: rawItemBodySchema,
  reportedItemThread: v.optional(v.array(rawItemBodySchema)),
  reportedItemsInThread: v.optional(v.array(itemIdentifierSchema)),
  additionalItems: v.optional(v.array(rawItemBodySchema)),
});
const appealItemInputSchema = v.object({
  appealId: v.string(),
  appealedBy: v.object({ typeId: v.string(), id: v.string() }),
  appealedAt: v.string(),
  actionedItem: rawItemBodySchema,
  additionalItems: v.optional(v.array(rawItemBodySchema)),
  actionsTaken: v.array(v.string()),
  appealReason: v.optional(v.string()),
  violatingPolicies: v.optional(v.array(v.object({ id: v.string() }))),
});

export type ReportItemInput = v.InferOutput<typeof reportItemInputSchema>;
export type AppealItemInput = v.InferOutput<typeof appealItemInputSchema>;

export type ReportItemOutput = { reportId: string };
export type AppealItemOutput = never;

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
export default {
  pathPrefix: '/report',
  routes: [
    route.post<ReportItemInput, ReportItemOutput>(
      '/',
      {
        bodySchema: reportItemInputSchema,
      },
      (deps) => [
        createApiKeyMiddleware<ReportItemInput, ReportItemOutput>(deps),
        submitReport(deps),
      ],
    ),
    route.post<AppealItemInput, AppealItemOutput>(
      '/appeal',
      {
        bodySchema: appealItemInputSchema,
      },
      (deps) => [
        createApiKeyMiddleware<AppealItemInput, AppealItemOutput>(deps),
        submitAppeal(deps),
      ],
    ),
  ],
} as Controller;
