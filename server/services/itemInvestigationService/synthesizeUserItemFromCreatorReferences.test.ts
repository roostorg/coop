import { type UserItemType } from '../moderationConfigService/index.js';
import { synthesizeUserItemFromCreatorReferences } from './synthesizeUserItemFromCreatorReferences.js';

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

type Deps = Parameters<typeof synthesizeUserItemFromCreatorReferences>[0];

function makeDeps(overrides: Partial<Deps> = {}): Deps {
  return {
    orgId: 'org-1',
    itemId: 'user-id-xyz',
    scyllaCreatorRefExists: jest.fn().mockResolvedValue(false),
    actionExecutionsAdapter: {
      findInferredUserIdentity: jest.fn().mockResolvedValue(null),
    },
    contentApiRequestsAdapter: {
      findInferredUserIdentityFromCreators: jest.fn().mockResolvedValue(null),
    },
    moderationConfigService: {
      getItemType: jest.fn(),
      getItemTypes: jest.fn().mockResolvedValue([]),
    },
    ...overrides,
  };
}

describe('synthesizeUserItemFromCreatorReferences', () => {
  it('returns null when every source comes up empty', async () => {
    const result = await synthesizeUserItemFromCreatorReferences(makeDeps());
    expect(result).toBeNull();
  });

  describe('with a pinned knownUserTypeId (URL-driven typed path)', () => {
    it('synthesizes when Scylla shows the id is referenced as a creator', async () => {
      const userType = makeUserType();
      const scyllaCreatorRefExists = jest.fn().mockResolvedValue(true);
      const findInferredUserIdentity = jest.fn();

      const result = await synthesizeUserItemFromCreatorReferences(
        makeDeps({
          knownUserTypeId: userType.id,
          scyllaCreatorRefExists,
          moderationConfigService: {
            getItemType: jest.fn().mockResolvedValue(userType),
            getItemTypes: jest.fn(),
          },
          actionExecutionsAdapter: { findInferredUserIdentity },
        }),
      );

      expect(result?.latestSubmission.itemType).toEqual(userType);
      expect(result?.latestSubmission.itemId).toBe('user-id-xyz');
      expect(result?.latestSubmission.submissionTime).toBeUndefined();
      expect(result?.latestSubmission.data).toEqual({});
      // Fast path: no warehouse adapters consulted when Scylla confirms.
      expect(findInferredUserIdentity).not.toHaveBeenCalled();
      expect(scyllaCreatorRefExists).toHaveBeenCalledWith({
        orgId: 'org-1',
        creatorIdentifier: { id: 'user-id-xyz', typeId: userType.id },
      });
    });

    it('does NOT synthesize when the pinned type is not a USER type', async () => {
      const result = await synthesizeUserItemFromCreatorReferences(
        makeDeps({
          knownUserTypeId: 'content-type-1',
          scyllaCreatorRefExists: jest.fn().mockResolvedValue(true),
          moderationConfigService: {
            getItemType: jest.fn().mockResolvedValue({
              id: 'content-type-1',
              kind: 'CONTENT',
            }),
            getItemTypes: jest.fn().mockResolvedValue([]),
          },
        }),
      );

      // Even though Scylla had a hit, content/thread synthesis is out of
      // scope for this fallback. We fall through and find nothing.
      expect(result).toBeNull();
    });

    it('falls through to inference when the pinned type has no Scylla references', async () => {
      const userType = makeUserType();
      // Pinned type returns null from Scylla; we should keep looking via the
      // inference path. Action-executions confirms.
      const scyllaCreatorRefExists = jest.fn().mockResolvedValue(false);

      const result = await synthesizeUserItemFromCreatorReferences(
        makeDeps({
          knownUserTypeId: userType.id,
          scyllaCreatorRefExists,
          moderationConfigService: {
            getItemType: jest.fn().mockResolvedValue(userType),
            getItemTypes: jest.fn().mockResolvedValue([userType]),
          },
          actionExecutionsAdapter: {
            findInferredUserIdentity: jest.fn().mockResolvedValue({
              itemTypeId: userType.id,
              lastSeenAt: new Date(),
            }),
          },
        }),
      );

      expect(result?.latestSubmission.itemType).toEqual(userType);
    });
  });

  it('mints a deterministic synthetic submission id derived from the itemId', async () => {
    const userType = makeUserType();
    const result = await synthesizeUserItemFromCreatorReferences(
      makeDeps({
        itemId: 'user-id-xyz',
        scyllaCreatorRefExists: jest.fn().mockResolvedValue(true),
        moderationConfigService: {
          getItemType: jest.fn().mockResolvedValue(userType),
          getItemTypes: jest.fn().mockResolvedValue([userType]),
        },
      }),
    );

    expect(result?.latestSubmission.submissionId).toBe('synthetic:user-id-xyz');
  });

  it('short-circuits when the org has no USER item types (no Scylla calls)', async () => {
    const scyllaCreatorRefExists = jest.fn();
    const findInferredUserIdentity = jest.fn();

    const result = await synthesizeUserItemFromCreatorReferences(
      makeDeps({
        scyllaCreatorRefExists,
        moderationConfigService: {
          getItemType: jest.fn(),
          getItemTypes: jest.fn().mockResolvedValue([
            // org has only non-USER types
            { id: 'content-1', kind: 'CONTENT' },
            { id: 'thread-1', kind: 'THREAD' },
          ]),
        },
        actionExecutionsAdapter: { findInferredUserIdentity },
      }),
    );

    expect(scyllaCreatorRefExists).not.toHaveBeenCalled();
    // We still consult the warehouse since the type-agnostic lookup may
    // surface a real id even when the org has no user types we can sweep.
    expect(findInferredUserIdentity).toHaveBeenCalledTimes(1);
    expect(result).toBeNull();
  });

  it('does NOT re-check the already-checked pinned type in the broad sweep', async () => {
    const pinned = makeUserType({ id: 'utype-pinned' });
    const other = makeUserType({ id: 'utype-other' });
    const scyllaCreatorRefExists = jest.fn().mockResolvedValue(false);

    await synthesizeUserItemFromCreatorReferences(
      makeDeps({
        knownUserTypeId: pinned.id,
        scyllaCreatorRefExists,
        moderationConfigService: {
          getItemType: jest.fn().mockResolvedValue(pinned),
          getItemTypes: jest.fn().mockResolvedValue([pinned, other]),
        },
      }),
    );

    const sweptTypeIds = scyllaCreatorRefExists.mock.calls.map(
      ([{ creatorIdentifier }]) => creatorIdentifier.typeId,
    );
    // Fast path probes the pinned type once; broad sweep must skip it.
    expect(sweptTypeIds).toEqual([pinned.id, other.id]);
  });

  describe('inference path (no pinned typeId)', () => {
    it('synthesizes from a Scylla creator-by-id match on the first user type tried', async () => {
      const userType = makeUserType({ id: 'utype-A' });
      const scyllaCreatorRefExists = jest
        .fn()
        .mockImplementation(
          async ({ creatorIdentifier }) =>
            creatorIdentifier.typeId === userType.id,
        );
      const findInferredUserIdentity = jest.fn();

      const result = await synthesizeUserItemFromCreatorReferences(
        makeDeps({
          scyllaCreatorRefExists,
          moderationConfigService: {
            getItemType: jest.fn(),
            getItemTypes: jest.fn().mockResolvedValue([userType]),
          },
          actionExecutionsAdapter: { findInferredUserIdentity },
        }),
      );

      expect(result?.latestSubmission.itemType).toEqual(userType);
      // Warehouse adapters never consulted when Scylla finds a match.
      expect(findInferredUserIdentity).not.toHaveBeenCalled();
    });

    it('falls back to action executions when Scylla creator refs are empty', async () => {
      const userType = makeUserType({ id: 'utype-from-actions' });
      const findInferredUserIdentity = jest.fn().mockResolvedValue({
        itemTypeId: userType.id,
        lastSeenAt: new Date(),
      });
      const fromCreators = jest.fn();

      const result = await synthesizeUserItemFromCreatorReferences(
        makeDeps({
          moderationConfigService: {
            getItemType: jest.fn().mockResolvedValue(userType),
            getItemTypes: jest.fn().mockResolvedValue([userType]),
          },
          actionExecutionsAdapter: { findInferredUserIdentity },
          contentApiRequestsAdapter: {
            findInferredUserIdentityFromCreators: fromCreators,
          },
        }),
      );

      expect(result?.latestSubmission.itemType).toEqual(userType);
      expect(fromCreators).not.toHaveBeenCalled();
    });

    it('only consults content-API creators when action executions return null', async () => {
      const userType = makeUserType({ id: 'utype-from-content-api' });
      const findInferredUserIdentity = jest.fn().mockResolvedValue(null);
      const findInferredUserIdentityFromCreators = jest.fn().mockResolvedValue({
        itemTypeId: userType.id,
        lastSeenAt: new Date(),
      });

      const result = await synthesizeUserItemFromCreatorReferences(
        makeDeps({
          moderationConfigService: {
            getItemType: jest.fn().mockResolvedValue(userType),
            getItemTypes: jest.fn().mockResolvedValue([userType]),
          },
          actionExecutionsAdapter: { findInferredUserIdentity },
          contentApiRequestsAdapter: { findInferredUserIdentityFromCreators },
        }),
      );

      expect(findInferredUserIdentity).toHaveBeenCalledTimes(1);
      expect(findInferredUserIdentityFromCreators).toHaveBeenCalledTimes(1);
      expect(result?.latestSubmission.itemType).toEqual(userType);
    });

    it('refuses to synthesize when the inferred typeId no longer resolves to any type', async () => {
      const result = await synthesizeUserItemFromCreatorReferences(
        makeDeps({
          actionExecutionsAdapter: {
            findInferredUserIdentity: jest.fn().mockResolvedValue({
              itemTypeId: 'deleted-type',
              lastSeenAt: new Date(),
            }),
          },
          moderationConfigService: {
            getItemType: jest.fn().mockResolvedValue(undefined),
            getItemTypes: jest.fn().mockResolvedValue([]),
          },
        }),
      );

      expect(result).toBeNull();
    });

    it('refuses to synthesize when the inferred type is not a USER type', async () => {
      // Guards against accidentally surfacing a content/thread id with a
      // missing submission as if it were a user.
      const result = await synthesizeUserItemFromCreatorReferences(
        makeDeps({
          actionExecutionsAdapter: {
            findInferredUserIdentity: jest.fn().mockResolvedValue({
              itemTypeId: 'content-type-1',
              lastSeenAt: new Date(),
            }),
          },
          moderationConfigService: {
            getItemType: jest.fn().mockResolvedValue({
              id: 'content-type-1',
              kind: 'CONTENT',
            }),
            getItemTypes: jest.fn().mockResolvedValue([]),
          },
        }),
      );

      expect(result).toBeNull();
    });
  });
});
