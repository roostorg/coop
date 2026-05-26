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
