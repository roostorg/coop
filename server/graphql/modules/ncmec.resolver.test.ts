import { vi } from 'vitest';

import { UserPermission } from '../../services/userManagementService/index.js';
import { resolvers } from './ncmec.js';

const Mutation = resolvers.Mutation as {
  updateNcmecOrgSettings: (
    parent: unknown,
    args: { input: Record<string, unknown> },
    ctx: unknown,
  ) => Promise<unknown>;
};

const Query = resolvers.Query as Record<
  'ncmecReportById' | 'ncmecThreads',
  (parent: unknown, args: unknown, ctx: unknown) => Promise<unknown>
>;

const VALID_INPUT = {
  username: 'cyber-user',
  password: 'cyber-pass',
  contactEmail: 'reporter@example.com',
};

function makeCtx(permissions: readonly UserPermission[]) {
  const updateNcmecOrgSettings = vi.fn(async () => undefined);
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

describe('NCMEC read surfaces require VIEW_CHILD_SAFETY_DATA', () => {
  function makeReadCtx(permissions: readonly UserPermission[] | null) {
    const getNcmecReportById = vi.fn(async () => null);
    const getNcmecMessages = vi.fn(async () => [] as unknown[]);
    const ctx = {
      getUser: () =>
        permissions === null
          ? null
          : {
              id: 'user-1',
              orgId: 'org-1',
              getPermissions: () => permissions,
            },
      services: { NcmecService: { getNcmecReportById, getNcmecMessages } },
    };
    return { ctx, getNcmecReportById, getNcmecMessages };
  }

  describe('Query.ncmecReportById', () => {
    it('throws forbiddenError when the caller lacks VIEW_CHILD_SAFETY_DATA', async () => {
      const { ctx, getNcmecReportById } = makeReadCtx([
        UserPermission.VIEW_MRT,
      ]);
      await expect(
        Query.ncmecReportById({}, { reportId: 'report-1' }, ctx),
      ).rejects.toThrow('VIEW_CHILD_SAFETY_DATA permission required');
      expect(getNcmecReportById).not.toHaveBeenCalled();
    });

    it('throws unauthenticatedError when there is no user', async () => {
      const { ctx, getNcmecReportById } = makeReadCtx(null);
      await expect(
        Query.ncmecReportById({}, { reportId: 'report-1' }, ctx),
      ).rejects.toThrow('User required.');
      expect(getNcmecReportById).not.toHaveBeenCalled();
    });

    it('reaches the service when the caller has VIEW_CHILD_SAFETY_DATA', async () => {
      const { ctx, getNcmecReportById } = makeReadCtx([
        UserPermission.VIEW_CHILD_SAFETY_DATA,
      ]);
      await expect(
        Query.ncmecReportById({}, { reportId: 'report-1' }, ctx),
      ).resolves.toBeNull();
      expect(getNcmecReportById).toHaveBeenCalledWith({
        orgId: 'org-1',
        reportId: 'report-1',
      });
    });
  });

  describe('Query.ncmecThreads', () => {
    it('throws forbiddenError when the caller lacks VIEW_CHILD_SAFETY_DATA', async () => {
      const { ctx, getNcmecMessages } = makeReadCtx([UserPermission.VIEW_MRT]);
      await expect(
        Query.ncmecThreads({}, { userId: 'user-9' }, ctx),
      ).rejects.toThrow('VIEW_CHILD_SAFETY_DATA permission required');
      expect(getNcmecMessages).not.toHaveBeenCalled();
    });

    it('throws unauthenticatedError when there is no user', async () => {
      const { ctx, getNcmecMessages } = makeReadCtx(null);
      await expect(
        Query.ncmecThreads({}, { userId: 'user-9' }, ctx),
      ).rejects.toThrow('User required.');
      expect(getNcmecMessages).not.toHaveBeenCalled();
    });

    it('reaches the service when the caller has VIEW_CHILD_SAFETY_DATA', async () => {
      const { ctx, getNcmecMessages } = makeReadCtx([
        UserPermission.VIEW_CHILD_SAFETY_DATA,
      ]);
      await expect(
        Query.ncmecThreads(
          {},
          { userId: 'user-9', reportedMessages: ['m-1'] },
          ctx,
        ),
      ).resolves.toEqual([]);
      expect(getNcmecMessages).toHaveBeenCalledWith('org-1', 'user-9', ['m-1']);
    });
  });
});
