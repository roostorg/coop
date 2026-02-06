import { rollUpPolicyCounts } from './insightsUtils';

describe('Test Rule Dashboard Insights', () => {
  describe('Test Policy Rollup', () => {
    type Policy = readonly {
      readonly __typename: 'Policy';
      readonly id: string;
      readonly name: string;
      readonly parentId?: string | null | undefined;
    }[];
    type ActionSubmissionsByPolicyByDay = readonly {
      readonly __typename: 'CountByPolicyByDay';
      readonly date: string | Date;
      readonly count: number;
      readonly policy: {
        readonly __typename: 'CountByPolicyByDayPolicy';
        readonly name: string;
        readonly id: string;
      };
    }[];
    const policies: Policy = [
      {
        __typename: 'Policy',
        id: '1',
        name: 'policy 1',
        parentId: null,
      },
      {
        __typename: 'Policy',
        id: '2',
        name: 'policy 2',
        parentId: '1',
      },
      {
        __typename: 'Policy',
        id: '3',
        name: 'policy 3',
        parentId: '2',
      },
      {
        __typename: 'Policy',
        id: '4',
        name: 'policy 4',
        parentId: null,
      },
      {
        __typename: 'Policy',
        id: '5',
        name: 'policy 5',
        parentId: '4',
      },
    ];
    it('Single date/policy should return exact policy', () => {
      const actionedSubmissionsByPolicyByDay: ActionSubmissionsByPolicyByDay = [
        {
          __typename: 'CountByPolicyByDay',
          date: 'date 1',
          count: 3,
          policy: {
            __typename: 'CountByPolicyByDayPolicy',
            name: 'policy 1',
            id: '1',
          },
        },
      ];
      expect(
        rollUpPolicyCounts(policies, actionedSubmissionsByPolicyByDay),
      ).toEqual([
        {
          date: 'date 1',
          count: 3,
          policy: {
            __typename: 'Policy',
            name: 'policy 1',
            id: '1',
            parentId: null,
          },
        },
      ]);
    });
    it('Recursive date/policy with 1 subtree', () => {
      const actionedSubmissionsByPolicyByDay: ActionSubmissionsByPolicyByDay = [
        {
          __typename: 'CountByPolicyByDay',
          date: 'date 1',
          count: 3,
          policy: {
            __typename: 'CountByPolicyByDayPolicy',
            name: 'policy 1',
            id: '1',
          },
        },
        {
          __typename: 'CountByPolicyByDay',
          date: 'date 1',
          count: 4,
          policy: {
            __typename: 'CountByPolicyByDayPolicy',
            name: 'policy 2',
            id: '2',
          },
        },
      ];
      expect(
        rollUpPolicyCounts(policies, actionedSubmissionsByPolicyByDay),
      ).toEqual([
        {
          date: 'date 1',
          count: 7,
          policy: {
            __typename: 'Policy',
            name: 'policy 1',
            id: '1',
            parentId: null,
          },
        },
      ]);
    });
    it('Recursive date/policy with more than one subtree', () => {
      const actionedSubmissionsByPolicyByDay: ActionSubmissionsByPolicyByDay = [
        {
          __typename: 'CountByPolicyByDay',
          date: 'date 1',
          count: 3,
          policy: {
            __typename: 'CountByPolicyByDayPolicy',
            name: 'policy 1',
            id: '1',
          },
        },
        {
          __typename: 'CountByPolicyByDay',
          date: 'date 1',
          count: 4,
          policy: {
            __typename: 'CountByPolicyByDayPolicy',
            name: 'policy 2',
            id: '2',
          },
        },
        {
          __typename: 'CountByPolicyByDay',
          date: 'date 1',
          count: 5,
          policy: {
            __typename: 'CountByPolicyByDayPolicy',
            name: 'policy 3',
            id: '3',
          },
        },
      ];
      expect(
        rollUpPolicyCounts(policies, actionedSubmissionsByPolicyByDay),
      ).toEqual([
        {
          date: 'date 1',
          count: 12,
          policy: {
            __typename: 'Policy',
            name: 'policy 1',
            id: '1',
            parentId: null,
          },
        },
      ]);
    });
    it('Only subtrees', () => {
      const actionedSubmissionsByPolicyByDay: ActionSubmissionsByPolicyByDay = [
        {
          __typename: 'CountByPolicyByDay',
          date: 'date 1',
          count: 4,
          policy: {
            __typename: 'CountByPolicyByDayPolicy',
            name: 'policy 2',
            id: '2',
          },
        },
        {
          __typename: 'CountByPolicyByDay',
          date: 'date 1',
          count: 5,
          policy: {
            __typename: 'CountByPolicyByDayPolicy',
            name: 'policy 3',
            id: '3',
          },
        },
      ];
      expect(
        rollUpPolicyCounts(policies, actionedSubmissionsByPolicyByDay),
      ).toEqual([
        {
          date: 'date 1',
          count: 9,
          policy: {
            __typename: 'Policy',
            name: 'policy 1',
            id: '1',
            parentId: null,
          },
        },
      ]);
    });
    it('Multiple rollups', () => {
      const actionedSubmissionsByPolicyByDay: ActionSubmissionsByPolicyByDay = [
        {
          __typename: 'CountByPolicyByDay',
          date: 'date 1',
          count: 3,
          policy: {
            __typename: 'CountByPolicyByDayPolicy',
            name: 'policy 1',
            id: '1',
          },
        },
        {
          __typename: 'CountByPolicyByDay',
          date: 'date 1',
          count: 4,
          policy: {
            __typename: 'CountByPolicyByDayPolicy',
            name: 'policy 2',
            id: '2',
          },
        },
        {
          __typename: 'CountByPolicyByDay',
          date: 'date 1',
          count: 5,
          policy: {
            __typename: 'CountByPolicyByDayPolicy',
            name: 'policy 4',
            id: '4',
          },
        },
        {
          __typename: 'CountByPolicyByDay',
          date: 'date 1',
          count: 6,
          policy: {
            __typename: 'CountByPolicyByDayPolicy',
            name: 'policy 5',
            id: '5',
          },
        },
      ];
      expect(
        [
          ...rollUpPolicyCounts(policies, actionedSubmissionsByPolicyByDay),
        ].sort((it1, it2) => it1.count - it2.count),
      ).toEqual(
        [
          {
            date: 'date 1',
            count: 7,
            policy: {
              __typename: 'Policy',
              name: 'policy 1',
              id: '1',
              parentId: null,
            },
          },
          {
            date: 'date 1',
            count: 11,
            policy: {
              __typename: 'Policy',
              name: 'policy 4',
              id: '4',
              parentId: null,
            },
          },
        ].sort((it1, it2) => it1.count - it2.count),
      );
    });
    it('Multiple dates', () => {
      const actionedSubmissionsByPolicyByDay: ActionSubmissionsByPolicyByDay = [
        {
          __typename: 'CountByPolicyByDay',
          date: 'date 1',
          count: 3,
          policy: {
            __typename: 'CountByPolicyByDayPolicy',
            name: 'policy 1',
            id: '1',
          },
        },
        {
          __typename: 'CountByPolicyByDay',
          date: 'date 1',
          count: 4,
          policy: {
            __typename: 'CountByPolicyByDayPolicy',
            name: 'policy 2',
            id: '2',
          },
        },
        {
          __typename: 'CountByPolicyByDay',
          date: 'date 2',
          count: 5,
          policy: {
            __typename: 'CountByPolicyByDayPolicy',
            name: 'policy 3',
            id: '3',
          },
        },
      ];
      expect(
        [
          ...rollUpPolicyCounts(policies, actionedSubmissionsByPolicyByDay),
        ].sort((it1, it2) => it1.count - it2.count),
      ).toEqual(
        [
          {
            date: 'date 1',
            count: 7,
            policy: {
              __typename: 'Policy',
              name: 'policy 1',
              id: '1',
              parentId: null,
            },
          },
          {
            date: 'date 2',
            count: 5,
            policy: {
              __typename: 'Policy',
              name: 'policy 1',
              id: '1',
              parentId: null,
            },
          },
        ].sort((it1, it2) => it1.count - it2.count),
      );
    });
    it('Multiple dates, multiple rollups', () => {
      const actionedSubmissionsByPolicyByDay: ActionSubmissionsByPolicyByDay = [
        {
          __typename: 'CountByPolicyByDay',
          date: 'date 1',
          count: 3,
          policy: {
            __typename: 'CountByPolicyByDayPolicy',
            name: 'policy 1',
            id: '1',
          },
        },
        {
          __typename: 'CountByPolicyByDay',
          date: 'date 1',
          count: 4,
          policy: {
            __typename: 'CountByPolicyByDayPolicy',
            name: 'policy 2',
            id: '2',
          },
        },
        {
          __typename: 'CountByPolicyByDay',
          date: 'date 1',
          count: 5,
          policy: {
            __typename: 'CountByPolicyByDayPolicy',
            name: 'policy 4',
            id: '4',
          },
        },
        {
          __typename: 'CountByPolicyByDay',
          date: 'date 1',
          count: 6,
          policy: {
            __typename: 'CountByPolicyByDayPolicy',
            name: 'policy 5',
            id: '5',
          },
        },
        {
          __typename: 'CountByPolicyByDay',
          date: 'date 2',
          count: 14,
          policy: {
            __typename: 'CountByPolicyByDayPolicy',
            name: 'policy 5',
            id: '5',
          },
        },
        {
          __typename: 'CountByPolicyByDay',
          date: 'date 3',
          count: 2,
          policy: {
            __typename: 'CountByPolicyByDayPolicy',
            name: 'policy 2',
            id: '2',
          },
        },
        {
          __typename: 'CountByPolicyByDay',
          date: 'date 3',
          count: 15,
          policy: {
            __typename: 'CountByPolicyByDayPolicy',
            name: 'policy 1',
            id: '1',
          },
        },
      ];
      expect(
        [
          ...rollUpPolicyCounts(policies, actionedSubmissionsByPolicyByDay),
        ].sort((it1, it2) => it1.count - it2.count),
      ).toEqual(
        [
          {
            date: 'date 1',
            count: 7,
            policy: {
              __typename: 'Policy',
              name: 'policy 1',
              id: '1',
              parentId: null,
            },
          },
          {
            date: 'date 1',
            count: 11,
            policy: {
              __typename: 'Policy',
              name: 'policy 4',
              id: '4',
              parentId: null,
            },
          },
          {
            date: 'date 2',
            count: 14,
            policy: {
              __typename: 'Policy',
              name: 'policy 4',
              id: '4',
              parentId: null,
            },
          },
          {
            date: 'date 3',
            count: 17,
            policy: {
              __typename: 'Policy',
              name: 'policy 1',
              id: '1',
              parentId: null,
            },
          },
        ].sort((it1, it2) => it1.count - it2.count),
      );
    });
  });
});
