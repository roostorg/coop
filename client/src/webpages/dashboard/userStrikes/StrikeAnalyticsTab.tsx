import {
  useGQLActionsQuery,
  useGQLRecentUserStrikeActionsQuery,
  useGQLUserStrikeDistributionQuery,
  useGQLUserStrikeThresholdsQuery,
} from '@/graphql/generated';
import { gql } from '@apollo/client';
import { format } from 'date-fns';
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
  const chartHeight = 400;

  return (
    <div className="w-full">
      <div className="font-bold">Distribution of User Strikes</div>
      <BarChart
        title="Distribution of User Strikes"
        width={900}
        height={chartHeight}
        data={counts}
        layout="horizontal"
        margin={{
          top: 25,
          right: 30,
          left: 20,
          // Room for both the tick values and the "Strikes Applied" axis label
          // below them.
          bottom: 40,
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
        {/* Pin the tooltip to a fixed Y in the middle of the plot area so
            it doesn't follow the cursor up and down inside a single bar.
            The +20 nudges it below the title without overlapping the x-axis
            label. The cursor fill replaces the invisible default so the
            user can see which column is selected. */}
        <Tooltip
          cursor={{ fill: 'rgba(0, 0, 0, 0.04)' }}
          position={{ y: chartHeight / 2 + 20 }}
        />
        {/* Top alignment keeps the legend out of the x-axis label's space.
            Custom payload so the dashed red threshold lines are explained;
            ReferenceLine doesn't participate in the legend on its own. */}
        <Legend
          verticalAlign="top"
          payload={[
            {
              value: 'Number of Users',
              type: 'square',
              color: '#6aa9f6',
            },
            ...((thresholds?.length ?? 0) > 0
              ? ([
                  {
                    value: 'Strike Threshold',
                    type: 'plainline',
                    color: 'red',
                    payload: { strokeDasharray: '3 3' },
                  },
                ] as const)
              : []),
          ]}
        />
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

  const tableData = useMemo(() => {
    return recentUserStrikeActions
      ?.slice()
      ?.sort((a, b) => (a.time > b.time ? -1 : a.time < b.time ? 1 : 0))
      .map((values) => {
        return {
          user: (
            <Link
              className="cursor-pointer shrink-0"
              to={`/dashboard/manual_review/investigation?id=${values.itemId}&typeId=${values.itemTypeId}`}
              target="_blank"
            >
              {values.itemId}
            </Link>
          ),
          action: actionsById
            ? (actionsById[values.actionId] ?? 'Unknown')
            : 'Unknown',
          date: format(new Date(values.time), 'MM/dd/yy hh:mm'),
        };
      });
  }, [recentUserStrikeActions, actionsById]);

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
      <Table
        columns={columns}
        data={tableData ?? []}
        containerClassName="w-full"
      />
    </div>
  );
}
