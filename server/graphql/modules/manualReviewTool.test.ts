import { buildASTSchema, isInputObjectType } from 'graphql';

import { UserPermission } from '../../services/userManagementService/index.js';
import typeDefs from '../schema.js';
import {
  assertManualReviewJobIdsWithinLimit,
  MAX_MANUAL_REVIEW_JOB_IDS,
  resolvers,
} from './manualReviewTool.js';

describe('manual review job ID limit', () => {
  it('accepts up to the configured limit', () => {
    expect(() =>
      assertManualReviewJobIdsWithinLimit(
        Array.from({ length: MAX_MANUAL_REVIEW_JOB_IDS }, (_, i) => `${i}`),
      ),
    ).not.toThrow();
  });

  it('rejects requests over the configured limit', () => {
    expect(() =>
      assertManualReviewJobIdsWithinLimit(
        Array.from({ length: MAX_MANUAL_REVIEW_JOB_IDS + 1 }, (_, i) => `${i}`),
      ),
    ).toThrow(`At most ${MAX_MANUAL_REVIEW_JOB_IDS} job IDs may be requested.`);
  });
});

describe('queue role assignment visibility', () => {
  const resolve = resolvers.ManualReviewQueue.assignedRoleIds as (
    parent: { id: string },
    args: unknown,
    context: unknown,
  ) => Promise<unknown>;

  test.each([false, true])(
    'checks queue access for editor=%s',
    async (editor) => {
      const service = {
        getQueueForOrg: jest.fn(),
        getQueueForOrgAndDangerouslyBypassPermissioning: jest.fn(),
        getAssignedRoleIdsForQueue: jest.fn(async () => ['role-id']),
      };
      const context = {
        getUser: () => ({
          id: 'user',
          orgId: 'org',
          getPermissions: () =>
            editor ? [UserPermission.EDIT_MRT_QUEUES] : [],
        }),
        services: { ManualReviewToolService: service },
      };
      await expect(resolve({ id: 'queue' }, {}, context)).rejects.toThrow(
        'User does not have access to this queue',
      );
      expect(service.getAssignedRoleIdsForQueue).not.toHaveBeenCalled();
      const accessCheck = editor
        ? service.getQueueForOrgAndDangerouslyBypassPermissioning
        : service.getQueueForOrg;
      expect(accessCheck).toHaveBeenCalledWith({
        orgId: 'org',
        queueId: 'queue',
        ...(!editor ? { userId: 'user' } : {}),
      });
      accessCheck.mockResolvedValue({ id: 'queue' });
      await expect(resolve({ id: 'queue' }, {}, context)).resolves.toEqual([
        'role-id',
      ]);
      expect(service.getAssignedRoleIdsForQueue).toHaveBeenCalledWith({
        orgId: 'org',
        queueId: 'queue',
      });
    },
  );
});

describe('manual review queue inputs', () => {
  test.each(['CreateManualReviewQueueInput', 'UpdateManualReviewQueueInput'])(
    '%s requires roleIds',
    (inputName) => {
      const input = buildASTSchema(typeDefs).getType(inputName);
      expect(isInputObjectType(input)).toBe(true);
      if (!isInputObjectType(input)) {
        return;
      }

      expect(input.getFields().roleIds.type.toString()).toBe('[ID!]!');
    },
  );
});
