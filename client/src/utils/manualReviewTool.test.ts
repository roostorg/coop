import { vi } from 'vitest';

import { GQLUserPenaltySeverity } from '../graphql/generated';
import {
  recomputeSelectedRelatedActions,
  relatedActionsToSubmitInput,
  selectPreferredUserItem,
} from './manualReviewTool';

describe('recomputeSelectedRelatedActions', () => {
  afterEach(() => {
    vi.clearAllMocks();
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

describe('relatedActionsToSubmitInput', () => {
  const hideContent = {
    action: {
      id: 'hide_content',
      name: 'Hide Content',
      penalty: GQLUserPenaltySeverity.High,
    },
    target: {
      identifier: { itemId: 'post_1', itemTypeId: 'content' },
      displayName: 'Post (post_1)',
    },
    policies: [{ id: 'policy_spam', name: 'Spam' }],
  };
  const enqueueHuman = {
    action: {
      id: 'enqueue_human',
      name: 'Enqueue for Human Review',
      penalty: GQLUserPenaltySeverity.None,
    },
    target: {
      identifier: { itemId: 'post_2', itemTypeId: 'content' },
      displayName: 'Post (post_2)',
    },
    policies: [{ id: 'policy_abuse', name: 'Abuse' }],
    customMrtApiParamDecisionPayload: { queue: 'priority' },
  };

  test('includes only items the reviewer marked with an action', () => {
    expect(relatedActionsToSubmitInput([hideContent, enqueueHuman])).toEqual([
      {
        actionIds: ['hide_content'],
        itemIds: ['post_1'],
        itemTypeId: 'content',
        policyIds: ['policy_spam'],
      },
      {
        actionIds: ['enqueue_human'],
        itemIds: ['post_2'],
        itemTypeId: 'content',
        policyIds: ['policy_abuse'],
        actionIdsToMrtApiParamDecisionPayload: {
          enqueue_human: { queue: 'priority' },
        },
      },
    ]);
  });

  test('omits unmarked items and incomplete enqueue entries', () => {
    expect(relatedActionsToSubmitInput([])).toEqual([]);
    expect(
      relatedActionsToSubmitInput([
        {
          ...hideContent,
          action: { ...hideContent.action, id: '' },
        },
        {
          ...hideContent,
          target: {
            ...hideContent.target,
            identifier: { itemId: '', itemTypeId: 'content' },
          },
        },
        hideContent,
      ]),
    ).toEqual([
      {
        actionIds: ['hide_content'],
        itemIds: ['post_1'],
        itemTypeId: 'content',
        policyIds: ['policy_spam'],
      },
    ]);
  });

  test('omits parameter payload when none were saved', () => {
    expect(
      relatedActionsToSubmitInput([hideContent])[0]
        .actionIdsToMrtApiParamDecisionPayload,
    ).toBeUndefined();
  });
});
