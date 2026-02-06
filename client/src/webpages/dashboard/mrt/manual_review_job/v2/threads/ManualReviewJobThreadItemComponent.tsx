import { Checkbox } from '@/coop-ui/Checkbox';
import { ReactComponent as UserAlt4 } from '@/icons/lni/User/user-alt-4.svg';
import { WarningFilled } from '@ant-design/icons';
import { RelatedItem } from '@roostorg/types';
import { Button } from 'antd';
import { useContext } from 'react';
import { JsonObject } from 'type-fest';

import CopyTextComponent from '@/components/common/CopyTextComponent';

import {
  GQLContentItem,
  GQLUserItemType,
} from '../../../../../../graphql/generated';
import {
  getFieldValueForRole,
  getFieldValueOrValues,
  getPrimaryContentFields,
} from '../../../../../../utils/itemUtils';
import { getSeverityColor } from '../../../../../../utils/userPenalty';
import FieldsComponent from '../ManualReviewJobFieldsComponent';
import ManualReviewJobMagnifyImageComponent from '../ManualReviewJobMagnifyImageComponent';
import { ManualReviewActionStore } from '../ManualReviewJobRelatedActionsStore';

type ManualReviewJobThreadItemOptions = {
  isByReportedUser: boolean;
  isReportedMessage: boolean;
  isReporter: boolean;
  isSelected: boolean;
  unblurAllMedia: boolean;
};

// TODO: At some point, we might want to make this more generic, and update the
// props to be things like 'onClickCheckbox' and 'onMouseOverProfilePic' instead
// of the more specific props we have now. For now, though, this is fine.
export default function ManualReviewJobThreadItemComponent(props: {
  threadItem: GQLContentItem;
  author?: RelatedItem;
  authorData?: JsonObject;
  authorType?: GQLUserItemType;
  timestamp?: string;
  options: ManualReviewJobThreadItemOptions;
  selectAllUsersMessages: (user: RelatedItem) => void;
  deselectAllUsersMessages: (user: RelatedItem) => void;
  inspectUser: (user: RelatedItem) => void;
  showInspectedUser: (state: boolean) => void;
  areAllUsersMessagesSelected: (user?: RelatedItem) => boolean;
  selectMessage: (message: GQLContentItem) => void;
  deselectMessage: (message: GQLContentItem) => void;
  isActionable?: boolean;
}) {
  const {
    threadItem,
    author,
    authorType,
    timestamp,
    options,
    selectAllUsersMessages,
    deselectAllUsersMessages,
    inspectUser,
    showInspectedUser,
    areAllUsersMessagesSelected,
    selectMessage,
    deselectMessage,
    authorData,
    isActionable = true,
  } = props;
  const {
    isByReportedUser,
    isReporter,
    isSelected,
    unblurAllMedia,
    isReportedMessage,
  } = options;

  const allAuthorMessagesAreSelected = areAllUsersMessagesSelected(author);

  const actionStore = useContext(ManualReviewActionStore);

  const authorTypeName = authorType?.name ?? 'User';
  const [profileImage, backgroundImage] =
    author && authorType && authorData
      ? [
          getFieldValueForRole(
            { type: authorType, data: authorData },
            'profileIcon',
          ),
          getFieldValueForRole(
            { type: authorType, data: authorData },
            'backgroundImage',
          ),
        ]
      : [undefined, undefined];

  // TODO: Make this configurable per organization. There's no reason
  // why we can't have the same flag for other clients. We can consider
  // making this a field role in the future, but for now let's search
  // automatically.
  const isAuthorDeleted = (() => {
    const isDeleted = authorData
      ? getFieldValueOrValues(authorData, {
          __typename: 'BaseField',
          type: 'BOOLEAN',
          name: 'deleted',
          required: false,
          container: null,
        })
      : undefined;
    return (
      isDeleted !== undefined &&
      !Array.isArray(isDeleted) &&
      isDeleted.value === true
    );
  })();

  const textColor = ((actions) => {
    if (!author) {
      return null;
    }
    const actionSeverities = actions
      .filter((it) => it.itemId === author.id)
      .map((it) => it.action.penalty)
      .sort()
      .reverse();

    return actionSeverities.length > 0
      ? getSeverityColor(actionSeverities[0])
      : null;
  })(actionStore?.actions ?? []);

  return (
    <div className="flex flex-row w-full gap-3">
      <div className="flex flex-col grow">
        <div className="flex flex-row mb-1.5 items-start">
          <span className="mr-3">
            {author ? (
              <ManualReviewJobMagnifyImageComponent
                itemIdentifier={{ id: author.id, typeId: author.typeId }}
                imageUrl={profileImage?.url}
                magnifiedUrls={backgroundImage ? [backgroundImage.url] : []}
                fallbackComponent={
                  <UserAlt4 className="p-3 fill-slate-500 w-11" />
                }
                footerComponent={
                  <div className="flex gap-2">
                    <Button
                      className="self-end my-2 text-sm cursor-pointer rounded-md"
                      onClick={() => {
                        inspectUser(author);
                        showInspectedUser(true);
                      }}
                    >
                      Inspect User
                    </Button>
                    <Button
                      className="self-end my-2 text-sm cursor-pointer rounded-md"
                      onClick={() => {
                        if (allAuthorMessagesAreSelected) {
                          deselectAllUsersMessages(author);
                        } else {
                          selectAllUsersMessages(author);
                        }
                      }}
                    >
                      {allAuthorMessagesAreSelected
                        ? 'Deselect All Messages'
                        : 'Select All Messages'}
                    </Button>
                  </div>
                }
              />
            ) : null}
          </span>
          <div className="flex flex-col grow">
            <div className="flex items-center justify-between w-full mb-1 gap-2">
              <div className="flex items-center gap-2">
                <div
                  className={`self-start font-medium ${
                    textColor ?? 'text-slate-500'
                  }`}
                >
                  {author?.name
                    ? `${author?.name} (${author?.id})`
                    : `${author?.id ?? 'Unknown User'}`}
                </div>
                {isByReportedUser ? (
                  <div className="flex px-2 py-1 text-xs font-medium text-white rounded gap-1 bg-coop-alert-red">
                    {`Reported ${authorTypeName}`}
                    <WarningFilled className="flex items-center justify-center" />
                  </div>
                ) : isReporter ? (
                  <div className="flex px-2 py-1 text-xs font-medium text-white rounded gap-1 bg-coop-success-green">
                    Reporter
                  </div>
                ) : null}
                {isReportedMessage ? (
                  <div className="flex px-2 py-1 text-xs font-medium text-white bg-orange-400 rounded gap-1">
                    Reported Message
                    <WarningFilled className="flex items-center justify-center" />
                  </div>
                ) : null}
                {isAuthorDeleted ? (
                  <div className="flex px-2 py-1 text-xs font-medium text-white bg-gray-600 rounded gap-1">
                    Author Deleted
                  </div>
                ) : null}
              </div>
              <div className="flex flex-row">
                {
                  <div className="self-end pt-2 pr-2 text-slate-400">
                    <CopyTextComponent
                      displayValue={'ID: ' + threadItem.id}
                      value={threadItem.id}
                    />
                  </div>
                }
                {timestamp ? (
                  <div className="self-end pt-2 text-slate-400">
                    {new Date(timestamp).toLocaleString()}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="flex flex-row items-center justify-between">
              <div className="flex flex-col w-full">
                <div className="flex flex-row items-center justify-between rounded bg-slate-200 grow">
                  <FieldsComponent
                    fields={getPrimaryContentFields(
                      threadItem.type.baseFields,
                      threadItem.data,
                    )}
                    itemTypeId={threadItem.type.id}
                    options={{
                      hideLabels: true,
                      maxHeightImage: 300,
                      maxHeightVideo: 300,
                      unblurAllMedia,
                      transparentBackground: true,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Checkbox
        className={`self-center grow-0 !mt-6 ${
          !isActionable ? '!invisible' : ''
        }`}
        checked={isSelected}
        onCheckedChange={(isChecked) =>
          isChecked ? selectMessage(threadItem) : deselectMessage(threadItem)
        }
      />
    </div>
  );
}
