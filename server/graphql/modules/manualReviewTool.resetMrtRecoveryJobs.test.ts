import { UserPermission } from '../../services/userManagementService/index.js';
import { resolvers } from './manualReviewTool.js';

const Mutation = resolvers.Mutation as {
  resetMrtRecoveryJobs: (
    parent: unknown,
    args: { jobIds: readonly string[] },
    ctx: unknown,
  ) => Promise<unknown>;
};

describe('manualReviewTool resetMrtRecoveryJobs', () => {
  function makeCtx(opts?: { permissions?: readonly UserPermission[] }) {
    const resetFailedRecoveryStates = jest.fn(async () => 1);
    const ctx = {
      getUser: () => ({
        orgId: 'org-1',
        getPermissions: () => opts?.permissions ?? [UserPermission.MANAGE_ORG],
      }),
      services: {
        ManualReviewToolService: { resetFailedRecoveryStates },
      },
    };
    return { ctx, resetFailedRecoveryStates };
  }

  it('returns success without calling the service for an empty list', async () => {
    const { ctx, resetFailedRecoveryStates } = makeCtx();

    await expect(
      Mutation.resetMrtRecoveryJobs({}, { jobIds: [] }, ctx),
    ).resolves.toMatchObject({
      __typename: 'ResetMrtRecoveryJobsSuccessResponse',
      success: true,
    });
    expect(resetFailedRecoveryStates).not.toHaveBeenCalled();
  });

  it('rejects invalid job ids before calling the service', async () => {
    const { ctx, resetFailedRecoveryStates } = makeCtx();

    await expect(
      Mutation.resetMrtRecoveryJobs({}, { jobIds: ['not-a-job-id'] }, ctx),
    ).rejects.toThrow('Invalid MRT recovery job id.');
    expect(resetFailedRecoveryStates).not.toHaveBeenCalled();
  });

  it('passes the caller orgId to the service', async () => {
    const { ctx, resetFailedRecoveryStates } = makeCtx();

    await expect(
      Mutation.resetMrtRecoveryJobs(
        {},
        { jobIds: ['d29yay1qb2I:Z3VpZA'] },
        ctx,
      ),
    ).resolves.toMatchObject({
      __typename: 'ResetMrtRecoveryJobsSuccessResponse',
      success: true,
    });
    expect(resetFailedRecoveryStates).toHaveBeenCalledWith({
      orgId: 'org-1',
      jobIds: ['d29yay1qb2I:Z3VpZA'],
    });
  });
});
