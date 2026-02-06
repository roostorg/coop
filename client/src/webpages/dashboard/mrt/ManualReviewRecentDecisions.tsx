import { ReactComponent as ChevronLeft } from '@/icons/lni/Direction/chevron-left.svg';
import { ReactComponent as ChevronRight } from '@/icons/lni/Direction/chevron-right.svg';
import { ReactComponent as CrossCircle } from '@/icons/lni/Interface and Sign/cross-circle.svg';
import { RedoOutlined } from '@ant-design/icons';
import { gql } from '@apollo/client';
import { Button, Input } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import ComponentLoading from '../../../components/common/ComponentLoading';
import CoopBadge, { type BadgeColorVariant } from '../components/CoopBadge';
import FormHeader from '../components/FormHeader';
import { stringSort } from '../components/table/sort';
import Table from '../components/table/Table';
import TruncatedListTableCell from '../components/table/TruncatedListTableCell';
import UserWithAvatar from '../components/UserWithAvatar';

import {
  GQLGetRecentDecisionsQuery,
  GQLManualReviewDecision,
  useGQLGetDecidedJobFromJobIdQuery,
  useGQLGetDecidedJobLazyQuery,
  useGQLGetRecentDecisionsLazyQuery,
  useGQLGetSkipsForRecentDecisionsLazyQuery,
} from '../../../graphql/generated';
import { assertUnreachable } from '../../../utils/misc';
import {
  parseDatetimeToReadableStringInCurrentTimeZone,
  parseDatetimeToReadableStringInUTC,
} from '../../../utils/time';
import { jsonParse } from '../../../utils/typescript-types';
import { ITEM_TYPE_FRAGMENT } from '../rules/rule_form/RuleForm';
import ManualReviewJobReview, {
  JOB_FRAGMENT,
} from './manual_review_job/ManualReviewJobReview';
import ManualReviewRecentDecisionsFilter, {
  RecentDecisionsFilterInput,
} from './ManualReviewRecentDecisionsFilter';
import ManualReviewRecentDecisionSummary from './ManualReviewRecentDecisionSummary';

gql`
  ${ITEM_TYPE_FRAGMENT}
  fragment ManualReviewDecisionComponentFields on ManualReviewDecisionComponentBase {
    type
    ... on UserOrRelatedActionDecisionComponent {
      itemTypeId
      itemIds
      actionIds
      policyIds
    }
    ... on RejectAppealDecisionComponent {
     appealId
    }
    ... on AcceptAppealDecisionComponent {
      appealId
    }
    ... on TransformJobAndRecreateInQueueDecisionComponent {
      newQueueId
      originalQueueId
    }
    ... on SubmitNCMECReportDecisionComponent {
      type
      reportedMedia {
        id
        typeId
        url
        fileAnnotations
        industryClassification
      }
    }
  }

  query GetRecentDecisions($input: RecentDecisionsInput!) {
    getRecentDecisions(input: $input) {
      id
      jobId
      queueId
      reviewerId
      itemId
      itemTypeId
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
      decisionReason
    }
    myOrg {
      id
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

  query getSkipsForRecentDecisions($input: RecentDecisionsInput!) {
    getSkipsForRecentDecisions(input: $input) {
      jobId
      userId
      queueId
      ts
    }
  }

  query GetDecidedJob($id: ID!) {
    getDecidedJob(id: $id) {
      ${JOB_FRAGMENT}
      ...JobFields
    }
  }
`;

type RecentDecision =
  GQLGetRecentDecisionsQuery['getRecentDecisions'][number]['decisions'][number];

export default function ManualReviewRecentDecisions() {
  const [searchParams] = useSearchParams();
  const [decisionId] = [searchParams.get('decisionId') ?? undefined];
  const [jobId] = [searchParams.get('jobId') ?? undefined];
  const [selectedDecision, setSelectedDecision] = useState<
    GQLManualReviewDecision | undefined
  >(undefined);
  const [userSearchString, setUserSearchString] = useState<string | undefined>(
    searchParams.get('reviewerId') ?? undefined,
  );
  const [unsavedFilterValue, setUnsavedFilterValue] = useState<
    RecentDecisionsFilterInput | undefined
  >(undefined);

  const { data: decidedJobFromJobIdData } = useGQLGetDecidedJobFromJobIdQuery({
    variables: { id: jobId! },
    skip: !jobId,
    onCompleted: (data) => {
      if (data.getDecidedJobFromJobId) {
        setSelectedDecision(
          data.getDecidedJobFromJobId.decision as GQLManualReviewDecision,
        );
      }
    },
  });

  const [
    getRecentDecisions,
    {
      loading: allDecisionsLoading,
      error: allDecisionsError,
      data: allDecisionsData,
    },
  ] = useGQLGetRecentDecisionsLazyQuery();

  const [getSkipsForRecentDecisions] =
    useGQLGetSkipsForRecentDecisionsLazyQuery();

  const [getRecentDecisionsForDownload] = useGQLGetRecentDecisionsLazyQuery();

  // Confusingly, getDecidedJob is used to get the job associated with a decision
  // whereas getDecidedJobFromJobId is used to get the decision associated with a job
  const [
    getDecidedJob,
    {
      loading: decidedJobLoading,
      error: decidedJobError,
      data: decidedJobData,
    },
  ] = useGQLGetDecidedJobLazyQuery();

  const navigate = useNavigate();

  const [page, setPage] = useState(0);
  // Handle clicking the page left icon
  const handlePrevious = () => {
    setPage((prevOffset) => Math.max(0, prevOffset - 1));
    getRecentDecisions({
      fetchPolicy: 'network-only',
      variables: {
        input: getRecentDecisionsInput(unsavedFilterValue ?? {}, page),
      },
    });
  };

  // Handle clicking the page right icon
  const handleNext = () => {
    setPage((prevOffset) => prevOffset + 1);
    getRecentDecisions({
      fetchPolicy: 'network-only',
      variables: {
        input: getRecentDecisionsInput(unsavedFilterValue ?? {}, page),
      },
    });
  };

  useEffect(() => {
    const decision =
      allDecisionsData?.getRecentDecisions.find((it) => it.id === decisionId) ??
      decidedJobFromJobIdData?.getDecidedJobFromJobId?.decision.id ===
        decisionId
        ? decidedJobFromJobIdData?.getDecidedJobFromJobId?.decision
        : undefined;
    if (decision) {
      setSelectedDecision(decision as GQLManualReviewDecision);
    }
  }, [
    allDecisionsData?.getRecentDecisions,
    decidedJobFromJobIdData?.getDecidedJobFromJobId?.decision,
    decisionId,
    jobId,
  ]);

  useEffect(() => {
    if (selectedDecision) {
      getDecidedJob({
        variables: { id: selectedDecision.id },
      });
      navigate(
        `/dashboard/manual_review/recent/?decisionId=${selectedDecision.id}&jobId=${selectedDecision.jobId}`,
        {
          replace: true,
        },
      );
    }
  }, [
    getDecidedJob,
    selectedDecision,
    navigate,
    decidedJobData?.getDecidedJob,
  ]);

  const columns = useMemo(
    () => [
      {
        Header: 'Decision Time',
        accessor: 'decisionTime',
        sortDescFirst: true,
        sortType: stringSort,
      },
      {
        Header: 'Decisions',
        accessor: 'decisions',
        canSort: false,
      },
      {
        Header: 'Policies',
        accessor: 'policies',
        canSort: false,
      },
      {
        Header: 'Reviewer',
        accessor: 'reviewer',
        canSort: false,
      },
      {
        Header: 'Queue',
        accessor: 'queue',
        canSort: true,
      },
    ],
    [],
  );

  const getReviewerName = useCallback(
    (reviewerId: string | null | undefined) => {
      if (!reviewerId) {
        return 'Automatic';
      }
      const reviewer = allDecisionsData?.myOrg?.users.find(
        (user) => user.id === reviewerId,
      );
      return reviewer
        ? `${reviewer.firstName} ${reviewer.lastName}`
        : 'Unknown';
    },
    [allDecisionsData?.myOrg?.users],
  );

  const getQueueName = useCallback(
    (queueId: string) =>
      allDecisionsData?.myOrg?.mrtQueues.find((queue) => queue.id === queueId)
        ?.name ?? 'Unknown',
    [allDecisionsData?.myOrg],
  );

  const getActionName = useCallback(
    (actionId: string) =>
      allDecisionsData?.myOrg?.actions.find((action) => action.id === actionId)
        ?.name ?? 'Unknown',
    [allDecisionsData?.myOrg],
  );

  const getPolicyName = useCallback(
    (policyId: string) =>
      allDecisionsData?.myOrg?.policies.find((policy) => policy.id === policyId)
        ?.name ?? 'Unknown',
    [allDecisionsData?.myOrg],
  );

  const getDecisionColorNamePairs = useCallback(
    (
      decision: RecentDecision,
      isSelected: boolean,
    ): { name: string; colorVariant: BadgeColorVariant }[] => {
      switch (decision.__typename) {
        case 'IgnoreDecisionComponent':
          return [
            {
              name: 'Ignore',
              colorVariant: 'soft-gray',
            },
          ];
        case 'AcceptAppealDecisionComponent':
          return [
            {
              name: 'Accept Appeal',
              colorVariant: 'soft-green',
            },
          ];
        case 'RejectAppealDecisionComponent':
          return [
            {
              name: 'Reject Appeal',
              colorVariant: 'soft-red',
            },
          ];
        case 'SubmitNCMECReportDecisionComponent':
          return [
            {
              name: 'Report to NCMEC',
              colorVariant: 'soft-yellow',
            },
          ];
        case 'TransformJobAndRecreateInQueueDecisionComponent':
          return [
            {
              name: 'Move to Different Queue',
              colorVariant: 'soft-blue',
            },
          ];
        case 'AutomaticCloseDecisionComponent':
          return [
            {
              name: 'Closed Automatically',
              colorVariant: 'soft-gray',
            },
          ];
        case 'UserOrRelatedActionDecisionComponent':
          if (decision.type === 'RELATED_ACTION') {
          }
          return decision.actionIds.map((actionId) => ({
            name: getActionName(actionId),
            // Reduced opacity because alert-red is really bright for this UI
            colorVariant: 'soft-red',
          }));
      }
    },
    [getActionName],
  );

  const getPoliciesFromDecision = useCallback(
    (decision: RecentDecision) => {
      switch (decision.__typename) {
        case 'IgnoreDecisionComponent':
        case 'AutomaticCloseDecisionComponent':
        case 'TransformJobAndRecreateInQueueDecisionComponent':
        case 'AcceptAppealDecisionComponent':
        case 'RejectAppealDecisionComponent':
          return [];
        case 'SubmitNCMECReportDecisionComponent':
        case 'UserOrRelatedActionDecisionComponent':
          return decision.__typename === 'SubmitNCMECReportDecisionComponent'
            ? ['Child Safety'] // TODO @mdworsky replace with the org's child safety policy ID
            : decision.policyIds.map((id) => getPolicyName(id));
        default:
          assertUnreachable(decision);
      }
    },
    [getPolicyName],
  );

  const dataValues = useMemo(() => {
    if (!allDecisionsData || !allDecisionsData.myOrg) {
      return undefined;
    }
    const allDecisions = [
      ...allDecisionsData.getRecentDecisions,
      ...(decidedJobFromJobIdData?.getDecidedJobFromJobId?.decision
        ? [decidedJobFromJobIdData?.getDecidedJobFromJobId?.decision]
        : []),
    ];

    return allDecisions.map((decisionData) => {
      const isSelected = selectedDecision?.id === decisionData.id;
      return {
        ...decisionData,
        decisions: decisionData.decisions
          .map((decision) =>
            getDecisionColorNamePairs(decision, isSelected).map(
              ({ name }) => name,
            ),
          )
          .flat(),
        decisionColorNamePairs: decisionData.decisions
          .map((decision) => getDecisionColorNamePairs(decision, isSelected))
          .flat(),
        policies: decisionData.decisions
          // eslint-disable-next-line array-callback-return
          .flatMap((decision) => getPoliciesFromDecision(decision)),
        reviewer: getReviewerName(decisionData.reviewerId),
        queue: getQueueName(decisionData.queueId),
        decisionTime: decisionData.createdAt,
        originalDecisionData: decisionData,
        decisionReason: decisionData.decisionReason,
      };
    });
  }, [
    allDecisionsData,
    decidedJobFromJobIdData?.getDecidedJobFromJobId?.decision,
    getDecisionColorNamePairs,
    getPoliciesFromDecision,
    getQueueName,
    getReviewerName,
    selectedDecision?.id,
  ]);

  const tableData = useMemo(() => {
    if (!dataValues) {
      return undefined;
    }
    return (
      dataValues
        .map((value) => {
          return {
            decisions: (
              <div className="flex flex-wrap gap-1">
                {value.decisionColorNamePairs.map(
                  ({ name, colorVariant }, index) => (
                    <CoopBadge
                      key={index}
                      colorVariant={colorVariant}
                      label={name}
                      shapeVariant="pill"
                    />
                  ),
                )}
              </div>
            ),
            policies: (
              <div className="flex flex-wrap gap-1">
                <TruncatedListTableCell list={value.policies} />
              </div>
            ),
            reviewer: <UserWithAvatar name={value.reviewer} />,
            queue: <div>{value.queue}</div>,
            decisionTime: (
              <div>
                {parseDatetimeToReadableStringInCurrentTimeZone(
                  new Date(value.decisionTime),
                )}
              </div>
            ),
            values: value,
          };
        })
        // Sort in reverse-chronological order
        .sort(
          (a, b) =>
            new Date(b.values.decisionTime).valueOf() -
            new Date(a.values.decisionTime).valueOf(),
        )
    );
  }, [dataValues]);

  if (allDecisionsError || allDecisionsError || decidedJobError) {
    throw allDecisionsError ?? allDecisionsError ?? decidedJobError!;
  }

  const refreshButton = (
    <Button
      icon={<RedoOutlined className="self-center" />}
      className="!inline-flex"
      onClick={async () =>
        getRecentDecisions({
          fetchPolicy: 'network-only',
          variables: {
            input: getRecentDecisionsInput(unsavedFilterValue ?? {}, page),
          },
        })
      }
      loading={allDecisionsLoading || allDecisionsLoading}
    >
      Refresh Table
    </Button>
  );

  const downloadButton = (
    <Button
      className="rounded"
      onClick={async () => {
        const decisions: GQLGetRecentDecisionsQuery[] = [];
        for (let i = 0; i < 100; i++) {
          const result = await getRecentDecisionsForDownload({
            variables: {
              input: getRecentDecisionsInput(
                unsavedFilterValue ?? {},
                page + i,
              ),
            },
          });
          if (result.data) {
            decisions.push(result.data);
          }
        }
        const allDecisions = decisions.flatMap((it) => it.getRecentDecisions);
        const allDecisionsCsv = allDecisions.map((decision) => {
          const decisions = decision.decisions.flatMap((it) =>
            getDecisionColorNamePairs(it, false).map(({ name }) => name),
          );
          const policies = decision.decisions.flatMap((decision) =>
            getPoliciesFromDecision(decision),
          );

          return {
            jobId: decision.jobId,
            queue: getQueueName(decision.queueId),
            reviewer: getReviewerName(decision.reviewerId),
            decisions,
            createdAt: parseDatetimeToReadableStringInUTC(
              new Date(decision.createdAt),
            ),
            policies,
          };
        });
        // Define the CSV headers
        const headers = [
          'Decisions',
          'Policies',
          'Reviewer',
          'Queue',
          'Decision Time',
          'Link',
        ];

        // Map the data to CSV rows
        const rows = allDecisionsCsv.map((item) => [
          JSON.stringify(item.decisions),
          JSON.stringify(item.policies), // Convert array/object to JSON string if necessary
          item.reviewer,
          item.queue,
          item.createdAt,
          `https://getcoop.com/dashboard/manual_review/recent?jobId=${item.jobId}`,
        ]);

        // Combine the headers and rows into a CSV string
        const csvContent = [headers, ...rows]
          .map((row) => row.map((field) => `"${field}"`).join(',')) // Ensure each field is enclosed in double quotes
          .join('\n');

        // Create a Blob from the CSV content
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);

        // Create a temporary link to download the Blob
        const a = document.createElement('a');
        a.href = url;
        a.download = 'decisions.csv'; // Set the desired file name
        a.click();

        // Clean up
        URL.revokeObjectURL(url);
      }}
      loading={allDecisionsLoading || allDecisionsLoading}
    >
      Download
    </Button>
  );

  const downloadSkips = (
    <Button
      className="rounded"
      onClick={async () => {
        const result = await getSkipsForRecentDecisions({
          variables: {
            input: getRecentDecisionsInput(unsavedFilterValue ?? {}, page),
          },
        });

        const skips = result.data?.getSkipsForRecentDecisions;

        if (skips === undefined) {
          return;
        }
        const rows = skips.map((skip) => {
          return [
            getReviewerName(skip.userId),
            getQueueName(skip.queueId),
            parseDatetimeToReadableStringInUTC(new Date(skip.ts)),
            `https://getcoop.com/dashboard/manual_review/recent?jobId=${skip.jobId}`,
          ];
        });
        // Define the CSV headers
        const headers = ['Reviewer', 'Queue', 'Decision Time', 'Link'];

        // Combine the headers and rows into a CSV string
        const csvContent = [headers, ...rows]
          .map((row) => row.map((field) => `"${field}"`).join(',')) // Ensure each field is enclosed in double quotes
          .join('\n');

        // Create a Blob from the CSV content
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);

        // Create a temporary link to download the Blob
        const a = document.createElement('a');
        a.href = url;
        a.download = 'skips.csv'; // Set the desired file name
        a.click();

        // Clean up
        URL.revokeObjectURL(url);
      }}
    >
      Download Skips
    </Button>
  );

  const getRecentDecisionsInput = useCallback(
    (input: RecentDecisionsFilterInput, page: number) => {
      const decisionOrActions = input.decisions?.map((it) => jsonParse(it));
      const filter = {
        userSearchString,
        policyIds: input.policyIds,
        reviewerIds: input.reviewerIds,
        queueIds: input.queueIds,
        startTime: input.dateRange?.startDate,
        endTime: input.dateRange?.endDate,
        // eslint-disable-next-line array-callback-return
        decisions: decisionOrActions?.map((it) => {
          switch (it.type) {
            case 'CUSTOM_ACTION':
              return {
                userOrRelatedActionDecision: {
                  actionIds: [it.actionId],
                },
              };
            case 'IGNORE':
              return {
                ignoreDecision: {
                  _: true,
                },
              };
            case 'AUTOMATIC_CLOSE':
              return {
                automaticClose: {
                  _: true,
                },
              };
            case 'REJECT_APPEAL':
              return {
                rejectAppealDecision: {
                  _: true,
                },
              };
            case 'ACCEPT_APPEAL':
              return {
                acceptAppealDecision: {
                  _: true,
                },
              };
            case 'SUBMIT_NCMEC_REPORT':
              return {
                submitNcmecReportDecision: {
                  _: true,
                },
              };
            case 'TRANSFORM_JOB_AND_RECREATE_IN_QUEUE':
              return {
                transformJobAndRecreateInQueueDecision: {
                  _: true,
                },
              };
            default:
              assertUnreachable(it);
          }
        }),
      };
      return { filter, page };
    },
    [userSearchString],
  );
  useEffect(() => {
    getRecentDecisions({
      variables: {
        input: getRecentDecisionsInput(unsavedFilterValue ?? {}, page),
      },
    });
    // NB: We only want to run this once, so we intentionally do not include
    // any dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const searchForUser = () => {
    if (userSearchString) {
      setSelectedDecision(undefined);
      getRecentDecisions({
        variables: {
          input: getRecentDecisionsInput(unsavedFilterValue ?? {}, page),
        },
      });
      navigate(
        `/dashboard/manual_review/recent/?reviewerId=${userSearchString}`,
        {
          replace: true,
        },
      );
    }
  };

  const userSearchInput = (
    <div className="flex items-start gap-2 pb-6">
      <Input
        className="rounded-lg w-[300px]"
        placeholder="Input a user's ID or username"
        value={userSearchString}
        onChange={(event) => setUserSearchString(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            searchForUser();
          }
        }}
        suffix={
          userSearchString ? (
            <CrossCircle
              onClick={() => setUserSearchString('')}
              className="cursor-pointer"
            />
          ) : null
        }
        autoFocus
      />
      <Button disabled={userSearchString === undefined} onClick={searchForUser}>
        Search
      </Button>
    </div>
  );

  const userSearchAndRefresh = (
    <div className="flex gap-8">
      {userSearchInput}
      {refreshButton}
      {downloadButton}
      {downloadSkips}
    </div>
  );

  const filter = (
    <ManualReviewRecentDecisionsFilter
      input={unsavedFilterValue ?? {}}
      onSave={(input) => {
        setPage(0);
        setSelectedDecision(undefined);
        setUnsavedFilterValue(input);
        getRecentDecisions({
          variables: { input: getRecentDecisionsInput(input, page) },
        });
        navigate(`/dashboard/manual_review/recent/`, {
          replace: true,
        });
      }}
    />
  );

  const currentJobNCMECDecision = selectedDecision?.decisions.find(
    (it) => it.__typename === 'SubmitNCMECReportDecisionComponent',
  );

  return (
    <div className="flex flex-col text-start">
      <Helmet>
        <title>Manual Review Decisions</title>
      </Helmet>
      <FormHeader
        title="Recent Decisions"
        subtitle="This is a list of all the most recent moderator decisions, in reverse chronological order with the most recent decision first, and the least recent decision last. You can search for decisions about a given user by entering that user's ID or username."
      />
      {selectedDecision ? userSearchAndRefresh : null}
      {allDecisionsLoading || !tableData ? (
        <ComponentLoading />
      ) : (
        <div className="flex w-full">
          <div>
            <Table
              columns={columns}
              // @ts-ignore
              data={tableData}
              onSelectRow={(rowData) =>
                setSelectedDecision(
                  rowData.original.values.originalDecisionData,
                )
              }
              topLeftComponent={selectedDecision ? null : userSearchAndRefresh}
              topRightComponent={<div className="pb-8">{filter}</div>}
              isCollapsed={selectedDecision != null}
              collapsedColumnTitle="Decisions"
              renderCollapsedCell={(row) => {
                const values = row.original.values as {
                  decisionColorNamePairs: { name: string; colors: string }[];
                  reviewerId: string;
                  createdAt: string | Date;
                };

                return (
                  <div className="flex flex-col gap-0.5">
                    <div className="flex flex-wrap gap-1">
                      {values.decisionColorNamePairs.map(
                        ({ name, colors }, index) => (
                          <div
                            key={index}
                            className={`flex px-2 py-0.5 rounded font-medium text-xs ${colors}`}
                          >
                            {name}
                          </div>
                        ),
                      )}
                    </div>
                    <div className="text-xs font-medium text-slate-500">
                      {getReviewerName(values.reviewerId)}
                    </div>
                    <div className="text-xs text-slate-400 whitespace-nowrap">
                      {parseDatetimeToReadableStringInCurrentTimeZone(
                        values.createdAt,
                      )}
                    </div>
                  </div>
                );
              }}
            />

            {decidedJobLoading || selectedDecision ? null : (
              <div className="flex justify-between w-full mb-10">
                <ChevronLeft
                  className="font-bold cursor-pointer w-7 fill-slate-500"
                  onClick={() => handlePrevious()}
                />
                <span>Page {page + 1}</span>
                <ChevronRight
                  className="font-bold cursor-pointer w-7 fill-slate-500"
                  onClick={() => handleNext()}
                />
              </div>
            )}
          </div>
          {decidedJobLoading ? (
            <div className="flex w-full h-screen">
              <ComponentLoading />
            </div>
          ) : selectedDecision ? (
            <div className="flex flex-col items-start w-full h-full p-3 mb-4 ml-3 border border-r-0 border-solid rounded border-slate-200">
              <ManualReviewRecentDecisionSummary
                selectedDecision={selectedDecision}
                showCloseButton={true}
                closeButtonOnClick={() => {
                  setSelectedDecision(undefined);
                  navigate(`/dashboard/manual_review/recent/`, {
                    replace: true,
                  });
                }}
              />
              {decidedJobError ? (
                <div className="text-red-500">
                  Error loading job. Please refresh and try again.
                </div>
              ) : decidedJobData ? (
                <div className="w-full h-screen overflow-y-scroll">
                  <ManualReviewJobReview
                    closedJobData={{
                      closedJob: decidedJobData.getDecidedJob,
                      ncmecDecisions:
                        currentJobNCMECDecision &&
                        currentJobNCMECDecision.__typename ===
                          'SubmitNCMECReportDecisionComponent'
                          ? currentJobNCMECDecision.reportedMedia
                          : undefined,
                      rightComponent: decidedJobData.getDecidedJob?.payload && (
                        <Link
                          className="cursor-pointer shrink-0"
                          to={`/dashboard/manual_review/investigation?id=${decidedJobData.getDecidedJob.payload.item.id}&typeId=${decidedJobData.getDecidedJob.payload.item.type.id}`}
                          target="_blank"
                        >
                          Action on this Item
                        </Link>
                      ),
                    }}
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
