import { gql } from '@apollo/client';
import { makeEnumLike } from '@roostorg/types';
import { Input, Tooltip } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';

import ComponentLoading from '../../../../../../components/common/ComponentLoading';
import CoopModal from '@/webpages/dashboard/components/CoopModal';

import {
  GQLDecisionSubmission,
  useGQLAllManualReviewQueuesQuery,
  useGQLPermissionsQuery,
} from '../../../../../../graphql/generated';

export const NCMECDecision = makeEnumLike([
  'Send',
  'Ignore',
  'Move to Different Queue',
]);

type SkipDecisionType = 'Skip';

export type NCMECDecisionType = keyof typeof NCMECDecision;

gql`
  query AllManualReviewQueues {
    myOrg {
      mrtQueues {
        id
        name
      }
    }
  }
`;

export default function NCMECActions(props: {
  setSendReportModalVisible: (visible: boolean) => void;
  setDeselectAndIgnoreModalVisible: (visible: boolean) => void;
  isAnyMediaSelected: boolean;
  isAllMediaSelected: boolean;
  submitDecision: (input: GQLDecisionSubmission) => void;
  moveToQueueMenuVisible: boolean;
  setMoveToQueueMenuVisible: (visible: boolean) => void;
  skipToNextJob: () => void;
  disableKeyboardShortcuts: boolean;
}) {
  const {
    setSendReportModalVisible,
    setDeselectAndIgnoreModalVisible,
    isAnyMediaSelected,
    isAllMediaSelected,
    submitDecision,
    moveToQueueMenuVisible,
    setMoveToQueueMenuVisible,
    skipToNextJob,
    disableKeyboardShortcuts,
  } = props;
  const [queueSearchString, setQueueSearchString] = useState<
    string | undefined
  >(undefined);
  const sendButtonRef = useRef<HTMLDivElement>(null);
  const [showSkipConfirmation, setShowSkipConfirmation] =
    useState<boolean>(false);

  const {
    loading,
    error: queuesError,
    data,
  } = useGQLAllManualReviewQueuesQuery();

  const { data: permissionsData, loading: permissionsLoading } =
    useGQLPermissionsQuery();

  // If all media has been categorized, then pressing Enter should have the
  // same effect as clicking Send
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (disableKeyboardShortcuts) {
        return;
      }
      if (isAllMediaSelected && event.key === 'Enter') {
        setSendReportModalVisible(true);
      }
    };

    // Add the event listener when the component mounts
    window.addEventListener('keydown', handleKeyPress);

    // Remove the event listener when the component unmounts
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAllMediaSelected, disableKeyboardShortcuts]);

  const onMoveToDifferentQueue = useCallback(
    (newQueueId: string) => {
      submitDecision({
        transformJobAndRecreateInQueue: {
          newJobKind: 'DEFAULT',
          newQueueId,
          policyIds: [],
        },
      });
      setMoveToQueueMenuVisible(false);
    },
    [setMoveToQueueMenuVisible, submitDecision],
  );

  const onClick = useCallback(
    (decision: NCMECDecisionType | SkipDecisionType) => {
      switch (decision) {
        case 'Send':
          setSendReportModalVisible(true);
          break;
        case 'Ignore':
          if (isAnyMediaSelected) {
            setDeselectAndIgnoreModalVisible(true);
          } else {
            submitDecision({ ignore: {} });
          }
          break;
        case 'Move to Different Queue':
          setMoveToQueueMenuVisible(!moveToQueueMenuVisible);
          break;
        case 'Skip':
          setShowSkipConfirmation(true);
          break;
      }
    },
    [
      isAnyMediaSelected,
      moveToQueueMenuVisible,
      setDeselectAndIgnoreModalVisible,
      setMoveToQueueMenuVisible,
      setSendReportModalVisible,
      submitDecision,
      setShowSkipConfirmation,
    ],
  );

  const color = (decision: NCMECDecisionType | SkipDecisionType) => {
    switch (decision) {
      case 'Send':
        return 'text-white bg-coop-alert-red hover:bg-coop-alert-red-hover';
      case 'Ignore':
        return 'text-white bg-coop-success-green hover:bg-coop-success-green-hover';
      case 'Move to Different Queue':
        return 'text-white bg-primary hover:bg-indigo-300';
      case 'Skip':
        return 'text-slate-500 bg-slate-200 hover:bg-slate-300';
    }
  };

  const queueButton = useCallback(
    (queue: { id: string; name: string }) => {
      const { id, name } = queue;
      return (
        <div
          key={id}
          className={`px-2 py-0.5 m-1 text-start rounded cursor-pointer text-slate-500 font-medium bg-white hover:bg-coop-lightblue-hover`}
          onClick={() => onMoveToDifferentQueue(id)}
        >
          {name}
        </div>
      );
    },
    [onMoveToDifferentQueue],
  );

  const button = useCallback(
    (decision: NCMECDecisionType | SkipDecisionType) => {
      const isDisabled = decision === 'Send' && !isAllMediaSelected;
      const button = (
        <div
          className={`block relative cursor-pointer p-2 rounded-md font-medium justify-center items-center px-4 h-fit border-none ${
            isDisabled
              ? 'text-slate-300 bg-slate-100'
              : `hover:text-white ${color(decision)}`
          }`}
          ref={decision === 'Send' ? sendButtonRef : null}
          onClick={() => {
            // Need to implement this separately from the <Button>'s disabled
            // prop because setting is and then wrapping the button in a Tooltip
            // completely messes up the disabled styling.
            if (!isDisabled) {
              onClick(decision);
            }
          }}
        >
          {decision}
          {decision !==
          'Move to Different Queue' ? null : moveToQueueMenuVisible ? (
            queuesError ? (
              <div className="font-medium">
                Error: Could not fetch your queues.
              </div>
            ) : (
              <div
                onClick={(event) => event.stopPropagation()}
                className="flex flex-col bg-white absolute border border-solid rounded shadow mt-3 p-1 min-w-[180px] z-20 border-slate-200 right-0"
              >
                <Input
                  autoFocus
                  placeholder="Search"
                  onChange={(event) => setQueueSearchString(event.target.value)}
                />
                <div className="flex flex-col max-h-[256px] overflow-y-scroll ">
                  {loading ? (
                    <ComponentLoading />
                  ) : (
                    data?.myOrg?.mrtQueues
                      .filter(
                        (queue) =>
                          !queueSearchString ||
                          queue.name
                            .toLocaleLowerCase()
                            .includes(queueSearchString.toLocaleLowerCase()),
                      )
                      .map((queue) => queueButton(queue))
                  )}
                </div>
              </div>
            )
          ) : null}
        </div>
      );
      return isDisabled ? (
        <Tooltip
          title="Please make a decision on every piece of media in this job before sending a report to NCMEC."
          className="relative items-center justify-center block p-2 px-4 font-medium cursor-pointer rounded-md text-slate-300 bg-slate-100 h-fit"
        >
          {button}
        </Tooltip>
      ) : (
        button
      );
    },
    [
      data?.myOrg?.mrtQueues,
      isAllMediaSelected,
      loading,
      moveToQueueMenuVisible,
      onClick,
      queueButton,
      queueSearchString,
      queuesError,
    ],
  );

  const permissions = permissionsData?.me?.permissions;

  if (permissionsLoading || permissions === undefined) {
    return <ComponentLoading />;
  }

  // Using ViewChildSafetyData as a proxy for External Moderator.
  const decisions = Object.values(NCMECDecision);

  return (
    <div className="flex flex-col">
      <CoopModal
        title={'Skip Job'}
        visible={showSkipConfirmation}
        footer={[
          {
            title: 'Cancel',
            onClick: () => setShowSkipConfirmation(false),
            type: 'secondary',
          },
          {
            title: 'Skip',
            onClick: skipToNextJob,
            type: 'primary',
          },
        ]}
        onClose={() => setShowSkipConfirmation(false)}
      >
        Are you sure you want to skip this job?
      </CoopModal>
      <div className="relative flex items-center gap-4">
        {[...decisions.map((decision) => button(decision))]}
        {button('Skip' satisfies SkipDecisionType)}
      </div>
    </div>
  );
}
