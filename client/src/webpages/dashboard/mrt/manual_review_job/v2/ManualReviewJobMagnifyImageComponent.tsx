import { ItemIdentifier } from '@roostorg/types';
import { Popover } from 'antd';
import { useContext, useMemo } from 'react';

import { useGQLGetMoreInfoForPartialItemsQuery } from '../../../../../graphql/generated';
import { getFieldValueForRole } from '../../../../../utils/itemUtils';
import { assertUnreachable } from '../../../../../utils/misc';
import { getSeverityColor } from '../../../../../utils/userPenalty';
import { ManualReviewActionStore } from './ManualReviewJobRelatedActionsStore';

// The purpose of this component is to display an image, and then when the user
// hovers over it, display the image magnified, along with any other images
// associated with that object, and an optional footer component for added
// functionality. This function also requires a fallback component in case the
// image url is undefined. In the following comment, when we say 'base
// component', what we're referring to is the component as it's rendered when
// the user is not hovering.
export default function ManualReviewJobMagnifyImageComponent(props: {
  // The image to display in the base component
  imageUrl: string | undefined;
  // ID of the item that this image is associated with, used to select border
  // and fetch additional info about the item
  itemIdentifier: ItemIdentifier;
  // Optional label to display next to the image in the base component
  label?: string;
  // Optional sublabel to display under the label in the base component
  sublabel?: string;
  // Fallback in case the image url is invalid or fails to load
  fallbackComponent: JSX.Element;
  // Additional image urls to show in a row with the base image when hovering
  magnifiedUrls?: string[];
  // This is an optional component to display under the row of images when hovering
  footerComponent?: JSX.Element;
  // color in some circumstances (like MRT)
  labelTruncationType?: 'truncate' | 'wrap';
}) {
  const {
    imageUrl,
    label,
    sublabel,
    fallbackComponent,
    magnifiedUrls,
    footerComponent,
    itemIdentifier,
    labelTruncationType,
  } = props;

  const { data } = useGQLGetMoreInfoForPartialItemsQuery({
    variables: { ids: [itemIdentifier] },
    skip: imageUrl != null,
  });

  const actionStore = useContext(ManualReviewActionStore);

  const borderAndTextColor = ((actions) => {
    if (!itemIdentifier) {
      return null;
    }

    const actionSeverities = actions
      .filter((it) => it.itemId === itemIdentifier.id)
      .map((it) => it.action.penalty)
      .sort()
      .reverse();

    return actionSeverities.length > 0
      ? getSeverityColor(actionSeverities[0])
      : null;
  })(actionStore?.actions ?? []);

  const finalImageUrl = useMemo(() => {
    if (
      data &&
      data.partialItems.__typename === 'PartialItemsSuccessResponse' &&
      data.partialItems.items.length > 0
    ) {
      const item = data.partialItems.items[0];

      switch (item.__typename) {
        case 'UserItem':
          {
            const profileIcon = getFieldValueForRole(item, 'profileIcon');
            if (profileIcon) {
              return profileIcon.url;
            }
          }
          break;
        case 'ContentItem':
        case 'ThreadItem':
          break;
        default:
          assertUnreachable(item);
      }
    }

    return imageUrl;
  }, [data, imageUrl]);

  // If we have no data and nothing to show on hover, then we just render the
  // fallback component
  if (
    finalImageUrl == null &&
    !magnifiedUrls?.length &&
    footerComponent == null
  ) {
    return (
      <div className="flex flex-row items-center gap-2">
        <div
          className={`flex border-solid rounded-full ${
            borderAndTextColor
              ? `${borderAndTextColor} border-2`
              : 'border-slate-500 border'
          }`}
        >
          {fallbackComponent}
        </div>
        {label ? (
          <div
            className={`ml-3 font-medium ${
              labelTruncationType === 'wrap' ? 'overflow-auto' : 'truncate'
            }`}
          >
            {label}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <Popover
      trigger="hover"
      placement="bottomLeft"
      content={
        <div className="flex flex-col">
          {finalImageUrl ? (
            <div className="flex flex-row items-start justify-between font-semibold space-x-2 text-slate-500">
              <div className="flex flex-col items-start justify-start h-full gap-1">
                Profile Picture
                <img
                  alt="profile pic"
                  className="w-auto h-auto max-w-sm rounded max-h-96"
                  src={finalImageUrl}
                />
              </div>
              {magnifiedUrls?.length ? (
                <div className="flex flex-col items-start justify-start h-full gap-1">
                  Other Images
                  {magnifiedUrls.map((url) => (
                    <img
                      alt=""
                      className="w-auto h-auto max-w-sm rounded max-h-96"
                      key={url}
                      src={url}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          {footerComponent}
        </div>
      }
    >
      <div className="flex flex-row items-center cursor-pointer flex-nowrap">
        {finalImageUrl ? (
          <img
            alt=""
            className={`rounded-full ${
              borderAndTextColor
                ? `p-0.5 border-2 border-solid ${borderAndTextColor} w-12 h-12`
                : 'border-current w-12 h-12'
            }`}
            src={finalImageUrl}
          />
        ) : (
          <div
            className={`flex border border-solid rounded-full ${
              borderAndTextColor ?? 'border-slate-500'
            }`}
          >
            {fallbackComponent}
          </div>
        )}
        {label ? (
          <div className="flex flex-col">
            <div
              className={`ml-2 truncate font-medium ${
                borderAndTextColor ?? 'text-slate-500'
              }`}
            >
              {label}
            </div>
            {sublabel ? (
              <div className="ml-2 text-xs truncate">{sublabel}</div>
            ) : null}
          </div>
        ) : null}
      </div>
    </Popover>
  );
}
