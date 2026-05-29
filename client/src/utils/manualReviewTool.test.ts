import { GQLUserPenaltySeverity } from '../graphql/generated';
import {
  recomputeSelectedRelatedActions,
  selectPreferredUserItem,
} from './manualReviewTool';

describe('recomputeSelectedRelatedActions', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('Should return input when there are no selected actions', () => {
    const newActions = [
      {
        action: {
          id: '1',
          name: 'action1',
          penalty: GQLUserPenaltySeverity.None,
        },
        target: {
          identifier: { itemId: 'a', itemTypeId: 'b' },
          displayName: '',
        },
        policies: [{ id: 'x', name: 'y' }],
      },
    ];

    expect(recomputeSelectedRelatedActions(newActions, [])).toEqual(newActions);
  });

  test('Should override selectedRelatedActions with corresponding newActions', () => {
    const newActions = [
      {
        action: {
          id: '1',
          name: 'action1',
          penalty: GQLUserPenaltySeverity.None,
        },
        target: {
          identifier: { itemId: 'a', itemTypeId: 'b' },
          displayName: '',
        },
        policies: [
          { id: 'x', name: 'y' },
          { id: 'm', name: 'n' },
        ],
      },
      {
        action: {
          id: '2',
          name: 'action2',
          penalty: GQLUserPenaltySeverity.None,
        },
        target: {
          identifier: { itemId: 'c', itemTypeId: 'd' },
          displayName: '',
        },
        policies: [{ id: 'z', name: 'w' }],
      },
    ];

    const selectedRelatedActions = [
      {
        action: {
          id: '1',
          name: 'action1',
          penalty: GQLUserPenaltySeverity.None,
        },
        target: {
          identifier: { itemId: 'a', itemTypeId: 'b' },
          displayName: '',
        },
        policies: [{ id: 'x', name: 'y' }],
      },
    ];

    expect(
      recomputeSelectedRelatedActions(newActions, selectedRelatedActions),
    ).toEqual([
      {
        action: {
          id: '1',
          name: 'action1',
          penalty: GQLUserPenaltySeverity.None,
        },
        target: {
          identifier: { itemId: 'a', itemTypeId: 'b' },
          displayName: '',
        },
        policies: [
          { id: 'x', name: 'y' },
          { id: 'm', name: 'n' },
        ],
      },
      {
        action: {
          id: '2',
          name: 'action2',
          penalty: GQLUserPenaltySeverity.None,
        },
        target: {
          identifier: { itemId: 'c', itemTypeId: 'd' },
          displayName: '',
        },
        policies: [{ id: 'z', name: 'w' }],
      },
    ]);
  });

  test('Should override selectedRelatedActions with corresponding newActions but leaving the other selectedRelatedActions in tact', () => {
    const newActions = [
      {
        action: {
          id: '1',
          name: 'action1',
          penalty: GQLUserPenaltySeverity.None,
        },
        target: {
          identifier: { itemId: 'a', itemTypeId: 'b' },
          displayName: '',
        },
        policies: [
          { id: 'x', name: 'y' },
          { id: 'm', name: 'n' },
        ],
      },
      {
        action: {
          id: '2',
          name: 'action2',
          penalty: GQLUserPenaltySeverity.None,
        },
        target: {
          identifier: { itemId: 'c', itemTypeId: 'd' },
          displayName: '',
        },
        policies: [{ id: 'z', name: 'w' }],
      },
    ];

    const selectedRelatedActions = [
      {
        action: {
          id: '1',
          name: 'action1',
          penalty: GQLUserPenaltySeverity.None,
        },
        target: {
          identifier: { itemId: 'a', itemTypeId: 'b' },
          displayName: '',
        },
        policies: [{ id: 'm', name: 'n' }],
      },
      {
        action: {
          id: '3',
          name: 'action1',
          penalty: GQLUserPenaltySeverity.None,
        },
        target: {
          identifier: { itemId: 'a', itemTypeId: 'b' },
          displayName: '',
        },
        policies: [{ id: 'm', name: 'n' }],
      },
    ];

    expect(
      recomputeSelectedRelatedActions(newActions, selectedRelatedActions),
    ).toEqual([
      {
        action: {
          id: '1',
          name: 'action1',
          penalty: GQLUserPenaltySeverity.None,
        },
        target: {
          identifier: { itemId: 'a', itemTypeId: 'b' },
          displayName: '',
        },
        policies: [
          { id: 'x', name: 'y' },
          { id: 'm', name: 'n' },
        ],
      },
      {
        action: {
          id: '3',
          name: 'action1',
          penalty: GQLUserPenaltySeverity.None,
        },
        target: {
          identifier: { itemId: 'a', itemTypeId: 'b' },
          displayName: '',
        },
        policies: [{ id: 'm', name: 'n' }],
      },
      {
        action: {
          id: '2',
          name: 'action2',
          penalty: GQLUserPenaltySeverity.None,
        },
        target: {
          identifier: { itemId: 'c', itemTypeId: 'd' },
          displayName: '',
        },
        policies: [{ id: 'z', name: 'w' }],
      },
    ]);
  });
});

describe('selectPreferredUserItem', () => {
  const userItem = { __typename: 'UserItem' as const, id: 'u1' };
  const contentItem = { __typename: 'ContentItem' as const, id: 'c1' };
  const fallbackUserItem = { __typename: 'UserItem' as const, id: 'u2' };

  // Regression: a `PartialItemsSuccessResponse` is partial by design and can
  // carry an empty `items` array. Indexing `items[0].__typename` without a
  // guard crashed the review page with "Cannot read properties of undefined
  // (reading '__typename')" and looped the MRT subtree.
  test('returns undefined (does not throw) when both lists are empty', () => {
    expect(selectPreferredUserItem([], [])).toBeUndefined();
  });

  test('returns undefined when both lists are undefined', () => {
    expect(selectPreferredUserItem(undefined, undefined)).toBeUndefined();
  });

  test('prefers the primary list when its first item is a UserItem', () => {
    expect(selectPreferredUserItem([userItem], [fallbackUserItem])).toBe(
      userItem,
    );
  });

  test('falls back when the primary list is empty but the fallback has a UserItem', () => {
    expect(selectPreferredUserItem([], [fallbackUserItem])).toBe(
      fallbackUserItem,
    );
  });

  test('falls back when the primary first item is not a UserItem', () => {
    expect(selectPreferredUserItem([contentItem], [fallbackUserItem])).toBe(
      fallbackUserItem,
    );
  });

  test('returns undefined when neither first item is a UserItem', () => {
    expect(
      selectPreferredUserItem([contentItem], [contentItem]),
    ).toBeUndefined();
  });
});
