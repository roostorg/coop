import { type GraphQLResolveInfo } from 'graphql';
import { vi } from 'vitest';

import {
  makeInvalidPolicyParentError,
  makePolicyHierarchyCycleError,
} from '../../services/moderationConfigService/index.js';
import { UserPermission } from '../../services/userManagementService/index.js';
import { makeNotFoundError } from '../../utils/errors.js';
import { type Context } from '../resolvers.js';
import { resolvers } from './policy.js';

const updatePolicy = resolvers.Mutation.updatePolicy;

describe('updatePolicy resolver', () => {
  it('adapts the authenticated user to a user mutation actor', async () => {
    const service = { updatePolicy: vi.fn().mockResolvedValue({ id: 'p' }) };
    const context = {
      getUser: () => ({
        id: 'user-id',
        orgId: 'org-id',
        getPermissions: () => [UserPermission.MANAGE_POLICIES],
      }),
      services: { ModerationConfigService: service },
    } as unknown as Context;
    if (typeof updatePolicy !== 'function')
      throw new Error('Missing updatePolicy resolver');

    await updatePolicy(
      {},
      { input: { id: 'policy-id', name: 'Policy' } },
      context,
      {} as GraphQLResolveInfo,
    );

    expect(service.updatePolicy).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: expect.objectContaining({ type: 'user', userId: 'user-id' }),
      }),
    );
  });

  it.each([
    [
      'NotFoundError',
      makeNotFoundError('Policy not found', { shouldErrorSpan: false }),
    ],
    [
      'InvalidPolicyParentError',
      makeInvalidPolicyParentError({ shouldErrorSpan: false }),
    ],
    [
      'PolicyHierarchyCycleError',
      makePolicyHierarchyCycleError({ shouldErrorSpan: false }),
    ],
  ])('maps %s into the GraphQL union', async (name, error) => {
    const service = { updatePolicy: vi.fn().mockRejectedValue(error) };
    const context = {
      getUser: () => ({
        id: 'user-id',
        orgId: 'org-id',
        getPermissions: () => [UserPermission.MANAGE_POLICIES],
      }),
      services: { ModerationConfigService: service },
    } as unknown as Context;
    if (typeof updatePolicy !== 'function')
      throw new Error('Missing updatePolicy resolver');

    const result = await updatePolicy(
      {},
      { input: { id: 'policy-id', name: 'Policy' } },
      context,
      {} as GraphQLResolveInfo,
    );

    expect(result).toEqual(expect.objectContaining({ __typename: name, name }));
  });
});
