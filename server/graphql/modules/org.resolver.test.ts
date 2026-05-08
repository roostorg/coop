import { type Action } from '../../services/moderationConfigService/index.js';
import { resolveOrgActions } from './org.js';

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
});
