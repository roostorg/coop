import {
  Combobox,
  MultiCombobox,
  type ComboboxOption,
} from '@/coop-ui/Combobox';
import sortBy from 'lodash/sortBy';
import { useMemo } from 'react';

import { TreeNode as CustomTreeNode, treeFromList } from '../../../utils/tree';
import { If } from '../../../utils/typescript-types';

type Policy = {
  readonly id?: string | undefined;
  readonly name: string;
  readonly parentId?: string | null | undefined;
};

/**
 * Depth-first flatten of the policy tree into a flat option list, using an
 * em-dash prefix to convey nesting depth (antd `TreeSelect` used to render
 * this hierarchy with tree lines; the coop-ui Combobox is flat + searchable).
 */
function flattenPolicyTree(
  nodes: readonly CustomTreeNode<Policy>[],
  depth = 0,
): ComboboxOption[] {
  const out: ComboboxOption[] = [];
  for (const node of sortBy(nodes, (n) => n.value.name)) {
    if (node.value.id != null) {
      out.push({
        value: node.value.id,
        label: `${'— '.repeat(depth)}${node.key}`,
      });
    }
    if (node.children.length > 0) {
      out.push(...flattenPolicyTree(node.children, depth + 1));
    }
  }
  return out;
}

export default function PolicyDropdown<SelectMultiple extends boolean>(props: {
  policies: readonly Policy[];
  onChange: (values: If<SelectMultiple, readonly string[], string>) => void;
  selectedPolicyIds: If<SelectMultiple, readonly string[], string> | undefined;
  placeholder?: string | undefined;
  multiple: SelectMultiple;
  className?: string;
  disabled?: boolean;
}) {
  const {
    policies,
    onChange,
    selectedPolicyIds,
    placeholder,
    multiple,
    className,
    disabled,
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

  const options = useMemo(
    () => flattenPolicyTree(policyTree.root.children),
    [policyTree],
  );

  if (multiple) {
    return (
      <MultiCombobox
        options={options}
        value={[
          ...((selectedPolicyIds as readonly string[] | undefined) ?? []),
        ]}
        // The generic `If<...>` return type can't be narrowed at this call site.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onValueChange={(vals) => onChange(vals as any)}
        placeholder={placeholder ?? 'Select Policies'}
        className={className}
        disabled={disabled ?? false}
        allowClear
      />
    );
  }

  return (
    <Combobox
      options={options}
      value={
        (Array.isArray(selectedPolicyIds)
          ? selectedPolicyIds[0]
          : selectedPolicyIds) ?? undefined
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onValueChange={(v) => onChange((v ?? '') as any)}
      placeholder={placeholder ?? 'Select policy'}
      className={className}
      disabled={disabled ?? false}
      allowClear
    />
  );
}
