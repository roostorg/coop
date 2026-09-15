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
  const getBankById = jest.fn(async (orgId: string, id: number) =>
    orgId === 'org-1' && id === 42 ? { id: 42, org_id: 'org-1' } : null,
  );
  const ctx = {
    getUser: () => ({
      id: 'user-1',
      orgId: 'org-1',
      getPermissions: () => permissions,
    }),
    services: {
      NcmecService: { updateNcmecOrgSettings },
      HMAHashBankService: { getBankById },
    },
  };
  return { ctx, updateNcmecOrgSettings, getBankById };
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

describe('updateNcmecOrgSettings reported media hash bank', () => {
  it('persists a bank that belongs to the org', async () => {
    const { ctx, updateNcmecOrgSettings, getBankById } = makeCtx([
      UserPermission.MANAGE_ORG,
    ]);
    await Mutation.updateNcmecOrgSettings(
      {},
      { input: { ...VALID_INPUT, reportedMediaHashBankId: '42' } },
      ctx,
    );
    expect(getBankById).toHaveBeenCalledWith('org-1', 42);
    expect(updateNcmecOrgSettings).toHaveBeenCalledWith(
      expect.objectContaining({ reportedMediaHashBankId: 42 }),
    );
  });

  it('clears the bank when none is supplied', async () => {
    const { ctx, updateNcmecOrgSettings, getBankById } = makeCtx([
      UserPermission.MANAGE_ORG,
    ]);
    await Mutation.updateNcmecOrgSettings(
      {},
      { input: { ...VALID_INPUT, reportedMediaHashBankId: null } },
      ctx,
    );
    expect(getBankById).not.toHaveBeenCalled();
    expect(updateNcmecOrgSettings).toHaveBeenCalledWith(
      expect.objectContaining({ reportedMediaHashBankId: null }),
    );
  });

  it('rejects a bank from another org and a missing bank with the same message', async () => {
    const { ctx, updateNcmecOrgSettings, getBankById } = makeCtx([
      UserPermission.MANAGE_ORG,
    ]);
    getBankById.mockImplementation(async (orgId: string, id: number) =>
      orgId === 'org-2' && id === 7 ? { id: 7, org_id: 'org-2' } : null,
    );
    const errorFor = async (id: string) =>
      Mutation.updateNcmecOrgSettings(
        {},
        { input: { ...VALID_INPUT, reportedMediaHashBankId: id } },
        ctx,
      ).then(
        () => undefined,
        (e: Error) => e.message,
      );

    const otherOrgMessage = await errorFor('7');
    const missingMessage = await errorFor('999');

    expect(otherOrgMessage).toBeDefined();
    expect(otherOrgMessage).toBe(missingMessage);
    expect(updateNcmecOrgSettings).not.toHaveBeenCalled();
  });

  it('rejects a non-numeric bank id', async () => {
    const { ctx, updateNcmecOrgSettings, getBankById } = makeCtx([
      UserPermission.MANAGE_ORG,
    ]);
    await expect(
      Mutation.updateNcmecOrgSettings(
        {},
        { input: { ...VALID_INPUT, reportedMediaHashBankId: '4x2' } },
        ctx,
      ),
    ).rejects.toThrow('reportedMediaHashBankId');
    expect(getBankById).not.toHaveBeenCalled();
    expect(updateNcmecOrgSettings).not.toHaveBeenCalled();
  });
});
