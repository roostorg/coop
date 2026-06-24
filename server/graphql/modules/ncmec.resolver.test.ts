import { UserPermission } from '../../services/userManagementService/index.js';
import { resolvers } from './ncmec.js';

const Mutation = resolvers.Mutation as {
  updateNcmecOrgSettings: (
    parent: unknown,
    args: { input: Record<string, unknown> },
    ctx: unknown,
  ) => Promise<unknown>;
};

const VALID_INPUT = {
  username: 'cyber-user',
  password: 'cyber-pass',
  contactEmail: 'reporter@example.com',
};

function makeCtx(permissions: readonly UserPermission[]) {
  const updateNcmecOrgSettings = jest.fn(async () => undefined);
  const ctx = {
    getUser: () => ({
      id: 'user-1',
      orgId: 'org-1',
      getPermissions: () => permissions,
    }),
    services: { NcmecService: { updateNcmecOrgSettings } },
  };
  return { ctx, updateNcmecOrgSettings };
}

describe('updateNcmecOrgSettings media review policy', () => {
  it('defaults to ALL and drops any supplied threshold', async () => {
    const { ctx, updateNcmecOrgSettings } = makeCtx([
      UserPermission.MANAGE_ORG,
    ]);
    await Mutation.updateNcmecOrgSettings(
      {},
      { input: { ...VALID_INPUT, minMediaToReview: 5 } },
      ctx,
    );
    expect(updateNcmecOrgSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaReviewRequirement: 'ALL',
        minMediaToReview: null,
      }),
    );
  });

  it('persists the threshold when requirement is MINIMUM', async () => {
    const { ctx, updateNcmecOrgSettings } = makeCtx([
      UserPermission.MANAGE_ORG,
    ]);
    await Mutation.updateNcmecOrgSettings(
      {},
      {
        input: {
          ...VALID_INPUT,
          mediaReviewRequirement: 'MINIMUM',
          minMediaToReview: 3,
        },
      },
      ctx,
    );
    expect(updateNcmecOrgSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaReviewRequirement: 'MINIMUM',
        minMediaToReview: 3,
      }),
    );
  });

  it('defaults MINIMUM threshold to 1 when omitted', async () => {
    const { ctx, updateNcmecOrgSettings } = makeCtx([
      UserPermission.MANAGE_ORG,
    ]);
    await Mutation.updateNcmecOrgSettings(
      {},
      { input: { ...VALID_INPUT, mediaReviewRequirement: 'MINIMUM' } },
      ctx,
    );
    expect(updateNcmecOrgSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaReviewRequirement: 'MINIMUM',
        minMediaToReview: 1,
      }),
    );
  });

  it('rejects a non-positive MINIMUM threshold', async () => {
    const { ctx, updateNcmecOrgSettings } = makeCtx([
      UserPermission.MANAGE_ORG,
    ]);
    await expect(
      Mutation.updateNcmecOrgSettings(
        {},
        {
          input: {
            ...VALID_INPUT,
            mediaReviewRequirement: 'MINIMUM',
            minMediaToReview: 0,
          },
        },
        ctx,
      ),
    ).rejects.toThrow('minMediaToReview');
    expect(updateNcmecOrgSettings).not.toHaveBeenCalled();
  });

  it('rejects a fractional MINIMUM threshold', async () => {
    const { ctx, updateNcmecOrgSettings } = makeCtx([
      UserPermission.MANAGE_ORG,
    ]);
    await expect(
      Mutation.updateNcmecOrgSettings(
        {},
        {
          input: {
            ...VALID_INPUT,
            mediaReviewRequirement: 'MINIMUM',
            minMediaToReview: 1.5,
          },
        },
        ctx,
      ),
    ).rejects.toThrow('minMediaToReview');
    expect(updateNcmecOrgSettings).not.toHaveBeenCalled();
  });

  it('rejects an unknown requirement value', async () => {
    const { ctx, updateNcmecOrgSettings } = makeCtx([
      UserPermission.MANAGE_ORG,
    ]);
    await expect(
      Mutation.updateNcmecOrgSettings(
        {},
        { input: { ...VALID_INPUT, mediaReviewRequirement: 'SOME' } },
        ctx,
      ),
    ).rejects.toThrow('mediaReviewRequirement');
    expect(updateNcmecOrgSettings).not.toHaveBeenCalled();
  });
});
