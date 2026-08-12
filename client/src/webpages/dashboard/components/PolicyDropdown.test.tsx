import { render } from '@testing-library/react';
import { ComponentProps } from 'react';
import { vi } from 'vitest';

import PolicyDropdown from './PolicyDropdown';

const mocks = vi.hoisted(() => ({
  treeSelectProps: undefined as
    | { multiple: boolean; value: string | readonly string[] | undefined }
    | undefined,
}));

vi.mock('antd', () => ({
  TreeSelect: (props: typeof mocks.treeSelectProps) => {
    mocks.treeSelectProps = props;
    return null;
  },
}));

vi.mock('antd/lib/tree-select', () => ({
  TreeNode: () => null,
}));

const policies = [
  { id: 'policy-1', name: 'First policy' },
  { id: 'policy-2', name: 'Second policy' },
];

describe('PolicyDropdown value adaptation', () => {
  beforeEach(() => {
    mocks.treeSelectProps = undefined;
  });

  it('passes only the first selected policy to a single-mode TreeSelect', () => {
    const props = {
      policies,
      multiple: false,
      selectedPolicyIds: ['policy-1', 'policy-2'],
      onChange: vi.fn(),
    } as unknown as ComponentProps<typeof PolicyDropdown>;

    render(<PolicyDropdown {...props} />);

    expect(mocks.treeSelectProps?.value).toBe('policy-1');
  });

  it('preserves all selected policies for a multi-mode TreeSelect', () => {
    render(
      <PolicyDropdown
        policies={policies}
        multiple={true}
        selectedPolicyIds={['policy-1', 'policy-2']}
        onChange={vi.fn()}
      />,
    );

    expect(mocks.treeSelectProps?.value).toEqual(['policy-1', 'policy-2']);
  });
});
