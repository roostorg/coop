import { type ScalarTypeRuntimeType } from '@roostorg/types';

import { type DerivedFieldSpec } from '../../services/derivedFieldsService/index.js';
import { type NormalizedItemData } from '../../services/itemProcessingService/index.js';
import { type SerializableError } from '../../utils/errors.js';
import { type JSON } from '../../utils/json-schema-types.js';
import { route } from '../../utils/route-helpers.js';
import { createApiKeyMiddleware } from '../../utils/apiKeyMiddleware.js';
import { type Controller } from '../index.js';
import submitContent from './submitContent.js';

export type EvaluateContentInputCamelCase = {
  userId?: string;
  contentType: string;
  contentId: string;
  content: { [key: string]: JSON };
  sync?: boolean;
};

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
    route.post<
      EvaluateContentInputCamelCase,
      EvaluateContentOutput
    >(
      '/',
      {
        bodySchema: {
          $schema: 'http://json-schema.org/draft-04/schema#',
          title: 'EvaluateContentInputModel',
          type: 'object',
          properties: {
            userId: { type: 'string' },
            contentType: { type: 'string' },
            contentId: { type: 'string' },
            // NB: the typings break here if we don't have { required: [] },
            // but actually putting an empty array for `required` in the runtime
            // value breaks request handling, so we just use a cast.
            content: { type: 'object' } as unknown as {
              type: 'object';
              required: [];
            },
            sync: { type: 'boolean' },
          },
          required: ['contentType', 'contentId', 'content'],
        },
      },
      (deps) => [createApiKeyMiddleware<EvaluateContentInputCamelCase, EvaluateContentOutput>(deps), submitContent(deps)],
    ),
  ],
} as Controller;
