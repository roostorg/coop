import { ReactComponent as Sidebar1 } from '@/icons/lni/Design/sidebar-1.svg';
import { ReactComponent as AngleDoubleRight } from '@/icons/lni/Direction/angle-double-right.svg';
import { __throw } from '@/utils/misc';
import { isNonEmptyString } from '@/utils/string';
import { multilevelListFromFlatList } from '@/utils/tree';
import { DownOutlined, LoadingOutlined } from '@ant-design/icons';
import { gql } from '@apollo/client';
import { Button, Dropdown, Input, Select } from 'antd';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useParams } from 'react-router-dom';

import ComponentLoading from '../../../../components/common/ComponentLoading';
import CopyTextComponent from '../../../../components/common/CopyTextComponent';
import CoopModal from '../../components/CoopModal';
import { CoopModalFooterButtonProps } from '../../components/CoopModalFooter';
import PolicyDropdown from '../../components/PolicyDropdown';
import Drawer from '@/components/common/Drawer';

import {
  GQLContentAppealManualReviewJobPayload,
  GQLContentItem,
  GQLContentManualReviewJobPayload,
  GQLDequeueManualReviewJobMutation,
  GQLGetDecidedJobQuery,
  GQLItemType,
  GQLNcmecFileAnnotation,
  GQLNcmecIndustryClassification,
  GQLSchemaFieldRoles,
  GQLThreadAppealManualReviewJobPayload,
  GQLUserManualReviewJobPayload,
  GQLUserPenaltySeverity,
  useGQLDequeueManualReviewJobMutation,
  useGQLLogSkipMutation,
  useGQLManualReviewJobInfoQuery,
  useGQLReleaseJobLockMutation,
  useGQLSubmitManualReviewDecisionMutation,
  type GQLThreadManualReviewJobPayload,
  type GQLUserItem,
} from '../../../../graphql/generated';
import { filterNullOrUndefined } from '../../../../utils/collections';
import { getFieldValueForRole } from '../../../../utils/itemUtils';
import { recomputeSelectedRelatedActions } from '../../../../utils/manualReviewTool';
import { ITEM_FRAGMENT } from '../../item_types/ItemTypesDashboard';
import HTMLRenderer from '../../policies/HTMLRenderer';
import { ITEM_TYPE_FRAGMENT } from '../../rules/rule_form/RuleForm';
import CustomMrtApiParamsSection from './CustomMrtApiParamsSection';
import ManualReviewJobDequeueErrorComponent from './ManualReviewJobDequeueErrorComponent';
import MergedReportsComponent from './MergedReportsComponent';
import ReportInfoComponent from './ReportInfoComponent';
import ManualReviewJobContentView from './v2/ManualReviewJobContentView';
import ManualReviewJobEmptyQueue from './v2/ManualReviewJobEmptyQueue';
import { ManualReviewJobOtherItemsComponent } from './v2/ManualReviewJobOtherItemsComponent';
import {
  CustomAction,
  ManualReviewActionStore,
  ManualReviewActionStoreProvider,
} from './v2/ManualReviewJobRelatedActionsStore';
import NCMECReviewUser from './v2/ncmec/NCMECReviewUser';
import ManualReviewJobEnqueuedRelatedActions from './v2/related_actions/ManualReviewJobEnqueuedRelatedActions';
import ManualReviewJobListOfThreadsComponent from './v2/threads/ManualReviewJobListOfThreadsComponent';
import ManualReviewJobPrimaryUserComponent from './v2/user/ManualReviewJobPrimaryUserComponent';

const { Option } = Select;
const { TextArea } = Input;

export const JOB_FRAGMENT = gql`
  ${ITEM_FRAGMENT}
  fragment JobFields on ManualReviewJob {
    id
    createdAt
    policyIds
    numTimesReported
    payload {
      ... on ContentManualReviewJobPayload {
        userScore
        reportHistory {
          reporterId {
            id
            typeId
          }
          policyId
          reportId
          reason
          reportedAt
        }
        item {
          ... on ItemBase {
            ...ItemFields
          }
        }
        additionalContentItems {
          ... on ContentItem {
            ...ItemFields
          }
        }
        itemThreadContentItems {
          ... on ContentItem {
            ...ItemFields
          }
        }
        reportedForReasons {
          ... on ReportedForReason {
            reporterId {
              id
              typeId
            }
            reason
          }
        }
        enqueueSourceInfo {
          ... on ReportEnqueueSourceInfo {
            kind
          }
          ... on RuleExecutionEnqueueSourceInfo {
            kind
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
          ... on MrtJobEnqueueSourceInfo {
            kind
          }
          ... on PostActionsEnqueueSourceInfo {
            kind
          }
        }
      }
      ... on UserManualReviewJobPayload {
        userScore
        reportHistory {
          reportId
          reporterId {
            id
            typeId
          }
          policyId
          reason
          reportedAt
        }
        item {
          ... on ItemBase {
            ...ItemFields
          }
        }
        itemThreadContentItems {
          ... on ContentItem {
            ...ItemFields
          }
        }
        reportedItems {
          id
          typeId
        }
        additionalContentItems {
          ... on ContentItem {
            ...ItemFields
          }
        }
        reportedForReasons {
          ... on ReportedForReason {
            reporterId {
              id
              typeId
            }
            reason
          }
        }
        enqueueSourceInfo {
          ... on ReportEnqueueSourceInfo {
            kind
          }
          ... on RuleExecutionEnqueueSourceInfo {
            kind
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
          ... on MrtJobEnqueueSourceInfo {
            kind
          }
          ... on PostActionsEnqueueSourceInfo {
            kind
          }
        }
      }
      ... on ThreadManualReviewJobPayload {
        reportHistory {
          reportId
          reporterId {
            id
            typeId
          }
          policyId
          reason
          reportedAt
        }
        item {
          ... on ItemBase {
            ...ItemFields
          }
        }
        reportedForReasons {
          ... on ReportedForReason {
            reporterId {
              id
              typeId
            }
            reason
          }
        }
        enqueueSourceInfo {
          ... on ReportEnqueueSourceInfo {
            kind
          }
          ... on RuleExecutionEnqueueSourceInfo {
            kind
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
          ... on MrtJobEnqueueSourceInfo {
            kind
          }
          ... on PostActionsEnqueueSourceInfo {
            kind
          }
        }
      }
      ... on ContentAppealManualReviewJobPayload {
        userScore
        item {
          ... on ItemBase {
            ...ItemFields
          }
        }
        additionalContentItems {
          ... on ContentItem {
            ...ItemFields
          }
        }
        appealReason
        appealId
        actionsTaken
        appealerIdentifier {
          id
          typeId
        }
        enqueueSourceInfo {
          ... on AppealEnqueueSourceInfo {
            kind
          }
        }
      }
      ... on UserAppealManualReviewJobPayload {
        userScore
        item {
          ... on ItemBase {
            ...ItemFields
          }
        }
        additionalContentItems {
          ... on ContentItem {
            ...ItemFields
          }
        }
        appealReason
        appealId
        actionsTaken
        appealerIdentifier {
          id
          typeId
        }
        enqueueSourceInfo {
          ... on AppealEnqueueSourceInfo {
            kind
          }
        }
      }
      ... on ThreadAppealManualReviewJobPayload {
        item {
          ... on ItemBase {
            ...ItemFields
          }
        }
        appealId
        appealReason
        actionsTaken
        appealerIdentifier {
          id
          typeId
        }
        enqueueSourceInfo {
          ... on AppealEnqueueSourceInfo {
            kind
          }
        }
      }
      ... on NcmecManualReviewJobPayload {
        item {
          ... on ItemBase {
            ...ItemFields
          }
        }
        allMediaItems {
          contentItem {
            ...ItemFields
          }
          isConfirmedCSAM
          isReported
        }
        enqueueSourceInfo {
          ... on ReportEnqueueSourceInfo {
            kind
          }
          ... on RuleExecutionEnqueueSourceInfo {
            kind
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
          ... on MrtJobEnqueueSourceInfo {
            kind
          }
          ... on PostActionsEnqueueSourceInfo {
            kind
          }
        }
      }
    }
  }
`;

gql`
  ${JOB_FRAGMENT}
  ${ITEM_TYPE_FRAGMENT}
  query ManualReviewJobInfo($jobIds: [ID!]) {
    myOrg {
      id
      policies {
        id
        name
        parentId
        policyText
        enforcementGuidelines
      }
      itemTypes {
        ...ItemTypeFragment
      }
      actions {
        ... on ActionBase {
          id
          name
          penalty
          itemTypes {
            ... on ItemTypeBase {
              id
              name
            }
          }
        }
        ... on CustomAction {
          id
          name
          penalty
          itemTypes {
            ... on ItemTypeBase {
              id
              name
            }
          }
          customMrtApiParams {
            name
            type
            displayName
          }
        }
      }
      mrtQueues {
        id
        name
        isAppealsQueue
        autoCloseJobs
      }
      hasNCMECReportingEnabled
      requiresPolicyForDecisionsInMrt
      requiresDecisionReasonInMrt
      allowMultiplePoliciesPerAction
      hideSkipButtonForNonAdmins
    }
    me {
      id
      reviewableQueues {
        id
        name
        pendingJobCount
        hiddenActionIds
        jobs(ids: $jobIds) {
          ...JobFields
        }
      }
      role
    }
  }

  mutation DequeueManualReviewJob($queueId: ID!) {
    dequeueManualReviewJob(queueId: $queueId) {
      ... on DequeueManualReviewJobSuccessResponse {
        job {
          ...JobFields
        }
        lockToken
        numPendingJobs
      }
    }
  }

  mutation SubmitManualReviewDecision($input: SubmitDecisionInput!) {
    submitManualReviewDecision(input: $input) {
      ... on SubmitDecisionSuccessResponse {
        success
      }
      ... on JobHasAlreadyBeenSubmittedError {
        title
        status
        type
      }
      ... on SubmittedJobActionNotFoundError {
        title
        status
        type
      }
      ... on NoJobWithIdInQueueError {
        title
        status
        type
      }
      ... on RecordingJobDecisionFailedError {
        title
        status
        type
        detail
      }
    }
  }

  mutation LogSkip($input: LogSkipInput!) {
    logSkip(input: $input)
  }

  mutation ReleaseJobLock($input: ReleaseJobLockInput!) {
    releaseJobLock(input: $input)
  }
`;

enum BuiltInActionType {
  Ignore = 'IGNORE',
  EnqueueToNcmec = 'ENQUEUE_TO_NCMEC',
  RejectAppeal = 'REJECT_APPEAL',
  AcceptAppeal = 'ACCEPT_APPEAL',
  Move = 'MOVE',
}

const builtInActions = [{ type: BuiltInActionType.Ignore, label: 'Ignore' }];
const builtInAppealActions = [
  { type: BuiltInActionType.AcceptAppeal, label: 'Accept Appeal' },
  { type: BuiltInActionType.RejectAppeal, label: 'Reject Appeal' },
];
const builtInMoveAction = [{ type: BuiltInActionType.Move, label: 'Move' }];
const ncmecAction = {
  type: BuiltInActionType.EnqueueToNcmec,
  label: 'Enqueue to NCMEC',
};

type ManualReviewJobItemIdentifier = {
  itemId: string;
  itemTypeId: string;
};

type ManualReviewJobEnqueuedPrimaryActionData = Omit<
  ManualReviewJobEnqueuedActionData,
  'action'
> & {
  action:
    | ManualReviewJobEnqueuedActionData['action']
    | (typeof builtInActions)[number]
    | { type: 'MOVE'; label: 'Move'; newQueueId: string };
};

export type ManualReviewJobPayload = NonNullable<
  GQLDequeueManualReviewJobMutation['dequeueManualReviewJob']
>['job']['payload'];

export type ManualReviewJobEnqueuedActionData = {
  action: CustomAction;
  target: { identifier: ManualReviewJobItemIdentifier; displayName: string };
  policies: { id: string; name: string }[];
  customMrtApiParamDecisionPayload?: Record<string, string | boolean>;
};

export type ManualReviewJobAction = {
  id: string;
  name: string;
  penalty: GQLUserPenaltySeverity;
  itemTypes: readonly { id: string; name: string }[];
  __typename: string;
  customMrtApiParams?: {
    name: string;
    type: 'BOOLEAN' | 'STRING';
    displayName: string;
  }[];
};

const appealPayloadTypenames = [
  'ContentAppealManualReviewJobPayload',
  'UserAppealManualReviewJobPayload',
  'ThreadAppealManualReviewJobPayload',
];

function ManualReviewJobReviewImpl(props: {
  closedJobData?: {
    closedJob: GQLGetDecidedJobQuery['getDecidedJob'];
    ncmecDecisions?: readonly {
      readonly id: string;
      readonly typeId: string;
      readonly url: string;
      readonly fileAnnotations: readonly GQLNcmecFileAnnotation[];
      readonly industryClassification: GQLNcmecIndustryClassification;
    }[];
    rightComponent?: React.ReactNode;
  };
}) {
  const { closedJobData } = props;
  const closedJob = closedJobData?.closedJob ?? undefined;

  const [selectedPrimaryActions, setSelectedPrimaryActions] = useState<
    ManualReviewJobEnqueuedPrimaryActionData[]
  >([]);
  const [selectedPrimaryPolicies, setSelectedPrimaryPolicies] = useState<
    { id: string; name: string }[]
  >([]);
  const [decisionReason, setDecisionReason] = useState<string | undefined>(
    undefined,
  );
  const [selectedRelatedActions, selectedRelatedActionsSetter] = useState<
    ManualReviewJobEnqueuedActionData[]
  >([]);
  const [modalInfo, setModalInfo] = useState<{
    visible: boolean;
    modalBody: string;
    footer: CoopModalFooterButtonProps[];
  }>({
    visible: false,
    modalBody: '',
    footer: [],
  });
  const [unblurAllMedia, setUnblurAllMedia] = useState(false);
  const [drawerInfo, setDrawerInfo] = useState<
    | {
        visible: false;
      }
    | { visible: true; policyId: string }
  >({ visible: false });

  const actionStore = useContext(ManualReviewActionStore);

  const setSelectedRelatedActions = (
    actions: ManualReviewJobEnqueuedActionData[],
  ) => {
    actionStore?.setActions(
      actions.map((it) => ({
        itemId: it.target.identifier.itemId,
        action: it.action,
      })),
    );
    selectedRelatedActionsSetter(actions);
  };

  const { queueId, jobId, lockToken } = useParams<{
    queueId?: string;
    jobId?: string;
    lockToken?: string;
  }>();
  const navigate = useNavigate();

  const mrtParentComponentRef = useRef<HTMLDivElement>(null);
  const reportedUserRef = useRef<HTMLDivElement>(null);

  const resetState = () => {
    setSelectedPrimaryActions([]);
    setSelectedPrimaryPolicies([]);
    setSelectedRelatedActions([]);
    setDecisionReason(undefined);
  };

  const { data, loading } = useGQLManualReviewJobInfoQuery({
    variables: { jobIds: closedJob ? [closedJob.id] : jobId ? [jobId] : [] },
    fetchPolicy: 'no-cache',
  });

  const [
    getNextJob,
    { data: jobData, loading: jobDataLoading, error: jobDataError },
  ] = useGQLDequeueManualReviewJobMutation({
    variables: { queueId: queueId! },
    fetchPolicy: 'no-cache',
    onCompleted: (data) => {
      // Here, we update the URL to include the queue ID, job ID, and lock
      // token. That way, users are able to send around the URL to others.
      // In case we can't find the required job, we can just fail silently.
      const { dequeueManualReviewJob } = data;
      if (dequeueManualReviewJob == null) {
        return;
      }

      const { job } = dequeueManualReviewJob;
      navigate(
        `/dashboard/manual_review/queues/review/${queueId}/${job.id}/${dequeueManualReviewJob.lockToken}`,
        { replace: true },
      );
    },
  });

  useEffect(() => {
    if (
      jobId == null &&
      closedJob == null &&
      !loading &&
      !jobDataLoading &&
      !jobData
    ) {
      getNextJob();
    }
  }, [getNextJob, jobId, closedJob, loading, jobDataLoading, jobData]);

  useEffect(() => {
    // If we were looking for a specific job and it no longer exists in this
    // queue, redirect to the recent decisions page for it
    if (
      jobId != null &&
      data?.me?.reviewableQueues
        .find((queue) => queue.id === queueId)
        ?.jobs.find((job) => job.id === jobId) === undefined &&
      !loading
    ) {
      if (!closedJob) {
        navigate(`/dashboard/manual_review/recent/?jobId=${jobId}`, {
          replace: true,
        });
      }
    }
  }, [jobId, data, loading, navigate, queueId, closedJob]);
  const selectedActionsForCustomActionParamsInput = filterNullOrUndefined(
    selectedPrimaryActions.map((it) =>
      'id' in it.action ? it.action.id : undefined,
    ),
  );
  const setCustomParamsForActionCallback = (
    actionId: string,
    customParams: Record<string, string | boolean>,
  ) => {
    const updatedAction = selectedPrimaryActions.find(
      (action) => !('type' in action.action) && action.action.id === actionId,
    );
    if (updatedAction) {
      updatedAction.customMrtApiParamDecisionPayload = {
        ...updatedAction.customMrtApiParamDecisionPayload,
        ...customParams,
      };
      setSelectedPrimaryActions([
        ...selectedPrimaryActions.filter(
          (action) => 'type' in action.action || action.action.id !== actionId,
        ),
        updatedAction,
      ]);
    }
  };

  const goBackToQueuesPage = () => navigate('/dashboard/manual_review/queues');
  const hideModal = () => setModalInfo({ ...modalInfo, visible: false });

  const [submitDecision, { loading: submissionLoading }] =
    useGQLSubmitManualReviewDecisionMutation({
      fetchPolicy: 'no-cache',
      onError: (e) => {
        setModalInfo({
          visible: true,
          modalBody: 'Unknown error occured.',
          footer: [
            {
              title: 'Ok',
              type: 'primary',
              onClick: hideModal,
            },
          ],
        });
      },
      onCompleted: async (response) => {
        switch (response.submitManualReviewDecision.__typename) {
          case 'SubmitDecisionSuccessResponse': {
            resetState();
            await getNextJob();
            break;
          }
          case 'JobHasAlreadyBeenSubmittedError': {
            setModalInfo({
              visible: true,
              modalBody:
                'This job has already been submitted. Would you like to move to the next job?',
              footer: [
                {
                  title: 'Yes',
                  type: 'primary',
                  onClick: async () => {
                    await getNextJob();
                    hideModal();
                  },
                },
                {
                  title: 'No',
                  type: 'primary',
                  onClick: goBackToQueuesPage,
                },
              ],
            });
            break;
          }
          case 'NoJobWithIdInQueueError': {
            setModalInfo({
              visible: true,
              modalBody: 'We could not find the requested job in this queue.',
              footer: [
                {
                  title: 'Go Back',
                  type: 'primary',
                  onClick: goBackToQueuesPage,
                },
              ],
            });
            break;
          }
          case 'SubmittedJobActionNotFoundError': {
            setModalInfo({
              visible: true,
              modalBody: 'Selected action not found. Please try again.',
              footer: [
                {
                  title: 'Ok',
                  type: 'primary',
                  onClick: hideModal,
                },
              ],
            });
            break;
          }
          case 'RecordingJobDecisionFailedError': {
            setModalInfo({
              visible: true,
              modalBody: 'Job submission failed. Please try again.',
              footer: [
                {
                  title: 'Ok',
                  type: 'primary',
                  onClick: hideModal,
                },
              ],
            });
            break;
          }
        }
      },
    });

  const canBeSubmitted = (() => {
    if (selectedPrimaryActions.length === 0 || submissionLoading) {
      return false;
    }

    // If the user has selected a built-in action, then we don't want to allow
    // them to select any policies.
    // NB: THIS IS AN ILLEGAL STATE. IF YOU ARE ENDING UP HERE, OUR STATE
    // MANAGEMENT IS BROKEN AND NEEDS TO BE UPDATED. Specifically, when a user
    // selects the 'ignore' action, we clear out any currently selected policies
    // and reset that state.
    if (
      selectedPrimaryActions.some(
        (it) => 'type' in it.action && it.action.type === 'IGNORE',
      ) &&
      selectedPrimaryPolicies.length > 0
    ) {
      return false;
    }

    if (data?.myOrg?.requiresPolicyForDecisionsInMrt) {
      // First check if there are related actions, and if there are, make sure
      // they include policies
      if (
        selectedRelatedActions.length > 0 &&
        selectedRelatedActions.some((it) => it.policies.length === 0)
      ) {
        return false;
      }

      // Return false if there are no primary policies selected and if no
      // built-in action has been selected
      if (
        selectedPrimaryPolicies.length === 0 &&
        selectedPrimaryActions.some((it) => 'id' in it.action)
      ) {
        return false;
      }
      // return false if more than one appeal action is selected
      // since ACCEPT/REJECT are the only options
      if (
        selectedPrimaryActions.length > 1 &&
        (selectedPrimaryActions.some(
          (it) => 'type' in it.action && it.action.type === 'REJECT_APPEAL',
        ) ||
          selectedPrimaryActions.some(
            (it) => 'type' in it.action && it.action.type === 'ACCEPT_APPEAL',
          ))
      ) {
        return false;
      }
    }

    // If the org requires a decision reason, and no decision reason has been
    // provided, return false
    if (
      data?.myOrg?.requiresDecisionReasonInMrt &&
      !isNonEmptyString(decisionReason)
    ) {
      return false;
    }

    return true;
  })();
  const getActionName = useCallback(
    (actionId: string) =>
      data?.myOrg?.actions.find((action) => action.id === actionId)?.name ??
      'Unknown',
    [data?.myOrg],
  );

  const job = closedJob
    ? closedJob
    : jobData
    ? jobData.dequeueManualReviewJob?.job
    : data?.me?.reviewableQueues
        .find((queue) => queue.id === queueId)
        ?.jobs.find((job) => job.id === jobId);
  const pendingJobCount = jobData?.dequeueManualReviewJob
    ? jobData.dequeueManualReviewJob.numPendingJobs
    : data?.me?.reviewableQueues
    ? data?.me?.reviewableQueues.find((queue) => queue.id === queueId)
        ?.pendingJobCount
    : undefined;

  const [logSkip] = useGQLLogSkipMutation({
    // This is safe because we check it before calling logSkip
    // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
    variables: { input: { queueId: queueId!, jobId: job?.id! } },
    fetchPolicy: 'no-cache',
  });

  const [releaseJobLock] = useGQLReleaseJobLockMutation({
    fetchPolicy: 'no-cache',
  });

  const skipToNextJob = async () => {
    // First, release the lock on the current job and log the skip
    if (queueId && job?.id && lockToken) {
      await Promise.all([
        logSkip(),
        releaseJobLock({
          variables: {
            input: {
              queueId,
              jobId: job.id,
              lockToken,
            },
          },
        }),
      ]);
    }

    // Reset state and try to get the next job
    resetState();
    const result = await getNextJob();

    // If there's no next job, redirect to the queues page
    if (result.data?.dequeueManualReviewJob == null) {
      navigate('/dashboard/manual_review/queues');
    }
  };

  if (loading || jobDataLoading || (!closedJob && !lockToken)) {
    return (
      <div className="flex items-center justify-center w-full h-screen">
        <ComponentLoading />
      </div>
    );
  }

  if (jobDataError) {
    return <ManualReviewJobDequeueErrorComponent />;
  }

  if (!job) {
    return <ManualReviewJobEmptyQueue />;
  }

  if (!closedJob && !queueId) {
    throw Error('A queue ID is required to view a pending job.');
  }

  if (!closedJob && !data) {
    throw Error(`Could not load data necessary to populate this job.`);
  }

  const org = data?.myOrg;
  if (!org) {
    throw Error('Org not found');
  }

  const queue = data.me?.reviewableQueues.find((queue) => queue.id === queueId);
  if (!closedJob && !queue) {
    throw Error(`Queue not found for ID ${queueId}`);
  }
  const userIsAdmin = data.me?.role === 'ADMIN';

  const filteredActions = org.actions.filter(
    ({ id }) => !queue?.hiddenActionIds?.includes(id),
  );
  const { payload, policyIds } = job;
  const reportHistory =
    'reportHistory' in job.payload ? job.payload.reportHistory ?? [] : [];

  const modal = (
    <CoopModal
      title="Error"
      visible={modalInfo.visible}
      onClose={hideModal}
      footer={modalInfo.footer}
      hideCloseButton={true}
    >
      {modalInfo.modalBody}
    </CoopModal>
  );

  if (payload.__typename === 'NcmecManualReviewJobPayload') {
    if (closedJob) {
      return (
        <NCMECReviewUser
          orgId={org.id}
          payload={payload}
          isActionable={false}
          ncmecDecisions={closedJobData?.ncmecDecisions}
        />
      );
    } else {
      // TODO: remove this when we launch messages for real. For now, allow Niles, Nick, Alex and EA
      const allowedUsersForMessages = [
        '77541281dc8',
        '4804fecc0ad',
        'eb372ef7940',
        '9f48683715a',
        '839009f7cc7',
      ];
      return (
        <div>
          <NCMECReviewUser
            orgId={org.id}
            payload={payload}
            isActionable={true}
            showMessages={
              data.me?.id ? allowedUsersForMessages.includes(data.me.id) : false
            }
            submitDecision={async (decision) => {
              await submitDecision({
                variables: {
                  input: {
                    reportHistory: reportHistory.map((it) => ({
                      policyId: it.policyId,
                      reason: it.reason,
                      reportId: it.reportId,
                      reportedAt: it.reportedAt,
                      reporterId: it.reporterId
                        ? { id: it.reporterId.id, typeId: it.reporterId.typeId }
                        : undefined,
                    })),
                    queueId: queueId!,
                    jobId: job.id,
                    // This is safe because we prevent both closedJob and lockToken from being null
                    lockToken: lockToken!,
                    reportedItemDecisionComponents: [decision],
                    relatedItemActions: [],
                  },
                },
              });
            }}
            skipToNextJob={skipToNextJob}
            ncmecDecisions={undefined}
          />
          {modal}
        </div>
      );
    }
  }

  const reportedItem = payload.item;
  const threadItems =
    payload.__typename === 'UserManualReviewJobPayload' ||
    payload.__typename === 'ContentManualReviewJobPayload'
      ? (payload.itemThreadContentItems as ReadonlyArray<GQLContentItem>) ?? []
      : [];
  const policiesFromIds = (policyIds: readonly string[]) =>
    policyIds.map((policyId) => {
      const policy = data.myOrg!.policies.find(
        (policy) => policy.id === policyId,
      )!;
      return { id: policyId, name: policy.name };
    });
  const isAppeal = appealPayloadTypenames.includes(payload.__typename);
  const actionsTaken =
    isAppeal && 'actionsTaken' in payload
      ? payload.actionsTaken.map(getActionName)
      : undefined;

  const reportInfo = (
    <ReportInfoComponent
      reportPayload={payload}
      closedJobData={closedJobData}
      policyIds={policyIds}
      isAppeal={isAppeal}
      createdAt={job.createdAt}
      numTimesReported={job.numTimesReported ?? undefined}
      userId={data.me!.id}
      jobId={job.id}
      actionsTaken={actionsTaken}
      orgId={org.id}
      allItemTypes={org.itemTypes as GQLItemType[]}
      policies={org.policies}
    />
  );
  const otherReports =
    reportHistory.length > 1 ? (
      <MergedReportsComponent
        primaryReportedAt={job.createdAt}
        reportHistory={reportHistory}
      />
    ) : null;
  const actionList = (
    <div className="sticky flex flex-col overflow-hidden border border-gray-200 border-solid rounded-md shrink-0">
      {[
        ...(appealPayloadTypenames.includes(payload.__typename)
          ? builtInAppealActions
          : builtInActions),
        ...(org.hasNCMECReportingEnabled &&
        (payload.__typename === 'ContentManualReviewJobPayload' ||
          payload.__typename === 'UserManualReviewJobPayload')
          ? [ncmecAction]
          : []),
        ...(appealPayloadTypenames.includes(payload.__typename)
          ? []
          : filteredActions
              .filter(
                (action) =>
                  action.itemTypes
                    .map((itemType) => itemType.id)
                    .includes(payload.item.type.id) &&
                  // Transform and move actions should be done through decisions
                  action.__typename === 'CustomAction',
              )
              .sort((a, b) => a.name.localeCompare(b.name))),
        ...builtInMoveAction,
      ]
        .map((action) => {
          const { key, selected, label } = (() => {
            if ('type' in action) {
              return {
                key: action.type,
                selected: selectedPrimaryActions.some(
                  (selectedAction) =>
                    'type' in selectedAction.action &&
                    'type' in action &&
                    selectedAction.action.type === action.type,
                ),
                label: action.label,
              };
            } else {
              return {
                key: action.id,
                selected: selectedPrimaryActions.some(
                  (selectedAction) =>
                    'id' in selectedAction.action &&
                    selectedAction.action.id === action.id,
                ),
                label: action.name,
              };
            }
          })();

          if ('type' in action && action.type === 'MOVE') {
            return (
              <div
                key={key}
                onClick={
                  selected
                    ? () =>
                        setSelectedPrimaryActions(
                          selectedPrimaryActions.filter(
                            (selectedAction) =>
                              !(
                                'type' in selectedAction.action &&
                                selectedAction.action.type === 'MOVE'
                              ),
                          ),
                        )
                    : undefined
                }
              >
                <Dropdown
                  className={`self-stretch text-start cursor-pointer text-gray-600 font-semibold p-3 ${
                    selected
                      ? 'bg-sky-100 text-sky-600'
                      : 'bg-white hover:bg-gray-100'
                  }`}
                  trigger={!selected ? ['click'] : []}
                  menu={{
                    items: org.mrtQueues
                      .filter((it) => isAppeal === it.isAppealsQueue)
                      .filter((it) => it.id !== queueId)
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((queue) => ({
                        key: queue.id,
                        label: queue.name,
                      })),
                    onClick: async ({ key: queueId }) => {
                      // Deselect Ignore if a user action is
                      // selected
                      setSelectedPrimaryActions([
                        ...selectedPrimaryActions.filter(
                          (action) =>
                            !(
                              'type' in action.action &&
                              (action.action.type === 'IGNORE' ||
                                action.action.type === 'REJECT_APPEAL' ||
                                action.action.type === 'ACCEPT_APPEAL')
                            ),
                        ),
                        {
                          action: {
                            type: 'MOVE',
                            newQueueId: queueId,
                            label: 'Move',
                          },
                          target: {
                            identifier: {
                              itemId: reportedItem.id,
                              itemTypeId: reportedItem.type.id,
                            },
                            displayName:
                              getFieldValueForRole<
                                GQLSchemaFieldRoles,
                                keyof GQLSchemaFieldRoles
                              >(reportedItem, 'displayName') ?? reportedItem.id,
                          },
                          policies: selectedPrimaryPolicies,
                        },
                      ]);
                    },
                  }}
                >
                  <div>
                    Move <DownOutlined />
                  </div>
                </Dropdown>
              </div>
            );
          }

          return (
            <div
              className={`self-stretch text-start cursor-pointer text-gray-600 font-semibold p-3 ${
                selected
                  ? 'bg-sky-100 text-sky-600'
                  : 'bg-white hover:bg-gray-100'
              }`}
              key={key}
              onClick={() => {
                if (selected) {
                  // If the action is a built-in action, then nothing else can
                  // be selected anyway, so we should deselect everything
                  // TODO: Create a better definition for built-in actions, and
                  // how they correlate with custom actions (since we
                  // can't necessarily depend on 'type' always being a key).
                  if ('type' in action && action.type === 'IGNORE') {
                    setSelectedPrimaryActions([]);
                  } else if ('type' in action) {
                    setSelectedPrimaryActions(
                      selectedPrimaryActions.filter(
                        (selectedAction) =>
                          !(
                            'type' in selectedAction.action &&
                            selectedAction.action.type === action.type
                          ),
                      ),
                    );
                  } else {
                    setSelectedPrimaryActions(
                      selectedPrimaryActions.filter(
                        (selectedAction) =>
                          !(
                            'id' in selectedAction.action &&
                            selectedAction.action.id === action.id
                          ),
                      ),
                    );
                  }
                } else {
                  const newAction = {
                    action,
                    target: {
                      identifier: {
                        itemId: reportedItem.id,
                        itemTypeId: reportedItem.type.id,
                      },
                      displayName:
                        getFieldValueForRole<
                          GQLSchemaFieldRoles,
                          keyof GQLSchemaFieldRoles
                        >(reportedItem, 'displayName') ?? reportedItem.id,
                    },
                    policies: selectedPrimaryPolicies,
                  };

                  // If the action is Ignore, or a built in appeal action we should deselect
                  // every other selected action
                  if (
                    'type' in action &&
                    (action.type === 'IGNORE' ||
                      action.type === 'ACCEPT_APPEAL' ||
                      action.type === 'REJECT_APPEAL')
                  ) {
                    setSelectedPrimaryActions([newAction]);
                    setSelectedPrimaryPolicies([]);
                  } else {
                    // Deselect Ignore if a user action is
                    // selected
                    setSelectedPrimaryActions([
                      ...selectedPrimaryActions.filter(
                        (action) =>
                          !(
                            'type' in action.action &&
                            action.action.type === 'IGNORE'
                          ),
                      ),
                      {
                        ...newAction,
                        // for user actions, we should set the default custom
                        // mrt params if they exist
                        ...('id' in action &&
                        action.__typename === 'CustomAction' &&
                        action.customMrtApiParams
                          ? {
                              customMrtApiParamDecisionPayload:
                                filterNullOrUndefined(
                                  action.customMrtApiParams,
                                ).reduce(
                                  (acc, param) => ({
                                    ...acc,
                                    [param.name]:
                                      param.type === 'BOOLEAN'
                                        ? false
                                        : param.type === 'STRING'
                                        ? ''
                                        : undefined,
                                  }),
                                  {},
                                ),
                            }
                          : {}),
                      },
                    ]);
                  }
                }
              }}
            >
              {label}
            </div>
          );
        })
        .flatMap((value, i) => [
          value,
          <div className="flex h-px bg-zinc-300" key={i} />,
        ])
        .slice(0, -1)}
    </div>
  );

  const viewPoliciesButton = (
    <Dropdown
      className="max-h-[80vh] overflow-y-scroll"
      placement="bottomLeft"
      menu={{
        items: multilevelListFromFlatList(
          org.policies.map((policy) => ({
            ...policy,
            key: policy.id,
            label: policy.name,
          })),
        ),
        onClick: ({ key }) => setDrawerInfo({ visible: true, policyId: key }),
      }}
      trigger={['click']}
    >
      <Button className="flex flex-row bottom-0 w-2/3 !px-2 mb-2 hidden !border-slate-200 !hover:fill-[#40a9ff] !focus:fill-[#40a9ff]">
        <div className="flex flex-row">
          <Sidebar1 className="w-3.5 mr-2 fill-inherit" /> View Policy
        </div>
      </Button>
    </Dropdown>
  );

  const skipToNextJobButton =
    org.hideSkipButtonForNonAdmins && !userIsAdmin ? undefined : (
      <Button
        className="bottom-0 w-1/3 !px-2 mb-2 overflow-hidden !border-slate-200 !hover:fill-[#40a9ff] !focus:fill-[#40a9ff]"
        onClick={skipToNextJob}
        disabled={pendingJobCount === 0}
      >
        <div className="flex flex-row">
          Skip <AngleDoubleRight className="w-3.5 ml-2 fill-inherit" />
        </div>
      </Button>
    );

  const drawerPolicy = drawerInfo.visible
    ? org.policies.find((policy) => policy.id === drawerInfo.policyId)
    : null;

  const drawer = (
    <Drawer
      isOpen={drawerInfo.visible}
      onClose={() => setDrawerInfo({ visible: false })}
      title={drawerPolicy?.name ?? 'Policy'}
    >
      <div className="flex flex-col items-start justify-start max-w-sm">
        <div className="mb-1 text-lg font-bold">Definition</div>
        <HTMLRenderer
          rawHTML={drawerPolicy?.policyText ?? 'No definition provided'}
        />
        {drawerPolicy?.enforcementGuidelines ? (
          <>
            <div className="mt-3 mb-1 text-lg font-bold">
              Enforcement Guidelines
            </div>
            <HTMLRenderer rawHTML={drawerPolicy.enforcementGuidelines} />
          </>
        ) : null}
      </div>
    </Drawer>
  );

  const policiesSection = (
    <PolicyDropdown
      policies={org.policies}
      onChange={(policyIds) => {
        if (Array.isArray(policyIds)) {
          setSelectedPrimaryPolicies(policiesFromIds(policyIds));
          setSelectedPrimaryActions(
            selectedPrimaryActions.map((action) => ({
              ...action,
              policies: selectedPrimaryPolicies,
            })),
          );
        } else {
          // NB: This cast is required because of a longstanding typescript
          // issue. See https://github.com/microsoft/TypeScript/issues/17002 for
          // more details.
          const policyId = policyIds satisfies
            | string
            | readonly string[] as string;
          setSelectedPrimaryPolicies(policiesFromIds([policyId]));
          setSelectedPrimaryActions(
            selectedPrimaryActions.map((action) => ({
              ...action,
              policies: selectedPrimaryPolicies,
            })),
          );
        }
      }}
      selectedPolicyIds={selectedPrimaryPolicies.map((policy) => policy.id)}
      multiple={org.allowMultiplePoliciesPerAction}
      placement="topLeft"
      disabled={
        selectedPrimaryActions.length === 1 &&
        'type' in selectedPrimaryActions[0].action &&
        selectedPrimaryActions[0].action.type === 'IGNORE'
      }
    />
  );

  const decisionReasonSection = (
    <TextArea
      className="rounded-md"
      placeholder="Reason for decision"
      rows={6}
      onChange={(e) => setDecisionReason(e.target.value)}
      value={decisionReason}
    />
  );

  const thread = (() => {
    switch (payload.__typename) {
      case 'ContentManualReviewJobPayload':
      case 'ContentAppealManualReviewJobPayload':
        return getFieldValueForRole(payload.item, 'threadId');
      case 'UserManualReviewJobPayload':
        const threadItem = payload.itemThreadContentItems?.[0];
        if (threadItem == null) {
          return undefined;
        }

        return getFieldValueForRole(threadItem, 'threadId');
      case 'ThreadManualReviewJobPayload':
      case 'UserAppealManualReviewJobPayload':
      case 'ThreadAppealManualReviewJobPayload':
        return undefined;
    }
  })();

  const threadComponent =
    thread && threadItems.length > 0 ? (
      <ManualReviewJobListOfThreadsComponent
        payload={
          payload as
            | GQLContentManualReviewJobPayload
            | GQLUserManualReviewJobPayload
        }
        thread={thread}
        threadMessages={threadItems}
        allActions={filteredActions}
        allItemTypes={org.itemTypes as GQLItemType[]}
        relatedActions={selectedRelatedActions}
        allPolicies={org.policies}
        onEnqueueActions={(actions) =>
          setSelectedRelatedActions(
            recomputeSelectedRelatedActions(actions, selectedRelatedActions),
          )
        }
        parentRef={mrtParentComponentRef}
        reportedUserRef={reportedUserRef}
        unblurAllMedia={unblurAllMedia}
        isActionable={!closedJob}
        requirePolicySelectionToEnqueueAction={
          org.requiresPolicyForDecisionsInMrt
        }
        allowMoreThanOnePolicySelection={org.allowMultiplePoliciesPerAction}
      />
    ) : 'itemThreadContentItems' in payload &&
      payload.itemThreadContentItems &&
      payload.itemThreadContentItems.length > 0 ? (
      <ManualReviewJobOtherItemsComponent
        reportedMessages={
          payload.__typename === 'UserManualReviewJobPayload'
            ? filterNullOrUndefined(payload.reportedItems ?? [])
            : payload.__typename === 'ContentManualReviewJobPayload'
            ? [{ id: payload.item.id, typeId: payload.item.type.id }]
            : []
        }
        otherItems={payload.itemThreadContentItems as readonly GQLContentItem[]}
        allActions={filteredActions}
        allItemTypes={org.itemTypes as GQLItemType[]}
        relatedActions={selectedRelatedActions}
        allPolicies={org.policies}
        onEnqueueActions={(actions) =>
          setSelectedRelatedActions(
            recomputeSelectedRelatedActions(actions, selectedRelatedActions),
          )
        }
        reportedUserRef={reportedUserRef}
        unblurAllMedia={unblurAllMedia}
        isActionable={!closedJob}
        requirePolicySelectionToEnqueueAction={
          org.requiresPolicyForDecisionsInMrt
        }
        allowMoreThanOnePolicySelection={org.allowMultiplePoliciesPerAction}
      />
    ) : undefined;

  const contentArea = () => {
    switch (payload.__typename) {
      case 'ContentAppealManualReviewJobPayload':
      case 'ContentManualReviewJobPayload':
        return (
          <ManualReviewJobContentView
            payload={
              payload.__typename === 'ContentManualReviewJobPayload'
                ? (payload as GQLContentManualReviewJobPayload)
                : (payload as GQLContentAppealManualReviewJobPayload)
            }
            allActions={closedJob ? [] : filteredActions}
            onEnqueueActions={(actions) =>
              setSelectedRelatedActions(
                recomputeSelectedRelatedActions(
                  actions,
                  selectedRelatedActions,
                ),
              )
            }
            allPolicies={org.policies}
            allItemTypes={org.itemTypes as GQLItemType[]}
            relatedActions={selectedRelatedActions}
            unblurAllMedia={unblurAllMedia}
            parentRef={mrtParentComponentRef}
            reportedUserRef={reportedUserRef}
            requirePolicySelectionToEnqueueAction={
              org.requiresPolicyForDecisionsInMrt
            }
            allowMoreThanOnePolicySelection={org.allowMultiplePoliciesPerAction}
            orgId={org.id}
            isActionable={!closedJob}
          />
        );
      case 'ThreadAppealManualReviewJobPayload':
      case 'ThreadManualReviewJobPayload':
        return (
          <ManualReviewJobContentView
            payload={
              payload.__typename === 'ThreadManualReviewJobPayload'
                ? (payload as GQLThreadManualReviewJobPayload)
                : (payload as GQLThreadAppealManualReviewJobPayload)
            }
            allActions={closedJob ? [] : filteredActions}
            onEnqueueActions={(actions) =>
              setSelectedRelatedActions(
                recomputeSelectedRelatedActions(
                  actions,
                  selectedRelatedActions,
                ),
              )
            }
            allPolicies={org.policies}
            allItemTypes={org.itemTypes as GQLItemType[]}
            relatedActions={selectedRelatedActions}
            unblurAllMedia={unblurAllMedia}
            parentRef={mrtParentComponentRef}
            requirePolicySelectionToEnqueueAction={
              org.requiresPolicyForDecisionsInMrt
            }
            allowMoreThanOnePolicySelection={org.allowMultiplePoliciesPerAction}
            orgId={org.id}
            isActionable={!closedJob}
          />
        );
      case 'UserAppealManualReviewJobPayload':
      case 'UserManualReviewJobPayload':
        return (
          <ManualReviewJobPrimaryUserComponent
            user={payload.item as GQLUserItem}
            userScore={payload.userScore ?? undefined}
            unblurAllMedia={unblurAllMedia}
            allItemTypes={org.itemTypes as GQLItemType[]}
            allActions={filteredActions}
            allPolicies={org.policies}
            relatedActions={selectedRelatedActions}
            reportedUserRef={reportedUserRef}
            onEnqueueActions={(actions) =>
              setSelectedRelatedActions(
                recomputeSelectedRelatedActions(
                  actions,
                  selectedRelatedActions,
                ),
              )
            }
            requirePolicySelectionToEnqueueAction={
              org.requiresPolicyForDecisionsInMrt
            }
            isActionable={!closedJob}
            allowMoreThanOnePolicySelection={org.allowMultiplePoliciesPerAction}
            jobCreatedAt={new Date(job.createdAt)}
          />
        );
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Helmet>
        <title>Review Job</title>
      </Helmet>
      <div
        ref={mrtParentComponentRef}
        // We need to allow the padding on the left of the MRT job to be
        // scrollable (i.e. a scroll target), but it doesn't happen by default.
        // So we have to add a negative left margin to move the entire component
        // to the left to cancel out the default dashboard padding, and then we
        // add in the same amount of left padding to re-introduce the default
        // dashboard padding, but this time that padding will be a scroll target
        // because it's part of the this MRT job component, rather than the
        // dashboard a few levels up
        className="flex flex-row w-full pl-12 -ml-12"
      >
        <div className="flex flex-col flex-1 pb-12 pr-8 overflow-y-auto">
          {!closedJob && queue ? (
            <div className="flex flex-col items-start mb-8">
              <div className="flex flex-row self-stretch justify-between">
                <div className="text-2xl font-bold text-start">
                  Review: {queue.name}
                </div>
                <Select dropdownMatchSelectWidth={false} value="Options">
                  <Option>
                    <div onClick={() => setUnblurAllMedia(!unblurAllMedia)}>
                      {unblurAllMedia ? 'Blur All Media' : 'Unblur All Media'}
                    </div>
                  </Option>
                </Select>
              </div>
              <div className="mt-2 font-medium text-gray-500 text-start">
                Here, you can review jobs in the {queue.name} queue one at a
                time and make decisions on each item.
              </div>
            </div>
          ) : null}
          {reportInfo}
          {otherReports}
          {threadComponent != null &&
          (payload.__typename === 'ContentManualReviewJobPayload' ||
            payload.__typename === 'UserManualReviewJobPayload')
            ? threadComponent
            : null}
          <div
            ref={reportedUserRef}
            className="flex flex-row justify-between mt-8"
          >
            <div className="self-start text-lg font-bold">
              {isAppeal ? 'Appealed ' : 'Reported '} {reportedItem.type.name}
            </div>
            <CopyTextComponent
              value={reportedItem.id}
              displayValue={`ID: ${reportedItem.id}`}
            />
          </div>
          <div className="my-2 divider" />
          {contentArea()}
        </div>
        {!closedJob ? <div className="w-px h-full bg-gray-200" /> : null}
        {!closedJob ? (
          <div className="sticky top-0 flex-none w-[300px] h-screen overflow-y-auto">
            <div className="flex flex-col gap-1">
              <div className="flex flex-row gap-2">
                {viewPoliciesButton}
                {skipToNextJobButton}
                {drawer}
              </div>
              {pendingJobCount != null && pendingJobCount > 0 ? (
                <div className="text-slate-400">
                  {pendingJobCount} {pendingJobCount === 1 ? 'job' : 'jobs'}{' '}
                  remaining
                </div>
              ) : pendingJobCount === 0 ? (
                <div className="text-slate-400">No jobs remaining</div>
              ) : null}
            </div>
            <div className="my-4 divider" />
            <div className="flex flex-col mb-4">
              <div className="self-start my-2 text-lg font-bold">Decision</div>
              {actionList}
            </div>
            <div className="flex flex-col mb-4">
              <div className="self-start my-2 text-lg font-bold">Policy</div>
              {policiesSection}
            </div>
            {org.requiresDecisionReasonInMrt ? (
              <div className="flex flex-col mb-4">
                <div className="self-start my-2 text-lg font-bold">Reason</div>
                {decisionReasonSection}
              </div>
            ) : null}
            <ManualReviewJobEnqueuedRelatedActions
              actionsData={selectedRelatedActions.map((action) => ({
                // NB: We don't include any iconUrl or otherImageUrls here yet, since we're still
                // figuring out exactly what we're going to be getting from the
                // users. However, it is a valid field inside the target
                // entry, and we'll want to support this in the near future.
                id: action.action.id,
                name: action.action.name,
                penalty: action.action.penalty,
                target: {
                  itemId: action.target.identifier.itemId,
                  itemTypeId: action.target.identifier.itemTypeId,
                  itemTypeName: org.actions
                    .flatMap((action) => action.itemTypes)
                    .find(
                      (itemType) =>
                        itemType.id === action.target.identifier.itemTypeId,
                    )?.name,
                  displayName:
                    action.target.displayName ??
                    action.target.identifier.itemId,
                },
                policyNames: action.policies.map((policy) => policy.name),
              }))}
              onRemoveAction={(action) =>
                setSelectedRelatedActions([
                  ...selectedRelatedActions.filter(
                    (a) =>
                      !(
                        a.target.identifier.itemId === action.target.itemId &&
                        a.target.identifier.itemTypeId ===
                          action.target.itemTypeId &&
                        a.action.id === action.id
                      ),
                  ),
                ])
              }
            />
            <CustomMrtApiParamsSection
              selectedActionIds={selectedActionsForCustomActionParamsInput}
              setCustomParamsForAction={setCustomParamsForActionCallback}
            />
            <div
              className={`flex w-full justify-center items-center rounded-md text-sm shadow-none drop-shadow-none p-2 font-semibold ${
                canBeSubmitted
                  ? 'border-none text-white cursor-pointer bg-coop-blue hover:bg-coop-blue-hover focus:bg-coop-blue active:bg-coop-blue'
                  : 'border border-solid border-gray-200 bg-gray-100 text-gray-300 cursor-not-allowed'
              }`}
              onClick={() => {
                if (canBeSubmitted) {
                  const decisionComponents = (() => {
                    if (
                      selectedPrimaryActions.some(
                        (it) =>
                          'type' in it.action && it.action.type === 'IGNORE',
                      )
                    ) {
                      return [{ ignore: {} }];
                    } else if (
                      // if we are processing a user appeal, there should only ever be one decision
                      // and it should be either accept or reject. this is enforced by `canBeSubmitted`
                      selectedPrimaryActions.some(
                        (it) =>
                          'type' in it.action &&
                          it.action.type === 'REJECT_APPEAL',
                      )
                    ) {
                      return [
                        {
                          rejectAppeal: {
                            appealId:
                              'appealId' in job.payload
                                ? job.payload.appealId
                                : __throw(new Error('Appeal ID not found')),
                          },
                        },
                      ];
                    } else if (
                      selectedPrimaryActions.some(
                        (it) =>
                          'type' in it.action &&
                          it.action.type === 'ACCEPT_APPEAL',
                      )
                    ) {
                      return [
                        {
                          acceptAppeal: {
                            appealId:
                              'appealId' in job.payload
                                ? job.payload.appealId
                                : __throw(new Error('Appeal ID not found')),
                          },
                        },
                      ];
                    }

                    const moveToQueue = (() => {
                      const moveAction = selectedPrimaryActions.find(
                        (it) =>
                          'type' in it.action && it.action.type === 'MOVE',
                      )?.action;
                      if (
                        moveAction === undefined ||
                        !('type' in moveAction) ||
                        moveAction.type !== 'MOVE' ||
                        !('newQueueId' in moveAction)
                      ) {
                        return undefined;
                      }
                      return {
                        transformJobAndRecreateInQueue: {
                          newJobKind: 'DEFAULT' as const,
                          originalQueueId: queueId,
                          newQueueId: moveAction.newQueueId,
                          policyIds: selectedPrimaryPolicies.map(
                            (policy) => policy.id,
                          ),
                        },
                      };
                    })();

                    return filterNullOrUndefined([
                      selectedPrimaryActions.some(
                        (it) => !('type' in it.action),
                      )
                        ? {
                            userAction: {
                              actionIds: filterNullOrUndefined(
                                selectedPrimaryActions.map((action) =>
                                  !('type' in action.action)
                                    ? action.action.id
                                    : undefined,
                                ),
                              ),
                              itemIds: [payload.item.id],
                              itemTypeId: payload.item.type.id,
                              policyIds: selectedPrimaryPolicies.map(
                                (policy) => policy.id,
                              ),
                              actionIdsToMrtApiParamDecisionPayload: {
                                ...selectedPrimaryActions
                                  .filter(
                                    (it) =>
                                      !(
                                        'type' in it.action &&
                                        it.action.type !== 'MOVE'
                                      ),
                                  )
                                  .reduce(
                                    (acc, action) => ({
                                      ...acc,
                                      // This cast is safe because of the filter
                                      // step above, but typescript doesn't
                                      // narrow the type based on that
                                      [(action.action as CustomAction).id]:
                                        action.customMrtApiParamDecisionPayload,
                                    }),
                                    {},
                                  ),
                              },
                            },
                          }
                        : undefined,
                      selectedPrimaryActions.some(
                        (it) =>
                          'type' in it.action &&
                          it.action.type === 'ENQUEUE_TO_NCMEC',
                      )
                        ? {
                            transformJobAndRecreateInQueue: {
                              newJobKind: 'NCMEC' as const,
                              policyIds: selectedPrimaryPolicies.map(
                                (policy) => policy.id,
                              ),
                            },
                          }
                        : undefined,
                      moveToQueue,
                    ]);
                  })();
                  submitDecision({
                    variables: {
                      input: {
                        reportHistory: reportHistory.map((it) => ({
                          policyId: it.policyId,
                          reason: it.reason,
                          reportId: it.reportId,
                          reportedAt: it.reportedAt,
                          reporterId: it.reporterId
                            ? {
                                id: it.reporterId.id,
                                typeId: it.reporterId.typeId,
                              }
                            : undefined,
                        })),
                        queueId: queueId!,
                        jobId: job.id,
                        lockToken: lockToken!,
                        reportedItemDecisionComponents: decisionComponents,
                        relatedItemActions: selectedRelatedActions.map(
                          (action) => ({
                            actionIds: [action.action.id],
                            itemIds: [action.target.identifier.itemId],
                            itemTypeId: action.target.identifier.itemTypeId,
                            policyIds: action.policies.map(
                              (policy) => policy.id,
                            ),
                          }),
                        ),
                        decisionReason,
                      },
                    },
                  });
                }
              }}
            >
              {submissionLoading ? (
                <LoadingOutlined spin className="self-start" />
              ) : (
                <div className="text-base">Submit</div>
              )}
            </div>
          </div>
        ) : null}
      </div>
      {modal}
    </div>
  );
}

export default function ManualReviewJobReview(props: {
  closedJobData?: {
    closedJob: GQLGetDecidedJobQuery['getDecidedJob'];
    ncmecDecisions?: readonly {
      readonly id: string;
      readonly typeId: string;
      readonly url: string;
      readonly fileAnnotations: readonly GQLNcmecFileAnnotation[];
      readonly industryClassification: GQLNcmecIndustryClassification;
    }[];
    rightComponent?: React.ReactNode;
  };
}) {
  return (
    <ManualReviewActionStoreProvider>
      <ManualReviewJobReviewImpl closedJobData={props.closedJobData} />
    </ManualReviewActionStoreProvider>
  );
}
