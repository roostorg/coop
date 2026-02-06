import { ReactComponent as UserAlt4 } from '@/icons/lni/User/user-alt-4.svg';
import { arrayFromArrayOrSingleItem } from '@/utils/collections';
import type { ItemTypeFieldFieldData } from '@/webpages/dashboard/item_types/itemTypeUtils';
import ItemActionHistory from '@/webpages/dashboard/items/ItemActionHistory';
import { LoadingOutlined } from '@ant-design/icons';
import { gql } from '@apollo/client';
import { ItemIdentifier, RelatedItem } from '@roostorg/types';
import isEmpty from 'lodash/isEmpty';

import {
  GQLItemType,
  GQLUserItem,
  useGQLGetMoreInfoForItemsQuery,
  useGQLGetUserItemsQuery,
} from '../../../../../../graphql/generated';
import { getFieldValueForRole } from '../../../../../../utils/itemUtils';
import {
  ManualReviewJobAction,
  ManualReviewJobEnqueuedActionData,
} from '../../ManualReviewJobReview';
import FieldsComponent from '../ManualReviewJobFieldsComponent';
import ManualReviewJobMagnifyImageComponent from '../ManualReviewJobMagnifyImageComponent';
import ManualReviewJobEnqueueRelatedActionWithPoliciesButton from '../related_actions/ManualReviewJobEnqueueRelatedActionWithPoliciesButton';
import ManualReviewJobLatestSubmissionsWithThreadComponent from './ManualReviewJobLatestSubmissionsWithThreadComponent';
import { convertRelatedItemToFieldData } from './ManualReviewJobUserUtils';

gql`
  query OrgData {
    myOrg {
      id
      name
    }
  }

  query getMoreInfoForItems($ids: [ItemIdentifierInput!]!) {
    partialItems(input: $ids) {
      ... on PartialItemsSuccessResponse {
        items {
          ... on UserItem {
            id
            submissionId
            type {
              baseFields {
                name
                type
                required
                container {
                  containerType
                  keyScalarType
                  valueScalarType
                }
              }
              schemaFieldRoles {
                displayName
                createdAt
                profileIcon
                backgroundImage
              }
              id
            }
            data
            userScore
          }
        }
      }
      ... on PartialItemsMissingEndpointError {
        title
        status
        type
      }
      ... on PartialItemsEndpointResponseError {
        title
        status
        type
      }
      ... on PartialItemsInvalidResponseError {
        title
        status
        type
      }
    }
  }
  query getUserItems($itemIdentifiers: [ItemIdentifierInput!]!) {
    latestItemSubmissions(itemIdentifiers: $itemIdentifiers) {
      ... on UserItem {
        id
        submissionId
        submissionTime
        data
        type {
          id
          name
          baseFields {
            name
            type
            required
            container {
              containerType
              keyScalarType
              valueScalarType
            }
          }
          schemaFieldRoles {
            displayName
            createdAt
            profileIcon
            backgroundImage
          }
        }
      }
    }
  }
`;

const SeeMoreInfoSection = (props: {
  expanded: boolean;
  loading: boolean;
  errorMessage?: string;
}) => {
  const { expanded, loading, errorMessage } = props;

  if (expanded) {
    return null;
  } else if (loading) {
    return <LoadingOutlined spin className="self-start" />;
  } else if (errorMessage) {
    return <div className="self-start text-red-500">{errorMessage}</div>;
  }
  return <div className="self-start">No user information found</div>;
};

export default function ManualReviewJobRelatedUserComponent(props: {
  user: RelatedItem;
  reportedUserIdentifier?: ItemIdentifier;
  title?: string | undefined;
  allItemTypes: readonly GQLItemType[];
  allActions: readonly Pick<
    ManualReviewJobAction,
    '__typename' | 'itemTypes' | 'name' | 'id' | 'penalty'
  >[];
  relatedActions: readonly ManualReviewJobEnqueuedActionData[];
  allPolicies: readonly { id: string; name: string }[];
  onEnqueueAction: (action: ManualReviewJobEnqueuedActionData) => void;
  unblurAllMedia: boolean;
  setSelectedUser: (user: RelatedItem) => void;
  isReporter?: boolean;
  isActionable?: boolean;
  requirePolicySelectionToEnqueueAction: boolean;
  allowMoreThanOnePolicySelection: boolean;
}) {
  const {
    user,
    reportedUserIdentifier,
    title,
    allActions,
    allItemTypes,
    relatedActions,
    allPolicies,
    onEnqueueAction,
    unblurAllMedia,
    setSelectedUser,
    isReporter = false,
    isActionable = true,
    requirePolicySelectionToEnqueueAction = false,
    allowMoreThanOnePolicySelection,
  } = props;

  const {
    loading: moreInfoLoading,
    error: moreInfoError,
    data: moreInfoData,
  } = useGQLGetMoreInfoForItemsQuery({
    variables: {
      ids: [{ id: user.id, typeId: user.typeId }],
    },
  });
  const { data: userItemData, loading: userItemLoading } =
    useGQLGetUserItemsQuery({
      variables: {
        itemIdentifiers: [{ id: user.id, typeId: user.typeId }],
      },
    });

  const moreInfo =
    moreInfoData?.partialItems.__typename === 'PartialItemsSuccessResponse' &&
    moreInfoData.partialItems.items[0].__typename === 'UserItem'
      ? moreInfoData.partialItems.items[0]
      : userItemData?.latestItemSubmissions[0]?.__typename === 'UserItem'
      ? userItemData.latestItemSubmissions[0]
      : undefined;

  const userItem = userItemData?.latestItemSubmissions?.find(
    (it) => it.__typename === 'UserItem',
  ) as GQLUserItem | undefined;

  // Prioritize the Item Investigation Service data over the partial items endpoint
  const userSubmission = userItem ?? moreInfo;

  const userType = allItemTypes.find((itemType) => user.typeId === itemType.id);
  if (!userType || userType.__typename !== 'UserItemType') {
    throw Error(
      'Item type is required to be a user item type but somehow is not a user item type',
    );
  }

  const userSubmissionItems = (() => {
    if (userSubmission && userSubmission.__typename === 'UserItem') {
      return userType.baseFields
        .filter(
          (it) =>
            it.name !== userType.schemaFieldRoles['profileIcon'] &&
            it.name !== userType.schemaFieldRoles['displayName'],
        )
        .map(
          (itemTypeField) =>
            ({
              ...itemTypeField,
              value: userSubmission.data[itemTypeField.name],
            }) as ItemTypeFieldFieldData,
        );
    }
  })();

  const [userProfileIconUrl, userBackgroundImageUrl] = moreInfo
    ? [
        getFieldValueForRole(
          { type: userType, data: moreInfo.data },
          'profileIcon',
        )?.url,
        getFieldValueForRole(
          { type: userType, data: moreInfo.data },
          'backgroundImage',
        )?.url,
      ]
    : [undefined, undefined];
  const userName =
    user.name ??
    (moreInfo
      ? getFieldValueForRole(
          { type: userType, data: moreInfo.data },
          'displayName',
        )
      : null) ??
    `User ${user.id}`;

  return (
    <div className="flex flex-col items-start justify-start w-full mt-8">
      {title ? (
        <div className="flex flex-col w-full">
          <div className="text-lg font-semibold text-start">{title}</div>
          <div className="my-6 divider" />
        </div>
      ) : null}
      <div className="flex flex-col items-start w-full">
        <div className="flex flex-row items-center justify-between w-full py-2 pb-4 gap-10">
          <div className="flex items-center gap-4">
            <ManualReviewJobMagnifyImageComponent
              itemIdentifier={{
                id: user.id,
                typeId: user.typeId,
              }}
              imageUrl={userProfileIconUrl}
              magnifiedUrls={
                userBackgroundImageUrl ? [userBackgroundImageUrl] : []
              }
              label={userName}
              fallbackComponent={
                <UserAlt4 className="p-3 fill-slate-500 w-11" />
              }
            />
            {isReporter ? (
              <div className="flex px-2 py-1 text-xs font-medium text-white rounded gap-1 bg-coop-success-green h-fit">
                Reporter
              </div>
            ) : null}
          </div>
          {!isActionable ? null : (
            <div className="flex flex-row flex-wrap items-center pt-2 gap-1.5">
              {[...allActions]
                .filter((action) =>
                  action.itemTypes.some(
                    (itemType) => itemType.id === user.typeId,
                  ),
                )
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((action) => (
                  <ManualReviewJobEnqueueRelatedActionWithPoliciesButton
                    key={action.id}
                    actionName={action.name}
                    allPolicies={allPolicies}
                    selectedPolicyIds={
                      relatedActions
                        .find(
                          (relatedAction) =>
                            relatedAction.target.identifier.itemId ===
                              user.id && relatedAction.action.id === action.id,
                        )
                        ?.policies.map((policy) => policy.id) ?? []
                    }
                    onChangeSelectedPolicies={(selectedPolicyIds) =>
                      onEnqueueAction({
                        action,
                        policies: allPolicies.filter((policy) =>
                          arrayFromArrayOrSingleItem(
                            selectedPolicyIds,
                          ).includes(policy.id),
                        ),
                        target: {
                          identifier: {
                            itemId: user.id,
                            itemTypeId: user.typeId,
                          },
                          displayName: user.name ?? user.id,
                        },
                      })
                    }
                    requirePolicySelection={
                      requirePolicySelectionToEnqueueAction
                    }
                    allowMoreThanOnePolicySelection={
                      allowMoreThanOnePolicySelection
                    }
                  />
                ))}
            </div>
          )}
        </div>
        <div className="flex flex-col self-stretch p-4 mb-2 border border-gray-200 border-solid rounded-md">
          <div className="flex justify-start w-full">
            <FieldsComponent
              fields={[
                ...convertRelatedItemToFieldData(user, userItem?.userScore),
                ...(userSubmissionItems ?? []),
              ]}
              itemTypeId={user.typeId}
              options={{
                maxHeightImage: 300,
                maxHeightVideo: 300,
                unblurAllMedia,
              }}
            />
          </div>
          {userSubmission === undefined && !userItemLoading ? (
            <SeeMoreInfoSection
              expanded={moreInfo != null}
              loading={moreInfoLoading}
              errorMessage={
                moreInfoError != null
                  ? 'Error Fetching Data'
                  : moreInfo != null && isEmpty(moreInfo?.data)
                  ? 'No info returned'
                  : undefined
              }
            />
          ) : undefined}
        </div>
        <div className="my-6 w-full">
          <ItemActionHistory
            itemIdentifier={{
              id: user.id,
              typeId: user.typeId,
            }}
          />
        </div>
        <ManualReviewJobLatestSubmissionsWithThreadComponent
          userIdentifier={{ id: user.id, typeId: user.typeId }}
          reportedUserIdentifier={reportedUserIdentifier}
          unblurAllMedia={unblurAllMedia}
          setRelatedUser={setSelectedUser}
          allItemTypes={allItemTypes}
          allActions={allActions}
          allPolicies={allPolicies}
          relatedActions={relatedActions}
          onEnqueueActions={(actions) =>
            actions.map((it) => onEnqueueAction(it))
          }
          isActionable={isActionable}
          requirePolicySelectionToEnqueueAction={
            requirePolicySelectionToEnqueueAction
          }
          allowMoreThanOnePolicySelection={allowMoreThanOnePolicySelection}
        />
      </div>
    </div>
  );
}
