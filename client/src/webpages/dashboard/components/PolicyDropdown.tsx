import { Checkbox } from '@/coop-ui/Checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/coop-ui/Popover';
import { cn } from '@/lib/utils';
import sortBy from 'lodash/sortBy';
import {
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  Search,
  X,
} from 'lucide-react';
import { useMemo, useState, type ReactElement } from 'react';

import { TreeNode as CustomTreeNode, treeFromList } from '../../../utils/tree';
import { If } from '../../../utils/typescript-types';

type Policy = {
  readonly id?: string | undefined;
  readonly name: string;
  readonly parentId?: string | null | undefined;
};

const triggerClasses =
  'flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm placeholder:text-gray-400 hover:border-gray-300 focus:outline-none focus:border-indigo-500 focus:shadow-focus-indigo disabled:cursor-not-allowed disabled:opacity-50 data-[state=open]:border-indigo-500';

/**
 * For every node that is itself in `targetIds`, or has a descendant in
 * `targetIds`, returns the set of that node's own ids — i.e. the set of
 * nodes that must be expanded so every target is reachable without manual
 * clicking. Used to auto-reveal the currently selected polic(y/ies).
 */
function ancestorIdsToExpand(
  nodes: readonly CustomTreeNode<Policy>[],
  targetIds: ReadonlySet<string>,
): Set<string> {
  const expand = new Set<string>();
  const visit = (node: CustomTreeNode<Policy>): boolean => {
    let hasTarget = node.value.id != null && targetIds.has(node.value.id);
    for (const child of node.children) {
      if (visit(child)) {
        hasTarget = true;
      }
    }
    if (hasTarget && node.value.id != null) {
      expand.add(node.value.id);
    }
    return hasTarget;
  };
  for (const node of nodes) {
    visit(node);
  }
  return expand;
}

/** Same shape as above, but the "target" is a case-insensitive name match. */
function ancestorIdsMatchingSearch(
  nodes: readonly CustomTreeNode<Policy>[],
  term: string,
): Set<string> {
  const visible = new Set<string>();
  const visit = (node: CustomTreeNode<Policy>): boolean => {
    let matches = node.value.name.toLowerCase().includes(term);
    for (const child of node.children) {
      if (visit(child)) {
        matches = true;
      }
    }
    if (matches && node.value.id != null) {
      visible.add(node.value.id);
    }
    return matches;
  };
  for (const node of nodes) {
    visit(node);
  }
  return visible;
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

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [manuallyExpandedIds, setManuallyExpandedIds] = useState<Set<string>>(
    new Set(),
  );

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

  // Consumers don't consistently switch shape with `multiple`: at least one
  // caller always stores selection as an array even when multiple={false}.
  // Accept either shape regardless of what `multiple` says, same as the
  // flat-Combobox version this replaces did.
  const normalizedSelectedIds = useMemo((): readonly string[] => {
    if (selectedPolicyIds == null) {
      return [];
    }
    return Array.isArray(selectedPolicyIds)
      ? selectedPolicyIds
      : [selectedPolicyIds as string];
  }, [selectedPolicyIds]);

  const selectedIds = useMemo(
    () => new Set(normalizedSelectedIds),
    [normalizedSelectedIds],
  );

  const searchTerm = search.trim().toLowerCase();
  const isSearching = searchTerm.length > 0;

  const autoExpandForSelection = useMemo(
    () => ancestorIdsToExpand(policyTree.root.children, selectedIds),
    [policyTree, selectedIds],
  );
  const searchExpand = useMemo(
    () =>
      isSearching
        ? ancestorIdsMatchingSearch(policyTree.root.children, searchTerm)
        : new Set<string>(),
    [policyTree, searchTerm, isSearching],
  );

  const isExpanded = (id: string) =>
    isSearching
      ? searchExpand.has(id)
      : manuallyExpandedIds.has(id) || autoExpandForSelection.has(id);

  const toggleExpanded = (id: string) => {
    setManuallyExpandedIds((prev) => {
      const next = new Set(prev);
      // Toggle relative to the *effective* (possibly auto-) expanded state,
      // not just the manual set, so collapsing an auto-expanded node works.
      if (isExpanded(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectNode = (id: string) => {
    if (multiple) {
      const next = normalizedSelectedIds.includes(id)
        ? normalizedSelectedIds.filter((v) => v !== id)
        : [...normalizedSelectedIds, id];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onChange(next as any);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onChange(id as any);
      setOpen(false);
    }
  };

  const clearAll = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onChange((multiple ? [] : '') as any);
  };

  const idToName = useMemo(() => {
    const map = new Map<string, string>();
    for (const policy of policies) {
      if (policy.id != null) {
        map.set(policy.id, policy.name);
      }
    }
    return map;
  }, [policies]);

  const selectedLabel = multiple
    ? [...selectedIds]
        .map((id) => idToName.get(id))
        .filter(Boolean)
        .join(', ') || undefined
    : idToName.get(normalizedSelectedIds[0] ?? '');

  const renderNode = (
    node: CustomTreeNode<Policy>,
    depth: number,
  ): ReactElement | null => {
    const id = node.value.id;
    if (id == null) {
      return null;
    }
    if (isSearching && !searchExpand.has(id)) {
      return null;
    }

    const hasChildren = node.children.length > 0;
    const expanded = hasChildren && isExpanded(id);
    const selected = selectedIds.has(id);
    const children = sortBy(node.children, (c) => c.value.name);

    return (
      <div key={id}>
        <div
          className={cn(
            'flex cursor-pointer items-center gap-1.5 rounded-sm py-1.5 pr-2 text-sm hover:bg-gray-100',
            selected && !multiple && 'bg-gray-100',
          )}
          style={{ paddingLeft: depth * 20 + 4 }}
          onClick={() => selectNode(id)}
        >
          {hasChildren ? (
            <button
              type="button"
              aria-label={expanded ? 'Collapse' : 'Expand'}
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded(id);
              }}
              className="flex h-4 w-4 shrink-0 items-center justify-center text-gray-400 hover:text-gray-600"
            >
              {expanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>
          ) : (
            <span className="w-4 shrink-0" />
          )}
          {multiple ? (
            <Checkbox
              checked={selected}
              onCheckedChange={() => selectNode(id)}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <Check
              className={cn(
                'h-4 w-4 shrink-0',
                selected ? 'opacity-100' : 'opacity-0',
              )}
            />
          )}
          <span className="truncate">{node.value.name}</span>
        </div>
        {hasChildren && expanded && (
          <div className="ml-3 border-l border-gray-200">
            {children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const topLevelNodes = sortBy(policyTree.root.children, (n) => n.value.name);
  const visibleTopLevelNodes = isSearching
    ? topLevelNodes.filter(
        (n) => n.value.id != null && searchExpand.has(n.value.id),
      )
    : topLevelNodes;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled ?? false}
          className={cn(triggerClasses, className)}
        >
          <span
            className={cn(
              'truncate text-left',
              !selectedLabel && 'text-gray-400',
            )}
          >
            {selectedLabel ??
              placeholder ??
              (multiple ? 'Select Policies' : 'Select policy')}
          </span>
          <span className="flex shrink-0 items-center gap-1">
            {selectedLabel && (
              <span
                role="button"
                tabIndex={-1}
                aria-label="Clear selection"
                className="text-gray-400 hover:text-gray-600"
                onClick={(e) => {
                  e.stopPropagation();
                  clearAll();
                }}
              >
                <X className="h-4 w-4" />
              </span>
            )}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
      >
        <div className="flex items-center border-b border-gray-200 px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-gray-400"
          />
        </div>
        <div className="max-h-[300px] overflow-y-auto overflow-x-hidden p-1">
          {visibleTopLevelNodes.length === 0 ? (
            <div className="py-6 text-center text-sm text-gray-500">
              No results.
            </div>
          ) : (
            visibleTopLevelNodes.map((node) => renderNode(node, 0))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
