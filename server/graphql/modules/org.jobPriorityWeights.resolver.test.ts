import {
  UserPermission,
  UserRole,
} from '../../services/userManagementService/index.js';
import { resolvers } from './org.js';

/**
 * `Org.jobPriorityWeights` exposes moderation-priority configuration, so it is
 * gated behind MANAGE_ORG just like the settings page and the
 * setJobPriorityWeights mutation. Without these tests the field could be opened
 * up by querying the Org type directly and nothing would notice.
 */
describe('Org.jobPriorityWeights resolver', () => {
  const ORG = { id: 'org-1' };

  const makeContext = (opts: {
    user: {
      orgId: string;
      permissions: UserPermission[];
    } | null;
    getJobPriorityWeights?: jest.Mock;
  }) => {
    const getJobPriorityWeights =
      opts.getJobPriorityWeights ?? jest.fn(async () => new Map());
    return {
      ctx: {
        getUser: () =>
          opts.user == null
            ? null
            : {
                id: 'user-1',
                orgId: opts.user.orgId,
                role: UserRole.MODERATOR,
                getPermissions: () => opts.user!.permissions,
              },
        services: {
          ManualReviewToolService: { getJobPriorityWeights },
        },
      },
      getJobPriorityWeights,
    };
  };

  const callResolver = async (ctx: unknown) =>
    (
      resolvers.Org as {
        jobPriorityWeights: (...a: unknown[]) => Promise<unknown>;
      }
    ).jobPriorityWeights(ORG, {}, ctx);

  it('rejects an unauthenticated caller without touching the service', async () => {
    const { ctx, getJobPriorityWeights } = makeContext({ user: null });

    await expect(callResolver(ctx)).rejects.toThrow(
      'Authenticated user required',
    );
    expect(getJobPriorityWeights).not.toHaveBeenCalled();
  });

  it('rejects a caller from a different org', async () => {
    // MANAGE_ORG in your own org must not grant reads of someone else's config.
    const { ctx, getJobPriorityWeights } = makeContext({
      user: { orgId: 'org-2', permissions: [UserPermission.MANAGE_ORG] },
    });

    await expect(callResolver(ctx)).rejects.toThrow(
      'Authenticated user required',
    );
    expect(getJobPriorityWeights).not.toHaveBeenCalled();
  });

  it('rejects a same-org caller lacking MANAGE_ORG', async () => {
    const { ctx, getJobPriorityWeights } = makeContext({
      user: {
        orgId: ORG.id,
        permissions: [UserPermission.VIEW_MRT, UserPermission.VIEW_MRT_DATA],
      },
    });

    await expect(callResolver(ctx)).rejects.toThrow(
      'User does not have permission to view org settings',
    );
    expect(getJobPriorityWeights).not.toHaveBeenCalled();
  });

  it('returns the org’s weights when the caller has MANAGE_ORG', async () => {
    const getJobPriorityWeights = jest.fn(
      async () =>
        new Map([
          ['numReports', 2],
          ['ageInQueue', 0.5],
        ]),
    );
    const { ctx } = makeContext({
      user: { orgId: ORG.id, permissions: [UserPermission.MANAGE_ORG] },
      getJobPriorityWeights,
    });

    await expect(callResolver(ctx)).resolves.toEqual([
      { property: 'numReports', weight: 2 },
      { property: 'ageInQueue', weight: 0.5 },
    ]);
    expect(getJobPriorityWeights).toHaveBeenCalledWith({ orgId: ORG.id });
  });
});
