import partition from 'lodash/partition';

export class TreeNode<T> {
  public key: string;
  public value: T;
  public parent: TreeNode<T> | undefined;
  public children: TreeNode<T>[];

  constructor(key: string, value: T, parent?: TreeNode<T>) {
    this.key = key;
    this.value = value;
    this.parent = parent;
    this.children = [];
  }

  get isLeaf() {
    return this.children.length === 0;
  }

  get hasChildren() {
    return !this.isLeaf;
  }
}

export class Tree<T extends any> {
  public root: TreeNode<T>;

  constructor(key: string, value: T) {
    this.root = new TreeNode(key, value);
  }

  *preOrderTraversal(node = this.root): Generator<TreeNode<T>, void, unknown> {
    yield node;
    if (node.children.length) {
      for (const child of node.children) {
        yield* this.preOrderTraversal(child);
      }
    }
  }

  *postOrderTraversal(node = this.root): Generator<TreeNode<T>, void, unknown> {
    if (node.children.length) {
      for (const child of node.children) {
        yield* this.postOrderTraversal(child);
      }
    }
    yield node;
  }

  *parentTraversal(node: TreeNode<T>): Generator<TreeNode<T>, void, unknown> {
    let current: TreeNode<T> | undefined = node;
    while (current) {
      yield current;
      current = current.parent;
    }
  }

  getPathToNode(node: TreeNode<T>) {
    return Array.from(this.parentTraversal(node)).reverse();
  }

  insert(parentNodeKey: string, key: string, value: T) {
    for (const node of this.preOrderTraversal()) {
      if (node.key === parentNodeKey) {
        node.children.push(new TreeNode(key, value, node));
        return true;
      }
    }
    return false;
  }

  remove(key: string) {
    for (const node of this.preOrderTraversal()) {
      const filtered = node.children.filter((c) => c.key !== key);
      if (filtered.length !== node.children.length) {
        node.children = filtered;
        return true;
      }
    }
    return false;
  }

  find(key: string) {
    for (const node of this.preOrderTraversal()) {
      if (node.key === key) return node;
    }
    return undefined;
  }

  size() {
    let size = 0;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const _ of this.preOrderTraversal()) {
      size++;
    }
    return size;
  }

  replaceNode(oldNodeKey: string, newNodeKey: string, newNodeValue: T) {
    for (const node of this.preOrderTraversal()) {
      const oldNodeIndex = node.children.findIndex((c) => c.key === oldNodeKey);
      if (oldNodeIndex >= 0) {
        const newNode = new TreeNode(newNodeKey, newNodeValue, node);
        newNode.children = [...(node.children[oldNodeIndex]?.children ?? [])];
        node.children.splice(oldNodeIndex, 1, newNode);
        return;
      }
    }
  }

  /**
   * Returns an array constructed from iterating over all the nodes
   * in the tree and extracting a particular value from each node,
   * as defined the by extract function.
   */
  getValues<U>(extract: (node: T) => U) {
    const values: U[] = [];
    for (const node of this.preOrderTraversal()) {
      values.push(extract(node.value));
    }
    return values;
  }

  /**
   * Function that determines whether all nodes in the
   * tree are unique, or whether there are duplicate nodes.
   * @param isEqual - a function that determines equality
   * between two objects of type T
   */
  duplicateValues(isEqual: (v1: T, v2: T) => boolean) {
    const nodes: TreeNode<T>[] = [];
    const duplicates: T[] = [];
    for (const node of this.preOrderTraversal()) {
      if (
        nodes.some((previousNode) => isEqual(node.value, previousNode.value))
      ) {
        duplicates.push(node.value);
      }
      nodes.push(node);
    }
    return duplicates;
  }

  filterTree(filterPredicate: (nodeValue: T) => boolean): Tree<T> | null {
    const filterRecursive = (currentNode: TreeNode<T>): TreeNode<T> | null => {
      const filteredChildren = currentNode.children
        .map((child) => filterRecursive(child))
        .filter((child): child is TreeNode<T> => child !== null);

      if (filterPredicate(currentNode.value) || filteredChildren.length > 0) {
        const newNode = new TreeNode(currentNode.key, currentNode.value);
        newNode.children = filteredChildren;
        for (const child of filteredChildren) {
          child.parent = newNode;
        }
        return newNode;
      }

      return null;
    };

    const filteredRoot = filterRecursive(this.root);

    if (!filteredRoot) {
      return null;
    }

    // Manually reconstruct the tree from the filteredRoot
    const newTree = new Tree<T>(filteredRoot.key, filteredRoot.value);
    newTree.root.children = filteredRoot.children;
    // Ensure all child nodes have their parent property correctly set
    for (const child of newTree.root.children) {
      child.parent = newTree.root;
    }

    return newTree;
  }
}

export function sortTreeNodeList(nodeList: readonly any[], agg: any[]): any[] {
  if (nodeList.length === 0) {
    return agg;
  }
  const [nextLevelNodes, lowerNodes] = partition(
    nodeList,
    (node) =>
      node.parentId == null || agg.some((it) => it.id === node.parentId),
  );
  return sortTreeNodeList(lowerNodes, [...agg, ...nextLevelNodes]);
}

/**
 * Constructs a tree from a flattened list of nodes, where each node has an id
 * and an optional parentId. An example input is:
 * [
 *  { id: '1', parentId: null },
 *  { id: '2', parentId: null },
 *  { id: '3', parentId: '1' },
 *  { id: '4', parentId: '2' },
 * ]
 * And the output would be a tree with the following structure:
 *          root
 *        /      \
 *       1        2
 *      /          \
 *     3            4
 */
export function treeFromList<T>(
  nodeList: readonly any[],
  root: T,
  constructNode: (values: any) => T,
): Tree<T> {
  const tree = new Tree('root', root);
  const sortedList = sortTreeNodeList(nodeList, []);
  for (const policy of sortedList) {
    const parentKey =
      sortedList.find((it) => it.id === policy.parentId)?.name ?? 'root';
    tree.insert(parentKey, policy.name, constructNode(policy));
  }
  return tree;
}

/**
 * Constructs a multilevel list from a flattened list of nodes, where each node
 * has an id and an optional parentId. An example input is:
 * [
 *  { id: '1', parentId: null },
 *  { id: '2', parentId: null },
 *  { id: '3', parentId: '1' },
 *  { id: '4', parentId: '2' },
 *  { id: '5', parentId: '2' },
 * ]
 * And the output would be a list with the following structure:
 * [
 *  { id: '1', parentId: null, children: [{ id: '3', parentId: '1' }] },
 *  { id: '2', parentId: null, children: [{ id: '4', parentId: '2' }, { id: '5', parentId: '2' }] },
 * ]
 */
export function multilevelListFromFlatList<
  T extends { id: string; parentId?: string | null | undefined },
>(
  nodeList: readonly T[],
): (T & {
  children?: T[];
})[] {
  const map = new Map<string, T & { children?: T[] }>();
  const roots: (T & { children?: T[] })[] = [];

  // Initialize map with all nodes
  nodeList.forEach((node) => {
    map.set(node.id, { ...node } as T & { children?: T[] });
  });

  // Build the tree
  nodeList.forEach((node) => {
    if (node.parentId == null) {
      roots.push(map.get(node.id)!);
    } else {
      const parent = map.get(node.parentId);
      if (parent) {
        if (!parent.children) {
          parent.children = [];
        }
        parent.children.push(map.get(node.id)!);
      }
    }
  });

  return roots;
}
