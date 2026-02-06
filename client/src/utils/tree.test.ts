import { faker } from '@faker-js/faker';

import { Tree, type TreeNode } from './tree';

function populateTree<T>(
  tree: Tree<T>,
  depth: number,
  branches: number,
  filterValue: string = '',
  currentLevel = 0,
  parentNodeKey: string = 'root',
) {
  if (currentLevel >= depth) return;

  Array.from({ length: branches }).forEach((_, idx) => {
    const key = faker.string.uuid();
    const value =
      idx % 2 === 0 ? faker.word.noun() : `${filterValue}${faker.word.noun()}`; // Random word
    tree.insert(parentNodeKey, key, value as unknown as T);

    // Recursively populate the tree
    populateTree(tree, depth, branches, filterValue, currentLevel + 1, key);
  });
}

function convertTreeToList<T>(tree: Tree<T>) {
  const nodeList: TreeNode<T>[] = [];
  const traverse = (node: TreeNode<T>) => {
    nodeList.push(node);
    node.children.forEach(traverse);
  };

  traverse(tree.root);
  return nodeList;
}

describe('Tree tests', () => {
  it('Should filter the tree appropriately', () => {
    const filterString = 'Test-';
    const tree = new Tree('root', 'rootValue');
    populateTree(tree, 4, 3, filterString);

    const filteredTree = tree.filterTree((node) => node.includes(filterString));

    expect(filteredTree).not.toBeNull();
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const filteredTreeValues = convertTreeToList(filteredTree!);
    expect(
      filteredTreeValues
        // We only care about the leaves of the tree in this case, since for each
        // matching node we want to preserve its ancestry line
        .filter((it) => it.children.length === 0)
        .every((it) => it.value.includes(filterString)),
    ).toEqual(true);
  });

  it('Should return null if no search matches', () => {
    const filterString = 'some-random-string';
    const tree = new Tree('root', 'rootValue');
    populateTree(tree, 4, 3);

    const filteredTree = tree.filterTree((node) => node.includes(filterString));

    expect(filteredTree).toBeNull();
  });
});
