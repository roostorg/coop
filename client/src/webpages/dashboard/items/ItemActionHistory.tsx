import {
  useGQLGetDecidedJobFromJobIdLazyQuery,
  useGQLGetRecentDecisionsQuery,
  useGQLItemActionHistoryQuery,
  type GQLManualReviewDecision,
} from '@/graphql/generated';
import { parseDatetimeToReadableStringInCurrentTimeZone } from '@/utils/time';
import { gql } from '@apollo/client';
import { ItemIdentifier } from '@roostorg/types';
import { Button } from 'antd';
import { useCallback, useMemo, useState } from 'react';

import CoopModal from '../components/CoopModal';
import { stringSort } from '../components/table/sort';
import Table from '../components/table/Table';
import ComponentLoading from '@/components/common/ComponentLoading';
import FullScreenLoading from '@/components/common/FullScreenLoading';

import InvestigationTag from '../investigation/InvestigationTag';
import ManualReviewJobReview, {
  JOB_FRAGMENT,
} from '../mrt/manual_review_job/ManualReviewJobReview';
import ManualReviewRecentDecisionSummary from '../mrt/ManualReviewRecentDecisionSummary';

gql`
  query ItemActionHistory(
    $itemIdentifier: ItemIdentifierInput!
    $submissionTime: DateTime
  ) {
    itemActionHistory(
      itemIdentifier: $itemIdentifier
      submissionTime: $submissionTime
    ) {
      ... on ItemAction {
        itemId
        itemTypeId
        itemCreatorId
        itemCreatorTypeId
        actionId
        actorId
        jobId
        policies
        ruleIds
        ts
      }
    }
    myOrg {
      users {
        id
        firstName
        lastName
      }
      actions {
        ... on ActionBase {
          id
          name
        }
      }
      policies {
        id
        name
      }
      itemTypes {
        ... on ItemTypeBase {
          id
          name
        }
      }
      rules {
        ... on ContentRule {
          id
          name
        }
        ... on UserRule {
          id
          name
        }
      }
    }
  }

  query getDecidedJobFromJobId($id: String!) {
    getDecidedJobFromJobId(id: $id) {
      job {
        ${JOB_FRAGMENT}
        ...JobFields
      }
      decision {
        id
        queueId
        reviewerId
        itemId
        itemTypeId
        jobId
        decisionReason
        decisions {
          ... on ManualReviewDecisionComponentBase {
            ...ManualReviewDecisionComponentFields
          }
        }
        relatedActions {
          ... on ManualReviewDecisionComponentBase {
            ...ManualReviewDecisionComponentFields
          }
        }
        createdAt
      }
    }
  }
`;
export default function ItemActionHistory(props: {
  itemIdentifier: ItemIdentifier;
  submissionTime?: string | undefined;
}) {
  const { itemIdentifier, submissionTime } = props;
  const { data, loading } = useGQLItemActionHistoryQuery({
    variables: {
      itemIdentifier,
      submissionTime: submissionTime
        ? new Date(submissionTime).toISOString()
        : undefined,
    },
  });

  const { data: recentIgnores, loading: recentIgnoresLoading } =
    useGQLGetRecentDecisionsQuery({
      variables: {
        input: {
          filter: {
            decisions: [{ ignoreDecision: { _: true } }],
            userSearchString: itemIdentifier.id,
          },
        },
      },
    });

  const [getDecidedJob, { data: decidedJobData, loading: decidedJobLoading }] =
    useGQLGetDecidedJobFromJobIdLazyQuery();
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const getReviewerName = useCallback(
    (reviewerId: string | null | undefined) => {
      const reviewer = data?.myOrg?.users.find(
        (user) => user.id === reviewerId,
      );
      return reviewer
        ? `${reviewer.firstName} ${reviewer.lastName}`
        : 'Unknown';
    },
    [data?.myOrg?.users],
  );

  const getActionName = useCallback(
    (actionId: string) =>
      data?.myOrg?.actions.find((action) => action.id === actionId)?.name ??
      'Unknown',
    [data?.myOrg],
  );

  const getPolicyName = useCallback(
    (policyId: string) =>
      data?.myOrg?.policies.find((policy) => policy.id === policyId)?.name ??
      'Unknown',
    [data?.myOrg],
  );

  const getItemTypeName = useCallback(
    (itemTypeId: string) =>
      data?.myOrg?.itemTypes.find((itemType) => itemType.id === itemTypeId)
        ?.name ?? 'Unknown',
    [data?.myOrg],
  );

  const getRuleName = useCallback(
    (ruleId: string) =>
      data?.myOrg?.rules.find((rule) => rule.id === ruleId)?.name ?? 'Unknown',
    [data?.myOrg],
  );

  const columns = useMemo(
    () => [
      {
        Header: 'Actions',
        accessor: 'actions',
        canSort: false,
      },
      {
        Header: 'Policies',
        accessor: 'policies',
        canSort: false,
      },
      {
        Header: 'Decision Time',
        accessor: 'ts',
        sortDescFirst: true,
        sortType: stringSort,
      },
      {
        Header: 'Actor',
        accessor: 'actor',
        canSort: false,
      },
      {
        Header: 'Source(s)',
        accessor: 'source',
        canSort: false,
      },
    ],
    [],
  );

  const dataValues = useMemo(() => {
    if (!data || !data.myOrg || !recentIgnores) {
      return undefined;
    }

    const actions = data.itemActionHistory.map((decisionData) => ({
      ...decisionData,
      policies: decisionData.policies.map((id) => getPolicyName(id)),
      actor: decisionData.actorId
        ? getReviewerName(decisionData.actorId)
        : undefined,
      ts: decisionData.ts,
      jobId: decisionData.jobId,
      ruleIds: decisionData.ruleIds,
      actions: [getActionName(decisionData.actionId)],
    }));

    const tableData = Object.values(
      actions.reduce<{
        [key: string]: {
          policies: string[];
          actor: string | undefined;
          ts: string | Date;
          jobId: string | null | undefined;
          ruleIds: readonly string[];
          actions: string[];
        };
      }>((acc, item) => {
        if (item.jobId == null) {
          const key = `null_${item.ts}_${item.actor}`;
          acc[key] = { ...item };
        } else if (acc[item.jobId]) {
          acc[item.jobId].actions = [
            ...acc[item.jobId].actions,
            ...item.actions,
          ];
        } else {
          acc[item.jobId] = { ...item };
        }
        return acc;
      }, {}),
    );
    return [
      ...tableData,
      ...recentIgnores.getRecentDecisions.map((it) => ({
        ...it,
        policies: [],
        actor: getReviewerName(it.reviewerId),
        ts: it.createdAt,
        jobId: it.jobId,
        ruleIds: [],
        actions: ['Ignore'],
      })),
    ];
  }, [data, recentIgnores, getPolicyName, getReviewerName, getActionName]);

  const tableData = useMemo(() => {
    if (!dataValues) {
      return undefined;
    }
    return (
      dataValues
        .slice(0, 10)
        .map((value, i) => {
          const jobId = value.jobId;
          return {
            actions: value.actions.map((it, index) => (
              <InvestigationTag key={`${i}-${index}`} title={it} />
            )),
            policies: (
              <div className="flex flex-wrap gap-1">
                {value.policies.map((policyName, index) => (
                  <div
                    key={index}
                    className={`flex px-2 py-0.5 rounded font-semibold bg-slate-200 text-slate-500`}
                  >
                    {policyName}
                  </div>
                ))}
              </div>
            ),
            actor: (
              <div className="whitespace-nowrap">
                {value.ruleIds.length > 0 ? 'System' : value.actor}
              </div>
            ),
            ts: (
              <div>
                {parseDatetimeToReadableStringInCurrentTimeZone(
                  new Date(value.ts),
                )}
              </div>
            ),
            values: value,
            source: jobId ? (
              <Button
                className="!px-0"
                type="link"
                onClick={() => {
                  getDecidedJob({ variables: { id: jobId } });
                  setIsModalOpen(true);
                }}
              >
                Preview Job
              </Button>
            ) : (
              value.ruleIds.map((ruleId) => (
                <div className="whitespace-nowrap" key={ruleId}>
                  Rule:
                  <Button
                    className="!pl-1 !pr-0"
                    type="link"
                    href={`/dashboard/rules/proactive/form/${ruleId}`}
                    target="_blank"
                  >
                    {getRuleName(ruleId)}
                  </Button>
                </div>
              ))
            ),
          };
        })
        // Sort in reverse-chronological order
        .sort(
          (a, b) =>
            new Date(b.values.ts).valueOf() - new Date(a.values.ts).valueOf(),
        )
    );
  }, [dataValues, getDecidedJob, getRuleName]);

  if (data && data.itemActionHistory.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col w-full text-start">
      <CoopModal
        className="!max-w-7xl"
        visible={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      >
        {decidedJobLoading ||
        !decidedJobData?.getDecidedJobFromJobId ||
        recentIgnoresLoading ? (
          <FullScreenLoading />
        ) : (
          <>
            <ManualReviewRecentDecisionSummary
              selectedDecision={
                decidedJobData.getDecidedJobFromJobId
                  .decision as GQLManualReviewDecision
              }
              showCloseButton={false}
            />
            <div className="w-full h-screen overflow-y-scroll">
              <ManualReviewJobReview
                closedJobData={{
                  closedJob: decidedJobData.getDecidedJobFromJobId.job,
                }}
              />
            </div>
          </>
        )}
      </CoopModal>
      {loading ? (
        <ComponentLoading />
      ) : !tableData ? null : (
        <>
          <div className="mb-3 text-base font-semibold">
            Recent Actions on this {getItemTypeName(itemIdentifier.typeId)}
          </div>
          <div className="overflow-y-scroll max-h-[400px]">
            <Table
              columns={columns}
              data={tableData}
              collapsedColumnTitle="Decisions"
              customMaxHeight="max-h-[360px]"
            />
          </div>
        </>
      )}
    </div>
  );
}
