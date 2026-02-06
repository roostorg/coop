import {
  DatabaseOutlined,
  DownloadOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import { gql } from '@apollo/client';
import { Select } from 'antd';
import capitalize from 'lodash/capitalize';
import omit from 'lodash/omit';
import uniq from 'lodash/uniq';
import { useMemo, useState } from 'react';
import { CSVLink } from 'react-csv';
import { Link } from 'react-router-dom';
import { Row } from 'react-table';

import ComponentLoading from '../../../../../components/common/ComponentLoading';
import CopyTextComponent from '../../../../../components/common/CopyTextComponent';
import RoundedTag from '../../../components/RoundedTag';
import {
  ColumnProps,
  DateRangeColumnFilter,
  NumberRangeColumnFilter,
  SelectColumnFilter,
} from '../../../components/table/filters';
import { ruleStatusSort, stringSort } from '../../../components/table/sort';
import Table from '../../../components/table/Table';

import {
  GQLFieldType,
  GQLRuleEnvironment,
  GQLRuleStatus,
  useGQLReportingRuleInsightsCurrentVersionSamplesQuery,
  useGQLReportingRuleInsightsPriorVersionSamplesLazyQuery,
  useGQLRuleInsightsTableAllSignalsQuery,
} from '../../../../../graphql/generated';
import { filterNullOrUndefined } from '../../../../../utils/collections';
import { unzip2 } from '../../../../../utils/misc';
import { createSubcategoryIdToLabelMapping } from '../../../../../utils/signalUtils';
import { parseDatetimeToReadableStringInCurrentTimeZone } from '../../../../../utils/time';
import RuleInsightsEmptyCard from './RuleInsightsEmptyCard';
import { RuleInsightsSamplesPlayVideoButton } from './RuleInsightsSamplesPlayVideoButton';
import {
  DetailViewData,
  getSignalName,
  getStringFromContent,
  LEAF_CONDITION_WITH_RESULT_FRAGMENT,
  LookbackVersion,
  makCSVDataFromRuleSamples,
} from './RuleInsightsSamplesTable';
import RuleInsightsSamplesVideoModal from './RuleInsightsSamplesVideoModal';
import RuleInsightsSampleDetailView from './sample_details/RuleInsightsSampleDetailView';

const { Option } = Select;

/**
 * GraphQL fragments cannot reference themselves recursively. In other words,
 * this is what we'd like to do:
 *
 * fragment ConditionWithResultFields on ConditionWithResult {
 *   ... on ConditionSetWithResult {
 *     conjunction
 *     conditions {
 *       ...ConditionWithResultFields
 *     }
 *   }
 *   ... on LeafConditionWithResult {
 *     ...LeafConditionWithResultFragment
 *   }
 * }
 *
 * But since we can't reference ConditionWithResultFields recursively, we have
 * to enumerate all the levels down which we want to traverse. For now, the
 * condition tree can only have two levels max (i.e. a Condition could just be
 * one LeafCondition, or it could be a ConditionSet that contains LeafConditions
 * - but not subsequent ConditionSet children). So we only traverse two levels.
 */
gql`
  ${LEAF_CONDITION_WITH_RESULT_FRAGMENT}
  fragment SampleReportingRuleExecutionResultFields on ReportingRuleExecutionResult {
    ts
    itemId
    itemTypeName
    itemTypeId
    creatorId
    creatorTypeId
    itemData
    environment
    signalResults {
      signalName
      integration
      subcategory
      score
    }
  }

  query ReportingRuleInsightsCurrentVersionSamples($id: ID!) {
    reportingRule(id: $id) {
      id
      name
      itemTypes {
        ... on ItemTypeBase {
          id
          name
          baseFields {
            name
            type
          }
          derivedFields {
            name
            type
          }
        }
      }
      insights {
        samples: latestVersionSamples {
          ...SampleReportingRuleExecutionResultFields
        }
      }
    }
  }

  query ReportingRuleInsightsPriorVersionSamples($id: ID!) {
    reportingRule(id: $id) {
      name
      itemTypes {
        ... on ItemTypeBase {
          id
          name
          baseFields {
            name
            type
          }
          derivedFields {
            name
            type
          }
        }
      }
      insights {
        samples: priorVersionSamples {
          ...SampleReportingRuleExecutionResultFields
        }
      }
    }
  }
`;

export default function ReportingRuleInsightsSamplesTable(props: {
  ruleId: string;
}) {
  const { ruleId } = props;
  const {
    loading: signalsLoading,
    error: signalsError,
    data: signalsData,
  } = useGQLRuleInsightsTableAllSignalsQuery();
  const { loading, error, data } =
    useGQLReportingRuleInsightsCurrentVersionSamplesQuery({
      variables: { id: ruleId },
    });
  const [
    fetchPriorVersionSamples,
    {
      loading: priorRuleVersionLoading,
      error: priorRuleVersionError,
      data: priorRuleVersionData,
    },
  ] = useGQLReportingRuleInsightsPriorVersionSamplesLazyQuery({
    variables: { id: ruleId },
  });

  const [lookback, setLookback] = useState<LookbackVersion>(
    LookbackVersion.LATEST,
  );

  function updateLookback(value: LookbackVersion) {
    setLookback(value);
    if (
      value === LookbackVersion.PRIOR &&
      !priorRuleVersionLoading &&
      !priorRuleVersionError &&
      !priorRuleVersionData
    ) {
      fetchPriorVersionSamples();
    }
  }

  const [detailViewData, setDetailViewData] = useState<DetailViewData>({
    visible: false,
    item: undefined,
  });
  const [videoPlayerUrl, setVideoPlayerUrl] = useState<string | null>(null);

  const allSignals = useMemo(() => {
    const signals = signalsData?.myOrg?.signals;
    if (signals == null) {
      return {};
    }

    return createSubcategoryIdToLabelMapping(signals);
  }, [signalsData?.myOrg?.signals]);

  /**
   * Add a signalsWithResults prop to every sample, which is just
   * an array of SignalWithResult objects corresponding to each
   * (signal, score) pair that'll be displayed in a new column
   */
  const queryResult = (() => {
    switch (lookback) {
      case LookbackVersion.LATEST:
        return data;
      case LookbackVersion.PRIOR:
        return priorRuleVersionData;
    }
  })();
  const samples = queryResult?.reportingRule?.insights?.samples;

  /**
   * Gather the extra columns we need to add. These just correspond to
   * the unique names of the signals for which we are displaying scores.
   */
  const extraColumns = useMemo(() => {
    // If the GQL query is still loading, or if there are no
    // extra columns to add, return an empty array
    if (!samples?.find((it) => it.signalResults)) {
      return [];
    }

    const distinctSignalNames = uniq(
      samples.flatMap(
        (sample) =>
          sample.signalResults?.map((it) => getSignalName(it, allSignals)) ??
          [],
      ),
    );

    return distinctSignalNames.map((signalName) => ({
      Header: signalName,
      accessor: signalName,
      Filter: (props: ColumnProps) =>
        NumberRangeColumnFilter({
          columnProps: props,
          accessor: signalName,
          placeholder: '',
        }),
      filter: 'between',
      sortDescFirst: true,
      sortType: stringSort,
    }));
  }, [allSignals, samples]);

  const dataValues = useMemo(
    () =>
      (samples ?? []).map((sample) => ({
        id: sample.itemId,
        itemTypeName: sample.itemTypeName,
        itemTypeId: sample.itemTypeId,
        creatorId: sample.creatorId,
        creatorTypeId: sample.creatorTypeId,
        itemData: sample.itemData,
        time: parseDatetimeToReadableStringInCurrentTimeZone(sample.ts),
        status:
          sample.environment === GQLRuleEnvironment.Live ||
          sample.environment === GQLRuleEnvironment.Retroaction
            ? GQLRuleStatus.Live
            : GQLRuleStatus.Background,
        // Insert all the extra column values into the row
        ...(sample.signalResults
          ? Object.fromEntries(
              sample.signalResults.map((it) => [
                getSignalName(it, allSignals),
                it.score,
              ]),
            )
          : {}),
      })),
    [allSignals, samples],
  );

  const itemTypeObjs = data?.reportingRule?.itemTypes;
  const itemTypeFields = itemTypeObjs
    ? Object.fromEntries(
        itemTypeObjs.map((itemType) => [
          itemType.name,
          [...itemType.baseFields, ...itemType.derivedFields],
        ]),
      )
    : null;
  const columns = useMemo(() => {
    return [
      {
        Header: 'Timestamp',
        accessor: 'time',
        Filter: (props: ColumnProps) =>
          DateRangeColumnFilter({
            columnProps: props,
            accessor: 'date',
            placeholder: '',
          }),
        filter: 'dateRange',
        sortDescFirst: true,
        sortType: stringSort,
      },
      {
        Header: 'Status',
        accessor: 'status',
        Filter: (props: ColumnProps) =>
          SelectColumnFilter({
            columnProps: props,
            accessor: 'status',
            placeholder: 'Live',
          }),
        filter: 'includes',
        sortType: ruleStatusSort,
      },
      {
        Header: 'Item',
        accessor: 'item',
        canSort: false,
      },
      {
        Header: 'Item Type',
        accessor: 'itemTypeName',
        Filter: (props: ColumnProps) =>
          SelectColumnFilter({
            columnProps: props,
            accessor: 'itemTypeName',
          }),
        filter: 'includes',
        sortType: stringSort,
      },
      {
        Header: 'ID',
        accessor: 'id', // accessor is the "key" in the data
        canSort: false,
      },
      {
        Header: 'Creator ID',
        accessor: 'creatorId',
        canSort: false,
      },
      ...extraColumns,
    ];
  }, [extraColumns]);
  const tableData = useMemo(
    () =>
      (dataValues ?? []).map((values) => {
        const parsedItem = JSON.parse(values.itemData);
        if (itemTypeFields == null) {
          return <ComponentLoading key={values.id} />;
        }
        const fields = itemTypeFields[values.itemTypeName];
        if (!fields || fields.length === 0) {
          return [];
        }
        const videoUrls = filterNullOrUndefined(
          fields
            .filter((field) => field.type === GQLFieldType.Video)
            .map((field) =>
              getStringFromContent(parsedItem[field.name], field),
            ),
        );
        const [formattedItem, item] = unzip2(
          fields
            .filter((field) => field.type !== 'ID')
            .map((field) => {
              const titledKey =
                field.name.charAt(0).toUpperCase() + field.name.slice(1);
              const val = getStringFromContent(parsedItem[field.name], field);
              if (val == null) {
                return ['', <span key={titledKey} />];
              }
              return [
                titledKey + ': ' + val,
                <div key={titledKey}>
                  <span style={{ fontWeight: 'bold' }}>{titledKey}</span>:{' '}
                  {field.type === 'IMAGE' ? (
                    <a
                      href={val}
                      onClick={(event) => event.stopPropagation()}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <span className="mr-1 text-blue-500 cursor-pointer">
                        See Image
                      </span>
                      <LinkOutlined />
                    </a>
                  ) : (
                    val
                  )}
                </div>,
              ];
            }),
        );

        return {
          id: (
            <CopyTextComponent
              value={values.id}
              displayValue={<div className="flex min-w-24">{values.id}</div>}
            />
          ),
          itemTypeName: <RoundedTag title={values.itemTypeName} />,
          creatorId: (
            <Link
              to={`/dashboard/manual_review/investigation?id=${values.creatorId}&typeId=${values.creatorTypeId}`}
              onClick={(event) => event.stopPropagation()}
              target="_blank"
            >
              {values.creatorId}
            </Link>
          ),
          item: (
            <CopyTextComponent
              value={formattedItem.filter((it) => it.length > 0).join('\n')}
              displayValue={
                <div className="flex flex-col items-start">{item}</div>
              }
              footerItems={videoUrls.map((videoUrl) => (
                <RuleInsightsSamplesPlayVideoButton
                  key={videoUrl}
                  onClick={() => {
                    setVideoPlayerUrl(videoUrl);
                  }}
                />
              ))}
            />
          ),
          time: <div className="flex min-w-[180px]">{values.time}</div>,
          status: (
            <div className="flex items-center">
              <RoundedTag
                title={capitalize(values.status)}
                status={values.status}
              />
            </div>
          ),
          values,
          ...Object.fromEntries(
            extraColumns.map((it) => [
              it.accessor,
              (values as { [key: string]: any })[it.accessor],
            ]),
          ),
        };
      }),
    [dataValues, itemTypeFields, extraColumns],
  );

  if (error || priorRuleVersionError || signalsError) {
    throw error ?? priorRuleVersionError ?? signalsError!;
  }

  const onSelectRow = (row: Row<any>) => {
    dataValues.length > 0 &&
      setDetailViewData({
        visible: true,
        item: (() => {
          const rowData = dataValues[row.index];
          return {
            identifier: { id: rowData.id, typeId: rowData.itemTypeId },
            date: rowData.time,
          };
        })(),
      });
  };

  const ruleVersionDropdown = (
    <div className="flex items-center justify-end">
      <div className="flex items-center pr-2 text-sm font-medium text-slate-500">
        Show Samples Matching:
      </div>
      <Select value={lookback} onChange={(value) => updateLookback(value)}>
        <Option value={LookbackVersion.LATEST}>
          Rule's Current Conditions
        </Option>
        <Option value={LookbackVersion.PRIOR}>Prior Rule Version</Option>
      </Select>
    </div>
  );

  const noSamples = (
    <RuleInsightsEmptyCard
      icon={<DatabaseOutlined />}
      title="No Samples"
      subtitle="Your report rule has not matched any reports yet. As soon as it does, you'll see a sample of those reports here."
    />
  );

  return (
    <div className="w-full text-start">
      <div className="flex items-center justify-between pb-4">
        <div className="flex flex-col">
          <div className="flex text-xl font-semibold">Samples</div>
          <div className="flex text-sm text-slate-500">
            Below are examples of reports that were caught by this Rule.
          </div>
        </div>
        <div className="flex items-center justify-center">
          {ruleVersionDropdown}
          {samples?.length ? (
            <CSVLink
              id="CSVLink"
              style={{ marginLeft: '16px' }}
              data={makCSVDataFromRuleSamples(
                dataValues?.map((value) => ({
                  ...omit(value, ['itemTypeId']),
                  content: value.itemData,
                })) ?? [],
              )}
              filename={(() => {
                const date = new Date().toJSON();
                return `${data?.reportingRule?.name}_${date.slice(
                  0,
                  10,
                )}_${date.slice(11, 19)}`;
              })()}
              enclosingCharacter={`"`}
              target="_blank"
            >
              <DownloadOutlined
                style={{ color: '#1890ff', paddingRight: '8px' }}
              />
              Download CSV
            </CSVLink>
          ) : null}
        </div>
      </div>
      {loading || priorRuleVersionLoading || signalsLoading ? (
        <ComponentLoading />
      ) : tableData?.length === 0 ? (
        noSamples
      ) : (
        <div className="flex">
          <div className="rounded-[5px] border-solid border-0 border-b border-[#f0f0f0] max-h-[1500px] overflow-scroll scrollbar-hide">
            <Table
              // @ts-ignore
              columns={columns}
              data={tableData}
              onSelectRow={onSelectRow}
            />
          </div>
          {detailViewData.visible && detailViewData.item && (
            <RuleInsightsSampleDetailView
              ruleId={ruleId}
              itemIdentifier={detailViewData.item.identifier}
              itemSubmissionDate={detailViewData.item.date}
              lookback={lookback}
              onClose={() =>
                setDetailViewData({ ...detailViewData, visible: false })
              }
            />
          )}
          {videoPlayerUrl ? (
            <RuleInsightsSamplesVideoModal
              videoURL={videoPlayerUrl}
              onClose={() => {
                setVideoPlayerUrl(null);
              }}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
