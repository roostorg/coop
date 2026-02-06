import { gql } from '@apollo/client';
import { ItemIdentifier } from '@roostorg/types';
import { Input } from 'antd';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import ComponentLoading from '../../../components/common/ComponentLoading';
import CoopButton from '../components/CoopButton';
import ItemAction from '@/components/ItemAction';

import {
  GQLItemHistoryResult,
  GQLItemType,
  GQLThreadItem,
  GQLUserItem,
  useGQLGetItemsWithIdLazyQuery,
  useGQLGetOrgDataQuery,
} from '../../../graphql/generated';
import { filterNullOrUndefined } from '../../../utils/collections';
import { __throw } from '../../../utils/misc';
import ManualReviewJobPrimaryUserComponent from '../mrt/manual_review_job/v2/user/ManualReviewJobPrimaryUserComponent';
import { ITEM_TYPE_FRAGMENT } from '../rules/rule_form/RuleForm';
import ItemInvestigationRuleResults from './ItemInvestigationRuleResults';
import ItemInvestigationSummary from './ItemInvestigationSummary';
import ThreadInvestigation from './ThreadInvestigation';

export type RuleExecutionHistory = GQLItemHistoryResult['executions'][0];

gql`
  ${ITEM_TYPE_FRAGMENT}
  query GetOrgData {
    myOrg {
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
      }
      itemTypes {
        ...ItemTypeFragment
      }
      policies {
        id
        name
        parentId
      }
      rules {
        id
        actions {
          ... on ActionBase {
            id
            name
          }
        }
      }
      requiresPolicyForDecisionsInMrt
      allowMultiplePoliciesPerAction
    }
  }

  query GetItemsWithId($id: ID!, $typeId: ID) {
    itemsWithId(itemId: $id, typeId: $typeId, returnFirstResultOnly: true) {
      latest {
        ... on ItemBase {
          id
          data
          submissionId
          submissionTime
          type {
            ... on ItemTypeBase {
              id
              name
              version
              schemaVariant
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
              ... on ContentItemType {
                schemaFieldRoles {
                  displayName
                  parentId
                  threadId
                  createdAt
                  creatorId
                }
              }
              ... on UserItemType {
                schemaFieldRoles {
                  displayName
                  createdAt
                  profileIcon
                }
              }
              ... on ThreadItemType {
                schemaFieldRoles {
                  displayName
                  createdAt
                  creatorId
                }
              }
            }
          }
        }
        ... on UserItem {
          userScore
        }
      }
    }
  }

  query InvestigationItems(
    $itemIdentifier: ItemIdentifierInput!
    $submissionTime: DateTime
  ) {
    itemWithHistory(
      itemIdentifier: $itemIdentifier
      submissionTime: $submissionTime
    ) {
      ... on ItemHistoryResult {
        item {
          ... on ItemBase {
            id
            submissionId
            type {
              ... on ItemTypeBase {
                id
              }
            }
          }
        }
        executions {
          date
          ts
          contentId
          itemTypeName
          itemTypeId
          userId
          userTypeId
          content
          environment
          passed
          ruleId
          ruleName
          policies
          tags
          result {
            conjunction
            conditions {
              ... on ConditionSetWithResult {
                conjunction
                conditions {
                  ... on LeafConditionWithResult {
                    ...LeafConditionWithResultFields
                  }
                }
                result {
                  outcome
                  score
                  matchedValue
                }
              }
              ... on LeafConditionWithResult {
                ...LeafConditionWithResultFields
              }
            }
            result {
              outcome
              score
              matchedValue
            }
          }
        }
      }
      ... on NotFoundError {
        title
      }
    }
  }
`;

function InvestigationError(props: { message: string }) {
  return (
    <div className="flex flex-col items-start">
      <div className="text-start">Error fetching results: {props.message}</div>
    </div>
  );
}

/**
 * This component is meant to be the main entry point for every item
 * investigation. It's designed so that our users don't need to supply an item
 * type (though of course they can when linked from elsewhere in the app). In
 * the case where there are multiple items with the same ID (but with different
 * item types), we will let the user choose which item they want to investigate.
 * In the case where only a single item is returned (which should be the
 * majority of the time), we will automatically select that item and show the
 * results of the investigation query.
 */
export default function ItemInvestigation(props: {
  itemId: string | undefined;
  itemTypeId: string | undefined;
  submissionTime: string | undefined;
}) {
  const {
    itemId: initialItemId,
    itemTypeId: initialItemTypeId,
    submissionTime: initialSubmissionTime,
  } = props;

  if (initialItemTypeId && !initialItemId) {
    throw Error('Cannot specify itemTypeId without itemId');
  }

  const navigate = useNavigate();

  const [itemId, setItemId] = useState<string | undefined>(initialItemId);
  const [selectedItem, setSelectedItem] = useState<
    (ItemIdentifier & { submissionTime?: string }) | undefined
  >(
    initialItemId && initialItemTypeId
      ? {
          id: initialItemId,
          typeId: initialItemTypeId,
          submissionTime: initialSubmissionTime,
        }
      : undefined,
  );

  const {
    data: orgData,
    loading: orgDataLoading,
    error: orgDataError,
  } = useGQLGetOrgDataQuery();
  const [
    getItemsForId,
    {
      error: itemsForIdError,
      loading: itemsForIdLoading,
      data: itemsForIdData,
    },
  ] = useGQLGetItemsWithIdLazyQuery();

  useEffect(() => {
    if (selectedItem) {
      // If we don't have a submission time, fetch the items with the given ID
      // so we can get the submission time for the latest item and feed it into
      // the item history query
      getItemsForId({
        variables: { id: selectedItem.id, typeId: selectedItem.typeId },
      });
      navigate(
        `/dashboard/manual_review/investigation/?id=${selectedItem.id}&typeId=${selectedItem.typeId}`,
        { replace: true },
      );
    }
  }, [getItemsForId, selectedItem, navigate]);

  const results = (() => {
    if (itemsForIdLoading) {
      return <ComponentLoading />;
    }

    if (orgDataError || itemsForIdError) {
      return (
        <InvestigationError
          message={
            /* The exclamation point is safe here because of the conditional
    above...unsure why the type system isn't narrowing the type */
            orgDataError ? orgDataError.message : itemsForIdError!.message
          }
        />
      );
    }
    if (!selectedItem && !itemsForIdLoading && !itemsForIdData) {
      return null;
    }

    const eligibleItemsResult = filterNullOrUndefined(
      itemsForIdData?.itemsWithId ?? [],
    );
    if (itemsForIdData && eligibleItemsResult.length === 0) {
      return <InvestigationError message="Item Not Found" />;
    }

    const eligibleItems = eligibleItemsResult.map((it) => it.latest) ?? [];

    if (eligibleItems.length === 0) {
      return <InvestigationError message="Item not found" />;
    }

    if (
      eligibleItems.length === 1 &&
      (eligibleItems[0].id !== selectedItem?.id ||
        eligibleItems[0].submissionTime?.toString() !==
          selectedItem?.submissionTime)
    ) {
      const { id, type, submissionTime } = eligibleItems[0];
      setSelectedItem({
        id,
        typeId: type.id,
        submissionTime: submissionTime?.toString(),
      });
      return null;
    }

    if (eligibleItems.length > 1 && !selectedItem) {
      const groupedItems = {
        Content: eligibleItems.filter((it) => it.__typename === 'ContentItem'),
        User: eligibleItems.filter((it) => it.__typename === 'UserItem'),
        Thread: eligibleItems.filter((it) => it.__typename === 'ThreadItem'),
      };

      return (
        <div className="flex flex-col items-start">
          {Object.entries(groupedItems)
            .filter(([_, value]) => value.length > 0)
            .map(([key, value]) => (
              <div className="text-xl font-bold text-start" key={key}>
                {key}
                {value.map((it) => (
                  <div
                    key={it.type.id}
                    className="flex flex-col p-2 my-4 border border-gray-200 border-solid rounded-lg cursor-pointer text-start"
                    onClick={() =>
                      setSelectedItem({
                        id: it.id,
                        typeId: it.type.id,
                        submissionTime: it.submissionTime?.toString(),
                      })
                    }
                  >
                    <div className="text-lg font-bold">{it.type.name}</div>
                  </div>
                ))}
              </div>
            ))}
        </div>
      );
    }

    const item = eligibleItems.find(
      (it) => it.id === selectedItem?.id && it.type.id === selectedItem.typeId,
    )!;

    const {
      itemTypes: allItemTypes,
      actions: allActions,
      policies: allPolicies,
      rules: allRules,
      requiresPolicyForDecisionsInMrt = false,
      allowMultiplePoliciesPerAction = false,
    } = orgData?.myOrg ?? {};

    switch (item.__typename) {
      case 'ContentItem':
        return (
          <div className="flex flex-col w-full mb-8">
            <ItemInvestigationSummary
              item={{
                id: item.id,
                data: item.data,
                itemType: item.type,
                submissionTime: item.submissionTime?.toString() ?? undefined,
              }}
              rules={allRules ?? []}
              itemTypes={allItemTypes as GQLItemType[]}
            />
            <ItemInvestigationRuleResults
              itemIdentifier={{ id: item.id, typeId: item.type.id }}
              submissionTime={item.submissionTime?.toString()}
              rules={allRules ?? []}
            />
          </div>
        );
      case 'UserItem':
        return (
          <div className="flex flex-col w-full mb-8">
            <ManualReviewJobPrimaryUserComponent
              user={
                item
                  ? (item as GQLUserItem)
                  : __throw(`User not found for item with ID ${itemId}`)
              }
              userScore={item.userScore ?? undefined}
              unblurAllMedia={false}
              allItemTypes={(allItemTypes as GQLItemType[] | undefined) ?? []}
              allActions={allActions ?? []}
              allPolicies={allPolicies ?? []}
              relatedActions={[]}
              onEnqueueActions={(action) => {}}
              isActionable={false}
              requirePolicySelectionToEnqueueAction={
                requiresPolicyForDecisionsInMrt
              }
              allowMoreThanOnePolicySelection={allowMultiplePoliciesPerAction}
            />
          </div>
        );
      case 'ThreadItem':
        return (
          <ThreadInvestigation
            threadItem={item as GQLThreadItem}
            rules={allRules ?? []}
            itemTypes={(allItemTypes as GQLItemType[] | undefined) ?? []}
            allActions={allActions ?? []}
            allPolicies={allPolicies ?? []}
            relatedActions={[]}
            onEnqueueActions={(action) => {}}
            isActionable={false}
            requirePolicySelectionToEnqueueAction={
              requiresPolicyForDecisionsInMrt
            }
            allowMoreThanOnePolicySelection={allowMultiplePoliciesPerAction}
          />
        );
    }
  })();

  return (
    <div className="flex flex-col items-start">
      <div className="w-4/5 mt-2 mb-6 text-start">
        Input an Item ID to see which Coop rules it matched against, why they
        matched, and what actions those rules applied to the item.
      </div>
      <div className="flex items-start justify-between w-full gap-4">
        <div className="flex flex-row items-end mb-6">
          <div className="flex flex-col items-start mr-2">
            <div className="mb-2 font-bold">Item ID</div>
            <Input
              className="!min-w-[300px]"
              value={itemId}
              onChange={(event) => setItemId(event.target.value.trim())}
              onKeyDown={(event) => {
                if (itemId && event.key === 'Enter') {
                  getItemsForId({ variables: { id: itemId } });
                  setSelectedItem(undefined);
                }
              }}
              placeholder="Enter an item ID"
            />
          </div>
          <CoopButton
            title="Search"
            size="small"
            loading={itemsForIdLoading}
            disabled={itemId == null || itemsForIdLoading || orgDataLoading}
            onClick={async () => {
              if (itemId) {
                getItemsForId({ variables: { id: itemId } });
                setSelectedItem(undefined);
              }
            }}
          />
        </div>
        {selectedItem ? <ItemAction itemIdentifier={selectedItem} /> : null}
      </div>
      {results}
    </div>
  );
}
