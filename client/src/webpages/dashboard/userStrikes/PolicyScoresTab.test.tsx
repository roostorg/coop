import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { vi } from 'vitest';

import PolicyScoresTab from './PolicyScoresTab';

const updatePolicy = vi.hoisted(() => vi.fn());

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
          applyUserStrikeCountConfigToChildren: true,
        },
        {
          __typename: 'Policy',
          id: 'grandchild',
          name: 'Grandchild policy',
          parentId: 'child',
          policyText: null,
          enforcementGuidelines: null,
          policyType: null,
          userStrikeCount: 2,
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
    useGQLUpdatePolicyMutation: () => [updatePolicy],
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

  it("shows and saves a child's apply-to-sub-policies setting", async () => {
    render(
      <MemoryRouter>
        <PolicyScoresTab />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByText('Edit Policy Scores'));
    const childRow = screen.getByText('Child policy').closest('tr')!;
    const childSwitch = within(childRow).getByRole('switch');
    expect(childSwitch).toBeChecked();

    fireEvent.click(childSwitch);
    fireEvent.click(screen.getByText('Save Policy Scores'));

    expect(updatePolicy).toHaveBeenCalledWith({
      variables: {
        input: expect.objectContaining({
          id: 'child',
          applyUserStrikeCountConfigToChildren: false,
        }),
      },
    });
  });
});
