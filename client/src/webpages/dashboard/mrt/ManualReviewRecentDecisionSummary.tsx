import {
  useGQLRecentDecisionsSummaryDataQuery,
  type GQLManualReviewDecision,
  type GQLManualReviewDecisionComponent,
} from '@/graphql/generated';
import { parseDatetimeToReadableStringInCurrentTimeZone } from '@/utils/time';
import { gql } from '@apollo/client';
import { useCallback } from 'react';

import CloseButton from '@/components/common/CloseButton';
import ComponentLoading from '@/components/common/ComponentLoading';

gql`
  query RecentDecisionsSummaryData {
    myOrg {
      users {
        id
        firstName
        lastName
      }
      mrtQueues {
        id
        name
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
    }
  }
`;

export default function ManualReviewRecentDecisionSummary(props: {
  selectedDecision: GQLManualReviewDecision | undefined;
  showCloseButton: boolean;
  closeButtonOnClick?: () => void;
}) {
  const { data, loading } = useGQLRecentDecisionsSummaryDataQuery();
  const getReviewerName = useCallback(
    (reviewerId: string | null | undefined) => {
      if (!reviewerId) {
        return 'Automatic';
      }
      const reviewer = data?.myOrg?.users.find(
        (user) => user.id === reviewerId,
      );
      return reviewer
        ? `${reviewer.firstName} ${reviewer.lastName}`
        : 'Unknown';
    },
    [data?.myOrg?.users],
  );

  const getQueueName = useCallback(
    (queueId: string) =>
      data?.myOrg?.mrtQueues.find((queue) => queue.id === queueId)?.name ??
      'Unknown',
    [data?.myOrg],
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
    [data?.myOrg?.itemTypes],
  );

  const actionPoliciesPair = (decision: GQLManualReviewDecisionComponent) => {
    switch (decision.__typename) {
      case 'UserOrRelatedActionDecisionComponent':
        const itemTypeName = getItemTypeName(decision.itemTypeId);
        return (
          <p>
            <text>Item{decision.itemIds.length > 1 ? 's' : ''}</text>:{' '}
            {itemTypeName}
            {decision.itemIds.length > 1 ? 's' : ''} with ID
            {decision.itemIds.length > 1 ? 's' : ''}{' '}
            {decision.itemIds.join(', ')}
            <br />
            <text>Action{decision.actionIds.length > 1 ? 's' : ''}</text>:{' '}
            <strong>
              {decision.actionIds
                .map((actionId) => getActionName(actionId))
                .join(', ')}
            </strong>
            <br />
            <text>
              Polic{decision.policyIds.length > 1 ? 'ies' : 'y'}
            </text>:{' '}
            <strong>
              {decision.policyIds.map((policyId) => getPolicyName(policyId))}
            </strong>
          </p>
        );
      case 'AcceptAppealDecisionComponent':
        return <div>Accepted Appeal</div>;
      case 'RejectAppealDecisionComponent':
        return <div>Rejected Appeal</div>;
      case 'IgnoreDecisionComponent':
        return <div>Ignored</div>;
      case 'AutomaticCloseDecisionComponent':
        return <div>Closed Automatically</div>;
      case 'SubmitNCMECReportDecisionComponent':
        return <div>Reported to NCMEC</div>;
      case 'TransformJobAndRecreateInQueueDecisionComponent':
        return (
          <div>
            <div>
              {decision.originalQueueId
                ? `Moved from: ${getQueueName(decision.originalQueueId)}`
                : null}
            </div>
            <div>
              {`Moved to Queue: ${
                decision.newQueueId
                  ? `${getQueueName(decision.newQueueId)}`
                  : 'Unknown'
              }`}
            </div>
          </div>
        );
    }
  };

  const { selectedDecision, closeButtonOnClick } = props;
  if (!selectedDecision) {
    return null;
  }

  if (loading) {
    return <ComponentLoading />;
  }

  return (
    // pl-12 -ml-12 matches the padding and margin in ManualReviewJobReviewImpl
    <div className="flex items-start w-full pl-12 -ml-12">
      <div className="flex flex-col w-full p-4 mb-6 rounded bg-coop-lightblue">
        <div className="flex flex-wrap items-center justify-between w-full gap-3 pb-2">
          <div className="text-lg font-bold">Decision Summary</div>
          <div className="text-sm font-medium text-slate-500">
            {parseDatetimeToReadableStringInCurrentTimeZone(
              selectedDecision.createdAt,
            )}
          </div>
        </div>
        <div className="flex gap-8">
          <div className="flex flex-col gap-2">
            <div className="flex flex-col text-slate-500">
              <div className="font-bold text-slate-700">Reviewer</div>
              {getReviewerName(selectedDecision.reviewerId)}
            </div>
            <div className="flex flex-col text-slate-500">
              <div className="font-bold text-slate-700">Queue</div>
              {getQueueName(selectedDecision.queueId)}
            </div>
            {selectedDecision.decisionReason ? (
              <div className="flex flex-col text-slate-500">
                <div className="font-bold text-slate-700">Decision Reason</div>
                {selectedDecision.decisionReason}
              </div>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex flex-col text-slate-500">
              <div className="font-bold text-slate-700">Primary Decision</div>
              {selectedDecision.decisions.map((decision) =>
                actionPoliciesPair(decision),
              )}
            </div>
            {selectedDecision.relatedActions.length > 0 ? (
              <div className="flex flex-col text-slate-500">
                <div className="font-bold text-slate-700">Related Actions</div>
                {selectedDecision.relatedActions.map((action) =>
                  actionPoliciesPair(action),
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
      {props.showCloseButton && closeButtonOnClick ? (
        <div className="ml-3">
          <CloseButton onClose={closeButtonOnClick} customWidth="w-5" />
        </div>
      ) : null}
    </div>
  );
}
