import {
  DatabaseOutlined,
  DownloadOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import { gql } from '@apollo/client';
import type { ItemIdentifier } from '@roostorg/types';
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
  GQLField,
  GQLFieldType,
  GQLRuleStatus,
  useGQLRuleInsightsCurrentVersionSamplesQuery,
  useGQLRuleInsightsPriorVersionSamplesLazyQuery,
  useGQLRuleInsightsTableAllSignalsQuery,
} from '../../../../../graphql/generated';
import { filterNullOrUndefined } from '../../../../../utils/collections';
import { unzip2 } from '../../../../../utils/misc';
import { createSubcategoryIdToLabelMapping } from '../../../../../utils/signalUtils';
import { parseDatetimeToReadableStringInCurrentTimeZone } from '../../../../../utils/time';
import RuleInsightsEmptyCard from './RuleInsightsEmptyCard';
import { RuleInsightsSamplesPlayVideoButton } from './RuleInsightsSamplesPlayVideoButton';
import RuleInsightsSamplesVideoModal from './RuleInsightsSamplesVideoModal';
import RuleInsightsSampleDetailView from './sample_details/RuleInsightsSampleDetailView';

const { Option } = Select;

export type DetailViewData = {
  visible: boolean;
  item: { identifier: ItemIdentifier; date: string } | undefined;
};

export enum RuleEnvironment {
  BACKGROUND = 'BACKGROUND',
  BACKTEST = 'BACKTEST',
  LIVE = 'LIVE',
  MANUAL = 'MANUAL',
  RETROACTION = 'RETROACTION',
}

export type SignalWithResult = {
  subcategory?: string | null;
  signalName: string;
  integration?: string | null | undefined;
  score?: string;
};

export enum LookbackVersion {
  LATEST = 'latestVersionSamples',
  PRIOR = 'priorVersionSamples',
}

export const LEAF_CONDITION_WITH_RESULT_FRAGMENT = gql`
  fragment LeafConditionWithResultFields on LeafConditionWithResult {
    input {
      type
      name
      contentTypeId
      spec {
        derivationType
      }
    }
    signal {
      id
      type
      name
      subcategory
      args {
        __typename
      }
    }
    matchingValues {
      strings
      textBankIds
      locationBankIds
      imageBankIds
      locations {
        id
        name
        geometry {
          center {
            lat
            lng
          }
          radius
        }
        bounds {
          northeastCorner {
            lat
            lng
          }
          southwestCorner {
            lat
            lng
          }
        }
        googlePlaceInfo {
          id
        }
      }
    }
    comparator
    threshold
    result {
      outcome
      score
      matchedValue
    }
  }
`;

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

export const SAMPLE_RULE_EXECUTION_RESULT_FIELDS = gql`
  fragment SampleRuleExecutionResultFields on RuleExecutionResult {
    ts
    contentId
    itemTypeName
    itemTypeId
    userId
    userTypeId
    content
    environment
    signalResults {
      signalName
      integration
      subcategory
      score
    }
  }
`;

export const SAMPLE_RULE_EXECUTION_RESULT_CONDITION_RESULT_FIELDS = gql`
  ${LEAF_CONDITION_WITH_RESULT_FRAGMENT}
  fragment SampleRuleExecutionResultConditionResultFields on ConditionSetWithResult {
    conjunction
    conditions {
      ... on ConditionSetWithResult {
        conjunction
        conditions {
          ... on LeafConditionWithResult {
            ...LeafConditionWithResultFields
          }
        }
        result {
          outcome
          score
          matchedValue
        }
      }
      ... on LeafConditionWithResult {
        ...LeafConditionWithResultFields
      }
    }
    result {
      outcome
      score
      matchedValue
    }
  }
`;

gql`
  ${SAMPLE_RULE_EXECUTION_RESULT_FIELDS}
  ${SAMPLE_RULE_EXECUTION_RESULT_CONDITION_RESULT_FIELDS}
  query RuleInsightsTableAllSignals {
    myOrg {
      signals(customOnly: false) {
        id
        integration
        eligibleSubcategories {
          id
          label
        }
      }
    }
  }

  query RuleInsightsCurrentVersionSamples($id: ID!) {
    rule(id: $id) {
      ... on ContentRule {
        __typename
        name
        insights {
          samples: latestVersionSamples {
            ...SampleRuleExecutionResultFields
          }
        }
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
      }
      ... on UserRule {
        __typename
        name
        insights {
          samples: latestVersionSamples {
            ...SampleRuleExecutionResultFields
          }
        }
      }
    }
  }

  query RuleInsightsPriorVersionSamples($id: ID!) {
    rule(id: $id) {
      ... on ContentRule {
        name
        insights {
          samples: priorVersionSamples {
            ...SampleRuleExecutionResultFields
          }
        }
        itemTypes {
          ... on ItemTypeBase {
            name
            id
            baseFields {
              name
              type
              container {
                keyScalarType
                valueScalarType
              }
            }
            derivedFields {
              name
              type
              container {
                keyScalarType
                valueScalarType
              }
            }
          }
        }
      }
      ... on UserRule {
        name
        insights {
          samples: priorVersionSamples {
            ...SampleRuleExecutionResultFields
          }
        }
      }
    }
  }

  query GetFullResultForRule($input: GetFullResultForItemInput!) {
    getFullRuleResultForItem(input: $input) {
      ... on RuleExecutionResult {
        ...SampleRuleExecutionResultFields
        result {
          ...SampleRuleExecutionResultConditionResultFields
        }
      }
      ... on NotFoundError {
        title
      }
    }
  }
`;

export default function RuleInsightsSamplesTable(props: { ruleId: string }) {
  const { ruleId } = props;
  const {
    loading: signalsLoading,
    error: signalsError,
    data: signalsData,
  } = useGQLRuleInsightsTableAllSignalsQuery();
  const { loading, error, data } = useGQLRuleInsightsCurrentVersionSamplesQuery(
    { variables: { id: ruleId } },
  );
  const [
    fetchPriorVersionSamples,
    {
      loading: priorRuleVersionLoading,
      error: priorRuleVersionError,
      data: priorRuleVersionData,
    },
  ] = useGQLRuleInsightsPriorVersionSamplesLazyQuery({
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

  const samples = queryResult?.rule?.insights?.samples;

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
      samples?.map((sample) => ({
        id: sample.contentId,
        itemTypeName: sample.itemTypeName,
        itemTypeId: sample.itemTypeId,
        userId: sample.userId,
        userTypeId: sample.userTypeId,
        content: sample.content,
        time: parseDatetimeToReadableStringInCurrentTimeZone(sample.ts),
        status:
          sample.environment === RuleEnvironment.LIVE ||
          sample.environment === RuleEnvironment.RETROACTION
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

  const itemTypeObjs =
    data?.rule?.__typename === 'ContentRule' ? data?.rule?.itemTypes : [];
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
        Header: 'Content',
        accessor: 'content',
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
        Header: 'User ID',
        accessor: 'userId',
        canSort: false,
      },
      ...extraColumns,
    ];
  }, [extraColumns]);
  const tableData = useMemo(
    () =>
      dataValues?.map((values) => {
        const parsedContent = JSON.parse(values.content);
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
              getStringFromContent(parsedContent[field.name], field),
            ),
        );
        const [formattedContent, content] = unzip2(
          fields
            .filter((field) => field.type !== 'ID')
            .map((field) => {
              const titledKey =
                field.name.charAt(0).toUpperCase() + field.name.slice(1);
              const val = getStringFromContent(
                parsedContent[field.name],
                field,
              );
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
          userId: (
            <Link
              to={`/dashboard/manual_review/investigation?id=${values.userId}&typeId=${values.userTypeId}`}
              onClick={(event) => event.stopPropagation()}
              target="_blank"
            >
              {values.userId}
            </Link>
          ),
          content: (
            <CopyTextComponent
              value={formattedContent.filter((it) => it.length > 0).join('\n')}
              displayValue={
                <div className="flex flex-col items-start">{content}</div>
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
              (values as any)[it.accessor],
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
    setDetailViewData({
      visible: true,
      item: (() => {
        const rowData = dataValues![row.index];
        return {
          identifier: { id: rowData.id, typeId: rowData.itemTypeId },
          date: rowData.time,
        };
      })(),
    });
  };

  const ruleVersionDropdown = (
    <div className="flex items-center justify-end">
      <div className="flex items-center pr-2 text-base font-medium text-slate-500">
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
      subtitle="Your rule has not matched any content yet. As soon as it does, you'll see a sample of that content here."
    />
  );

  return (
    <div className="w-full text-start">
      <div className="flex items-center justify-between pb-4">
        <div className="flex flex-col">
          <div className="flex text-xl font-semibold">Samples</div>
          <div className="flex text-base text-slate-500">
            Below are examples of content submissions that were caught by this
            Rule.
          </div>
        </div>
        <div className="flex items-center justify-center">
          {ruleVersionDropdown}
          {samples?.length ? (
            <CSVLink
              id="CSVLink"
              style={{ marginLeft: '16px' }}
              data={makCSVDataFromRuleSamples(
                // Removing 'result' makes the type much easier to work with,
                // and the user doesn't need to see 'itemTypeId'
                dataValues?.map((value) => omit(value, ['itemTypeId'])) ?? [],
              )}
              filename={(() => {
                const date = new Date().toJSON();
                return `${data?.rule?.name}_${date.slice(0, 10)}_${date.slice(
                  11,
                  19,
                )}`;
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
              data={tableData!}
              onSelectRow={onSelectRow}
            />
          </div>
          {detailViewData.visible && detailViewData.item && (
            <RuleInsightsSampleDetailView
              ruleId={ruleId}
              onClose={() =>
                setDetailViewData({
                  visible: false,
                  item: undefined,
                })
              }
              lookback={lookback}
              itemIdentifier={detailViewData.item.identifier}
              itemSubmissionDate={detailViewData.item.date}
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

/**
 * This function attempts to parse the JSON of the sample execution data and infers
 * typing from the field type.
 *
 * TODO: When there are content types that utilize Arrays and Maps, grab the
 * type from the container field and display it in a more suitable way.
 */
export function getStringFromContent(
  content: any,
  field: GQLField,
): string | null {
  if (!content) {
    return null;
  }
  switch (field.type) {
    case GQLFieldType.Boolean:
    case GQLFieldType.Geohash:
    case GQLFieldType.Id:
    case GQLFieldType.Number:
    case GQLFieldType.UserId:
    case GQLFieldType.String:
    case GQLFieldType.Url:
    case GQLFieldType.Array:
    case GQLFieldType.Map:
    case GQLFieldType.PolicyId:
      return content.toString();
    case GQLFieldType.Image:
    case GQLFieldType.Video:
      return typeof content === 'object' ? content.url : null;
    case GQLFieldType.Datetime:
      return parseDatetimeToReadableStringInCurrentTimeZone(content);
    case GQLFieldType.Audio:
    case GQLFieldType.RelatedItem:
      // TODO: Fill this in
      return null;
  }
}

export function makCSVDataFromRuleSamples(
  samples: {
    id: string;
    itemTypeName: string;
    userId?: string | null;
    content: string;
    time: string;
    status: 'BACKGROUND' | 'LIVE';
  }[],
) {
  // Transform the content JSON into an interpretable, flattened shape
  return samples.map((sample) => ({
    ...flattenRuleExecutionSampleForCSV(null, JSON.parse(sample.content)),
    ...omit(sample, 'content'),
  }));
}

export function getSignalName(
  signal: SignalWithResult,
  allSignals: {
    [key: string]: string;
  },
) {
  return signal.subcategory
    ? `${signal.signalName} - ${
        allSignals[`${signal.integration}:${signal.subcategory}`]
      }`
    : signal.signalName;
}

/**
 * We need to pass a flattened version of each execution sample into
 * the CSV file so that each cell contains a primitive, rather than
 * an object.
 *
 * For example, if the user sends us video content, then the 'content'
 * field in the sample will be something like:
 * {
 *    caption: 'abc',
 *    video: {
 *      url: 'https://someurl.com',
 *      other: {
 *        a: 1
 *      }
 *    }
 * }
 *
 * So if we just did JSON.parse(content) and then spread the result into
 * separate columns, we'd get a correct 'caption' column, but the 'video'
 * column would just display [object Object] because the CSV file generator
 * wouldn't know how to stringify the { url: 'https://someurl.com' } JSON.
 *
 * To solve this, we flatten the JSON to something like:
 * {
 *    caption: 'abc',
 *    'video:url': 'https://someurl.com',
 *    'video:other:a': 1
 * }
 *
 * where each key is a concatenation of the path to the property so that
 * the shape is flat, but the column name is very clear.
 *
 * Note: we need to do this recursively to eventually support arbitrarily
 * deeply-nested content type schemas in the future.
 */
export function flattenRuleExecutionSampleForCSV(
  topLevelKey: string | null,
  json: object,
) {
  let result: { [key: string]: string } = {};
  Object.entries(json).forEach(([key, value]) => {
    if (typeof value === 'object') {
      result = {
        ...omit(result, key),
        ...flattenRuleExecutionSampleForCSV(
          topLevelKey ? `${topLevelKey}:${key}` : key,
          value,
        ),
      };
    } else {
      result[topLevelKey ? `${topLevelKey}:${key}` : key] = value;
    }
  });
  return result;
}
