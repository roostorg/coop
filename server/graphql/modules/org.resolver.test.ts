import { type Action } from '../../services/moderationConfigService/index.js';
import { UserPermission } from '../../services/userManagementService/index.js';
import { resolveOrgActions, resolvers } from './org.js';

function makeAction(
  id: string,
  actionType: Action['actionType'],
  orgId: string,
): Action {
  const base = {
    id,
    orgId,
    name: id,
    description: null,
    penalty: 'NONE' as const,
    applyUserStrikes: false,
  };
  if (actionType === 'CUSTOM_ACTION') {
    return {
      ...base,
      actionType,
      callbackUrl: 'https://example.com',
      callbackUrlBody: null,
      callbackUrlHeaders: null,
      customMrtApiParams: null,
    };
  }
  return { ...base, actionType };
}

describe('Org resolvers', () => {
  describe('resolveOrgActions', () => {
    function makeContext(opts: {
      orgId: string;
      callerOrgId?: string;
      actionTypes: Array<{ id: string; actionType: Action['actionType'] }>;
      hasNCMECReportingEnabled: boolean;
    }) {
      const actions = opts.actionTypes.map((a) =>
        makeAction(a.id, a.actionType, opts.orgId),
      );
      const getActions = jest.fn(async () => actions);
      const hasNCMECReportingEnabled = jest.fn(
        async () => opts.hasNCMECReportingEnabled,
      );
      const ctx = {
        getUser: () => ({ orgId: opts.callerOrgId ?? opts.orgId }),
        services: {
          ModerationConfigService: { getActions },
          NcmecService: { hasNCMECReportingEnabled },
        },
      };
      return { ctx, getActions, hasNCMECReportingEnabled };
    }

    it('hides ENQUEUE_TO_NCMEC built-in when NCMEC reporting is disabled', async () => {
      const { ctx } = makeContext({
        orgId: 'org-1',
        actionTypes: [
          { id: 'a-custom', actionType: 'CUSTOM_ACTION' },
          { id: 'a-mrt', actionType: 'ENQUEUE_TO_MRT' },
          { id: 'a-author', actionType: 'ENQUEUE_AUTHOR_TO_MRT' },
          { id: 'a-ncmec', actionType: 'ENQUEUE_TO_NCMEC' },
        ],
        hasNCMECReportingEnabled: false,
      });

      const result = await resolveOrgActions({ id: 'org-1' }, {}, ctx);
      expect(result.map((it) => it.id).sort()).toEqual([
        'a-author',
        'a-custom',
        'a-mrt',
      ]);
    });

    it('returns ENQUEUE_TO_NCMEC built-in when NCMEC reporting is enabled', async () => {
      const { ctx } = makeContext({
        orgId: 'org-1',
        actionTypes: [
          { id: 'a-mrt', actionType: 'ENQUEUE_TO_MRT' },
          { id: 'a-ncmec', actionType: 'ENQUEUE_TO_NCMEC' },
        ],
        hasNCMECReportingEnabled: true,
      });

      const result = await resolveOrgActions({ id: 'org-1' }, {}, ctx);
      expect(result.map((it) => it.id).sort()).toEqual(['a-mrt', 'a-ncmec']);
    });

    it('rejects when caller org does not match the requested org (IDOR guard)', async () => {
      const { ctx, getActions, hasNCMECReportingEnabled } = makeContext({
        orgId: 'org-1',
        callerOrgId: 'other-org',
        actionTypes: [],
        hasNCMECReportingEnabled: false,
      });

      await expect(resolveOrgActions({ id: 'org-1' }, {}, ctx)).rejects.toThrow(
        'User required.',
      );
      expect(getActions).not.toHaveBeenCalled();
      expect(hasNCMECReportingEnabled).not.toHaveBeenCalled();
    });
  });

  describe('Org sensitive field resolvers require MANAGE_ORG', () => {
    function makeCtx(opts: {
      orgId: string;
      permissions: readonly UserPermission[];
      callerOrgId?: string;
    }) {
      const getActivatedApiKeyForOrg = jest.fn(async () => ({
        key: 'api-key-secret',
      }));
      const getPublicSigningKeyPem = jest.fn(async () => 'PEM_BODY');
      const getAllIntegrationConfigs = jest.fn(async () => []);
      const ctx = {
        getUser: () => ({
          id: 'user-1',
          orgId: opts.callerOrgId ?? opts.orgId,
          getPermissions: () => opts.permissions,
        }),
        dataSources: {
          orgAPI: { getActivatedApiKeyForOrg, getPublicSigningKeyPem },
          integrationAPI: { getAllIntegrationConfigs },
        },
      };
      return {
        ctx,
        getActivatedApiKeyForOrg,
        getPublicSigningKeyPem,
        getAllIntegrationConfigs,
      };
    }

    const orgParent = { id: 'org-1' };
    const Org = resolvers.Org as Record<
      'apiKey' | 'publicSigningKey' | 'integrationConfigs',
      (
        parent: typeof orgParent,
        args: unknown,
        ctx: unknown,
      ) => Promise<unknown>
    >;

    it('Org.apiKey throws forbiddenError when caller lacks MANAGE_ORG', async () => {
      const { ctx, getActivatedApiKeyForOrg } = makeCtx({
        orgId: 'org-1',
        permissions: [UserPermission.VIEW_MRT],
      });
      await expect(Org.apiKey(orgParent, {}, ctx)).rejects.toThrow(
        'User does not have permission to view the org API key',
      );
      expect(getActivatedApiKeyForOrg).not.toHaveBeenCalled();
    });

    it('Org.apiKey returns the key when caller has MANAGE_ORG', async () => {
      const { ctx, getActivatedApiKeyForOrg } = makeCtx({
        orgId: 'org-1',
        permissions: [UserPermission.MANAGE_ORG],
      });
      await expect(Org.apiKey(orgParent, {}, ctx)).resolves.toBe(
        'api-key-secret',
      );
      expect(getActivatedApiKeyForOrg).toHaveBeenCalledWith('org-1');
    });

    it('Org.publicSigningKey throws forbiddenError when caller lacks MANAGE_ORG', async () => {
      const { ctx, getPublicSigningKeyPem } = makeCtx({
        orgId: 'org-1',
        permissions: [UserPermission.VIEW_MRT],
      });
      await expect(Org.publicSigningKey(orgParent, {}, ctx)).rejects.toThrow(
        'User does not have permission to view the webhook signing key',
      );
      expect(getPublicSigningKeyPem).not.toHaveBeenCalled();
    });

    it('Org.integrationConfigs throws forbiddenError when caller lacks MANAGE_ORG', async () => {
      const { ctx, getAllIntegrationConfigs } = makeCtx({
        orgId: 'org-1',
        permissions: [UserPermission.VIEW_MRT],
      });
      await expect(Org.integrationConfigs(orgParent, {}, ctx)).rejects.toThrow(
        'User does not have permission to view integration configs',
      );
      expect(getAllIntegrationConfigs).not.toHaveBeenCalled();
    });

    it('Org.apiKey still throws unauthenticatedError when caller is in a different org (IDOR guard runs first)', async () => {
      const { ctx } = makeCtx({
        orgId: 'org-1',
        callerOrgId: 'other-org',
        permissions: [UserPermission.MANAGE_ORG],
      });
      await expect(Org.apiKey(orgParent, {}, ctx)).rejects.toThrow(
        'User required.',
      );
    });
  });
});
