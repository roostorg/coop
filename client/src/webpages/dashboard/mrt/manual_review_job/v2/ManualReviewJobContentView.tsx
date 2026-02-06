import type { ItemTypeFieldFieldData } from '@/webpages/dashboard/item_types/itemTypeUtils';
import ItemActionHistory from '@/webpages/dashboard/items/ItemActionHistory';
import { useState } from 'react';

import CoopModal from '../../../components/CoopModal';

import {
  GQLContentAppealManualReviewJobPayload,
  GQLContentManualReviewJobPayload,
  GQLItemType,
  GQLThreadAppealManualReviewJobPayload,
  GQLThreadManualReviewJobPayload,
} from '../../../../../graphql/generated';
import { getFieldValueForRole } from '../../../../../utils/itemUtils';
import {
  ManualReviewJobAction,
  ManualReviewJobEnqueuedActionData,
} from '../ManualReviewJobReview';
import IframeContentDisplayComponent from '../IframeContentDisplayComponent';
import ManualReviewJobContentThreadHistory from './ManualReviewJobContentThreadHistory';
import FieldsComponent from './ManualReviewJobFieldsComponent';
import ManualReviewJobRelatedUserComponent from './user/ManualReviewJobRelatedUserComponent';

export default function ManualReviewJobContentView(props: {
  payload:
    | GQLContentManualReviewJobPayload
    | GQLThreadManualReviewJobPayload
    | GQLContentAppealManualReviewJobPayload
    | GQLThreadAppealManualReviewJobPayload;
  allActions: readonly Pick<
    ManualReviewJobAction,
    '__typename' | 'penalty' | 'id' | 'itemTypes' | 'name'
  >[];
  relatedActions: readonly ManualReviewJobEnqueuedActionData[];
  allPolicies: readonly { id: string; name: string }[];
  allItemTypes: readonly GQLItemType[];
  onEnqueueActions: (action: ManualReviewJobEnqueuedActionData[]) => void;
  unblurAllMedia: boolean;
  parentRef: React.RefObject<HTMLDivElement>;
  reportedUserRef?: React.RefObject<HTMLDivElement>;
  requirePolicySelectionToEnqueueAction: boolean;
  allowMoreThanOnePolicySelection: boolean;
  orgId: string;
  isActionable: boolean;
}) {
  const {
    payload,
    allActions,
    relatedActions,
    allPolicies,
    allItemTypes,
    onEnqueueActions,
    unblurAllMedia,
    parentRef,
    reportedUserRef,
    requirePolicySelectionToEnqueueAction,
    allowMoreThanOnePolicySelection,
    isActionable,
  } = props;
  const { item } = payload;

  const [secondaryRelatedUser, setSecondaryRelatedUser] = useState<
    | {
        id: string;
        typeId: string;
        name?: string | undefined;
      }
    | undefined
  >(undefined);

  const itemCreator =
    item.__typename === 'ContentItem'
      ? getFieldValueForRole(item, 'creatorId')
      : undefined;

  const fieldData = item.type.baseFields.map(
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
        value: item.data[itemTypeField.name],
      }) as ItemTypeFieldFieldData,
  );

  const contentThread =
    payload.__typename === 'ContentManualReviewJobPayload'
      ? getFieldValueForRole(payload.item, 'threadId')
      : payload.__typename === 'ThreadManualReviewJobPayload'
      ? { id: payload.item.id, typeId: payload.item.type.id }
      : undefined;

  const inspectUserModal = (
    <CoopModal
      title="Inspected User"
      visible={secondaryRelatedUser != null}
      onClose={() => setSecondaryRelatedUser(undefined)}
      hideCloseButton={false}
    >
      {secondaryRelatedUser ? (
        // This is a bit confusing, but the `reportedUserIdentifier` is the user
        // who created the piece of content, and the `user` is the selected user
        // the reviewer wants to inspect.
        <ManualReviewJobRelatedUserComponent
          user={secondaryRelatedUser}
          reportedUserIdentifier={itemCreator}
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

  return (
    <div className="flex flex-col overflow-x-scroll">
      <div className="flex flex-row items-start py-4 space-x-4">
        {/* Split the data into two columns: non-media fields and media fields*/}
        <div className="max-w-full min-w-[50%] grow">
          <FieldsComponent
            fields={fieldData}
            itemTypeId={item.type.id}
            options={{
              unblurAllMedia,
              maxHeightImage: 300,
              maxHeightVideo: 300,
            }}
          />
        </div>
      </div>
      {'url' in payload.item.data ? (
        <IframeContentDisplayComponent contentUrl={String(payload.item.data.url)} />
      ) : null}
      {!contentThread ? null : (
        <div className="my-6">
          <ManualReviewJobContentThreadHistory
            payload={payload}
            thread={contentThread}
            allActions={allActions}
            allItemTypes={allItemTypes}
            relatedActions={relatedActions}
            allPolicies={allPolicies}
            onEnqueueActions={onEnqueueActions}
            parentRef={parentRef}
            reportedUserRef={reportedUserRef}
            unblurAllMedia={unblurAllMedia}
            isActionable={isActionable}
            requirePolicySelectionToEnqueueAction={
              requirePolicySelectionToEnqueueAction
            }
            allowMoreThanOnePolicySelection={allowMoreThanOnePolicySelection}
          />
        </div>
      )}
      <div className="mt-6">
        <ItemActionHistory
          itemIdentifier={{ id: payload.item.id, typeId: payload.item.type.id }}
        />
      </div>
      {itemCreator ? (
        <ManualReviewJobRelatedUserComponent
          title={`Associated ${
            allItemTypes.find((itemType) => itemCreator.typeId === itemType.id)
              ?.name ?? 'User'
          }`}
          user={itemCreator}
          allActions={allActions}
          allPolicies={allPolicies}
          allItemTypes={allItemTypes}
          relatedActions={relatedActions}
          onEnqueueAction={(action) => onEnqueueActions([action])}
          setSelectedUser={setSecondaryRelatedUser}
          unblurAllMedia={unblurAllMedia}
          requirePolicySelectionToEnqueueAction={
            requirePolicySelectionToEnqueueAction
          }
          isActionable={isActionable}
          allowMoreThanOnePolicySelection={allowMoreThanOnePolicySelection}
        />
      ) : undefined}
      {inspectUserModal}
    </div>
  );
}
