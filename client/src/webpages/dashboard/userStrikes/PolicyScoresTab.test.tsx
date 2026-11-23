import { ApolloError } from '@apollo/client';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
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
    updatePolicy.mockReset();
    updatePolicy.mockResolvedValue({ data: {} });
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

  it('saves a policy before its sub-policies, one at a time', async () => {
    let finishParentSave = () => {};
    updatePolicy.mockImplementationOnce(
      async () =>
        new Promise((resolve) => {
          finishParentSave = () => resolve({ data: {} });
        }),
    );
    render(
      <MemoryRouter>
        <PolicyScoresTab />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByText('Edit Policy Scores'));
    fireEvent.change(screen.getAllByRole('spinbutton')[0], {
      target: { value: '5' },
    });
    fireEvent.click(
      within(screen.getByText('Child policy').closest('tr')!).getByRole(
        'switch',
      ),
    );
    fireEvent.click(screen.getByText('Save Policy Scores'));

    expect(updatePolicy).toHaveBeenCalledTimes(1);
    expect(updatePolicy).toHaveBeenLastCalledWith({
      variables: { input: expect.objectContaining({ id: 'parent' }) },
    });

    finishParentSave();
    await waitFor(() => expect(updatePolicy).toHaveBeenCalledTimes(2));
    expect(updatePolicy).toHaveBeenLastCalledWith({
      variables: { input: expect.objectContaining({ id: 'child' }) },
    });
  });

  it('stops saving at the first failure and keeps the unsaved changes', async () => {
    updatePolicy.mockResolvedValueOnce({
      data: undefined,
      errors: new ApolloError({ errorMessage: 'failed' }),
    });
    render(
      <MemoryRouter>
        <PolicyScoresTab />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByText('Edit Policy Scores'));
    fireEvent.change(screen.getAllByRole('spinbutton')[0], {
      target: { value: '5' },
    });
    fireEvent.change(scoreInput('Child policy'), { target: { value: '8' } });
    fireEvent.click(screen.getByText('Save Policy Scores'));

    await waitFor(() => expect(updatePolicy).toHaveBeenCalledTimes(1));
    expect(updatePolicy).toHaveBeenLastCalledWith({
      variables: { input: expect.objectContaining({ id: 'parent' }) },
    });
    await waitFor(() =>
      expect(screen.getByText('Save Policy Scores')).toBeInTheDocument(),
    );
    expect(screen.getAllByRole('spinbutton')[0]).toHaveValue(5);
    expect(scoreInput('Child policy')).toHaveValue(8);
    expect(updatePolicy).toHaveBeenCalledTimes(1);
  });

  it('shows the saved apply-to-sub-policies setting after discarding changes', async () => {
    render(
      <MemoryRouter>
        <PolicyScoresTab />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByText('Edit Policy Scores'));
    const parentSwitch = () =>
      screen.getAllByRole('switch').find((it) => it.closest('tr') === null)!;
    fireEvent.click(parentSwitch());
    expect(parentSwitch()).toBeChecked();
    expect(scoreInput('Child policy')).toBeDisabled();

    fireEvent.click(screen.getByText('Discard Changes'));
    fireEvent.click(screen.getByText('Edit Policy Scores'));

    expect(parentSwitch()).not.toBeChecked();
    expect(scoreInput('Child policy')).toBeEnabled();
  });
});
