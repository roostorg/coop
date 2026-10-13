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
        {
          __typename: 'Policy',
          id: 'great-grandchild',
          name: 'Great-grandchild policy',
          parentId: 'grandchild',
          policyText: null,
          enforcementGuidelines: null,
          policyType: null,
          userStrikeCount: 1,
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

const scoreInput = (policyName: string) =>
  within(screen.getByText(policyName).closest('tr')!).getByRole('spinbutton');

describe('PolicyScoresTab', () => {
  beforeEach(() => {
    updatePolicy.mockClear();
  });

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

  it('shows the score of a sub-policy that applies to its sub-policies at every depth below it', async () => {
    render(
      <MemoryRouter>
        <PolicyScoresTab />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByText('Edit Policy Scores'));
    expect(scoreInput('Child policy')).toBeEnabled();
    for (const name of ['Grandchild policy', 'Great-grandchild policy']) {
      expect(scoreInput(name)).toBeDisabled();
      expect(scoreInput(name)).toHaveValue(3);
    }

    fireEvent.change(scoreInput('Child policy'), { target: { value: '7' } });
    expect(scoreInput('Grandchild policy')).toHaveValue(7);
    expect(scoreInput('Great-grandchild policy')).toHaveValue(7);
  });

  it('does not save its own score for a policy whose score is inherited', async () => {
    render(
      <MemoryRouter>
        <PolicyScoresTab />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByText('Edit Policy Scores'));
    const childSwitch = within(
      screen.getByText('Child policy').closest('tr')!,
    ).getByRole('switch');
    fireEvent.click(childSwitch);
    fireEvent.change(scoreInput('Great-grandchild policy'), {
      target: { value: '9' },
    });
    fireEvent.click(childSwitch);
    expect(scoreInput('Great-grandchild policy')).toHaveValue(3);

    fireEvent.click(screen.getByText('Save Policy Scores'));

    expect(updatePolicy).toHaveBeenCalledWith({
      variables: {
        input: expect.objectContaining({
          id: 'child',
          applyUserStrikeCountConfigToChildren: true,
        }),
      },
    });
    expect(updatePolicy).not.toHaveBeenCalledWith({
      variables: {
        input: expect.objectContaining({ userStrikeCount: 9 }),
      },
    });
  });
});
