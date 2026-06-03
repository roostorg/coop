import { UserPermission } from '../../services/userManagementService/index.js';
import { resolvers } from './integration.js';

// The MANAGE_ORG check fires before any data-source or integration-registry
// lookup, so these tests exercise the forbidden path with a minimal mock ctx
// that never gets reached for the underlying API calls.

describe('integration resolvers', () => {
  function makeCtx(permissions: readonly UserPermission[]) {
    const getConfigWithMetadata = jest.fn();
    const setConfig = jest.fn();
    const setConfigByIntegrationId = jest.fn();
    const ctx = {
      getUser: () => ({
        id: 'user-1',
        orgId: 'org-1',
        getPermissions: () => permissions,
      }),
      dataSources: {
        integrationAPI: {
          getConfigWithMetadata,
          setConfig,
          setConfigByIntegrationId,
        },
      },
    };
    return { ctx, getConfigWithMetadata, setConfig, setConfigByIntegrationId };
  }

  it('Query.integrationConfig throws forbiddenError when caller lacks MANAGE_ORG', async () => {
    const { ctx, getConfigWithMetadata } = makeCtx([UserPermission.VIEW_MRT]);
    const Query = resolvers.Query as {
      integrationConfig: (
        parent: unknown,
        args: { name: string },
        ctx: unknown,
      ) => Promise<unknown>;
    };
    await expect(
      Query.integrationConfig({}, { name: 'OPEN_AI' }, ctx),
    ).rejects.toThrow(
      'User does not have permission to view integration configs',
    );
    expect(getConfigWithMetadata).not.toHaveBeenCalled();
  });

  it('Mutation.setIntegrationConfig throws forbiddenError when caller lacks MANAGE_ORG', async () => {
    const { ctx, setConfig } = makeCtx([UserPermission.VIEW_MRT]);
    const Mutation = resolvers.Mutation as {
      setIntegrationConfig: (
        parent: unknown,
        args: { input: unknown },
        ctx: unknown,
      ) => Promise<unknown>;
    };
    await expect(
      Mutation.setIntegrationConfig({}, { input: {} }, ctx),
    ).rejects.toThrow(
      'User does not have permission to update integration configs',
    );
    expect(setConfig).not.toHaveBeenCalled();
  });

  it('Mutation.setPluginIntegrationConfig throws forbiddenError when caller lacks MANAGE_ORG', async () => {
    const { ctx, setConfigByIntegrationId } = makeCtx([
      UserPermission.VIEW_MRT,
    ]);
    const Mutation = resolvers.Mutation as {
      setPluginIntegrationConfig: (
        parent: unknown,
        args: { input: { integrationId: string; credential: unknown } },
        ctx: unknown,
      ) => Promise<unknown>;
    };
    await expect(
      Mutation.setPluginIntegrationConfig(
        {},
        { input: { integrationId: 'fake', credential: {} } },
        ctx,
      ),
    ).rejects.toThrow(
      'User does not have permission to update integration configs',
    );
    expect(setConfigByIntegrationId).not.toHaveBeenCalled();
  });
});
