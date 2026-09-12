import {
  type ItemSubmission,
  type NormalizedItemData,
  type SubmissionId,
} from '../../services/itemProcessingService/index.js';
import {
  type ItemType,
  type UserItemType,
} from '../../services/moderationConfigService/index.js';
import { instantiateOpaqueType } from '../../utils/typescript-types.js';
import {
  resolveItemsWithId,
  resolvers,
  type ItemsWithIdContext,
} from './investigation.js';

function makeUserType(overrides: Partial<UserItemType> = {}): UserItemType {
  return {
    id: 'user-type-1',
    kind: 'USER',
    name: 'User',
    description: null,
    version: '2025-01-01',
    schema: [
      { name: 'username', type: 'STRING', required: false, container: null },
    ],
    schemaVariant: 'original',
    schemaFieldRoles: {},
    orgId: 'org-1',
    isDefaultUserType: false,
    ...overrides,
  };
}

function makeSubmission(opts: {
  itemId: string;
  itemType?: ItemType;
}): ItemSubmission {
  return instantiateOpaqueType<ItemSubmission>({
    submissionId: instantiateOpaqueType<SubmissionId>('sub-1'),
    submissionTime: new Date('2026-05-01T00:00:00Z'),
    itemId: opts.itemId,
    creator: undefined,
    data: instantiateOpaqueType<NormalizedItemData>({}),
    itemType: opts.itemType ?? makeUserType(),
  });
}

async function* emptyAsyncIterable<T>(): AsyncIterableIterator<T> {
  // no-op
}

async function* singleAsyncIterable<T>(value: T): AsyncIterableIterator<T> {
  yield value;
}

type ItemInvestigationServiceMock =
  ItemsWithIdContext['services']['ItemInvestigationService'];

type SubmissionsForItem = NonNullable<
  Awaited<ReturnType<ItemInvestigationServiceMock['getItemByIdentifier']>>
>;

function makeContext(
  overrides: Partial<ItemInvestigationServiceMock> = {},
  user: { orgId: string } | null = { orgId: 'org-1' },
) {
  const service: ItemInvestigationServiceMock = {
    getItemByIdentifier: jest.fn(async () => null),
    getItemByTypeAgnosticIdentifier: jest.fn(() =>
      emptyAsyncIterable<SubmissionsForItem>(),
    ),
    synthesizeUserItemFromCreatorReferences: jest.fn(async () => null),
    ...overrides,
  };

  const ctx: ItemsWithIdContext = {
    getUser: () => user,
    services: { ItemInvestigationService: service },
  };

  return { ctx, service };
}

describe('investigation resolvers', () => {
  describe('resolveItemsWithId', () => {
    it('rejects when unauthenticated', async () => {
      const { ctx, service } = makeContext({}, null);

      await expect(
        resolveItemsWithId({ itemId: 'i-1' }, ctx),
      ).rejects.toMatchObject({ extensions: { code: 'UNAUTHENTICATED' } });

      expect(service.getItemByIdentifier).not.toHaveBeenCalled();
      expect(
        service.synthesizeUserItemFromCreatorReferences,
      ).not.toHaveBeenCalled();
    });

    describe('typed path (typeId provided)', () => {
      it('returns the real submission and never falls back to synthesis', async () => {
        const submission = makeSubmission({ itemId: 'i-1' });
        const { ctx, service } = makeContext({
          getItemByIdentifier: jest.fn().mockResolvedValue({
            latestSubmission: submission,
            priorSubmissions: undefined,
          }),
        });

        const result = await resolveItemsWithId(
          { itemId: 'i-1', typeId: 'user-type-1' },
          ctx,
        );

        expect(result).toHaveLength(1);
        expect(result[0].latest.id).toBe('i-1');
        expect(
          service.synthesizeUserItemFromCreatorReferences,
        ).not.toHaveBeenCalled();
      });

      it('falls back to synthesis (with knownUserTypeId) when no real submission exists', async () => {
        const synthSubmission = makeSubmission({ itemId: 'i-1' });
        const { ctx, service } = makeContext({
          getItemByIdentifier: jest.fn().mockResolvedValue(null),
          synthesizeUserItemFromCreatorReferences: jest.fn().mockResolvedValue({
            latestSubmission: synthSubmission,
            priorSubmissions: undefined,
          }),
        });

        const result = await resolveItemsWithId(
          { itemId: 'i-1', typeId: 'user-type-1' },
          ctx,
        );

        expect(
          service.synthesizeUserItemFromCreatorReferences,
        ).toHaveBeenCalledWith({
          orgId: 'org-1',
          itemId: 'i-1',
          knownUserTypeId: 'user-type-1',
        });
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({ isSynthetic: true });
        expect(result[0].latest.id).toBe('i-1');
      });

      it('returns an empty array when neither lookup nor synthesis yields anything', async () => {
        const { ctx } = makeContext();

        const result = await resolveItemsWithId(
          { itemId: 'missing', typeId: 'user-type-1' },
          ctx,
        );

        expect(result).toEqual([]);
      });
    });

    describe('type-agnostic path with returnFirstResultOnly', () => {
      it('returns the first real submission without invoking synthesis', async () => {
        const submission = makeSubmission({ itemId: 'i-1' });
        const { ctx, service } = makeContext({
          getItemByTypeAgnosticIdentifier: jest.fn().mockReturnValue(
            singleAsyncIterable({
              latestSubmission: submission,
              priorSubmissions: undefined,
            }),
          ),
        });

        const result = await resolveItemsWithId(
          { itemId: 'i-1', returnFirstResultOnly: true },
          ctx,
        );

        expect(result).toHaveLength(1);
        expect(result[0].latest.id).toBe('i-1');
        expect(
          service.synthesizeUserItemFromCreatorReferences,
        ).not.toHaveBeenCalled();
      });

      it('falls back to synthesis (without knownUserTypeId) when the stream is empty', async () => {
        const synthSubmission = makeSubmission({ itemId: 'i-1' });
        const { ctx, service } = makeContext({
          synthesizeUserItemFromCreatorReferences: jest.fn().mockResolvedValue({
            latestSubmission: synthSubmission,
            priorSubmissions: undefined,
          }),
        });

        const result = await resolveItemsWithId(
          { itemId: 'i-1', returnFirstResultOnly: true },
          ctx,
        );

        expect(
          service.synthesizeUserItemFromCreatorReferences,
        ).toHaveBeenCalledWith({
          orgId: 'org-1',
          itemId: 'i-1',
          knownUserTypeId: undefined,
        });
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({ isSynthetic: true });
      });
    });

    describe('type-agnostic path without returnFirstResultOnly', () => {
      it('falls back to synthesis when the stream is empty', async () => {
        const synthSubmission = makeSubmission({ itemId: 'i-1' });
        const { ctx, service } = makeContext({
          synthesizeUserItemFromCreatorReferences: jest.fn().mockResolvedValue({
            latestSubmission: synthSubmission,
            priorSubmissions: undefined,
          }),
        });

        const result = await resolveItemsWithId({ itemId: 'i-1' }, ctx);

        expect(
          service.synthesizeUserItemFromCreatorReferences,
        ).toHaveBeenCalledTimes(1);
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({ isSynthetic: true });
      });

      it('returns real submissions and skips synthesis when the stream yields data', async () => {
        const submission = makeSubmission({ itemId: 'i-1' });
        const { ctx, service } = makeContext({
          getItemByTypeAgnosticIdentifier: jest.fn().mockReturnValue(
            singleAsyncIterable({
              latestSubmission: submission,
              priorSubmissions: undefined,
            }),
          ),
        });

        const result = await resolveItemsWithId({ itemId: 'i-1' }, ctx);

        expect(result).toHaveLength(1);
        expect(result[0].latest.id).toBe('i-1');
        expect(
          service.synthesizeUserItemFromCreatorReferences,
        ).not.toHaveBeenCalled();
      });
    });
  });
});

type ItemActionRow = {
  actionId: string;
  parameters: Record<string, unknown>;
};

describe('itemActionHistory parameter narrowing', () => {
  const execution = {
    actionId: 'action-ban',
    itemId: 'user-1',
    itemTypeId: 'user-type-1',
    actorId: 'moderator-1',
    jobId: 'job-1',
    itemCreatorId: undefined,
    itemCreatorTypeId: undefined,
    policies: [],
    ruleIds: [],
    ts: new Date('2026-06-01T10:00:00.000Z'),
  };

  function makeHistoryContext(opts: {
    /** Shorthand for a single execution row. */
    parameters?: Record<string, unknown>;
    /** Explicit rows, for cases that need more than one. */
    rows?: ReadonlyArray<Record<string, unknown>>;
    actions?: ReadonlyArray<Record<string, unknown>>;
  }) {
    const rows = opts.rows ?? [{ ...execution, parameters: opts.parameters }];
    const getActions = jest.fn(async () => opts.actions ?? []);
    return {
      getActions,
      ctx: {
        getUser: () => ({ orgId: 'org-1' }),
        services: {
          ItemInvestigationService: {
            getItemActionHistory: jest.fn(async () => rows),
          },
          ModerationConfigService: { getActions },
        },
      },
    };
  }

  const customAction = (
    parameterNames: readonly string[],
  ): Record<string, unknown> => ({
    id: 'action-ban',
    actionType: 'CUSTOM_ACTION',
    customMrtApiParams: parameterNames.map((name) => ({
      name,
      displayName: name,
      type: 'STRING',
      required: false,
    })),
  });

  /**
   * Narrow `resolvers.Query` to just the resolver under test, following the
   * pattern in `integration.resolver.test.ts`. Declaring the signature keeps
   * the argument and return shapes checked without standing up a full
   * `Context`, which these tests never exercise beyond the two services mocked
   * above.
   */
  async function run(ctx: unknown): Promise<ItemActionRow[]> {
    const Query = resolvers.Query as {
      itemActionHistory: (
        parent: unknown,
        args: { itemIdentifier: { id: string; typeId: string } },
        ctx: unknown,
      ) => Promise<unknown>;
    };

    return (await Query.itemActionHistory(
      {},
      { itemIdentifier: { id: 'user-1', typeId: 'user-type-1' } },
      ctx,
    )) as ItemActionRow[];
  }

  it('drops values the action does not declare', async () => {
    const { ctx } = makeHistoryContext({
      parameters: {
        num_days: 30,
        reportHistory: [{ reason: 'spam', reporter: 'u1' }],
        bogus_field: 'leak',
      },
      actions: [customAction(['num_days'])],
    });

    const [row] = await run(ctx);

    expect(row.parameters).toEqual({ num_days: 30 });
  });

  it('keeps a declared `reason` parameter', async () => {
    // The DEFAULT manual-review path overwrites `reason` with the decision
    // reason at write time, so the stored value may not be what the moderator
    // typed — but a declared parameter must still be shown rather than
    // filtered out as if it were callback metadata.
    const { ctx } = makeHistoryContext({
      parameters: { reason: 'Repeated scam posts', reportHistory: [] },
      actions: [customAction(['reason'])],
    });

    const [row] = await run(ctx);

    expect(row.parameters).toEqual({ reason: 'Repeated scam posts' });
  });

  it('passes stored values through when the action is unknown', async () => {
    const stored = { num_days: 30, reportHistory: [{ reason: 'spam' }] };
    const { ctx } = makeHistoryContext({ parameters: stored, actions: [] });

    const [row] = await run(ctx);

    expect(row.parameters).toEqual(stored);
  });

  it('declares nothing for a non-custom action', async () => {
    const { ctx } = makeHistoryContext({
      parameters: { reason: 'set by the callback' },
      actions: [{ id: 'action-ban', actionType: 'ENQUEUE_TO_MRT' }],
    });

    const [row] = await run(ctx);

    expect(row.parameters).toEqual({});
  });

  it('batches the lookup, one entry per distinct action', async () => {
    // Three rows across two actions: a per-row lookup would call twice with
    // duplicated ids, so this fails if the batching regresses.
    const { ctx, getActions } = makeHistoryContext({
      rows: [
        { ...execution, actionId: 'action-ban', parameters: { num_days: 30 } },
        { ...execution, actionId: 'action-warn', parameters: { note: 'x' } },
        { ...execution, actionId: 'action-ban', parameters: { num_days: 7 } },
      ],
      actions: [customAction(['num_days'])],
    });

    const rows = await run(ctx);

    expect(getActions).toHaveBeenCalledTimes(1);
    expect(getActions).toHaveBeenCalledWith({
      orgId: 'org-1',
      ids: ['action-ban', 'action-warn'],
    });
    // Narrowing still applied per row: `action-warn` has no spec, so its
    // stored values pass through; `action-ban` keeps only `num_days`.
    expect(rows.map((it) => it.parameters)).toEqual([
      { num_days: 30 },
      { note: 'x' },
      { num_days: 7 },
    ]);
  });
});
