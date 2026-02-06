import { TreeSelect } from 'antd';
import { TreeNode } from 'antd/lib/tree-select';
import sortBy from 'lodash/sortBy';
import { useMemo } from 'react';

import { TreeNode as CustomTreeNode, treeFromList } from '../../../utils/tree';
import { If } from '../../../utils/typescript-types';

type Policy = {
  readonly id?: string | undefined;
  readonly name: string;
  readonly parentId?: string | null | undefined;
};

const policyOption = (policy: CustomTreeNode<Policy>) => {
  return (
    <TreeNode key={policy.value.id} value={policy.value.id!} title={policy.key}>
      {sortBy(policy.children, (policy) => policy.value.name)?.map(
        policyOption,
      )}
    </TreeNode>
  );
};

export default function PolicyDropdown<SelectMultiple extends boolean>(props: {
  policies: readonly Policy[];
  onChange: (values: If<SelectMultiple, readonly string[], string>) => void;
  selectedPolicyIds: If<SelectMultiple, readonly string[], string> | undefined;
  placeholder?: string | undefined;
  multiple: SelectMultiple;
  className?: string;
  placement?: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';
  disabled?: boolean;
  maxTagCount?: number;
}) {
  const {
    policies,
    onChange,
    selectedPolicyIds,
    placeholder,
    multiple,
    className,
    placement,
    disabled,
    maxTagCount,
  } = props;

  const policyTree = useMemo(
    () =>
      treeFromList<Policy>(
        sortBy(policies, (policy) => policy.name) ?? [],
        { name: 'root' },
        (policy) => ({
          id: policy.id,
          name: policy.name,
        }),
      ),
    [policies],
  );

  return (
    <TreeSelect
      className={className}
      multiple={multiple}
      treeLine={true}
      maxTagCount={maxTagCount}
      placeholder={
        placeholder ?? multiple ? 'Select Policies' : 'Select policy'
      }
      dropdownMatchSelectWidth={false}
      value={selectedPolicyIds}
      onChange={onChange}
      showSearch={true}
      placement={placement ?? 'bottomLeft'}
      filterTreeNode={(input, treeNode) => {
        const title = typeof treeNode.title === 'string' ? treeNode.title : '';
        return title.toLowerCase().includes(input.toLowerCase());
      }}
      disabled={disabled ?? false}
    >
      {policyTree.root.children.map(policyOption)}
    </TreeSelect>
  );
}
