import type { GQLAddPoliciesMutation } from '@/graphql/generated';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import PolicyForm from './PolicyForm';

type Harness = {
  addPolicy: ReturnType<typeof vi.fn>;
  response: GQLAddPoliciesMutation;
};

const harness = vi.hoisted<Harness>(() => ({
  addPolicy: vi.fn(),
  response: {
    __typename: 'Mutation',
    addPolicies: {
      __typename: 'AddPoliciesResponse',
      policies: [],
      failures: [],
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
      }) => {
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
  harness.response = {
    __typename: 'Mutation',
    addPolicies: {
      __typename: 'AddPoliciesResponse',
      policies: [],
      failures: ['Duplicate Policy'],
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
  it('shows a generic error instead of success when policy creation fails', async () => {
    renderPolicyForm();
    await submitPolicy('Duplicate Policy');

    expect(
      screen.getByText('Error saving policy. Please try again.'),
    ).toBeTruthy();
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
