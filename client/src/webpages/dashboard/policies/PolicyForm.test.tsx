import type { GQLAddPoliciesMutation } from '@/graphql/generated';
import { ApolloError } from '@apollo/client';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { GraphQLError } from 'graphql';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import PolicyForm from './PolicyForm';

type Harness = {
  addPolicy: ReturnType<typeof vi.fn>;
  response: GQLAddPoliciesMutation;
  error?: ApolloError;
};

const harness = vi.hoisted<Harness>(() => ({
  addPolicy: vi.fn(),
  response: {
    __typename: 'Mutation',
    addPolicies: {
      __typename: 'AddPoliciesResponse',
      policies: [],
      failures: [],
      failureDetails: [],
    },
  },
}));

vi.mock('@/graphql/generated', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/graphql/generated')>()),
  useGQLPoliciesQuery: () => ({
    data: { myOrg: { policies: [] } },
    loading: false,
  }),
  useGQLAddPoliciesMutation() {
    harness.addPolicy.mockImplementation(
      async (options: {
        onCompleted?: (data: GQLAddPoliciesMutation) => void;
        onError?: (error: ApolloError) => void;
      }) => {
        if (harness.error) {
          options.onError?.(harness.error);
          return {};
        }
        options.onCompleted?.(harness.response);
        return { data: harness.response };
      },
    );
    return [harness.addPolicy, { loading: false }];
  },
  useGQLUpdatePolicyMutation: () => [vi.fn(), { loading: false }],
}));

vi.mock('./MarkdownTextInput', () => ({
  default: () => null,
}));

vi.mock('../components/CoopModal', () => ({
  default: function MockModal({
    title,
    visible,
    children,
  }: {
    title: React.ReactNode;
    visible: boolean;
    children: React.ReactNode;
  }) {
    return visible ? (
      <div role="dialog">
        <div>{title}</div>
        {children}
      </div>
    ) : null;
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  harness.error = undefined;
  harness.response = {
    __typename: 'Mutation',
    addPolicies: {
      __typename: 'AddPoliciesResponse',
      policies: [],
      failures: ['Duplicate Policy'],
      failureDetails: [
        {
          __typename: 'PolicyCreationFailure',
          name: 'Duplicate Policy',
          title: 'A policy with that name already exists in this organization.',
          detail: null,
        },
      ],
    },
  };
});

afterEach(cleanup);

function renderPolicyForm() {
  render(
    <HelmetProvider>
      <MemoryRouter>
        <PolicyForm />
      </MemoryRouter>
    </HelmetProvider>,
  );
}

async function submitPolicy(name: string) {
  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: name },
  });

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
  });
}

describe('PolicyForm', () => {
  it('shows the backend duplicate-name error instead of success', async () => {
    renderPolicyForm();
    await submitPolicy('Duplicate Policy');

    expect(
      screen.getByText(
        'A policy with that name already exists in this organization.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText('Policy Created')).toBeNull();
  });

  it('shows a different backend reason without assuming the name is duplicated', async () => {
    harness.response = {
      ...harness.response,
      addPolicies: {
        ...harness.response.addPolicies,
        failureDetails: [
          {
            __typename: 'PolicyCreationFailure',
            name: 'New Policy',
            title: 'You do not have permission to create policies',
            detail: 'Ask an administrator to update your permissions.',
          },
        ],
      },
    };
    renderPolicyForm();
    await submitPolicy('New Policy');

    expect(
      screen.getByText(
        'You do not have permission to create policies Ask an administrator to update your permissions.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText('Policy Created')).toBeNull();
    expect(screen.queryByText(/already exists/)).toBeNull();
  });

  it('falls back when no useful backend failure detail is available', async () => {
    harness.response = {
      ...harness.response,
      addPolicies: {
        ...harness.response.addPolicies,
        failureDetails: [],
      },
    };
    renderPolicyForm();
    await submitPolicy('New Policy');

    expect(
      screen.getByText('Error saving policy. Please try again.'),
    ).toBeTruthy();
    expect(screen.queryByText('Policy Created')).toBeNull();
  });

  it('shows a backend GraphQL error', async () => {
    harness.error = new ApolloError({
      graphQLErrors: [new GraphQLError('Authenticated user required.')],
    });
    renderPolicyForm();
    await submitPolicy('New Policy');

    expect(screen.getByText('Authenticated user required.')).toBeTruthy();
    expect(screen.queryByText('Policy Created')).toBeNull();
  });

  it('uses a generic fallback for a network error', async () => {
    harness.error = new ApolloError({
      networkError: new Error('Internal network configuration details'),
    });
    renderPolicyForm();
    await submitPolicy('New Policy');

    expect(
      screen.getByText('Error saving policy. Please try again.'),
    ).toBeTruthy();
    expect(screen.queryByText(/Internal network/)).toBeNull();
    expect(screen.queryByText('Policy Created')).toBeNull();
  });

  it('shows success when policy creation has no failures', async () => {
    harness.response = {
      __typename: 'Mutation',
      addPolicies: {
        __typename: 'AddPoliciesResponse',
        policies: [
          {
            __typename: 'Policy',
            id: 'policy-1',
            name: 'New Policy',
          },
        ],
        failures: [],
        failureDetails: [],
      },
    };
    renderPolicyForm();
    await submitPolicy('New Policy');

    expect(screen.getByText('Policy Created')).toBeTruthy();
    expect(
      screen.queryByText('Error saving policy. Please try again.'),
    ).toBeNull();
  });
});
