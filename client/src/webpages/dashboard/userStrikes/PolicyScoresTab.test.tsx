import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

import '@testing-library/jest-dom/extend-expect';

import PolicyScoresTab from './PolicyScoresTab';

vi.mock('@/graphql/generated', async () => {
  const actual = await vi.importActual<typeof import('@/graphql/generated')>(
    '@/graphql/generated',
  );
  const data = {
    __typename: 'Query',
    myOrg: {
      __typename: 'Org',
      policies: [
        {
          __typename: 'Policy',
          id: 'parent',
          name: 'Parent policy',
          parentId: null,
          policyText: null,
          enforcementGuidelines: null,
          policyType: null,
          userStrikeCount: 4,
          applyUserStrikeCountConfigToChildren: false,
        },
        {
          __typename: 'Policy',
          id: 'child',
          name: 'Child policy',
          parentId: 'parent',
          policyText: null,
          enforcementGuidelines: null,
          policyType: null,
          userStrikeCount: 3,
          applyUserStrikeCountConfigToChildren: false,
        },
      ],
    },
  };
  return {
    ...actual,
    useGQLPoliciesQuery: () => ({
      loading: false,
      error: undefined,
      refetch: vi.fn(),
      data,
    }),
    useGQLUpdatePolicyMutation: () => [vi.fn()],
  };
});

describe('PolicyScoresTab', () => {
  it("shows a child's saved score while the policy is not being edited", async () => {
    render(
      <MemoryRouter>
        <PolicyScoresTab />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByText('Show all'));

    const scoreInputs = screen.getAllByRole('spinbutton');
    expect(scoreInputs[0]).toHaveValue(4);
    expect(scoreInputs[1]).toHaveValue(3);
  });
});
