import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

import '@testing-library/jest-dom/extend-expect';

import PolicyScoresTab from './PolicyScoresTab';

const mocks = vi.hoisted(() => ({ updatePolicy: vi.fn() }));

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
    useGQLUpdatePolicyMutation: () => [mocks.updatePolicy],
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
  it('saves the apply-to-sub-policies toggle from the child policies table', async () => {
    mocks.updatePolicy.mockReset();
    render(
      <MemoryRouter>
        <PolicyScoresTab />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByText('Edit Policy Scores'));
    const childRow = screen.getByText('Child policy').closest('tr');
    if (childRow === null) {
      throw new Error('Child policy row not found');
    }
    const childSwitch = within(childRow).getByRole('switch');
    expect(childSwitch).not.toBeChecked();

    fireEvent.click(childSwitch);
    fireEvent.click(screen.getByRole('button', { name: 'Save Policy Scores' }));

    expect(mocks.updatePolicy).toHaveBeenCalledWith({
      variables: {
        input: expect.objectContaining({
          id: 'child',
          applyUserStrikeCountConfigToChildren: true,
        }),
      },
    });
  });
});
