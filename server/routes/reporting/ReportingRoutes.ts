import { type ItemIdentifier } from '@roostorg/types';

import {
  rawItemSubmissionSchema,
  type RawItemSubmission,
} from '../../services/itemProcessingService/index.js';
import { route } from '../../utils/route-helpers.js';
import { createApiKeyMiddleware } from '../../utils/apiKeyMiddleware.js';
import { type Controller } from '../index.js';
import submitAppeal from './submitAppeal.js';
import submitReport from './submitReport.js';

export type ReportItemInput = {
  reporter:
    | { kind: 'rule'; id: string }
    | { kind: 'user'; typeId: string; id: string };
  reportedAt: string;
  reportedForReason?: {
    policyId?: string | null;
    reason?: string | null;
    csam?: boolean | null;
  } | null;
  reportedItem: RawItemSubmission;
  reportedItemThread?: RawItemSubmission[];
  reportedItemsInThread?: ItemIdentifier[];
  additionalItems?: RawItemSubmission[];
};

export type AppealItemInput = {
  appealId: string;
  appealedBy: { typeId: string; id: string };
  appealedAt: string;
  actionedItem: RawItemSubmission;
  additionalItems?: RawItemSubmission[];
  actionsTaken: string[];
  appealReason?: string;
  violatingPolicies?: Array<{ id: string }>;
};

export type ReportItemOutput = { reportId: string };
export type AppealItemOutput = never;

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
export default {
  pathPrefix: '/report',
  routes: [
    route.post<ReportItemInput, ReportItemOutput>(
      '/',
      {
        bodySchema: {
          $schema: 'http://json-schema.org/draft-04/schema#',
          title: 'ReportContentInputModel',
          type: 'object',
          properties: {
            reporter: {
              type: 'object',
              properties: {
                kind: { type: 'string', enum: ['user'] },
                typeId: { type: 'string' },
                id: { type: 'string' },
              },
              required: ['kind', 'typeId', 'id'],
            },
            reportedAt: { type: 'string' },
            reportedForReason: {
              type: 'object' as const,
              properties: {
                policyId: {
                  type: ['string', 'null'] as const,
                },
                reason: {
                  type: ['string', 'null'] as const,
                },
                csam: {
                  type: ['boolean', 'null'] as const,
                },
              },
            },
            reportedItem: rawItemSubmissionSchema,
            reportedItemThread: {
              type: 'array',
              items: rawItemSubmissionSchema,
            },
            reportedItemsInThread: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  typeId: { type: 'string' },
                },
                required: ['id', 'typeId'],
              },
            },
            additionalItems: {
              type: 'array',
              items: rawItemSubmissionSchema,
            },
          },
          required: ['reporter', 'reportedAt', 'reportedItem'],
        },
      },
      (deps) => [createApiKeyMiddleware<ReportItemInput, ReportItemOutput>(deps), submitReport(deps)],
    ),
    route.post<AppealItemInput, AppealItemOutput>(
      '/appeal',
      {
        bodySchema: {
          $schema: 'http://json-schema.org/draft-04/schema#',
          title: 'AppealContentInputModel',
          type: 'object',
          properties: {
            appealId: { type: 'string' },
            appealedBy: {
              type: 'object',
              properties: {
                typeId: { type: 'string' },
                id: { type: 'string' },
              },
              required: ['typeId', 'id'],
            },
            appealedAt: { type: 'string' },
            actionedItem: rawItemSubmissionSchema,
            actionsTaken: {
              type: 'array',
              items: { type: 'string' },
            },
            additionalItems: {
              type: 'array',
              items: rawItemSubmissionSchema,
            },
            violatingPolicies: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                },
                required: ['id'],
              },
            },
            appealReason: { type: 'string' },
          },
          required: [
            'appealId',
            'appealedAt',
            'actionedItem',
            'appealedBy',
            'actionsTaken',
          ],
        },
      },
      (deps) => [createApiKeyMiddleware<AppealItemInput, AppealItemOutput>(deps), submitAppeal(deps)],
    ),
  ],
} as Controller;
