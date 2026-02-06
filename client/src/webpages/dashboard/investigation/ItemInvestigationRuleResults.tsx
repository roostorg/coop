import { ItemIdentifier } from '@roostorg/types';
import { Button } from 'antd';
import capitalize from 'lodash/capitalize';
import lowerCase from 'lodash/lowerCase';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Row } from 'react-table';

import ComponentLoading from '../../../components/common/ComponentLoading';
import CoopBadge from '../components/CoopBadge';
import CoopModal from '../components/CoopModal';
import RoundedTag from '../components/RoundedTag';
import {
  ColumnProps,
  DefaultColumnFilter,
  SelectColumnFilter,
} from '../components/table/filters';
import {
  conditionOutcomeSort,
  ruleStatusSort,
  stringSort,
} from '../components/table/sort';
import Table from '../components/table/Table';

import {
  GQLConditionOutcome,
  useGQLInvestigationItemsQuery,
} from '../../../graphql/generated';
import { ReadonlyDeep } from '../../../utils/typescript-types';
import { LookbackVersion } from '../rules/info/insights/RuleInsightsSamplesTable';
import RuleInsightsSampleDetailResults, {
  getDisplayName,
  outcomeIcon,
} from '../rules/info/insights/sample_details/RuleInsightsSampleDetailResults';
import InvestigationTag from './InvestigationTag';

export default function ItemInvestigationRuleResults(props: {
  itemIdentifier: ItemIdentifier;
  submissionTime?: string;
  rules: Readonly<ReadonlyDeep<{ id: string; actions: { name: string }[] }>[]>;
}) {
  const { rules, itemIdentifier, submissionTime } = props;
  const navigate = useNavigate();
  const [modalInfo, setModalInfo] = useState<
    | {
        visible: false;
        title: undefined;
        ruleId: undefined;
        contentId: undefined;
      }
    | {
        visible: true;
        title: string;
        ruleId: string;
        contentId: string;
      }
  >({
    visible: false,
    title: undefined,
    ruleId: undefined,
    contentId: undefined,
  });

  const {
    data: itemHistoryData,
    loading: itemHistoryLoading,
    error: itemHistoryError,
  } = useGQLInvestigationItemsQuery({
    variables: {
      itemIdentifier,
      submissionTime: submissionTime
        ? new Date(submissionTime).toISOString()
        : undefined,
    },
  });

  const ruleExecutionsHistory = useMemo(
    () =>
      itemHistoryData?.itemWithHistory.__typename === 'ItemHistoryResult'
        ? itemHistoryData.itemWithHistory.executions
        : [],
    [itemHistoryData?.itemWithHistory],
  );

  const columns = useMemo(
    () => [
      {
        Header: 'Rule',
        accessor: 'rule',
        Filter: (props: ColumnProps) =>
          DefaultColumnFilter({
            columnProps: props,
            accessor: 'rule',
          }),
        filter: 'text',
        sortType: stringSort,
      },
      {
        Header: 'Result',
        accessor: 'result',
        Filter: (props: ColumnProps) =>
          SelectColumnFilter({
            columnProps: props,
            accessor: 'result',
          }),
        filter: 'includes',
        sortType: conditionOutcomeSort,
      },
      {
        Header: 'Status',
        accessor: 'status',
        Filter: (props: ColumnProps) =>
          SelectColumnFilter({
            columnProps: props,
            accessor: 'status',
          }),
        filter: 'includes',
        sortType: ruleStatusSort,
      },
      {
        Header: 'Policies',
        accessor: 'policies',
        Filter: (props: ColumnProps) =>
          SelectColumnFilter({
            columnProps: props,
            accessor: 'policies',
          }),
        filter: 'includes',
        canSort: false,
      },
      {
        Header: 'Tags',
        accessor: 'tags',
        Filter: (props: ColumnProps) =>
          SelectColumnFilter({
            columnProps: props,
            accessor: 'tags',
          }),
        filter: 'includes',
        canSort: false,
      },
      {
        Header: 'Actions',
        accessor: 'actions',
        Filter: (props: ColumnProps) =>
          SelectColumnFilter({
            columnProps: props,
            accessor: 'actions',
            placeholder: 'Filter by action',
          }),
        filter: 'includes',
        sortType: stringSort,
      },
      {
        Header: '',
        accessor: 'edit',
        canSort: false,
      },
    ],
    [],
  );

  const tableData = useMemo(
    () =>
      ruleExecutionsHistory.map((ruleResult) => {
        const outcome = ruleResult.passed
          ? GQLConditionOutcome.Passed
          : ruleResult.result?.result?.outcome;
        return {
          rule: ruleResult.ruleName,
          result: (
            <CoopBadge
              colorVariant={
                outcome === GQLConditionOutcome.Passed
                  ? 'soft-red'
                  : outcome === GQLConditionOutcome.Failed
                  ? 'soft-green'
                  : 'soft-gray'
              }
              shapeVariant="rounded"
              label={getDisplayName(outcome)}
              icon={outcomeIcon(outcome)}
            />
          ),
          status: (
            <RoundedTag
              title={capitalize(lowerCase(ruleResult.environment))}
              environment={ruleResult.environment}
            />
          ),
          policies: (
            <div className="w-48 mr-10 grid gap-y-1">
              {ruleResult.policies.map((policy, i) => (
                <InvestigationTag title={policy} key={i} />
              ))}
            </div>
          ),
          tags: (
            <div className="w-48 mr-10 grid gap-y-1">
              {ruleResult.tags.map((tag, i) => (
                <InvestigationTag title={tag} key={i} />
              ))}
            </div>
          ),
          actions: (
            <div className="w-48 mr-10 grid gap-y-1">
              {rules
                ?.find((it) => ruleResult.ruleId === it.id)
                ?.actions?.map((action, i) => (
                  <InvestigationTag title={action.name} key={i} />
                ))}
            </div>
          ),
          edit: (
            <div className="flex items-center justify-end">
              <Button
                className="rounded-lg cursor-pointer"
                size="middle"
                onClick={() =>
                  navigate(
                    `/dashboard/rules/proactive/form/${ruleResult.ruleId}`,
                  )
                }
              >
                Edit Rule
              </Button>
            </div>
          ),
          ruleExecutionResult: ruleResult.result,
        };
      }),
    [ruleExecutionsHistory, navigate, rules],
  );

  if (itemHistoryLoading) {
    return <ComponentLoading />;
  }

  if (itemHistoryError) {
    return (
      <div className="text-start">Error loading rule execution history</div>
    );
  }

  if (ruleExecutionsHistory.length === 0) {
    return null;
  }

  const closeModal = () =>
    setModalInfo({
      visible: false,
      title: undefined,
      ruleId: undefined,
      contentId: undefined,
    });

  const modal = (
    <CoopModal
      visible={modalInfo.visible}
      title={modalInfo.title}
      onClose={closeModal}
    >
      {modalInfo.visible && (
        <div className="p-4">
          <RuleInsightsSampleDetailResults
            ruleId={modalInfo.ruleId}
            itemIdentifier={itemIdentifier}
            itemSubmissionDate={submissionTime}
            lookback={LookbackVersion.LATEST}
          />
        </div>
      )}
    </CoopModal>
  );

  const onSelectRow = (rowData: Row<any>) => {
    const executionResult = ruleExecutionsHistory[rowData.index];
    if (executionResult == null) {
      return;
    }

    setModalInfo({
      visible: true,
      title: `Rule Result: ${rowData.original.rule}`,
      ruleId: executionResult.ruleId,
      contentId: executionResult.contentId,
    });
  };

  return (
    <div className="flex flex-col text-start">
      <Table
        columns={columns}
        data={tableData}
        onSelectRow={onSelectRow}
        topLeftComponent={
          <div className="flex flex-col justify-center">
            <div className="mb-1 text-base font-semibold text-zinc-900 text-start">
              Results
            </div>
            <div className="mb-1 text-sm text-zinc-900">
              Below you can inspect which rules the item matched on and why.
            </div>
          </div>
        }
      />
      {modal}
    </div>
  );
}
