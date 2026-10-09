import { ApolloServer } from '@apollo/server';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { MapperKind, mapSchema } from '@graphql-tools/utils';
import { GraphQLScalarType } from 'graphql';
import { vi } from 'vitest';

import ContentAccessService, {
  type ContentAccessEvent,
  type ContentAccessExtension,
} from '../../services/contentAccessService.js';
import typeDefs from '../schema.js';
import { authSchemaWrapper } from '../utils/authorization.js';
import { formatGraphQLError } from '../utils/formatError.js';
import { resolvers as itemResolvers } from './itemType.js';
import { resolvers as reviewResolvers } from './manualReviewTool.js';

const secret = { videoUrl: 'https://media.example/private?signature=secret' };
const item = {
  id: 'item',
  type: { id: 'type', name: 'Video', orgId: 'org' },
  submissionId: 'version-1',
  data: secret,
};
const comment = { id: 'comment', commentText: 'sensitive comment' };
const payload = {
  __typename: 'ContentManualReviewJobPayload',
  item,
  reportedForReason: 'sensitive payload',
};
const job = { id: 'job', orgId: 'org', payload, comments: [comment] };
const selectPayload =
  'payload { ... on ContentManualReviewJobPayload { reportedForReason } ... on ContentAppealManualReviewJobPayload { appealReason } }';

// Keep production object/union types and nullability; only root data sources are fixtures.
const schema = makeExecutableSchema({
  typeDefs: [
    typeDefs,
    `
    extend type Query {
      active: ManualReviewJob
      preview: ManualReviewJob
      history: ManualReviewJob
      appeal: ManualReviewJob
      foreignJob: ManualReviewJob
      item: ContentItem
      oldItem: ContentItem
      selectorItem: ContentItem
      foreignItem: ContentItem
      userItem: UserItem
      threadItem: ThreadItem
      comment: ManualReviewJobComment
      decision: ManualReviewDecision
      noReason: ManualReviewDecision
      queue: ManualReviewQueue
      requiredQueue: ManualReviewQueue!
      healthy: String!
      unexpectedFailure: String
    }
  `,
  ],
  resolvers: {
    JSONObject: new GraphQLScalarType({
      name: 'JSONObject',
      serialize: (value) => value,
    }),
    Query: {
      active: () => job,
      preview: () => job,
      history: () => job,
      appeal: () => ({
        ...job,
        payload: {
          __typename: 'ContentAppealManualReviewJobPayload',
          appealReason: 'appeal',
        },
      }),
      foreignJob: () => ({ ...job, orgId: 'other-org' }),
      item: () => item,
      oldItem: () => ({ ...item, submissionId: 'version-0' }),
      selectorItem: () => ({ ...item, type: { id: 'type' } }),
      foreignItem: () => ({
        ...item,
        type: { ...item.type, orgId: 'other-org' },
      }),
      userItem: () => item,
      threadItem: () => item,
      comment: () => comment,
      decision: () => ({ id: 'decision', decisionReason: 'sensitive reason' }),
      noReason: () => ({ id: 'decision' }),
      queue: () => ({ jobs: [job, { ...job, id: 'second-job' }] }),
      requiredQueue: () => ({ jobs: [job] }),
      healthy: () => 'ok',
      unexpectedFailure: () => {
        throw new Error('private database password');
      },
    },
    ManualReviewJob: { payload: reviewResolvers.ManualReviewJob.payload },
    ContentItem: { data: itemResolvers.ContentItem.data },
    UserItem: { data: itemResolvers.UserItem.data },
    ThreadItem: { data: itemResolvers.ThreadItem.data },
    ManualReviewJobComment: {
      commentText: reviewResolvers.ManualReviewJobComment.commentText,
    },
    ManualReviewDecision: {
      decisionReason: reviewResolvers.ManualReviewDecision.decisionReason,
    },
  },
});

function makeContext(
  extension: ContentAccessExtension = {},
  authenticated = true,
) {
  return {
    getUser: vi.fn(() =>
      authenticated
        ? { id: 'reviewer', orgId: 'org', role: 'ADMIN' }
        : undefined,
    ),
    services: {
      ContentAccessService: new ContentAccessService(extension),
      getItemTypeEventuallyConsistent: vi.fn(async () => item.type),
    },
  };
}

const apollo = new ApolloServer<ReturnType<typeof makeContext>>({
  schema,
  formatError: formatGraphQLError,
  includeStacktraceInErrorResponses: false,
});
beforeAll(async () => apollo.start());
afterAll(async () => apollo.stop());
async function execute(query: string, contextValue = makeContext()) {
  const response = await apollo.executeOperation({ query }, { contextValue });
  if (response.body.kind !== 'single')
    throw new Error('Expected single GraphQL response');
  return response.body.singleResult;
}

describe('content access with production GraphQL types and Apollo formatter', () => {
  it('retains production root authentication when the extension is disabled', async () => {
    const protectedSchema = mapSchema(schema, {
      [MapperKind.QUERY_ROOT_FIELD]: (field, _, _typeName, currentSchema) =>
        authSchemaWrapper(field, currentSchema),
    });
    const server = new ApolloServer<ReturnType<typeof makeContext>>({
      schema: protectedSchema,
      formatError: formatGraphQLError,
    });
    try {
      const response = await server.executeOperation(
        { query: `{ active { ${selectPayload} } }` },
        {
          contextValue: makeContext({}, false),
        },
      );
      if (response.body.kind !== 'single')
        throw new Error('Expected single response');
      expect(response.body.singleResult.data).toEqual({ active: null });
      expect(response.body.singleResult.errors?.[0].extensions?.code).toBe(
        'UNAUTHENTICATED',
      );
    } finally {
      await server.stop();
    }
  });
  it.each(['active', 'preview', 'history', 'appeal'])(
    'denies %s payloads even for an administrator',
    async (field) => {
      const record = vi.fn(async (_event: ContentAccessEvent) => {});
      const result = await execute(
        `{ ${field} { id ${selectPayload} } }`,
        makeContext({ authorize: async () => false, record }),
      );
      expect(result.data?.[field]).toBeNull();
      expect(result.errors?.[0].extensions?.code).toBe('FORBIDDEN');
      expect(result.errors?.[0].path).toEqual([field, 'payload']);
      expect(record).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 'reviewer',
          orgId: 'org',
          resourceId: 'job',
          resourceType: 'review_job',
          field: 'payload',
          outcome: 'denied',
        }),
        expect.any(AbortSignal),
      );
    },
  );

  it.each(['item', 'userItem', 'threadItem', 'selectorItem'])(
    'denies and audits %s data',
    async (field) => {
      const record = vi.fn(async (_event: ContentAccessEvent) => {});
      const result = await execute(
        `{ ${field} { data } }`,
        makeContext({ authorize: async () => false, record }),
      );
      expect(result.data?.[field]).toBeNull();
      expect(result.errors?.[0].extensions?.code).toBe('FORBIDDEN');
      expect(record).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 'reviewer',
          orgId: 'org',
          resourceType: 'item',
          resourceId: 'item',
          itemTypeId: 'type',
          submissionId: 'version-1',
          field: 'data',
          outcome: 'denied',
        }),
        expect.any(AbortSignal),
      );
    },
  );

  it.each([
    ['comment', 'commentText', 'review_comment'],
    ['decision', 'decisionReason', 'review_decision'],
  ])('denies and audits %s text', async (field, text, resourceType) => {
    const record = vi.fn(async (_event: ContentAccessEvent) => {});
    const result = await execute(
      `{ ${field} { ${text} } }`,
      makeContext({ authorize: async () => false, record }),
    );
    expect(result.data?.[field]).toEqual(
      field === 'comment' ? null : { [text]: null },
    );
    expect(result.errors?.[0].extensions?.code).toBe('FORBIDDEN');
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'reviewer',
        orgId: 'org',
        resourceId: field,
        resourceType,
        field: text,
        outcome: 'denied',
      }),
      expect.any(AbortSignal),
    );
  });

  it.each(['payload', 'commentText'])(
    'propagates denied %s through non-null job/list chains',
    async (field) => {
      const context = makeContext({
        authorize: async (request) => request.field !== field,
      });
      const selection =
        field === 'payload' ? selectPayload : 'comments { commentText }';
      const result = await execute(
        `{ queue { jobs { id ${selection} } } healthy }`,
        context,
      );
      expect(result.data).toEqual({ queue: null, healthy: 'ok' });
      expect(result.errors?.[0].extensions?.code).toBe('FORBIDDEN');
      const root = await execute(
        `{ requiredQueue { jobs { ${selection} } } healthy }`,
        makeContext({ authorize: async (request) => request.field !== field }),
      );
      expect(root.data).toBeNull();
      expect(root.errors?.[0].extensions?.code).toBe('FORBIDDEN');
    },
  );

  it('preserves default output without adding hydration or auth work to fields', async () => {
    const context = makeContext({}, false);
    const result = await execute(
      `{ active { ${selectPayload} } selectorItem { data } comment { commentText } decision { decisionReason } }`,
      context,
    );
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      active: { payload: { reportedForReason: 'sensitive payload' } },
      selectorItem: { data: secret },
      comment: { commentText: 'sensitive comment' },
      decision: { decisionReason: 'sensitive reason' },
    });
    expect(context.getUser).not.toHaveBeenCalled();
    expect(
      context.services.getItemTypeEventuallyConsistent,
    ).not.toHaveBeenCalled();
    // Production root authorization remains responsible for unauthenticated requests.
  });

  it('hydrates selectors and records exact versions when enabled', async () => {
    const record = vi.fn(async (_event: ContentAccessEvent) => {});
    const context = makeContext({ record });
    const result = await execute(
      '{ selectorItem { data } oldItem { data } }',
      context,
    );
    expect(result.errors).toBeUndefined();
    expect(
      context.services.getItemTypeEventuallyConsistent,
    ).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledTimes(2);
    expect(
      new Set(record.mock.calls.map(([event]) => event.submissionId)),
    ).toEqual(new Set(['version-1', 'version-0']));
  });

  it('does not require content access for job identifiers or absent reasons', async () => {
    const authorize = vi.fn(async () => false);
    const result = await execute(
      '{ active { id } noReason { decisionReason } }',
      makeContext({ authorize }),
    );
    expect(result.errors).toBeUndefined();
    expect(authorize).not.toHaveBeenCalled();
  });

  it('coalesces aliases within a context, not across requests', async () => {
    const authorize = vi.fn(async () => true);
    const record = vi.fn(async (_event: ContentAccessEvent) => {});
    const extension = { authorize, record };
    const source = `{ a: active { ${selectPayload} } b: history { ${selectPayload} } }`;
    expect(
      (await execute(source, makeContext(extension))).errors,
    ).toBeUndefined();
    expect(record).toHaveBeenCalledTimes(1);
    expect(authorize).toHaveBeenCalledTimes(1);
    expect(
      (await execute(source, makeContext(extension))).errors,
    ).toBeUndefined();
    expect(record).toHaveBeenCalledTimes(2);
    expect(record.mock.calls[0][0].requestId).not.toBe(
      record.mock.calls[1][0].requestId,
    );
    expect(record.mock.calls[0][0]).not.toHaveProperty('payload');
  });

  it('rejects unauthenticated field access before callbacks when enabled', async () => {
    const record = vi.fn(async () => {});
    const result = await execute(
      `{ active { ${selectPayload} } }`,
      makeContext({ record }, false),
    );
    expect(result.errors?.[0].extensions?.code).toBe('UNAUTHENTICATED');
    expect(record).not.toHaveBeenCalled();
  });

  it('rejects cross-organization jobs and items before callbacks', async () => {
    const record = vi.fn(async () => {});
    const result = await execute(
      `{ foreignJob { ${selectPayload} } foreignItem { data } }`,
      makeContext({ record }),
    );
    expect(result.errors).toHaveLength(2);
    expect(
      result.errors?.every((error) => error.extensions?.code === 'FORBIDDEN'),
    ).toBe(true);
    expect(record).not.toHaveBeenCalled();
  });

  it.each(['authorize', 'record'] as const)(
    'returns a safe client error when %s fails',
    async (stage) => {
      const callback = vi.fn(async () => {
        throw new Error('secret media URL');
      });
      const result = await execute(
        `{ a: active { ${selectPayload} } b: active { ${selectPayload} } }`,
        makeContext({ [stage]: callback }),
      );
      expect(result.data).toEqual({ a: null, b: null });
      expect(callback).toHaveBeenCalledTimes(1);
      expect(
        result.errors?.map((error) => ({
          message: error.message,
          code: error.extensions?.code,
        })),
      ).toEqual([
        {
          message: 'Content access verification is unavailable.',
          code: 'INTERNAL_SERVER_ERROR',
        },
        {
          message: 'Content access verification is unavailable.',
          code: 'INTERNAL_SERVER_ERROR',
        },
      ]);
    },
  );

  it.each(['authorize', 'record'] as const)(
    'returns a safe client error when %s never settles',
    async (stage) => {
      let signal: AbortSignal | undefined;
      const callback = vi.fn(async (_, callbackSignal: AbortSignal) => {
        signal = callbackSignal;
        return new Promise<never>(() => {});
      });
      const result = await execute(
        `{ a: active { ${selectPayload} } b: active { ${selectPayload} } }`,
        makeContext({ timeoutMs: 10, [stage]: callback }),
      );
      expect(result.data).toEqual({ a: null, b: null });
      expect(callback).toHaveBeenCalledTimes(1);
      expect(signal?.aborted).toBe(true);
      expect(
        result.errors?.map((error) => ({
          message: error.message,
          code: error.extensions?.code,
        })),
      ).toEqual(
        Array.from({ length: 2 }, () => ({
          message: 'Content access verification is unavailable.',
          code: 'INTERNAL_SERVER_ERROR',
        })),
      );
    },
  );

  it('still sanitizes unrelated unexpected errors through the production formatter', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const result = await execute('{ unexpectedFailure }');
      expect(result.errors?.[0].message).toBe(
        process.env.EXPOSE_SENSITIVE_IMPLEMENTATION_DETAILS_IN_ERRORS === 'true'
          ? 'Error: private database password'
          : 'Unknown error',
      );
      expect(result.errors?.[0].extensions?.code).toBe('INTERNAL_SERVER_ERROR');
    } finally {
      log.mockRestore();
    }
  });
});
