import { ApolloServer } from '@apollo/server';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { vi } from 'vitest';

import { makePolicyNameExistsError } from '../../services/moderationConfigService/index.js';
import { UserPermission } from '../../services/userManagementService/index.js';
import { jsonStringify } from '../../utils/encoding.js';
import {
  makeBadRequestError,
  makeUnauthorizedError,
} from '../../utils/errors.js';
import { formatGraphQLError } from '../utils/formatError.js';
import { typeDefs as genericTypeDefs } from './generic.js';
import { resolvers, typeDefs } from './policy.js';

const schema = makeExecutableSchema({
  typeDefs: [genericTypeDefs, typeDefs],
  resolvers,
});

const createPolicy = vi.fn();
const user = {
  id: 'user-1',
  orgId: 'org-1',
  getPermissions: () => [UserPermission.MANAGE_POLICIES],
};

function makeContext(getUser: () => typeof user | null = () => user) {
  return {
    getUser,
    services: { ModerationConfigService: { createPolicy } },
  };
}

// Execute through Apollo so schema construction and execution use the same
// GraphQL module instance in Vitest, matching the production execution path.
const apollo = new ApolloServer<ReturnType<typeof makeContext>>({
  schema,
  formatError: formatGraphQLError,
  includeStacktraceInErrorResponses: false,
});

beforeAll(async () => apollo.start());
afterAll(async () => apollo.stop());

async function savePolicies(
  policies = [{ name: 'Spam' }],
  getUser: () => typeof user | null = () => user,
  includeFailureDetails = true,
) {
  const response = await apollo.executeOperation(
    {
      query: `
        mutation AddPolicies($policies: [AddPolicyInput!]!) {
          addPolicies(policies: $policies) {
            policies { id name }
            failures
            ${includeFailureDetails ? 'failureDetails { name title detail status }' : ''}
          }
        }
      `,
      variables: { policies },
    },
    { contextValue: makeContext(getUser) },
  );
  if (response.body.kind !== 'single') {
    throw new Error('Expected a single GraphQL response');
  }
  return response.body.singleResult;
}

describe('policy creation errors', () => {
  beforeEach(() => {
    createPolicy.mockReset();
  });

  it.each([
    [
      makePolicyNameExistsError({ shouldErrorSpan: true }),
      'A policy with that name already exists in this organization.',
      409,
    ],
    [
      makeUnauthorizedError('You do not have permission to create policies', {
        shouldErrorSpan: true,
      }),
      'You do not have permission to create policies',
      403,
    ],
    [
      makeBadRequestError('The parent policy is invalid.', {
        shouldErrorSpan: true,
      }),
      'The parent policy is invalid.',
      400,
    ],
  ])('preserves the safe reason: %s', async (error, title, status) => {
    createPolicy.mockRejectedValue(error);

    expect(await savePolicies()).toEqual({
      data: {
        addPolicies: {
          policies: [],
          failures: ['Spam'],
          failureDetails: [{ name: 'Spam', title, status, detail: null }],
        },
      },
    });
    expect(createPolicy).toHaveBeenCalledExactlyOnceWith({
      policy: {
        name: 'Spam',
        parentId: null,
        policyText: null,
        enforcementGuidelines: null,
        policyType: null,
      },
      orgId: 'org-1',
      invokedBy: {
        userId: 'user-1',
        orgId: 'org-1',
        permissions: [UserPermission.MANAGE_POLICIES],
      },
    });
  });

  it('sanitizes unexpected errors unless debug details are explicitly enabled', async () => {
    createPolicy.mockRejectedValue(new Error('private SQL constraint details'));

    const result = await savePolicies();

    const exposeDebugDetails =
      process.env.EXPOSE_SENSITIVE_IMPLEMENTATION_DETAILS_IN_ERRORS === 'true';
    expect(result).toEqual({
      data: {
        addPolicies: {
          policies: [],
          failures: ['Spam'],
          failureDetails: [
            {
              name: 'Spam',
              title: exposeDebugDetails
                ? 'Error: private SQL constraint details'
                : 'Unknown error',
              status: 500,
              detail: null,
            },
          ],
        },
      },
    });
    if (!exposeDebugDetails) {
      expect(jsonStringify(result)).not.toContain('private SQL');
    }
  });

  it('preserves partial successes and the legacy list of failed names', async () => {
    createPolicy
      .mockResolvedValueOnce({ id: 'policy-1', name: 'Allowed' })
      .mockRejectedValueOnce(
        makePolicyNameExistsError({ shouldErrorSpan: true }),
      );

    const result = await savePolicies([
      { name: 'Allowed' },
      { name: 'Duplicate' },
    ]);

    expect(result.errors).toBeUndefined();
    expect(result.data?.addPolicies).toEqual({
      policies: [{ id: 'policy-1', name: 'Allowed' }],
      failures: ['Duplicate'],
      failureDetails: [
        {
          name: 'Duplicate',
          title: 'A policy with that name already exists in this organization.',
          status: 409,
          detail: null,
        },
      ],
    });
  });

  it('keeps existing clients that only select failures working', async () => {
    createPolicy.mockRejectedValue(
      makePolicyNameExistsError({ shouldErrorSpan: true }),
    );

    expect(await savePolicies(undefined, undefined, false)).toEqual({
      data: { addPolicies: { policies: [], failures: ['Spam'] } },
    });
  });

  it('returns no failure details after successful creation', async () => {
    createPolicy.mockResolvedValue({ id: 'policy-1', name: 'Spam' });

    expect(await savePolicies()).toEqual({
      data: {
        addPolicies: {
          policies: [{ id: 'policy-1', name: 'Spam' }],
          failures: [],
          failureDetails: [],
        },
      },
    });
  });

  it('rejects anonymous requests before attempting creation', async () => {
    const result = await savePolicies(undefined, () => null);

    expect(result.errors?.[0].message).toBe('Authenticated user required.');
    expect(createPolicy).not.toHaveBeenCalled();
  });
});
