import { GQLUserPenaltySeverity } from '../graphql/generated';
import { recomputeSelectedRelatedActions } from './manualReviewTool';

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
