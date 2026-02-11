import { ReactComponent as UserAlt4 } from '@/icons/lni/User/user-alt-4.svg';
import type { ItemTypeFieldFieldData } from '@/webpages/dashboard/item_types/itemTypeUtils';
import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  DownOutlined,
  InfoCircleOutlined,
  UpOutlined,
} from '@ant-design/icons';
import { isContainerType, isMediaType, ScalarTypes } from '@roostorg/types';
import { Popover } from 'antd';
import { useEffect, useState } from 'react';
import { JsonObject } from 'type-fest';

import FullScreenLoading from '../../../../../../components/common/FullScreenLoading';

import {
  GQLNcmecFileAnnotation,
  GQLNcmecIndustryClassification,
  GQLThreadItem,
  GQLUserItemType,
} from '../../../../../../graphql/generated';
import { getFieldValueForRole } from '../../../../../../utils/itemUtils';
import FieldsComponent from '../ManualReviewJobFieldsComponent';
import ManualReviewJobMagnifyImageComponent from '../ManualReviewJobMagnifyImageComponent';
import NCMECLabelSelector from './NCMECLabelSelector';
import NCMECMediaViewer from './NCMECMediaViewer';
import {
  getMatchedBanksForMediaUrl,
  NCMECCategory,
  NCMECMediaIdentifier,
  NCMECMediaQueryResult,
  NCMECMediaState,
  NCMECUrlInfo,
} from './NCMECReviewUser';
import NCMECSelectCategory from './NCMECSelectCategory';

type ManualReviewToolUser = {
  id: string;
  type: Pick<GQLUserItemType, 'id' | 'baseFields' | 'schemaFieldRoles'>;
  data: JsonObject;
};

export default function NCMECInspectedMedia(props: {
  orgId: string;
  mediaId: NCMECMediaIdentifier;
  fullNcmecContentItem: NCMECMediaQueryResult & { urlInfo: NCMECUrlInfo };
  state: NCMECMediaState | undefined;
  user: ManualReviewToolUser;
  isSelected: boolean;
  addLabel: (
    mediaId: NCMECMediaIdentifier,
    label: GQLNcmecFileAnnotation,
  ) => void;
  removeLabel: (
    mediaId: NCMECMediaIdentifier,
    label: GQLNcmecFileAnnotation,
  ) => void;
  updateSelectedCategory: (
    mediaId: NCMECMediaIdentifier,
    category: NCMECCategory | undefined,
  ) => void;
  goToNextMedia: () => void;
  goToPreviousMedia: () => void;
  index: number;
  totalLength: number;
  disableKeyboardShortcuts: boolean;
  shouldBlurAll: boolean;
  onMediaError: (mediaId: NCMECMediaIdentifier) => void;
  isLabelSelectorInInspectedMediaVisible: boolean;
  setIsLabelSelectorInInspectedMediaVisible: (isVisible: boolean) => void;
  // Technically this type should be narrower
  threadId?: string;
  threadInfo?: GQLThreadItem;
  threadLoading?: boolean;
}) {
  const {
    mediaId,
    fullNcmecContentItem,
    user,
    state,
    isSelected,
    addLabel,
    removeLabel,
    updateSelectedCategory,
    goToNextMedia,
    goToPreviousMedia,
    index,
    totalLength,
    disableKeyboardShortcuts,
    shouldBlurAll,
    onMediaError,
    isLabelSelectorInInspectedMediaVisible,
    setIsLabelSelectorInInspectedMediaVisible,
    threadInfo,
    threadLoading,
    threadId,
  } = props;

  const [userInfoVisible, setUserInfoVisible] = useState(false);

  const fieldData = fullNcmecContentItem.contentItem.type.baseFields.map(
    (itemTypeField) =>
      ({
        ...itemTypeField,
        value: fullNcmecContentItem.contentItem.data[itemTypeField.name],
      }) as ItemTypeFieldFieldData,
  );

  const displayNameKey = user.type.schemaFieldRoles['displayName'];
  const profileIconKey = user.type.schemaFieldRoles['profileIcon'];

  const displayName = getFieldValueForRole(user, 'displayName');
  const profilePicUrl = getFieldValueForRole(user, 'profileIcon');
  const backgroundImageUrl = getFieldValueForRole(user, 'backgroundImage');

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (disableKeyboardShortcuts || isLabelSelectorInInspectedMediaVisible) {
        return;
      }
      const currentCategory = state?.category;
      const newCategory = (() => {
        switch (event.key) {
          case 'j':
            return GQLNcmecIndustryClassification.A1;
          case 'k':
            return GQLNcmecIndustryClassification.A2;
          case 'l':
            return GQLNcmecIndustryClassification.B1;
          case ';':
            return GQLNcmecIndustryClassification.B2;
          case 'n':
            return 'None';
          default:
            return;
        }
      })();
      if (!newCategory) {
        return;
      }
      if (currentCategory === newCategory) {
        // Deselect category
        updateSelectedCategory(mediaId, undefined);
      } else {
        updateSelectedCategory(mediaId, newCategory);
      }
    };

    // Add the event listener when the component mounts
    window.addEventListener('keydown', handleKeyPress);

    // Remove the event listener when the component unmounts
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mediaId,
    state?.category,
    disableKeyboardShortcuts,
    isLabelSelectorInInspectedMediaVisible,
  ]);

  const divider = <div className="my-2 divider" />;

  const navigationButtons = (
    <div className="flex items-center justify-between w-full mb-3">
      <div
        className={`cursor-pointer py-1 px-3 rounded border border-solid ${index === 0
            ? 'text-slate-300 border-slate-100'
            : 'text-coop-blue border-coop-blue hover:border-coop-blue hover:bg-coop-lightblue'
          }`}
        onClick={goToPreviousMedia}
      >
        <ArrowLeftOutlined className="pr-1 text-xs" /> Previous
      </div>
      <div className="text-sm text-slate-500">{`${index + 1
        } / ${totalLength}`}</div>
      <div
        className={`cursor-pointer py-1 px-3 rounded border border-solid ${index === totalLength - 1
            ? 'text-slate-300 border-slate-100'
            : 'text-coop-blue border-coop-blue hover:border-coop-blue hover:bg-coop-lightblue'
          }`}
        onClick={goToNextMedia}
      >
        Next <ArrowRightOutlined className="pl-1 text-xs" />
      </div>
    </div>
  );
  const threadInfoFields = threadInfo
    ? threadInfo.type.baseFields
      .map(
        (itemTypeField) =>
          ({
            ...itemTypeField,
            value: threadInfo.data[itemTypeField.name],
          }) as ItemTypeFieldFieldData,
      )
      .filter((field) => {
        return isContainerType(field.type)
          ? !isMediaType(field.container!.valueScalarType) &&
          field.container!.valueScalarType !== ScalarTypes.RELATED_ITEM &&
          threadInfo.data[field.name] !== undefined
          : !isMediaType(field.type) &&
          field.type !== ScalarTypes.RELATED_ITEM &&
          threadInfo.data[field.name] !== undefined;
      })
    : [];
  const threadComponent = (() => {
    if (threadLoading) {
      return <FullScreenLoading />;
    }
    if (threadInfoFields.length > 0 && threadInfo) {
      return (
        <div className="flex flex-col gap-1.5">
          <div className="text-base font-bold pb-0.5">
            {threadInfo.type.name} Info{threadId ? ` (${threadId})` : ''}
          </div>
          <div className="p-2 bg-white border border-gray-200 border-solid rounded-md">
            <FieldsComponent
              fields={threadInfoFields}
              itemTypeId={threadInfo.type.id}
            />
          </div>
        </div>
      );
    }
    if (threadId) {
      return (
        <div className="text-base font-bold pb-0.5">Thread Id: {threadId}</div>
      );
    }
    return undefined;
  })();
  return (
    <div className="flex justify-between w-full">
      <div className="flex flex-row w-full p-3 border border-gray-200 border-solid gap-6 rounded-md">
        <div className="max-w-[60%] grow">
          <div className="flex flex-col w-fit">
            {navigationButtons}
            <NCMECMediaViewer
              mediaId={mediaId}
              index={index}
              state={state}
              options={{
                isSelected,
                isInInspectedView: true,
                grayOutThumbnail: false,
                isConfirmedCsam: fullNcmecContentItem.isConfirmedCSAM,
              }}
              addLabel={addLabel}
              removeLabel={removeLabel}
              updateSelectedCategory={updateSelectedCategory}
              shouldBlur={shouldBlurAll}
              onMediaError={onMediaError}
            />
          </div>
        </div>
        <div className="flex flex-col flex-shrink w-2/5 mt-0 gap-2 text-start">
          <div className="flex flex-col justify-between w-full">
            <div className="flex flex-col w-full mb-2 text-start">
              <div className="flex gap-3">
                <div>Category</div>
                <Popover
                  content={
                    <div className="flex flex-col">
                      <div>"j" = A1</div>
                      <div>"k" = A2</div>
                      <div>"l" = B1</div>
                      <div>";" (semicolon) = B2</div>
                      <div>"n" = None</div>
                    </div>
                  }
                  title={'Keyboard shortcuts'}
                >
                  <InfoCircleOutlined className="!flex items-center justify-center !text-slate-500" />
                </Popover>
              </div>
              <NCMECSelectCategory
                selectedCategory={state?.category}
                onUpdateCategory={updateSelectedCategory.bind(null, mediaId)}
              />
            </div>
            <div className="flex flex-col w-full gap-2 text-start">
              Labels
              <NCMECLabelSelector
                key={`${state?.itemId}.${state?.urlInfo.url}`}
                disabled={state?.category == null || state.category === 'None'}
                value={state?.labels}
                addLabel={addLabel.bind(null, mediaId)}
                removeLabel={removeLabel.bind(null, mediaId)}
                setIsOpen={setIsLabelSelectorInInspectedMediaVisible}
              />
            </div>
            {(() => {
              const matchedBanks = getMatchedBanksForMediaUrl(
                fullNcmecContentItem.contentItem,
                mediaId.urlInfo.url,
              );
              if (matchedBanks.length === 0) return null;
              return (
                <>
                  {divider}
                  <div className="flex flex-col w-full gap-2 text-start">
                    <div className="text-base font-bold pb-0.5">Matched</div>
                    <div className="w-full px-3 py-2 text-sm border border-gray-200 border-solid rounded-md bg-white min-h-[32px] flex items-center">
                      [ {matchedBanks.join(', ')} ]
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
          {divider}
          <div className="text-base font-bold pb-0.5">Media Info</div>
          <div className="p-2 bg-white border border-gray-200 border-solid rounded-md">
            <FieldsComponent
              fields={fieldData.filter((field) => {
                return isContainerType(field.type)
                  ? !isMediaType(field.container!.valueScalarType) &&
                  field.container!.valueScalarType !==
                  ScalarTypes.RELATED_ITEM
                  : !isMediaType(field.type) &&
                  field.type !== ScalarTypes.RELATED_ITEM;
              })}
              itemTypeId={fullNcmecContentItem.contentItem.type.id}
            />
          </div>
          {divider}
          {threadComponent ? (
            <div className="flex flex-col gap-2">
              {threadComponent}
              {divider}
            </div>
          ) : undefined}
          <div className="pb-2 text-base font-bold text-start">User</div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <ManualReviewJobMagnifyImageComponent
              itemIdentifier={{ id: user.id, typeId: user.type.id }}
              imageUrl={profilePicUrl?.url}
              label={displayName ? `${displayName} (${user.id})` : user.id}
              fallbackComponent={
                <UserAlt4 className="p-3 fill-slate-500 w-11" />
              }
              magnifiedUrls={backgroundImageUrl ? [backgroundImageUrl.url] : []}
            />
            <div
              className="w-full font-medium cursor-pointer text-slate-500"
              onClick={() => setUserInfoVisible(!userInfoVisible)}
            >
              {userInfoVisible ? 'Hide' : 'See'} user info
              {userInfoVisible ? (
                <UpOutlined className="text-xs pl-1.5" />
              ) : (
                <DownOutlined className="text-xs pl-1.5" />
              )}
            </div>
          </div>
          {userInfoVisible ? (
            <div className="flex-shrink p-2 overflow-hidden bg-white border border-gray-200 border-solid">
              <FieldsComponent
                fields={user.type.baseFields
                  .filter(
                    (field) =>
                      field.name !== displayNameKey &&
                      field.name !== profileIconKey &&
                      field.type !== 'RELATED_ITEM',
                  )
                  .map(
                    (field) =>
                      ({
                        ...field,
                        value: user.data[field.name],
                      }) as ItemTypeFieldFieldData,
                  )}
                itemTypeId={user.type.id}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
