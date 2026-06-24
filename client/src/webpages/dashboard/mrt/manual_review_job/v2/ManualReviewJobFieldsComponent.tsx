import { getFieldValueForRole } from '@/utils/itemUtils';
import type { ItemTypeFieldFieldData } from '@/webpages/dashboard/item_types/itemTypeUtils';
import { DownOutlined } from '@ant-design/icons';
import { gql } from '@apollo/client';
import {
  isContainerField,
  isMediaType,
  ScalarType,
  ScalarTypeRuntimeType,
} from '@roostorg/coop-types';
import isPlainObject from 'lodash/isPlainObject';
import { useState } from 'react';
import ReactAudioPlayer from 'react-audio-player';
import { Link } from 'react-router-dom';

import ComponentLoading from '../../../../../components/common/ComponentLoading';

import {
  GQLContentItem,
  GQLContentSchemaFieldRoles,
  GQLItemType,
  GQLThreadItem,
  GQLThreadSchemaFieldRoles,
  GQLUserItem,
  GQLUserSchemaFieldRoles,
  useGQLGetRelatedItemsQuery,
  useGQLItemTypeHiddenFieldsQuery,
  useGQLPersonalSafetySettingsQuery,
} from '../../../../../graphql/generated';
import { __throw, assertUnreachable } from '../../../../../utils/misc';
import { toHumanReadableLabel } from '../../../../../utils/string';
import { parseDatetimeToReadableStringInCurrentTimeZone } from '../../../../../utils/time';
import ManualReviewJobContentBlurableImage from '../ManualReviewJobContentBlurableImage';
import ManualReviewJobContentBlurableVideo from '../ManualReviewJobContentBlurableVideo';
import { BlurStrength } from './ncmec/NCMECMediaViewer';

// Best-effort media-kind inference from a URL's file extension. Mirrors the
// server's `detectMediaKindFromUrl` so the review tool can still render a
// preview when a MEDIA value's `mediaType` is absent — e.g. items submitted
// before the field became MEDIA, or legacy data missing the resolved kind.
const MEDIA_EXTENSION_TO_KIND: Readonly<Record<string, ScalarType>> = {
  jpg: 'IMAGE',
  jpeg: 'IMAGE',
  png: 'IMAGE',
  gif: 'IMAGE',
  webp: 'IMAGE',
  bmp: 'IMAGE',
  svg: 'IMAGE',
  avif: 'IMAGE',
  heic: 'IMAGE',
  heif: 'IMAGE',
  tif: 'IMAGE',
  tiff: 'IMAGE',
  mp4: 'VIDEO',
  m4v: 'VIDEO',
  mov: 'VIDEO',
  webm: 'VIDEO',
  mkv: 'VIDEO',
  avi: 'VIDEO',
  flv: 'VIDEO',
  mp3: 'AUDIO',
  m4a: 'AUDIO',
  wav: 'AUDIO',
  aac: 'AUDIO',
  flac: 'AUDIO',
  opus: 'AUDIO',
  wma: 'AUDIO',
};

function inferMediaKindFromUrl(url: string): ScalarType | null {
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return null;
  }
  const dot = pathname.lastIndexOf('.');
  if (dot < 0 || dot === pathname.length - 1) return null;
  const ext = pathname.slice(dot + 1).toLowerCase();
  return MEDIA_EXTENSION_TO_KIND[ext] ?? null;
}

type FieldsComponentOptions = {
  hideLabels?: boolean;
  maxWidthImage?: number;
  maxHeightImage?: number;
  maxWidthVideo?: number;
  maxHeightVideo?: number;
  unblurAllMedia?: boolean;
  transparentBackground?: boolean;
};

gql`
  query ItemTypeHiddenFields {
    myOrg {
      itemTypes {
        ... on ItemTypeBase {
          id
          hiddenFields
        }
      }
    }
  }
`;

type TableRowComponentData = {
  [K in ScalarType]: {
    type: K;
    // Value can be undefined in the case of an optional field whose value was
    // not populated
    value: ScalarTypeRuntimeType<K> | undefined;
    label?: string;
  };
}[ScalarType];

function NotProvidedComponent() {
  return (
    <td className="flex flex-row pr-2 align-top text-start min-w-max">
      <div className="overflow-auto text-gray-400 text-start">
        Value not provided
      </div>
    </td>
  );
}

function ContentFieldLabelComponent(props: { data: ItemTypeFieldFieldData }) {
  const { data } = props;

  return (
    <div
      className={`mr-4 font-bold text-sm ${
        !data.required && data.value === undefined
          ? 'text-slate-300'
          : 'text-slate-500'
      }`}
    >
      {toHumanReadableLabel(data.name)}
    </div>
  );
}

function TableRowComponent(props: {
  data: TableRowComponentData;
  itemTypes: readonly ItemTypeFromHiddenFieldsQuery[];
  options?: FieldsComponentOptions;
}) {
  const { data, itemTypes, options } = props;
  const { type, label, value } = data;
  const {
    maxWidthImage,
    maxHeightImage,
    maxWidthVideo,
    maxHeightVideo,
    unblurAllMedia = false,
  } = options ?? {};

  const { data: safetyData } = useGQLPersonalSafetySettingsQuery();
  const safetySettings = safetyData?.me?.interfacePreferences;
  const relatedItemKind =
    type === 'RELATED_ITEM' && value
      ? itemTypes.find((itemType) => itemType.id === value.typeId)?.__typename
      : undefined;
  const { data: relatedItemData } = useGQLGetRelatedItemsQuery({
    variables: {
      itemIdentifiers: [
        {
          id: type === 'RELATED_ITEM' && value !== undefined ? value.id : '',
          typeId:
            type === 'RELATED_ITEM' && value !== undefined ? value.typeId : '',
        },
      ],
    },
    skip: type !== 'RELATED_ITEM' || value == null,
  });

  if (value == null) {
    return <NotProvidedComponent />;
  }

  switch (type) {
    case 'AUDIO': {
      const url = value?.url;
      if (url == null) {
        return <NotProvidedComponent />;
      }
      return (
        <div className="flex flex-col px-2 align-top text-start">
          {label ? <div className="pr-3 font-bold">{label}</div> : null}
          <ReactAudioPlayer src={url} autoPlay controls />
        </div>
      );
    }
    case 'BOOLEAN':
    case 'GEOHASH':
    case 'ID':
    case 'NUMBER':
    case 'POLICY_ID':
    case 'STRING': {
      return (
        <div className="flex flex-col whitespace-normal align-top text-start">
          {label ? (
            <div className="pr-3 font-bold text-slate-500 whitespace-nowrap">
              {label}
            </div>
          ) : null}
          <div className="text-start">{String(value)}</div>
        </div>
      );
    }
    case 'IP_ADDRESS': {
      // Make the IP clickable so a moderator can pivot to every other item
      // associated with the same IP (ban evasion, coordinated abuse, etc.).
      return (
        <div className="flex flex-col whitespace-normal align-top text-start">
          {label ? (
            <div className="pr-3 font-bold text-slate-500 whitespace-nowrap">
              {label}
            </div>
          ) : null}
          <Link
            className="cursor-pointer break-all"
            to={`/dashboard/manual_review/investigation?ip=${encodeURIComponent(
              String(value),
            )}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {String(value)}
          </Link>
        </div>
      );
    }
    case 'USER_ID': {
      return (
        <div className="align-top text-start min-w-0">
          {label ? <div className="pr-3 font-bold">{label}</div> : null}
          <Link
            className="cursor-pointer break-all"
            to={`/dashboard/manual_review/investigation?id=${value.id}&typeId=${value.typeId}`}
            target="_blank"
          >
            {value.id}
          </Link>
        </div>
      );
    }
    case 'IMAGE': {
      const url = value?.url;
      if (url == null) {
        return <NotProvidedComponent />;
      }

      // Extract matched banks if available, normalizing to a string[] so the
      // render path below always has a concrete array to map over.
      const rawMatchedBanks = (value as { matchedBanks?: string[] })
        .matchedBanks;
      const matchedBanks = Array.isArray(rawMatchedBanks)
        ? rawMatchedBanks
        : [];
      const hasMatches = matchedBanks.length > 0;

      return (
        <div className="flex flex-col px-2 align-top text-start">
          <ManualReviewJobContentBlurableImage
            url={url}
            options={{
              maxWidth: maxWidthImage,
              maxHeight: maxHeightImage,
              shouldBlur: !(
                unblurAllMedia || safetySettings?.moderatorSafetyBlurLevel === 0
              ),
              blurStrength: unblurAllMedia
                ? (0 as const)
                : safetySettings?.moderatorSafetyBlurLevel
                  ? (safetySettings.moderatorSafetyBlurLevel as BlurStrength)
                  : (2 as const),
              grayscale: safetySettings?.moderatorSafetyGrayscale ?? false,
            }}
          />
          {label ? <div className="font-bold">{label}</div> : null}
          {hasMatches && (
            <div className="flex flex-wrap gap-1 mt-1">
              {matchedBanks.map((bankName) => (
                <span
                  key={bankName}
                  className="inline-block px-2 py-0.5 text-s font-large bg-gray-200 rounded"
                >
                  {bankName}
                </span>
              ))}
            </div>
          )}
        </div>
      );
    }
    case 'VIDEO': {
      const url = value?.url;
      if (url == null) {
        return <NotProvidedComponent />;
      }

      return (
        <div className="p-2 align-top text-start">
          <ManualReviewJobContentBlurableVideo
            url={url}
            options={{
              shouldBlur: !(
                unblurAllMedia || safetySettings?.moderatorSafetyBlurLevel === 0
              ),
              blurStrength: unblurAllMedia
                ? (0 as const)
                : safetySettings?.moderatorSafetyBlurLevel
                  ? (safetySettings.moderatorSafetyBlurLevel as BlurStrength)
                  : (2 as const),
              maxWidth: maxWidthVideo,
              maxHeight: maxHeightVideo,
              muted: safetySettings?.moderatorSafetyMuteVideo ?? true,
            }}
          />
          {label ? <div className="font-bold">{label}</div> : null}
        </div>
      );
    }
    case 'MEDIA': {
      // Polymorphic field — render with the kind detected at coercion time.
      // When that's missing (legacy data, or items submitted before the field
      // became MEDIA), fall back to inferring the kind from the URL extension,
      // and only render a plain link if even that doesn't resolve.
      const url = value?.url;
      if (url == null) {
        return <NotProvidedComponent />;
      }
      const resolvedMediaType = value.mediaType ?? inferMediaKindFromUrl(url);
      if (resolvedMediaType === 'IMAGE') {
        return (
          <div className="flex flex-col px-2 align-top text-start">
            <ManualReviewJobContentBlurableImage
              url={url}
              options={{
                maxWidth: maxWidthImage,
                maxHeight: maxHeightImage,
                shouldBlur: !(
                  unblurAllMedia ||
                  safetySettings?.moderatorSafetyBlurLevel === 0
                ),
                blurStrength: unblurAllMedia
                  ? (0 as const)
                  : safetySettings?.moderatorSafetyBlurLevel
                    ? (safetySettings.moderatorSafetyBlurLevel as BlurStrength)
                    : (2 as const),
                grayscale: safetySettings?.moderatorSafetyGrayscale ?? false,
              }}
            />
            {label ? <div className="font-bold">{label}</div> : null}
          </div>
        );
      }
      if (resolvedMediaType === 'VIDEO') {
        return (
          <div className="p-2 align-top text-start">
            <ManualReviewJobContentBlurableVideo
              url={url}
              options={{
                shouldBlur: !(
                  unblurAllMedia ||
                  safetySettings?.moderatorSafetyBlurLevel === 0
                ),
                blurStrength: unblurAllMedia
                  ? (0 as const)
                  : safetySettings?.moderatorSafetyBlurLevel
                    ? (safetySettings.moderatorSafetyBlurLevel as BlurStrength)
                    : (2 as const),
                maxWidth: maxWidthVideo,
                maxHeight: maxHeightVideo,
                muted: safetySettings?.moderatorSafetyMuteVideo ?? true,
              }}
            />
            {label ? <div className="font-bold">{label}</div> : null}
          </div>
        );
      }
      if (resolvedMediaType === 'AUDIO') {
        return (
          <div className="flex flex-col px-2 align-top text-start">
            {label ? <div className="pr-3 font-bold">{label}</div> : null}
            <ReactAudioPlayer src={url} autoPlay controls />
          </div>
        );
      }
      return (
        <div className="align-top text-start">
          {label ? <div className="pr-3 font-bold">{label}</div> : null}
          <a rel="noreferrer" href={url} target="_blank">
            {url}
          </a>
        </div>
      );
    }
    case 'DATETIME': {
      return (
        <div className="flex flex-row align-top text-start">
          {label ? <div className="pr-3 font-bold">{label}</div> : null}
          <div className="px-1 text-start">
            {parseDatetimeToReadableStringInCurrentTimeZone(value)}
          </div>
        </div>
      );
    }
    case 'URL':
      return (
        <div className="align-top text-start">
          {label ? <div className="pr-3 font-bold">{label}</div> : null}
          <a rel="noreferrer" href={value} target="_blank">
            {value}
          </a>
        </div>
      );
    case 'RELATED_ITEM': {
      if (!relatedItemKind) {
        __throw(new Error(`Could not find item type for ID ${value.typeId}`));
      }

      // Resolve a human-readable title for every related-item kind via its
      // `displayName` schema role (not just users). The profile icon role only
      // exists on user types, so it stays user-only.
      let displayName: string | undefined;
      let profilePhoto: { url: string } | undefined;
      const relatedItem = relatedItemData?.latestItemSubmissions[0];
      switch (relatedItem?.__typename) {
        case 'UserItem': {
          const user = relatedItem as GQLUserItem;
          displayName = getFieldValueForRole<
            GQLUserSchemaFieldRoles,
            'displayName'
          >({ data: user.data, type: user.type }, 'displayName');
          profilePhoto = getFieldValueForRole<
            GQLUserSchemaFieldRoles,
            'profileIcon'
          >({ data: user.data, type: user.type }, 'profileIcon');
          break;
        }
        case 'ContentItem': {
          const content = relatedItem as GQLContentItem;
          displayName = getFieldValueForRole<
            GQLContentSchemaFieldRoles,
            'displayName'
          >({ data: content.data, type: content.type }, 'displayName');
          break;
        }
        case 'ThreadItem': {
          const thread = relatedItem as GQLThreadItem;
          displayName = getFieldValueForRole<
            GQLThreadSchemaFieldRoles,
            'displayName'
          >({ data: thread.data, type: thread.type }, 'displayName');
          break;
        }
        default:
          break;
      }
      return (
        <div className="flex flex-row align-top text-start">
          {label ? <div className="pr-3 font-bold">{label}</div> : null}
          <Link
            to={`/dashboard/manual_review/investigation?id=${value.id}&typeId=${value.typeId}`}
            className="flex flex-row items-center cursor-pointer text-start shrink-0"
            target="_blank"
          >
            {profilePhoto ? (
              <span className="mr-3">
                <img
                  alt=""
                  className="border-current rounded-full w-9 h-9"
                  src={profilePhoto.url}
                />
              </span>
            ) : null}
            {displayName ?? value.name ?? value.id}
          </Link>
        </div>
      );
    }
    default:
      assertUnreachable(type);
  }
}

function FieldComponent(props: {
  data: ItemTypeFieldFieldData;
  itemTypes: readonly ItemTypeFromHiddenFieldsQuery[];
  options?: FieldsComponentOptions;
}) {
  const { data, itemTypes, options } = props;
  const { hideLabels = false, transparentBackground = false } = options ?? {};
  if (data.value === undefined) {
    return null;
  }

  switch (data.type) {
    case 'ARRAY':
    case 'MAP':
      return (
        <ContainerComponent
          data={data}
          itemTypes={itemTypes}
          options={options}
        />
      );
    case 'AUDIO':
    case 'BOOLEAN':
    case 'GEOHASH':
    case 'ID':
    case 'IMAGE':
    case 'NUMBER':
    case 'STRING':
    case 'USER_ID':
    case 'VIDEO':
    case 'MEDIA':
    case 'RELATED_ITEM':
    case 'URL':
    case 'POLICY_ID':
    case 'IP_ADDRESS':
    case 'DATETIME':
      return (
        <div className="py-0" key={data.name}>
          {!hideLabels ? (
            <div className="pb-px align-top text-start whitespace-nowrap">
              <ContentFieldLabelComponent data={data} />
            </div>
          ) : null}
          <div
            className={`align-top rounded border-slate-200 text-start p-1.5 ${
              transparentBackground ? '' : 'bg-slate-100'
            }`}
          >
            <TableRowComponent
              data={data}
              options={options}
              itemTypes={itemTypes}
            />
          </div>
        </div>
      );
    default:
      assertUnreachable(data);
  }
}

function ContainerComponent(props: {
  data: ItemTypeFieldFieldData;
  itemTypes: readonly ItemTypeFromHiddenFieldsQuery[];
  options?: FieldsComponentOptions;
}) {
  const { data, itemTypes, options } = props;
  const [expanded, setExpanded] = useState(false);

  const { hideLabels = false, transparentBackground = false } = options ?? {};
  const items = (() => {
    if (!data.value) {
      return null;
    }

    switch (data.type) {
      case 'ARRAY': {
        if (!Array.isArray(data.value)) {
          __throw(new Error('Data.value incorrectly assumed to be an array'));
        }
        const valueCanBeStringified = (() => {
          switch (data.container.valueScalarType) {
            case 'BOOLEAN':
            case 'GEOHASH':
            case 'ID':
            case 'NUMBER':
            case 'STRING':
            case 'USER_ID':
            case 'DATETIME':
            case 'POLICY_ID':
            case 'IP_ADDRESS':
              return true;
            case 'AUDIO':
            case 'IMAGE':
            case 'MEDIA':
            case 'RELATED_ITEM':
            case 'URL':
            case 'VIDEO':
              return false;
            default:
              assertUnreachable(data.container.valueScalarType);
          }
        })();
        return valueCanBeStringified
          ? [{ type: 'STRING' as const, value: data.value.join(', ') }]
          : data.value.map((it) => ({
              type: data.container.valueScalarType,
              value: it,
            }));
      }
      case 'MAP': {
        const mapValue = data.value;
        return isPlainObject(mapValue)
          ? Object.keys(mapValue).map((key) => ({
              value: mapValue[key],
              label: toHumanReadableLabel(key),
              type: data.container.valueScalarType,
            }))
          : __throw(new Error('Data.value incorrectly assumed to be a map'));
      }
      case 'AUDIO':
      case 'BOOLEAN':
      case 'GEOHASH':
      case 'ID':
      case 'IMAGE':
      case 'NUMBER':
      case 'STRING':
      case 'USER_ID':
      case 'DATETIME':
      case 'RELATED_ITEM':
      case 'URL':
      case 'POLICY_ID':
      case 'IP_ADDRESS':
      case 'MEDIA':
      case 'VIDEO': {
        throw Error('Cannot call container component with scalar field');
      }
      default:
        assertUnreachable(data);
    }
  })();

  const itemCollection = (() => {
    if (items == null || items.length === 0) {
      return <NotProvidedComponent />;
    }

    const itemComponents = items.map((item, i) => {
      const itemData = {
        ...item,
        type: data.container!.valueScalarType,
      };
      return (
        <div key={i} className="align-top text-start whitespace-nowrap">
          {/*Talk to ethan about how to avoid casting here*/}
          <TableRowComponent
            data={itemData as TableRowComponentData}
            itemTypes={itemTypes}
            options={
              options
                ? { ...options, hideLabels: data.type === 'ARRAY' }
                : { hideLabels: data.type === 'ARRAY' }
            }
          />
        </div>
      );
    });

    const collapsedItemLimit = 7;
    if (itemComponents.length > collapsedItemLimit && !expanded) {
      return (
        <div className="flex flex-col">
          {itemComponents.slice(0, collapsedItemLimit)}
          <div
            className="flex flex-row pt-2 font-semibold text-blue-500 cursor-pointer"
            onClick={() => setExpanded(true)}
          >
            Expand{' '}
            {`(${itemComponents.length - collapsedItemLimit} more items)`}
            <DownOutlined className="pt-1 pl-2" />
          </div>
        </div>
      );
    }

    return itemComponents;
  })();

  return (
    <div className="flex flex-col py-1" key={data.name}>
      {!hideLabels ? (
        <div className="align-top text-start whitespace-nowrap">
          <ContentFieldLabelComponent data={data} />
        </div>
      ) : null}
      <div
        className={` ${
          data.container!.valueScalarType === 'IMAGE' ||
          data.container!.valueScalarType === 'VIDEO' ||
          data.container!.valueScalarType === 'AUDIO' ||
          data.container!.valueScalarType === 'MEDIA'
            ? ''
            : 'flex-col'
        } flex overflow-x-scroll border-slate-200 rounded p-1.5 ${
          transparentBackground ? '' : 'bg-slate-100'
        } ${expanded ? 'max-h-96 overflow-y-auto' : 'overflow-y-hidden'}`}
      >
        {itemCollection}
      </div>
    </div>
  );
}

type ItemTypeFromHiddenFieldsQuery = Pick<
  GQLItemType,
  'id' | 'hiddenFields' | '__typename'
>;

export default function FieldsComponent(props: {
  fields: ItemTypeFieldFieldData[];
  itemTypeId: string;
  options?: FieldsComponentOptions;
}) {
  const { fields, options, itemTypeId } = props;

  const { data, loading } = useGQLItemTypeHiddenFieldsQuery();

  if (loading) {
    return <ComponentLoading />;
  }

  if (fields.length === 0) {
    return null;
  }

  if (fields.every((field) => field.value == null)) {
    return null;
  }

  const { itemTypes } = data?.myOrg ?? { itemTypes: [] };
  const hiddenFields =
    itemTypes.find((it) => it.id === itemTypeId)?.hiddenFields ?? [];

  return (
    <div className="flex flex-wrap w-full gap-3 p-0">
      {fields
        .filter((it) => !hiddenFields.includes(it.name))
        .sort((a, b) => {
          if (a.value === undefined) {
            return 1;
          }
          if (b.value === undefined) {
            return -1;
          }
          // Render media fields after non-media fields
          if (
            isContainerField(a)
              ? isMediaType(a.container.valueScalarType)
              : isMediaType(a.type)
          ) {
            return 1;
          }
          if (
            isContainerField(b)
              ? isMediaType(b.container.valueScalarType)
              : isMediaType(b.type)
          ) {
            return -1;
          }
          return 0;
        })
        .map((field) =>
          field.value === undefined ||
          (Array.isArray(field.value) && field.value.length === 0) ||
          (isPlainObject(field.value) &&
            Object.values(field.value).every(
              (it) => it === undefined,
            )) ? null : (
            <FieldComponent
              data={field}
              key={field.name}
              options={options}
              itemTypes={itemTypes}
            />
          ),
        )}
    </div>
  );
}
