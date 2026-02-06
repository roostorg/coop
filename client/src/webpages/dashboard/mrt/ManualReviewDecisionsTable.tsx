import {
  GQLDecisionsCountGroupBy,
  useGQLGetDecisionsTableQuery,
} from '@/graphql/generated';
import { assertUnreachable } from '@/utils/misc';
import { DownOutlined, UpOutlined } from '@ant-design/icons';
import { gql } from '@apollo/client/core';
import { useState } from 'react';
import type { Column } from 'react-table';

import Table from '../components/table/Table';
import FullScreenLoading from '@/components/common/FullScreenLoading';

import type { TimeWindow } from '../rules/dashboard/visualization/RulesDashboardInsights';
import { getReadableNameFromDecisionType } from './ManualReviewRecentDecisionsFilter';

gql`
  query getDecisionsTable($input: GetDecisionCountsTableInput!) {
    getDecisionsTable(input: $input) {
      count
      type
      action_id
      queue_id
      reviewer_id
    }
    myOrg {
      actions {
        ... on ActionBase {
          id
          name
        }
      }
      users {
        id
        firstName
        lastName
      }
      mrtQueues {
        id
        name
      }
    }
  }
`;

export default function ManualReviewDecisionsTable(props: {
  timeWindow: TimeWindow;
}) {
  const { timeWindow } = props;
  const [groupBy, setGroupBy] =
    useState<GQLDecisionsCountGroupBy>('REVIEWER_ID');
  const { data, loading, error } = useGQLGetDecisionsTableQuery({
    variables: {
      input: {
        groupBy,
        filterBy: {
          queueIds: [],
          reviewerIds: [],
          endDate: timeWindow.end,
          startDate: timeWindow.start,
        },
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    },
  });
  const [groupByMenuVisible, setGroupByMenuVisible] = useState(false);

  const getDisplayNameForGroupByOption = (option: GQLDecisionsCountGroupBy) => {
    switch (option) {
      case 'REVIEWER_ID':
        return 'Reviewer';
      case 'QUEUE_ID':
        return 'Queue';
      default:
        assertUnreachable(option);
    }
  };

  const groupByMenuButton = (option: GQLDecisionsCountGroupBy) => {
    return (
      <div
        className={`px-2 py-0.5 m-1 text-start rounded cursor-pointer text-slate-500 font-medium ${
          groupBy === option
            ? 'bg-coop-lightblue'
            : 'bg-white hover:bg-coop-lightblue-hover'
        }`}
        key={option}
        onClick={() => {
          setGroupBy(option);
          setGroupByMenuVisible(false);
        }}
      >
        {getDisplayNameForGroupByOption(option)}
      </div>
    );
  };

  if (error) {
    return undefined;
  }

  if (loading) {
    return <FullScreenLoading />;
  }

  type ReviewerGroupedData = {
    groupedByKey: string;
    name: string;
    [key: string]: number | string; // Allows for reviewer_id and dynamic keys
  };

  const groupedByKey = data?.getDecisionsTable.reduce<ReviewerGroupedData[]>(
    (acc, item) => {
      const { reviewer_id, queue_id, action_id, type, count } = item;
      const [groupedByKey, name] = (() => {
        switch (groupBy) {
          case 'REVIEWER_ID':
            const reviewer = data?.myOrg?.users.find(
              (u) => u.id === reviewer_id,
            );
            if (!reviewer) {
              return [undefined, undefined];
            }
            return [reviewer_id, `${reviewer.firstName} ${reviewer.lastName}`];
          case 'QUEUE_ID':
            const queue = data?.myOrg?.mrtQueues.find((q) => q.id === queue_id);
            if (!queue) {
              return [undefined, undefined];
            }
            return [queue_id, queue.name];
          default:
            assertUnreachable(groupBy);
        }
      })();
      if (!groupedByKey || !name) {
        return acc;
      }
      if (!acc.find((it) => it.groupedByKey === groupedByKey)) {
        acc.push({ groupedByKey, name });
      }
      const key = action_id ?? type;
      const obj = acc.find((it) => it.groupedByKey === groupedByKey);
      if (obj === undefined) {
        return acc;
      }
      obj[key] = count;
      return acc;
    },
    [],
  );

  const columns = data?.getDecisionsTable
    .reduce<Column<object>[]>(
      (acc, { action_id, type }) => {
        if (action_id !== null && action_id !== undefined) {
          const action = data?.myOrg?.actions.find((a) => a.id === action_id);
          if (
            action === undefined ||
            acc.find((it) => it.Header === action.name)
          ) {
            return acc;
          }
          acc.push({ accessor: action_id, Header: action.name });
        }
        // These should be caught in the previous if with the action
        if (type === 'CUSTOM_ACTION' || type === 'RELATED_ACTION') {
          return acc;
        }
        const title = getReadableNameFromDecisionType(type);
        if (!acc.find((it) => it.Header === title)) {
          acc.push({
            accessor: type,
            Header: getReadableNameFromDecisionType(type),
          });
        }
        return acc;
      },
      [{ accessor: 'name', Header: 'Name' }],
    )
    .sort((a, b) => {
      if (typeof a.Header !== 'string') {
        return -1;
      }
      if (typeof b.Header !== 'string') {
        return 1;
      }
      return a.Header === 'Name'
        ? -1
        : b.Header === 'Name'
        ? 1
        : a.Header.localeCompare(b.Header);
    });

  const filledInData = columns
    ? groupedByKey?.map((it) => {
        const obj = { ...it };
        columns.forEach((col) => {
          const accessor = col.accessor as string;
          if (obj[accessor] === undefined) {
            obj[accessor] = 0;
          }
        });
        return obj;
      })
    : undefined;
  if (columns === undefined || filledInData === undefined) {
    return <div />;
  }

  return (
    <div>
      <div className="flex text-start">
        <div className="pb-2 text-base font-medium text-slate-500">
          {`Decisions By ${groupBy === 'REVIEWER_ID' ? 'Reviewer' : 'Queue'}`}
        </div>
        <div className="flex-grow" />
        <div className="relative flex">
          <div className="flex self-center pr-2 font-semibold text-slate-500">
            Group by
          </div>
          <div>
            <div
              onClick={() => setGroupByMenuVisible((visible) => !visible)}
              className="flex items-center px-2 py-1 border border-solid rounded cursor-pointer border-slate-200 hover:border-coop-blue"
            >
              <div className="flex bg-slate-200 items-center py-0.5 px-2 font-medium text-slate-500 rounded whitespace-nowrap">
                {groupBy === 'REVIEWER_ID' ? 'Reviewer' : 'Queue'}
              </div>
              {/*
              We render both icons and toggle their visibility based on the groupByMenuVisible
              state instead of doing something like
              {groupByMenuVisible ? <UpOutlined /> : <DownOutlined />}
              because componentRef.current.contains doesn't work properly with that setup. It must
              be something about the component literally not being in the component tree based on
              the groupByMenuVisible state, versus the implementation below where the components
              stay in the component tree no matter what, and they're just hidden/visible based on
              the groupByMenuVisible state.
            */}
              <UpOutlined
                className={`pl-2 text-xs text-slate-400 flex items-center ${
                  groupByMenuVisible ? 'visible' : 'hidden'
                }`}
              />
              <DownOutlined
                className={`pl-2 text-xs text-slate-400 flex items-center ${
                  groupByMenuVisible ? 'hidden' : 'visible'
                }`}
              />
            </div>
            {groupByMenuVisible && (
              <div className="flex flex-col bg-white absolute border border-solid rounded shadow mt-1 p-2 min-w-[180px] z-20 border-slate-200">
                {Object.values(GQLDecisionsCountGroupBy).map((option) =>
                  groupByMenuButton(option),
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      <Table data={filledInData ?? []} columns={columns} />
    </div>
  );
}
