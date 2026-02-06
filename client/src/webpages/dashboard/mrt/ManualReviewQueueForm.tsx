import { Checkbox } from '@/coop-ui/Checkbox';
import { Label } from '@/coop-ui/Label';
import { gql } from '@apollo/client';
import { Select } from 'antd';
import difference from 'lodash/difference';
import orderBy from 'lodash/orderBy';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate, useParams } from 'react-router-dom';

import FullScreenLoading from '../../../components/common/FullScreenLoading';
import { selectFilterByLabelOption } from '../components/antDesignUtils';
import CoopButton from '../components/CoopButton';
import CoopModal from '../components/CoopModal';
import FormHeader from '../components/FormHeader';
import NameDescriptionInput from '../components/NameDescriptionInput';

import {
  namedOperations,
  useGQLCreateManualReviewQueueMutation,
  useGQLManualReviewQueueQuery,
  useGQLQueueFormDataQuery,
  useGQLUpdateManualReviewQueueMutation,
} from '../../../graphql/generated';
import { titleCaseEnumStringWithArticle } from '../../../utils/string';
import { optionWithTooltip } from './queue_routing/ManualReviewQueueRuleFormCondition';

const { Option } = Select;

gql`
  query QueueFormData {
    myOrg {
      hasAppealsEnabled
      hasPartialItemsEndpoint
      users {
        id
        firstName
        lastName
        role
      }
      actions {
        ... on ActionBase {
          id
          name
        }
      }
      usersWhoCanReviewEveryQueue {
        id
      }
    }
  }

  query ManualReviewQueue($id: ID!) {
    manualReviewQueue(id: $id) {
      ... on ManualReviewQueue {
        id
        name
        description
        explicitlyAssignedReviewers {
          id
        }
        hiddenActionIds
        isAppealsQueue
        autoCloseJobs
      }
    }
  }

  mutation CreateManualReviewQueue($input: CreateManualReviewQueueInput!) {
    createManualReviewQueue(input: $input) {
      ... on MutateManualReviewQueueSuccessResponse {
        data {
          ... on ManualReviewQueue {
            id
            name
            description
          }
        }
      }
      ... on ManualReviewQueueNameExistsError {
        title
        status
        type
      }
    }
  }

  mutation UpdateManualReviewQueue($input: UpdateManualReviewQueueInput!) {
    updateManualReviewQueue(input: $input) {
      ... on MutateManualReviewQueueSuccessResponse {
        data {
          ... on ManualReviewQueue {
            id
            name
            description
          }
        }
      }
      ... on ManualReviewQueueNameExistsError {
        title
        status
        type
      }
      ... on NotFoundError {
        title
        status
        type
      }
    }
  }
`;

export default function ManualReviewQueueForm() {
  // NB: it's stupid that antd can't track this for us, like other libraries do.
  // But alas: https://github.com/ant-design/ant-design/issues/27667
  const [modalInfo, setModalInfo] = useState<
    | {
        title: string;
        body: string;
        buttonText: string;
        onClickDone?: () => void;
      }
    | undefined
  >(undefined);
  const [queueName, setQueueName] = useState<string | undefined>(undefined);
  const [queueDescription, setQueueDescription] = useState<string | undefined>(
    undefined,
  );
  const [moderatorsWithAccess, setModeratorsWithAccess] = useState<string[]>(
    [],
  );
  const [hiddenActionIds, setHiddenActionIds] = useState<string[]>([]);
  const [autoCloseJobs, setAutoCloseJobs] = useState<boolean>(false);
  const [isAppealsQueue, setIsAppealsQueue] = useState<boolean>(false);
  const navigate = useNavigate();

  const [
    createManualReviewQueue,
    { data: createMutationResponse, loading: createMutationLoading },
  ] = useGQLCreateManualReviewQueueMutation({
    onError: () =>
      setModalInfo({
        title: 'Error Creating Queue',
        body: 'We encountered an error trying to create your Queue. Please try again.',
        buttonText: 'OK',
      }),
    onCompleted: (response) => {
      switch (response.createManualReviewQueue.__typename) {
        case 'MutateManualReviewQueueSuccessResponse':
          setModalInfo({
            title: 'Queue Created',
            body: 'Your Queue was successfully created!',
            buttonText: 'Done',
            onClickDone: () => navigate(-1),
          });

          break;
        case 'ManualReviewQueueNameExistsError':
          setModalInfo({
            title: 'Error Creating Queue',
            body: 'Your organization already has a queue with this name.',
            buttonText: 'OK',
          });
          break;
      }
    },
    refetchQueries: [
      namedOperations.Query.ManualReviewQueues,
      namedOperations.Query.ManualReviewQueue,
    ],
  });

  const [
    updateManualReviewQueue,
    { data: updateMutationResponse, loading: updateMutationLoading },
  ] = useGQLUpdateManualReviewQueueMutation({
    onError: () =>
      setModalInfo({
        title: 'Error Saving Changes',
        body: 'We encountered an error trying to save your changes. Please try again.',
        buttonText: 'OK',
      }),
    onCompleted: (response) => {
      switch (response.updateManualReviewQueue.__typename) {
        case 'ManualReviewQueueNameExistsError':
          setModalInfo({
            title: 'Error Saving Changes',
            body: 'Your organization already has a queue with this name.',
            buttonText: 'OK',
          });
          break;
        case 'MutateManualReviewQueueSuccessResponse':
          setModalInfo({
            title: 'Changes Saved',
            body: 'Your Queue was successfully updated!',
            buttonText: 'Done',
          });
          break;
        case 'NotFoundError':
          setModalInfo({
            title: 'Error Saving Changes',
            body: 'We encountered an error trying to save your changes. Please try again.',
            buttonText: 'OK',
          });
          break;
      }
    },
    refetchQueries: [
      namedOperations.Query.ManualReviewQueues,
      namedOperations.Query.ManualReviewQueue,
    ],
  });

  const { id } = useParams<{ id: string | undefined }>();

  const { data, loading, error } = useGQLQueueFormDataQuery();

  const queueQueryParams = useGQLManualReviewQueueQuery({
    variables: { id: id! },
    skip: id == null,
  });

  const orgUsers = data?.myOrg?.users ?? [];
  const orgActions = data?.myOrg?.actions ?? [];
  const usersWhoCanReviewEveryQueue =
    data?.myOrg?.usersWhoCanReviewEveryQueue ?? [];

  const usersWithExplicitQueuePermission =
    queueQueryParams.data?.manualReviewQueue?.explicitlyAssignedReviewers ?? [];
  const queue = queueQueryParams.data?.manualReviewQueue;
  const initiallyHiddenActionIds = useMemo(
    () => queueQueryParams.data?.manualReviewQueue?.hiddenActionIds ?? [],
    [queueQueryParams.data?.manualReviewQueue?.hiddenActionIds],
  );
  const queueQueryLoading = queueQueryParams.loading;
  const queueQueryError = queueQueryParams.error;

  const userIdsWithPermission = usersWithExplicitQueuePermission.map(
    (it) => it.id,
  );
  const userIdsWhoCanReviewEveryQueue = usersWhoCanReviewEveryQueue.map(
    (it) => it.id,
  );
  const sortedUsers = orgUsers
    .filter(
      (it) =>
        userIdsWithPermission.includes(it.id) ||
        userIdsWhoCanReviewEveryQueue.includes(it.id),
    )
    .sort((a, b) => {
      if (
        userIdsWhoCanReviewEveryQueue.includes(a.id) &&
        !userIdsWhoCanReviewEveryQueue.includes(b.id)
      ) {
        return 1;
      } else if (
        !userIdsWhoCanReviewEveryQueue.includes(a.id) &&
        userIdsWhoCanReviewEveryQueue.includes(b.id)
      ) {
        return -1;
      } else {
        return a.firstName.localeCompare(b.firstName);
      }
    });

  useEffect(() => {
    if (!queue) {
      return;
    }

    setQueueName(queue.name);
    setQueueDescription(queue.description ?? undefined);
    setModeratorsWithAccess(sortedUsers.map((it) => it.id));
    setHiddenActionIds([...queue.hiddenActionIds]);
    setAutoCloseJobs(queue.autoCloseJobs);
    setIsAppealsQueue(queue.isAppealsQueue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, queue?.autoCloseJobs]);

  if (queueQueryError || error) {
    // eslint-disable-next-line @typescript-eslint/no-throw-literal
    throw queueQueryError ?? error;
  }

  const onCreateQueue = useCallback(
    async () =>
      createManualReviewQueue({
        variables: {
          input: {
            name: queueName!,
            // We're intentionally casting the empty string to null for the backend.
            // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
            description: queueDescription || null,
            userIds: moderatorsWithAccess,
            hiddenActionIds,
            isAppealsQueue,
            autoCloseJobs,
          },
        },
      }),
    [
      autoCloseJobs,
      createManualReviewQueue,
      hiddenActionIds,
      isAppealsQueue,
      moderatorsWithAccess,
      queueDescription,
      queueName,
    ],
  );

  const onUpdateQueue = useCallback(
    async () =>
      updateManualReviewQueue({
        variables: {
          input: {
            id: id!,
            name: queueName!,
            // We're intentionally casting the empty string to null for the backend.
            // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
            description: queueDescription || null,
            userIds: moderatorsWithAccess,
            actionIdsToHide: difference(
              hiddenActionIds,
              initiallyHiddenActionIds,
            ),
            actionIdsToUnhide: difference(
              initiallyHiddenActionIds,
              hiddenActionIds,
            ),
            autoCloseJobs,
          },
        },
      }),
    [
      autoCloseJobs,
      hiddenActionIds,
      id,
      initiallyHiddenActionIds,
      moderatorsWithAccess,
      queueDescription,
      queueName,
      updateManualReviewQueue,
    ],
  );

  const hideModal = useCallback(() => setModalInfo(undefined), []);
  const onClickModalFooter = useCallback(() => {
    setModalInfo(undefined);
    if (modalInfo?.onClickDone) {
      modalInfo.onClickDone();
    }
  }, [modalInfo]);
  const footer = useMemo(
    () => [
      {
        title: modalInfo?.buttonText ?? '',
        onClick: onClickModalFooter,
        type: 'primary' as const,
      },
    ],
    [modalInfo?.buttonText, onClickModalFooter],
  );

  if (queueQueryLoading || loading) {
    return <FullScreenLoading />;
  }

  const isCreateForm = id == null;

  const divider = () => <div className="mt-5 divider mb-9" />;
  return (
    <div className="flex flex-col text-start">
      <Helmet>
        <title>{id == null ? 'Create Queue' : 'Update Queue'}</title>
      </Helmet>
      <FormHeader
        title={
          id == null
            ? 'Create Manual Review Queue'
            : 'Update Manual Review Queue'
        }
      />
      <NameDescriptionInput
        nameInitialValue={queueName}
        descriptionInitialValue={queueDescription}
        error={
          createMutationResponse?.createManualReviewQueue.__typename ===
            'ManualReviewQueueNameExistsError' ||
          updateMutationResponse?.updateManualReviewQueue.__typename ===
            'ManualReviewQueueNameExistsError'
            ? 'Your organization already has a queue with this name.'
            : undefined
        }
        onChangeName={setQueueName}
        onChangeDescription={setQueueDescription}
      />
      <div className="flex flex-col items-start mt-6">
        <div className="font-semibold">Reviewer Access</div>
        <div className="mb-2 text-slate-500">
          Select which moderators should have access to this queue. Note: Users
          who are Admins or Moderator Managers automatically have access to
          every queue, so you don't need to add them as moderators here. You can
          see each user's role in our{' '}
          <Link to="/dashboard/settings/users">Users</Link> page.
        </div>
        <Select<string[]>
          className="self-start !min-w-[160px]"
          mode="multiple"
          placeholder="Add Moderators"
          dropdownMatchSelectWidth={false}
          allowClear
          showSearch
          filterOption={selectFilterByLabelOption}
          value={moderatorsWithAccess}
          onChange={setModeratorsWithAccess}
        >
          {orgUsers.map((user, index) => {
            const userIsAdmin = userIdsWhoCanReviewEveryQueue.includes(user.id);
            return optionWithTooltip({
              title: `${user.firstName} ${user.lastName}`,
              value: user.id,
              disabled: userIsAdmin,
              description: userIsAdmin
                ? `This user is ${titleCaseEnumStringWithArticle(
                    user.role!,
                  )} and can therefore see every queue, so you can't remove them from individual queues`
                : undefined,
              key: user.id,
              index,
              isInOptionGroup: false,
            });
          })}
        </Select>
        {orgActions.length > 0 && (
          <div className="mt-8">
            <div className="font-semibold">Hidden Actions</div>
            <div className="mb-2 text-slate-500">
              Select which actions should be hidden from this queue. Hidden
              actions will not be shown to moderators who review jobs in this
              queue. If you don't select any actions, all actions will be
              available.
            </div>
            <Select<string[]>
              className="self-start !min-w-[160px]"
              mode="multiple"
              placeholder="Add Hidden Actions"
              dropdownMatchSelectWidth={false}
              allowClear
              showSearch
              filterOption={selectFilterByLabelOption}
              value={hiddenActionIds}
              onChange={setHiddenActionIds}
            >
              {orderBy(orgActions, ['name']).map((action) => (
                <Option key={action.id} value={action.id} label={action.name}>
                  {action.name}
                </Option>
              ))}
            </Select>
          </div>
        )}
      </div>
      {data?.myOrg?.hasPartialItemsEndpoint && (
        <div className="mt-8">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="auto-close-jobs"
              onCheckedChange={setAutoCloseJobs}
              checked={autoCloseJobs}
            />
            <Label htmlFor="auto-close-jobs">
              Automatically close jobs in this queue if a reported item has
              already been deleted
            </Label>
          </div>
        </div>
      )}
      {isCreateForm && data?.myOrg?.hasAppealsEnabled ? (
        <div className="mt-8">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="is-appeals-queue"
              onCheckedChange={setIsAppealsQueue}
              checked={isAppealsQueue}
            />
            <Label htmlFor="is-appeals-queue">This is an Appeals Queue</Label>
          </div>
        </div>
      ) : null}
      {divider()}
      <div className="self-start">
        <CoopButton
          title={id == null ? 'Create Queue' : 'Save Changes'}
          loading={createMutationLoading || updateMutationLoading}
          disabled={queueName == null}
          disabledTooltipTitle={
            queueName == null
              ? 'Please provide a name for the queue.'
              : undefined
          }
          disabledTooltipPlacement="bottom"
          onClick={id == null ? onCreateQueue : onUpdateQueue}
        />
      </div>
      <CoopModal
        title={modalInfo?.title}
        visible={modalInfo != null}
        onClose={hideModal}
        footer={footer}
      >
        {modalInfo?.body}
      </CoopModal>
    </div>
  );
}
