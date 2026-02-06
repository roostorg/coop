import { useEffect, useMemo } from 'react';
import { JsonObject } from 'type-fest';

import FormSectionHeader from '../components/FormSectionHeader';

import {
  GQLContentItemType,
  GQLItemType,
  GQLUserItem,
  useGQLGetUserItemsLazyQuery,
  useGQLInvestigationItemsLazyQuery,
  useGQLInvestigationItemsQuery,
  type GQLContentSchemaFieldRoles,
  type GQLThreadItemType,
} from '../../../graphql/generated';
import {
  getFieldValueForRole,
  getFieldValueOrValues,
} from '../../../utils/itemUtils';
import { ReadonlyDeep } from '../../../utils/typescript-types';
import type { ItemTypeFieldFieldData } from '../item_types/itemTypeUtils';
import ItemActionHistory from '../items/ItemActionHistory';
import IframeContentDisplayComponent from '../mrt/manual_review_job/IframeContentDisplayComponent';
import FieldsComponent from '../mrt/manual_review_job/v2/ManualReviewJobFieldsComponent';
import { findFirstIframeUrl } from '../../../utils/contentUrlUtils';

export default function ItemInvestigationSummary(props: {
  item: {
    id: string;
    data: JsonObject;
    itemType: Omit<
      GQLContentItemType | GQLThreadItemType,
      'derivedFields' | 'hiddenFields'
    >;
    submissionTime: string | undefined;
  };
  rules: Readonly<ReadonlyDeep<{ id: string; actions: { name: string }[] }>[]>;
  itemTypes: readonly Omit<GQLItemType, 'derivedFields'>[];
}) {
  const { item, itemTypes } = props;

  const { data: itemHistoryData } = useGQLInvestigationItemsQuery({
    variables: {
      itemIdentifier: { id: item.id, typeId: item.itemType.id },
      submissionTime: item.submissionTime
        ? new Date(item.submissionTime).toISOString()
        : undefined,
    },
  });

  const [getItemHistory] = useGQLInvestigationItemsLazyQuery();

  const ruleExecutionsHistory =
    itemHistoryData?.itemWithHistory?.__typename === 'ItemHistoryResult'
      ? itemHistoryData.itemWithHistory.executions
      : undefined;

  const firstRuleExecution = ruleExecutionsHistory?.[0];

  const [getUserItem, { data: userItems, error: userDataError }] =
    useGQLGetUserItemsLazyQuery();

  const userItem = useMemo(() => {
    return userItems?.latestItemSubmissions.find(
      (it): it is GQLUserItem => it.__typename === 'UserItem',
    );
  }, [userItems?.latestItemSubmissions]);

  const userData = useMemo(() => {
    // First, see if the userItem has been fetched from GraphQL,
    // which may contain a submissionTime. userItem will only be nonnull if
    // userData has already been set, so this it will never be nonnull the first
    // time this function is called.
    if (userItem) {
      return {
        userIdentifier: {
          id: userItem.id,
          typeId: userItem.type.id,
        },
        submissionTime: userItem.submissionTime?.toString() ?? undefined,
      };
    }

    // Then, if the item is a Content item, we can try to get the creator ID
    // from the item itself
    const userIdentifier =
      item.itemType.__typename === 'ContentItemType'
        ? getFieldValueForRole<GQLContentSchemaFieldRoles, 'creatorId'>(
            {
              // Silencing linter because I'm not aware of another way to do
              // this, and it should be safe
              // eslint-disable-next-line custom-rules/no-casting-in-getFieldValueForRole
              type: item.itemType as Omit<
                GQLContentItemType,
                'derivedFields' | 'hiddenFields'
              >,
              data: item.data,
            },
            'creatorId',
          )
        : undefined;

    if (userIdentifier) {
      return {
        userIdentifier,
        submissionTime: undefined,
      };
    }

    if (!firstRuleExecution?.userId || !firstRuleExecution?.userTypeId) {
      return null;
    }

    return {
      userIdentifier: {
        id: firstRuleExecution.userId,
        typeId: firstRuleExecution.userTypeId,
      },
      submissionTime: undefined,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstRuleExecution?.userId, firstRuleExecution?.userTypeId, userItem]);

  useEffect(() => {
    if (userData) {
      getUserItem({
        variables: {
          itemIdentifiers: [userData.userIdentifier],
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstRuleExecution]);

  const userComponentTemplate = (label: string, value: string) => (
    <div className="flex items-center my-1">
      <div className="mr-2 font-semibold text-slate-700 shrink-0">
        {`${label}: `}
      </div>
      {userData ? (
        <div
          className="font-bold underline cursor-pointer text-coop-blue hover:text-coop-blue-hover focus:text-coop-blue"
          onClick={async () =>
            getItemHistory({
              variables: {
                itemIdentifier: userData.userIdentifier,
                submissionTime: userData.submissionTime
                  ? new Date(userData.submissionTime).toISOString()
                  : undefined,
              },
            })
          }
        >
          {value.length > 40 ? `${value.slice(0, 40)}...` : value}
        </div>
      ) : null}
    </div>
  );

  const userComponent = (() => {
    const userId = userData?.userIdentifier.id;
    if (!userId) {
      return null;
    }

    const fallbackComponent = userComponentTemplate('User ID', userId);

    if (
      userDataError ||
      !userItems ||
      userItems.latestItemSubmissions.length === 0 ||
      !userItems.latestItemSubmissions.some(
        (it) => it.__typename === 'UserItem',
      )
    ) {
      return fallbackComponent;
    }

    const userItemType = itemTypes?.find((it) => it.id === userItem?.type.id);

    if (
      !userItem ||
      !userItemType ||
      userItemType.__typename !== 'UserItemType'
    ) {
      return fallbackComponent;
    }

    const userName = getFieldValueForRole(
      { type: userItemType, data: userItem.data },
      'displayName',
    );

    if (!userName) {
      return fallbackComponent;
    }

    return userComponentTemplate('User Name', userName);
  })();

  const contentComponent = (() => {
    const fieldData = item.itemType.baseFields.map(
      (itemTypeField) =>
        ({
          ...itemTypeField,
          value: item.data[itemTypeField.name],
        }) as ItemTypeFieldFieldData,
    );

    return (
      <FieldsComponent
        fields={fieldData}
        itemTypeId={item.itemType.id}
        options={{ maxHeightImage: 300, maxHeightVideo: 300 }}
      />
    );
  })();

  const urlFields = item.itemType.baseFields.filter((it) => it.type === 'URL');
  const urls = urlFields.map((urlField) =>
    getFieldValueOrValues(item.data, urlField),
  );
  const firstIframeUrl = findFirstIframeUrl(urls);

  return (
    <div className="flex flex-col items-start justify-start w-full">
      <div className="my-6 divider" />
      <div className="flex flex-row w-full">
        <div className="flex flex-col items-start justify-start w-auto text-start">
          <FormSectionHeader title={`${item.itemType.name} Summary`} />
          <div className="flex flex-col items-start justify-center w-full p-0">
            {item.data ? (
              <div className="w-full mt-2">{contentComponent}</div>
            ) : null}
          </div>
          <div className="flex items-center my-1 mt-4">
            <div className="mr-2 font-semibold text-slate-700 shrink-0">
              Item Type:{' '}
            </div>
            {item.itemType.name}
          </div>
          {item.submissionTime && (
            <div className="flex items-center my-1">
              <div className="mr-2 font-semibold text-slate-700 shrink-0">
                Date Received:{' '}
              </div>
              {new Date(item.submissionTime).toLocaleDateString() +
                ' ' +
                new Date(item.submissionTime).toLocaleTimeString()}
            </div>
          )}
          {userComponent}
          {firstIframeUrl &&
          'type' in firstIframeUrl &&
          firstIframeUrl.type === 'URL' ? (
            <div className="w-full">
              <IframeContentDisplayComponent contentUrl={firstIframeUrl?.value} />
            </div>
          ) : null}
          <div className="my-6">
            <ItemActionHistory
              itemIdentifier={{ id: item.id, typeId: item.itemType.id }}
              submissionTime={item.submissionTime}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
