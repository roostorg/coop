import { type ScalarTypeRuntimeType } from '@roostorg/coop-types';
import * as v from 'valibot';

import { type DerivedFieldSpec } from '../../services/derivedFieldsService/index.js';
import {
  type NormalizedItemData,
  type RawItemData,
} from '../../services/itemProcessingService/index.js';
import { createApiKeyMiddleware } from '../../utils/apiKeyMiddleware.js';
import { type SerializableError } from '../../utils/errors.js';
import { route } from '../../utils/route-helpers.js';
import { type Controller } from '../index.js';
import submitContent from './submitContent.js';

const evaluateContentInputSchema = v.object({
  userId: v.optional(v.string()),
  contentType: v.string(),
  contentId: v.string(),
  content: v.custom<RawItemData>(
    (input) =>
      typeof input === 'object' && input !== null && !Array.isArray(input),
  ),
  sync: v.optional(v.boolean()),
});

export type EvaluateContentInputCamelCase = v.InferInput<
  typeof evaluateContentInputSchema
>;

// The type for the data that we respond with after we're done processing a
// submission. We intentionally define it independently of (i.e., not deriving
// it from) the return type of `RuleEgine.runRuleSet`, which actually generates
// the response data, so that the compiler will complain if a refactor to
// `runRuleSet` would lead to a breaking change in our POST /content response.
export type EvaluateContentOutput = {
  actionsTriggered: { id: string; name: string }[];
  derivedFields: {
    [key: string]: {
      value:
        | ScalarTypeRuntimeType
        | ScalarTypeRuntimeType[]
        | NormalizedItemData
        | null
        | SerializableError;
      field: DerivedFieldSpec;
    };
  };
};

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
export default {
  pathPrefix: '/content',
  routes: [
    route.post<EvaluateContentInputCamelCase, EvaluateContentOutput>(
      '/',
      {
        bodySchema: evaluateContentInputSchema,
      },
      (deps) => [
        createApiKeyMiddleware<
          EvaluateContentInputCamelCase,
          EvaluateContentOutput
        >(deps),
        submitContent(deps),
      ],
    ),
  ],
} as Controller;
