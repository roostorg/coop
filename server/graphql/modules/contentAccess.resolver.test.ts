import { makeExecutableSchema } from '@graphql-tools/schema';
import { graphql, GraphQLScalarType } from 'graphql';

import ContentAccessService, {
  type ContentAccessEvent,
  type ContentAccessExtension,
} from '../../services/contentAccessService.js';
import { resolvers as itemResolvers } from './itemType.js';
import { resolvers as reviewResolvers } from './manualReviewTool.js';

const secret = { videoUrl: 'https://media.example/private?signature=secret' };
const job = { id: 'job', orgId: 'org', payload: secret };
const item = {
  id: 'item',
  type: { id: 'type', name: 'Video', orgId: 'org' },
  submissionId: 'version-1',
  data: secret,
};

// Use the production field resolvers with fixture root fields; no external stores.
const schema = makeExecutableSchema({
  typeDefs: `
    scalar JSONObject
    type Query {
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
    }
    type ManualReviewJob { id: ID! payload: JSONObject }
    type ContentItem { id: ID! data: JSONObject }
    type UserItem { id: ID! data: JSONObject }
    type ThreadItem { id: ID! data: JSONObject }
    type ManualReviewJobComment { id: ID! commentText: String }
    type ManualReviewDecision { id: ID! decisionReason: String }
  `,
  resolvers: {
    JSONObject: new GraphQLScalarType({
      name: 'JSONObject',
      serialize: (value) => value,
    }),
    Query: {
      active: () => job,
      preview: () => job,
      history: () => job,
      appeal: () => ({ ...job, payload: { appealId: 'appeal', ...secret } }),
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
      comment: () => ({ id: 'comment', commentText: 'sensitive comment' }),
      decision: () => ({ id: 'decision', decisionReason: 'sensitive reason' }),
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
    getUser: () =>
      authenticated
        ? { id: 'reviewer', orgId: 'org', role: 'ADMIN' }
        : undefined,
    services: {
      ContentAccessService: new ContentAccessService(extension),
      getItemTypeEventuallyConsistent: jest.fn(async () => item.type),
    },
  };
}

async function execute(source: string, contextValue = makeContext()) {
  return graphql({ schema, source, contextValue });
}

describe('content access GraphQL response fields', () => {
  it.each(['active', 'preview', 'history', 'appeal'])(
    'denies %s payloads even for an administrator',
    async (field) => {
      const record = jest.fn(async (_event: ContentAccessEvent) => {});
      const result = await execute(
        `{ ${field} { id payload } }`,
        makeContext({
          authorize: async () => false,
          record,
        }),
      );
      expect(result.data?.[field]).toEqual({ id: 'job', payload: null });
      expect(result.errors?.[0].extensions.code).toBe('FORBIDDEN');
      expect(record).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 'reviewer',
          orgId: 'org',
          resourceId: 'job',
          outcome: 'denied',
        }),
      );
    },
  );

  it.each(['item', 'userItem', 'threadItem', 'selectorItem'])(
    'denies %s data independently of the review payload path',
    async (field) => {
      const result = await execute(
        `{ ${field} { data } }`,
        makeContext({ authorize: async () => false }),
      );
      expect(result.data?.[field]).toEqual({ data: null });
      expect(result.errors?.[0].extensions.code).toBe('FORBIDDEN');
    },
  );

  it.each([
    ['comment', 'commentText'],
    ['decision', 'decisionReason'],
  ])('denies %s free text', async (field, text) => {
    const result = await execute(
      `{ ${field} { ${text} } }`,
      makeContext({ authorize: async () => false }),
    );
    expect(result.data?.[field]).toEqual({ [text]: null });
    expect(result.errors?.[0].extensions.code).toBe('FORBIDDEN');
  });

  it('preserves payloads with no extension and resolves type selectors', async () => {
    const result = await execute(
      '{ active { payload } selectorItem { data } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      active: { payload: secret },
      selectorItem: { data: secret },
    });
  });

  it('does not require content access for job identifiers', async () => {
    const authorize = jest.fn(async () => false);
    const result = await execute(
      '{ active { id } }',
      makeContext({ authorize }),
    );
    expect(result.errors).toBeUndefined();
    expect(authorize).not.toHaveBeenCalled();
  });

  it('shares policy and audit checks across aliases, not across requests', async () => {
    const authorize = jest.fn(async () => true);
    const record = jest.fn(async (_event: ContentAccessEvent) => {});
    const extension = { authorize, record };
    const source = '{ a: active { payload } b: history { payload } }';
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

  it('does not merge different item submissions into one audit record', async () => {
    const record = jest.fn(async (_event: ContentAccessEvent) => {});
    const result = await execute(
      '{ item { data } oldItem { data } }',
      makeContext({ record }),
    );
    expect(result.errors).toBeUndefined();
    expect(record).toHaveBeenCalledTimes(2);
    expect(
      new Set(record.mock.calls.map(([event]) => event.submissionId)),
    ).toEqual(new Set(['version-1', 'version-0']));
  });

  it('rejects unauthenticated access without invoking external callbacks', async () => {
    const record = jest.fn(async () => {});
    const result = await execute(
      '{ active { payload } }',
      makeContext({ record }, false),
    );
    expect(result.errors?.[0].extensions.code).toBe('UNAUTHENTICATED');
    expect(record).not.toHaveBeenCalled();
  });

  it('rejects cross-organization jobs and items before external callbacks', async () => {
    const record = jest.fn(async () => {});
    const result = await execute(
      '{ foreignJob { payload } foreignItem { data } }',
      makeContext({ record }),
    );
    expect(result.errors).toHaveLength(2);
    expect(
      result.errors?.every((error) => error.extensions.code === 'FORBIDDEN'),
    ).toBe(true);
    expect(record).not.toHaveBeenCalled();
  });

  it('fails closed on audit persistence errors and shares the rejection across aliases', async () => {
    const record = jest.fn(async () => {
      throw new Error('secret media URL');
    });
    const result = await execute(
      '{ a: active { payload } b: active { payload } }',
      makeContext({ record }),
    );
    expect(result.data).toEqual({ a: { payload: null }, b: { payload: null } });
    expect(record).toHaveBeenCalledTimes(1);
    expect(result.errors?.map((error) => error.message)).toEqual([
      'Content access verification is unavailable.',
      'Content access verification is unavailable.',
    ]);
  });
});
