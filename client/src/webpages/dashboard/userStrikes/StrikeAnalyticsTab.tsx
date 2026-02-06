import {
  useGQLActionsQuery,
  useGQLRecentUserStrikeActionsQuery,
  useGQLUserStrikeDistributionQuery,
  useGQLUserStrikeThresholdsQuery,
} from '@/graphql/generated';
import { gql } from '@apollo/client';
import moment from 'moment';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  Legend,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import Table from '../components/table/Table';
import FullScreenLoading from '@/components/common/FullScreenLoading';

gql`
  query RecentUserStrikeActions($input: RecentUserStrikeActionsInput!) {
    recentUserStrikeActions(input: $input) {
      itemId
      itemTypeId
      actionId
      source
      time
    }
  }
  query UserStrikeDistribution {
    getUserStrikeCountDistribution {
      numStrikes
      numUsers
    }
  }
`;

export default function StrikeAnalyticsTab() {
  return (
    <div className="flex flex-col gap-4">
      <UserStrikeDistributionChart />
      <div className="my-8 divider" />
      <RecentUserStrikeActionsTable />
    </div>
  );
}

function UserStrikeDistributionChart() {
  const { data, loading } = useGQLUserStrikeDistributionQuery();
  const { data: thresholdsData, loading: thresholdsLoading } =
    useGQLUserStrikeThresholdsQuery({});
  const counts =
    data?.getUserStrikeCountDistribution.map((it) => ({
      numStrikes: it.numStrikes,
      numUsers: it.numUsers,
    })) ?? [];
  const thresholds = thresholdsData?.myOrg?.userStrikeThresholds;

  const maxThreshold =
    thresholds?.reduce((acc, threshold) => {
      return Math.max(acc, threshold.threshold);
    }, 0) ?? 0;

  if (loading || thresholdsLoading) {
    return <FullScreenLoading />;
  }
  return (
    <div className="w-full">
      <div className="font-bold">Distribution of User Strikes</div>
      <BarChart
        title="Distribution of User Strikes"
        width={900}
        height={400}
        data={counts}
        layout="horizontal"
        margin={{
          top: 25,
          right: 30,
          left: 20,
          bottom: 15,
        }}
      >
        <YAxis
          tickFormatter={(tick) => (Number.isInteger(tick) ? tick : '')}
          domain={[0, (dataMax: number) => dataMax * 1.3]}
          type="number"
          dataKey="numUsers"
          name="Number of Users"
          label={{
            value: 'Number of Users',
            angle: -90,
            position: 'insideLeft',
          }}
        />
        <XAxis
          tickFormatter={(tick) => (Number.isInteger(tick) ? tick : '')}
          tickCount={10}
          domain={[
            0,
            (dataMax: number) => Math.max(maxThreshold * 1.1, dataMax * 1.3),
          ]}
          type="number"
          dataKey="numStrikes"
          name="Strike Count"
          label={{ value: 'Strikes Applied', position: 'bottom' }}
        />
        <Tooltip cursor={{ fill: 'transparent' }} />
        <Legend />
        {thresholds?.map((threshold) => (
          <ReferenceLine
            key={threshold.threshold}
            x={threshold.threshold}
            stroke="red"
            strokeDasharray="3 3"
          />
        ))}
        <Bar
          name="Number of Users"
          dataKey="numUsers"
          fill="#6aa9f6"
          barSize={40}
        />
      </BarChart>
    </div>
  );
}

function RecentUserStrikeActionsTable() {
  const { loading, error, data } = useGQLRecentUserStrikeActionsQuery({
    variables: {
      input: {
        limit: 50,
      },
    },
  });

  const {
    loading: actionsLoading,
    error: actionsError,
    data: actionsData,
  } = useGQLActionsQuery({});

  const actionsById = actionsData?.myOrg?.actions.reduce(
    (acc: Record<string, string>, action) => {
      acc[action.id] = action.name;
      return acc;
    },
    {},
  );

  const columns = useMemo(
    () => [
      {
        Header: 'User',
        accessor: 'user',
        canSort: false,
      },
      {
        Header: 'Action Taken',
        accessor: 'action',
        canSort: false,
      },
      {
        Header: 'Date',
        accessor: 'date',
        canSort: false,
      },
    ],
    [],
  );
  const recentUserStrikeActions = data?.recentUserStrikeActions;

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const tableData = useMemo(
    () => {
      return recentUserStrikeActions
        ?.slice()
        ?.sort((a, b) => {
          return a.time > b.time ? -1 : 1;
        })
        .map((values) => {
          return {
            user: (
              <Link
                className="cursor-pointer shrink-0"
                to={`/dashboard/investigation?id=${values.itemId}&typeId=${values.itemTypeId}`}
                target="_blank"
              >
                {values.itemId}
              </Link>
            ),
            action: actionsById
              ? actionsById[values.actionId] || 'Unknown'
              : 'Unknown',
            date: moment(values.time).zone(timezone).format('MM/DD/YY hh:mm'),
          };
        });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [recentUserStrikeActions, actionsById],
  );

  if (error || actionsError) {
    throw new Error(error?.message ?? actionsError?.message);
  }
  if (loading || actionsLoading) {
    return <FullScreenLoading />;
  }

  return (
    <div>
      <div className="font-bold">
        Recent Actions Taken By Your Strike System
      </div>
      <div className="items-center w-full">
        <Table columns={columns} data={tableData ?? []} />
      </div>
    </div>
  );
}
