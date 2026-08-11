import { fireEvent, render } from '@testing-library/react';
import { vi } from 'vitest';

import '@testing-library/jest-dom/extend-expect';

import ItemAction from './ItemAction';

const mocks = vi.hoisted(() => ({
  allowMultiplePoliciesPerAction: false,
  policyDropdownProps: undefined as
    | {
        multiple: boolean;
        selectedPolicyIds: string | readonly string[] | undefined;
        onChange: (value: string | readonly string[]) => void;
      }
    | undefined,
}));

vi.mock('@/graphql/generated', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/graphql/generated')>()),
  useGQLBulkActionsFormDataQuery: () => ({
    data: {
      myOrg: {
        actions: [
          {
            id: 'action-1',
            name: 'Action',
            itemTypes: [{ id: 'item-type-1' }],
            parameters: [],
          },
        ],
        policies: [],
        allowMultiplePoliciesPerAction: mocks.allowMultiplePoliciesPerAction,
      },
    },
  }),
  useGQLBulkActionExecutionMutation: () => [vi.fn(), { loading: false }],
}));

vi.mock('@/webpages/dashboard/components/PolicyDropdown', () => ({
  default: (props: typeof mocks.policyDropdownProps) => {
    mocks.policyDropdownProps = props;
    return (
      <button onClick={() => props?.onChange(['policy-1', 'policy-2'])}>
        Select policies
      </button>
    );
  },
}));

describe('ItemAction policy selection', () => {
  beforeEach(() => {
    mocks.allowMultiplePoliciesPerAction = false;
    mocks.policyDropdownProps = undefined;
  });

  it('passes a scalar selected policy value in single-policy mode', () => {
    const { getByRole } = render(
      <ItemAction itemIdentifier={{ id: 'item-1', typeId: 'item-type-1' }} />,
    );

    expect(mocks.policyDropdownProps?.selectedPolicyIds).toBeUndefined();
    fireEvent.click(getByRole('button', { name: 'Select policies' }));
    expect(mocks.policyDropdownProps?.selectedPolicyIds).toBe('policy-1');
  });

  it('passes every selected policy value in multiple-policy mode', () => {
    mocks.allowMultiplePoliciesPerAction = true;
    const { getByRole } = render(
      <ItemAction itemIdentifier={{ id: 'item-1', typeId: 'item-type-1' }} />,
    );

    fireEvent.click(getByRole('button', { name: 'Select policies' }));
    expect(mocks.policyDropdownProps?.selectedPolicyIds).toEqual([
      'policy-1',
      'policy-2',
    ]);
  });
});
