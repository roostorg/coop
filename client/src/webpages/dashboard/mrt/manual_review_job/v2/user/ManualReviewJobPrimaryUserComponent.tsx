import { ReactComponent as UserAlt4 } from '@/icons/lni/User/user-alt-4.svg';
import type { ItemTypeFieldFieldData } from '@/webpages/dashboard/item_types/itemTypeUtils';
import ItemActionHistory from '@/webpages/dashboard/items/ItemActionHistory';
import { WarningFilled } from '@ant-design/icons';
import { ItemIdentifier } from '@roostorg/types';
import { useState } from 'react';

import CoopModal from '../../../../components/CoopModal';

import {
  GQLItemType,
  GQLUserItem,
  useGQLGetMoreInfoForPartialItemsQuery,
} from '../../../../../../graphql/generated';
import { getFieldValueForRole } from '../../../../../../utils/itemUtils';
import {
  ManualReviewJobAction,
  ManualReviewJobEnqueuedActionData,
} from '../../ManualReviewJobReview';
import FieldsComponent from '../ManualReviewJobFieldsComponent';
import ManualReviewJobMagnifyImageComponent from '../ManualReviewJobMagnifyImageComponent';
import ManualReviewJobCurrentJobsComponent from './ManualReviewJobCurrentJobsComponent';
import ManualReviewJobLatestSubmissionsWithThreadComponent from './ManualReviewJobLatestSubmissionsWithThreadComponent';
import ManualReviewJobRelatedUserComponent from './ManualReviewJobRelatedUserComponent';
import { convertRelatedItemToFieldData } from './ManualReviewJobUserUtils';

export default function ManualReviewJobPrimaryUserComponent(props: {
  user: GQLUserItem | ItemIdentifier;
  unblurAllMedia: boolean;
  userScore: number | undefined;
  allItemTypes: readonly GQLItemType[];
  allActions: readonly Pick<
    ManualReviewJobAction,
    '__typename' | 'penalty' | 'id' | 'itemTypes' | 'name'
  >[];
  allPolicies: readonly { id: string; name: string }[];
  relatedActions: readonly ManualReviewJobEnqueuedActionData[];
  reportedUserRef?: React.RefObject<HTMLDivElement>;
  onEnqueueActions: (actions: ManualReviewJobEnqueuedActionData[]) => void;
  isReported?: boolean;
  isActionable?: boolean;
  requirePolicySelectionToEnqueueAction: boolean;
  allowMoreThanOnePolicySelection: boolean;
  jobCreatedAt?: Date;
}) {
  const {
    user,
    unblurAllMedia,
    userScore,
    allItemTypes,
    allActions,
    allPolicies,
    relatedActions,
    onEnqueueActions,
    reportedUserRef,
    isReported = false,
    isActionable = true,
    requirePolicySelectionToEnqueueAction = false,
    allowMoreThanOnePolicySelection,
  } = props;

  const [secondaryRelatedUser, setSecondaryRelatedUser] = useState<
    | {
        id: string;
        typeId: string;
        name?: string | undefined;
      }
    | undefined
  >(undefined);

  const { data: partialItemsInfo } = useGQLGetMoreInfoForPartialItemsQuery({
    variables: {
      ids: [
        { id: user.id, typeId: 'typeId' in user ? user.typeId : user.type.id },
      ],
    },
  });

  const inspectUserModal = (
    <CoopModal
      title="Inspected User"
      visible={secondaryRelatedUser != null}
      onClose={() => setSecondaryRelatedUser(undefined)}
      hideCloseButton={false}
    >
      {secondaryRelatedUser ? (
        <ManualReviewJobRelatedUserComponent
          user={secondaryRelatedUser}
          reportedUserIdentifier={{
            id: user.id,
            typeId: 'type' in user ? user.type.id : user.typeId,
          }}
          allActions={allActions}
          allPolicies={allPolicies}
          allItemTypes={allItemTypes}
          relatedActions={relatedActions}
          onEnqueueAction={(action) => onEnqueueActions([action])}
          unblurAllMedia={unblurAllMedia}
          setSelectedUser={setSecondaryRelatedUser}
          isReporter={false}
          requirePolicySelectionToEnqueueAction={
            requirePolicySelectionToEnqueueAction
          }
          allowMoreThanOnePolicySelection={allowMoreThanOnePolicySelection}
        />
      ) : null}
    </CoopModal>
  );

  const userIdentifier =
    '__typename' in user ? { id: user.id, typeId: user.type.id } : user;
  const userComponent = (() => {
    if (!('__typename' in user)) {
      return null;
    }
    const partialItemsUser =
      partialItemsInfo?.partialItems.__typename ===
      'PartialItemsSuccessResponse'
        ? partialItemsInfo.partialItems.items[0]
        : null;

    const fieldData = user.type.baseFields
      .filter(
        (it) =>
          it.name !== user.type.schemaFieldRoles['profileIcon'] &&
          it.name !== user.type.schemaFieldRoles['displayName'],
      )
      .map(
        (
          itemTypeField, // itemTypeField comes back as a GQLBaseField, and the GQL types
        ) =>
          // aren't (and can't be) precise enough to verify that the internal
          // properties are properly correlated (e.g., `itemTypeField.type` ===
          // `itemTypeField.container.containerType` when
          // `contentTypeField.container` is not null) and that the value matches
          // the field's declared type (which we're just assuming based on the
          // backend validation of the submission). So, we make an object
          // combining the schema and the value and cast that the whole bundle is
          // a coherent value.
          ({
            ...itemTypeField,
            value:
              partialItemsUser?.data[itemTypeField.name] ??
              user.data[itemTypeField.name],
          }) as ItemTypeFieldFieldData,
      )
      .sort((a, b) => {
        if (a.value === undefined) {
          return 1;
        }
        if (b.value === undefined) {
          return -1;
        }
        return 0;
      });

    const displayName = getFieldValueForRole(user, 'displayName');
    const profilePicUrl = getFieldValueForRole(user, 'profileIcon');
    const backgroundImageUrl = getFieldValueForRole(user, 'backgroundImage');

    return (
      <div className="flex flex-col items-start self-stretch p-4 my-6 bg-white border border-gray-200 border-solid rounded-lg space-y-2">
        <div className="flex items-center gap-4">
          <ManualReviewJobMagnifyImageComponent
            itemIdentifier={{
              id: userIdentifier.id,
              typeId: userIdentifier.typeId,
            }}
            imageUrl={profilePicUrl?.url}
            magnifiedUrls={backgroundImageUrl ? [backgroundImageUrl.url] : []}
            label={displayName}
            fallbackComponent={<UserAlt4 className="p-3 fill-slate-500 w-11" />}
          />
          {isReported ? (
            <div className="flex px-2 py-1 text-xs font-medium text-white rounded gap-1 bg-coop-alert-red h-fit">
              Reported
              <WarningFilled className="flex items-center justify-center" />
            </div>
          ) : null}
        </div>
        <FieldsComponent
          fields={[
            ...convertRelatedItemToFieldData(
              { id: user.id, typeId: user.type.id, name: 'User Score' },
              userScore,
            ),
            ...fieldData,
          ]}
          itemTypeId={user.type.id}
          options={{ maxHeightImage: 300, maxHeightVideo: 300, unblurAllMedia }}
        />
      </div>
    );
  })();

  return (
    <div className="flex flex-col items-start self-stretch">
      {userComponent}
      <ItemActionHistory itemIdentifier={userIdentifier} />
      <ManualReviewJobCurrentJobsComponent userIdentifier={userIdentifier} />
      <ManualReviewJobLatestSubmissionsWithThreadComponent
        userIdentifier={userIdentifier}
        reportedUserIdentifier={userIdentifier}
        unblurAllMedia={unblurAllMedia}
        setRelatedUser={setSecondaryRelatedUser}
        allItemTypes={allItemTypes}
        allActions={allActions}
        allPolicies={allPolicies}
        relatedActions={relatedActions}
        onEnqueueActions={onEnqueueActions}
        reportedUserRef={reportedUserRef}
        isActionable={isActionable}
        requirePolicySelectionToEnqueueAction={
          requirePolicySelectionToEnqueueAction
        }
        allowMoreThanOnePolicySelection={allowMoreThanOnePolicySelection}
        endDate={props.jobCreatedAt}
      />
      {inspectUserModal}
    </div>
  );
}
