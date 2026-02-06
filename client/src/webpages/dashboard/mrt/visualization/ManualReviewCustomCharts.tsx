import { PlusOutlined } from '@ant-design/icons';
import { gql } from '@apollo/client';
import { notification } from 'antd';
import { useEffect, useState } from 'react';

import CoopButton from '../../components/CoopButton';
import CoopModal from '../../components/CoopModal';

import {
  GQLDecisionCountFilterByInput,
  GQLDecisionCountGroupByColumns,
  GQLJobCreationFilterByInput,
  GQLJobCreationGroupByColumns,
  useGQLManualReviewChartConfigurationSettingsQuery,
  useGQLSetMrtChartConfigurationSettingsMutation,
} from '../../../../graphql/generated';
import { stripTypename } from '../../../../graphql/inputHelpers';
import type { TimeDivisionOptions } from '../../overview/Overview';
import {
  ChartType,
  TimeWindow,
} from '../../rules/dashboard/visualization/RulesDashboardInsights';
import ManualReviewCustomChartBuilder from './ManualReviewCustomChartBuilder';
import ManualReviewDashboardInsightsChart, {
  ManualReviewDashboardInsightsChartMetric,
} from './ManualReviewDashboardInsightsChart';
import { ManualReviewDashboardInsightsFilterByInput } from './ManualReviewDashboardInsightsFilterBy';
import { ManualReviewDashboardInsightsGroupByColumns } from './ManualReviewDashboardInsightsGroupBy';

gql`
  query ManualReviewChartConfigurationSettings {
    me {
      interfacePreferences {
        mrtChartConfigurations {
          ... on GetDecisionCountSettings {
            title
            metric
            decisionGroupBy: groupBy
            filterBy {
              startDate
              endDate
              type
              actionIds
              policyIds
              queueIds
              reviewerIds
              itemTypeIds
            }
            timeDivision
          }
          ... on GetJobCreationCountSettings {
            title
            metric
            jobCreationGroupBy: groupBy
            filterBy {
              startDate
              endDate
              policyIds
              queueIds
              itemTypeIds
              ruleIds
              sources
            }
            timeDivision
          }
        }
      }
    }
  }

  mutation SetMrtChartConfigurationSettings(
    $mrtChartConfigurationSettings: ManualReviewChartConfigurationsInput!
  ) {
    setMrtChartConfigurationSettings(
      mrtChartConfigurationSettings: $mrtChartConfigurationSettings
    ) {
      _
    }
  }
`;

export type ManualReviewCustomChartConfig = {
  title: string | undefined;
  metric:
    | Exclude<
        ManualReviewDashboardInsightsChartMetric,
        'REVIEWED_JOBS' | 'SKIPPED_JOBS'
      >
    | undefined;
  timeDivision: TimeDivisionOptions | undefined;
  groupBy: ManualReviewDashboardInsightsGroupByColumns | undefined;
  filterBy: ManualReviewDashboardInsightsFilterByInput | undefined;
  editMode: boolean;
};

interface ManualReviewCustomChartsProps {
  timeWindow: TimeWindow;
}

const ManualReviewCustomCharts = ({
  timeWindow,
}: ManualReviewCustomChartsProps) => {
  const [charts, setCharts] = useState<ManualReviewCustomChartConfig[]>([]);
  const [notificationApi, notificationContextHolder] =
    notification.useNotification();
  const [modalVisible, setModalVisible] = useState(false);

  const { error, data } = useGQLManualReviewChartConfigurationSettingsQuery();

  useEffect(() => {
    if (data?.me?.interfacePreferences?.mrtChartConfigurations) {
      setCharts(
        data.me.interfacePreferences.mrtChartConfigurations.map((it) => ({
          ...it,
          editMode: false,
          groupBy:
            // For now, we only allow one groupBy to be set at a time
            it.__typename === 'GetDecisionCountSettings'
              ? it.decisionGroupBy[0]
              : it.jobCreationGroupBy[0],
          // For now, ignore the start and end dates that are saved in the
          // chart config and just set them to the current timeWindow. This
          // make sure that when we load the page, the charts will have the
          // most recent data, rather than being frozen on a specific time window
          filterBy: {
            ...it.filterBy,
            startDate: timeWindow.start,
            endDate: timeWindow.end,
          },
        })),
      );
    }
  }, [
    data?.me?.interfacePreferences?.mrtChartConfigurations,
    timeWindow.start,
    timeWindow.end,
  ]);

  const [saveMrtCharts, { loading: mutationLoading, error: mutationError }] =
    useGQLSetMrtChartConfigurationSettingsMutation({
      onCompleted: () => {
        notificationApi.success({ message: 'Charts saved!' });
        setCharts((prevCharts) =>
          prevCharts
            .filter(
              (chart) => chart.metric && chart.timeDivision && chart.title,
            )
            .map((chart) => ({ ...chart, editMode: false })),
        );
      },
      onError: () => {
        notificationApi.error({
          message: 'Charts failed to save. Please try again. ',
        });
      },
    });

  if (error || mutationError) {
    throw error ?? mutationError!;
  }

  const chartsAreIncomplete = charts.some(
    (chart) => !chart.metric || !chart.timeDivision || !chart.title,
  );

  const onSave = () => {
    const chartConfigurations = charts
      .filter((chart) => chart.metric && chart.timeDivision && chart.title)
      .map((chart) => ({
        title: chart.title!,
        metric: chart.metric!,
        ...(chart.metric === 'DECISIONS'
          ? {
              decisionCountSettings: {
                timeDivision: chart.timeDivision!,
                groupBy: chart.groupBy
                  ? [chart.groupBy as GQLDecisionCountGroupByColumns]
                  : [],
                filterBy: chart.filterBy
                  ? (stripTypename(
                      chart.filterBy,
                    ) as GQLDecisionCountFilterByInput)
                  : {
                      startDate: timeWindow.start,
                      endDate: timeWindow.end,
                      type: [],
                      actionIds: [],
                      policyIds: [],
                      queueIds: [],
                      reviewerIds: [],
                      itemTypeIds: [],
                    },
              },
            }
          : {}),
        ...(chart.metric === 'JOBS'
          ? {
              jobCreationCountSettings: {
                timeDivision: chart.timeDivision!,
                groupBy: chart.groupBy
                  ? [chart.groupBy as GQLJobCreationGroupByColumns]
                  : [],
                filterBy: chart.filterBy
                  ? (stripTypename(
                      chart.filterBy,
                    ) as GQLJobCreationFilterByInput)
                  : {
                      startDate: timeWindow.start,
                      endDate: timeWindow.end,
                      policyIds: [],
                      queueIds: [],
                      itemTypeIds: [],
                      ruleIds: [],
                      sources: [],
                    },
              },
            }
          : {}),
      }));
    saveMrtCharts({
      variables: {
        mrtChartConfigurationSettings: {
          chartConfigurations,
        },
      },
    });
  };

  const onAddChart = () => {
    setCharts((prev) => [
      ...prev,
      {
        title: undefined,
        metric: undefined,
        timeDivision: 'DAY',
        groupBy: undefined,
        filterBy: undefined,
        editMode: true,
      },
    ]);
  };

  const modal = (
    <CoopModal
      title="If you save, we will erase any charts that you haven't completed yet."
      visible={modalVisible}
      footer={[
        {
          title: 'Cancel',
          onClick: () => setModalVisible(false),
          type: 'secondary',
        },
        {
          title: 'Save',
          onClick: () => {
            onSave();
            setModalVisible(false);
          },
          type: 'primary',
        },
      ]}
      onClose={() => setModalVisible(false)}
    >
      Some of your charts are incomplete, so if you press "Save", we will delete
      the incomplete ones. Are you sure you want to proceed?
    </CoopModal>
  );

  return (
    <div>
      <div className="flex justify-end mb-3">
        <div className="flex flex-col">
          <CoopButton
            title="Save Charts"
            onClick={() => {
              if (chartsAreIncomplete) {
                setModalVisible(true);
              } else {
                onSave();
              }
            }}
            loading={mutationLoading}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 pb-4 xl:grid-cols-2">
        {charts.map((chart, index) =>
          chart.editMode ? (
            <ManualReviewCustomChartBuilder
              key={`${index}_builder`}
              timeWindow={timeWindow}
              chart={chart}
              updateChart={(newChart) => {
                setCharts((prevCharts) => {
                  const newCharts = [...prevCharts];
                  newCharts.splice(index, 1, newChart);
                  return newCharts;
                });
              }}
              deleteChart={() => {
                setCharts((prevCharts) => {
                  const newCharts = [...prevCharts];
                  newCharts.splice(index, 1);
                  return newCharts;
                });
              }}
            />
          ) : (
            <ManualReviewDashboardInsightsChart
              key={index}
              timeWindow={timeWindow}
              initialTimeDivision={chart.timeDivision}
              initialChartType={ChartType.LINE}
              metric={chart.metric!}
              initialGroupBy={chart.groupBy ? [chart.groupBy] : []}
              initialFilterBy={chart.filterBy}
              title={chart.title}
              isCustomTitle={true}
              hideTotal
              narrowMode
              onEdit={() =>
                setCharts((prevCharts) => {
                  const newCharts = [...prevCharts];
                  newCharts.splice(index, 1, {
                    ...prevCharts[index],
                    editMode: true,
                  });
                  return newCharts;
                })
              }
              onDelete={() =>
                setCharts((prevCharts) => {
                  const newCharts = [...prevCharts];
                  newCharts.splice(index, 1);
                  return newCharts;
                })
              }
            />
          ),
        )}
        <div
          className="flex items-center justify-center w-full rounded cursor-pointer bg-slate-100 hover:bg-slate-200 aspect-square"
          onClick={onAddChart}
        >
          <PlusOutlined className="items-center text-2xl text-slate-400" />
        </div>
      </div>
      {modal}
      {notificationContextHolder}
    </div>
  );
};
export default ManualReviewCustomCharts;
