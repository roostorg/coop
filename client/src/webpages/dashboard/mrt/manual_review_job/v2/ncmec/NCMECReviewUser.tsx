import { BulbOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { gql } from '@apollo/client';
import { ItemIdentifier, TaggedScalar } from '@roostorg/types';
import { Button } from 'antd';
import pick from 'lodash/pick';
import uniqBy from 'lodash/uniqBy';
import uniqWith from 'lodash/uniqWith';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import CopyTextComponent from '../../../../../../components/common/CopyTextComponent';
import CoopModal from '../../../../components/CoopModal';
import FormHeader from '../../../../components/FormHeader';
import CoopButton from '@/webpages/dashboard/components/CoopButton';
import TabBar from '@/webpages/dashboard/components/TabBar';

import {
  GQLDecisionSubmission,
  GQLJobFieldsFragment,
  GQLNcmecFileAnnotation,
  GQLNcmecIncidentType,
  GQLNcmecIndustryClassification,
  GQLNcmecThreadInput,
  GQLThreadItem,
  useGQLGetMoreInfoForThreadItemsQuery,
  useGQLPersonalSafetySettingsQuery,
} from '../../../../../../graphql/generated';
import { filterNullOrUndefined } from '../../../../../../utils/collections';
import {
  getFieldValueForRole,
  getFieldValueOrValues,
} from '../../../../../../utils/itemUtils';
import { titleCaseEnumString } from '../../../../../../utils/string';
import { jsonStringify } from '../../../../../../utils/typescript-types';
import ManualReviewJobContentBlurableVideo from '../../ManualReviewJobContentBlurableVideo';
import NCMECActions from './NCMECActions';
import NCMECInspectedMedia from './NCMECInspectedMedia';
import NCMECMediaGallery from './NCMECMediaGallery';
import { BLUR_LEVELS, BlurStrength } from './NCMECMediaViewer';
import NCMECPreviousMessages from './NCMECPreviousMessages';

export type NCMECUrlInfo = {
  url: string;
  mediaType: 'IMAGE' | 'VIDEO';
};

// The unique identifier
// for a piece of media is (itemId, url) because some items might have multiple
// image/video URLs, so itemId alone isn't unique.
export type NCMECMediaIdentifier = {
  itemId: string;
  itemTypeId: string;
  urlInfo: NCMECUrlInfo;
};

export type NCMECCategory = GQLNcmecIndustryClassification | 'None';

export type NCMECMediaState = NCMECMediaIdentifier & {
  category: NCMECCategory;
  labels: GQLNcmecFileAnnotation[];
};

type NCMECJobPayloadQueryResult = Extract<
  GQLJobFieldsFragment['payload'],
  { __typename: 'NcmecManualReviewJobPayload' }
>;

export type NCMECMediaQueryResult =
  NCMECJobPayloadQueryResult['allMediaItems'][0];

gql`
  query getMoreInfoForThreadItems($ids: [ItemIdentifierInput!]!) {
    partialItems(input: $ids) {
      ... on PartialItemsSuccessResponse {
        items {
          ... on ThreadItem {
            id
            submissionId
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
            }
            data
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
`;

function getUrlsFromItem(
  item: NCMECMediaQueryResult['contentItem'],
): NCMECUrlInfo[] {
  const mediaFields = item.type.baseFields.filter(
    (it) =>
      it.type === 'IMAGE' ||
      it.type === 'VIDEO' ||
      it.container?.valueScalarType === 'IMAGE' ||
      it.container?.valueScalarType === 'VIDEO',
  );
  return filterNullOrUndefined(
    mediaFields
      .map((field) => {
        const valueOrValues = getFieldValueOrValues(item.data, field) as
          | TaggedScalar<'IMAGE' | 'VIDEO'>
          | TaggedScalar<'IMAGE' | 'VIDEO'>[];
        if (valueOrValues === undefined) {
          return undefined;
        }
        return Array.isArray(valueOrValues)
          ? valueOrValues.map((it) => ({
              url: it.value.url,
              mediaType: it.type,
            }))
          : { url: valueOrValues.value.url, mediaType: valueOrValues.type };
      })
      .flat(),
  );
}

// Mapping from GraphQL enum values to display labels
const NCMEC_INCIDENT_TYPE_LABELS: Record<GQLNcmecIncidentType, string> = {
  [GQLNcmecIncidentType.ChildPornography]:
    'Child Pornography (possession, manufacture, and distribution)',
  [GQLNcmecIncidentType.ChildSexTrafficking]: 'Child Sex Trafficking',
  [GQLNcmecIncidentType.ChildSexTourism]: 'Child Sex Tourism',
  [GQLNcmecIncidentType.ChildSexualMolestation]: 'Child Sexual Molestation',
  [GQLNcmecIncidentType.MisleadingDomainName]: 'Misleading Domain Name',
  [GQLNcmecIncidentType.MisleadingWordsOrDigitalImages]:
    'Misleading Words or Digital Images on the Internet',
  [GQLNcmecIncidentType.OnlineEnticementOfChildren]:
    'Online Enticement of Children for Sexual Acts',
  [GQLNcmecIncidentType.UnsolicitedObsceneMaterialToChild]:
    'Unsolicited Obscene Material Sent to a Child',
};

// Get all incident type options for dropdown
const NCMEC_INCIDENT_TYPE_OPTIONS = Object.entries(
  NCMEC_INCIDENT_TYPE_LABELS,
).map(([value, label]) => ({ value: value as GQLNcmecIncidentType, label }));

export default function NCMECReviewUser(
  props: {
    orgId: string;
    payload: NCMECJobPayloadQueryResult;
    showMessages?: boolean;
  } & (
    | {
        isActionable: false;
        ncmecDecisions?: readonly {
          readonly id: string;
          readonly typeId: string;
          readonly url: string;
          readonly fileAnnotations: readonly GQLNcmecFileAnnotation[];
          readonly industryClassification: GQLNcmecIndustryClassification;
        }[];
      }
    | {
        isActionable: true;
        submitDecision: (input: GQLDecisionSubmission) => Promise<void>;
        skipToNextJob: () => Promise<void>;
        ncmecDecisions: undefined;
      }
  ),
) {
  const { orgId, payload, isActionable, ncmecDecisions, showMessages } = props;
  const { item, allMediaItems } = payload;

  const uniqueMediaItems = uniqBy(allMediaItems, (it) =>
    jsonStringify({ id: it.contentItem.id, typeId: it.contentItem.type.id }),
  );

  const [erroredMedia, setErroredMedia] = useState<ItemIdentifier[]>([]);
  const [selectedTab, setSelectedTab] = useState<'MEDIA' | 'MESSAGES'>('MEDIA');
  const [allMediaItemsWithUrls, setAllMediaItemsWithUrls] = useState<
    ((typeof uniqueMediaItems)[number] & { urlInfo: NCMECUrlInfo })[]
  >(
    uniqueMediaItems
      .map((it) =>
        getUrlsFromItem(it.contentItem).map((urlInfo) => ({ ...it, urlInfo })),
      )
      .flat()
      .sort((a, b) => {
        // Put confirmed CSAM first, then the reported item, then everything else
        if (a.isConfirmedCSAM) {
          return -1;
        }
        if (b.isConfirmedCSAM) {
          return 1;
        }
        if (a.isReported) {
          return -1;
        }
        if (b.isReported) {
          return 1;
        }
        return 0;
      }),
  );
  const { data: threadInfo, loading: threadLoading } =
    useGQLGetMoreInfoForThreadItemsQuery({
      variables: {
        ids: uniqWith(
          filterNullOrUndefined(
            uniqueMediaItems.map((it) => {
              const threadId =
                it.contentItem.__typename === 'ContentItem'
                  ? getFieldValueForRole(it.contentItem, 'threadId')
                  : undefined;
              return threadId
                ? {
                    id: threadId.id,
                    typeId: threadId.typeId,
                  }
                : undefined;
            }),
          ),
          (a, b) => a.id === b.id && a.typeId === b.typeId,
        ),
      },
    });

  // Media In Detail View = media that is being highlighted/inspected in the
  // detail view (there can only be one inspected at a time).
  const [mediaInDetailView, setMediaInDetailView] = useState<
    NCMECMediaIdentifier | undefined
  >(
    allMediaItemsWithUrls.length > 0
      ? {
          itemId: allMediaItemsWithUrls[0].contentItem.id,
          urlInfo: allMediaItemsWithUrls[0].urlInfo,
          itemTypeId: allMediaItemsWithUrls[0].contentItem.type.id,
        }
      : undefined,
  );
  // Selected Media = media that has been selected to be included in the
  // NCMEC report (there can be multiple selected at once)
  const [selectedMedia, setSelectedMedia] = useState<NCMECMediaState[]>(
    ncmecDecisions
      ? allMediaItemsWithUrls.map((media) => {
          const decision = ncmecDecisions.find(
            (decision) =>
              media.contentItem.id === decision.id &&
              media.contentItem.type.id === decision.typeId,
          );
          if (decision) {
            return {
              itemId: decision.id,
              itemTypeId: decision.typeId,
              urlInfo: media.urlInfo,
              category: decision.industryClassification,
              labels: [...decision.fileAnnotations],
            };
          }
          return {
            itemId: media.contentItem.id,
            itemTypeId: media.contentItem.type.id,
            urlInfo: media.urlInfo,
            category: 'None',
            labels: [],
          };
        })
      : [],
  );
  const [selectedThreadsWithMessages, setSelectedThreadsWithMessages] =
    useState<GQLNcmecThreadInput[]>([]);
  const [incidentType, setIncidentType] = useState<GQLNcmecIncidentType>(
    GQLNcmecIncidentType.ChildPornography,
  );
  const [sendReportModalVisible, setSendReportModalVisible] = useState(false);
  const [deselectAndIgnoreModalVisible, setDeselectAndIgnoreModalVisible] =
    useState(false);
  const [moveToQueueMenuVisible, setMoveToQueueMenuVisible] = useState(false);
  const [unblurAllMediaInConfirmation, setUnblurAllMediaInConfirmation] =
    useState(false);
  const [shouldBlurAll, setBlurAll] = useState(true);
  const [
    isLabelSelectorInInspectedMediaVisible,
    setIsLabelSelectorInInspectedMediaVisible,
  ] = useState(false);

  const inspectedMediaRef = useRef<HTMLInputElement | null>(null);
  const reviewRef = useRef<HTMLInputElement>(null);

  const navigate = useNavigate();

  const { loading, data } = useGQLPersonalSafetySettingsQuery();
  const noValidMedia = (
    <div className="flex items-start justify-center w-full h-full">
      <div className="flex flex-col items-center justify-center p-12 mt-20 shadow rounded-xl bg-slate-50 text-slate-500">
        <div className="pb-3 text-slate-200 text-8xl">
          <ExclamationCircleOutlined />
        </div>
        <div className="text-2xl max-w-[400px] pb-2">
          Could not find any valid media
        </div>
        <CopyTextComponent
          value={erroredMedia.map((it) => it.id).join(',')}
          displayValue={`${erroredMedia.length} video${
            erroredMedia.length === 1 ? '' : 's'
          } or image${
            erroredMedia.length === 1 ? '' : 's'
          } failed to load. Click here to copy a list of the IDs that failed to load.`}
          isError={true}
        />
        {isActionable ? (
          <div className="pt-2">
            <CoopButton
              title="Next Job"
              onClick={() => {
                setDeselectAndIgnoreModalVisible(false);
                props.submitDecision({ ignore: {} });
              }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );

  // If allMediaItemsWithUrls is empty, assume that there's nothing left to
  // review and set an error that submits an ignore.
  if (allMediaItemsWithUrls.length === 0) {
    return noValidMedia;
  }

  if (mediaInDetailView === undefined) {
    setMediaInDetailView({
      itemId: allMediaItemsWithUrls[0].contentItem.id,
      urlInfo: allMediaItemsWithUrls[0].urlInfo,
      itemTypeId: allMediaItemsWithUrls[0].contentItem.type.id,
    });
  }
  if (mediaInDetailView === undefined) {
    return noValidMedia;
  }

  const {
    moderatorSafetyBlurLevel,
    moderatorSafetyGrayscale,
    moderatorSafetyMuteVideo,
  } = data?.me?.interfacePreferences ?? {};

  // Compares two pieces of media to determine whether they're the same, based
  // on the unique identifier of (itemId, itemTypeId, url)
  const areMediaEqual = (a: NCMECMediaIdentifier, b: NCMECMediaIdentifier) => {
    return (
      a.itemId === b.itemId &&
      a.itemTypeId === b.itemTypeId &&
      a.urlInfo.url === b.urlInfo.url
    );
  };

  const addLabel = (
    mediaId: NCMECMediaIdentifier,
    label: GQLNcmecFileAnnotation,
  ) => {
    const media = selectedMedia.find((it) => areMediaEqual(it, mediaId));
    if (media && !media.labels.includes(label)) {
      const selectedLabels = media.labels;
      const newMedia = {
        ...media,
        labels: [...selectedLabels, label],
      };
      setSelectedMedia([
        ...selectedMedia.filter((it) => !areMediaEqual(it, newMedia)),
        newMedia,
      ]);
    }
  };

  const removeLabel = (
    mediaId: NCMECMediaIdentifier,
    label: GQLNcmecFileAnnotation,
  ) => {
    const media = selectedMedia.find((it) => areMediaEqual(it, mediaId));
    if (media && media.labels.includes(label)) {
      const selectedLabels = media.labels;
      const newMedia = {
        ...media,
        labels: selectedLabels.filter((it) => it !== label),
      };
      setSelectedMedia([
        ...selectedMedia.filter((it) => !areMediaEqual(it, newMedia)),
        newMedia,
      ]);
    }
  };

  const updateSelectedCategory = (
    mediaId: NCMECMediaIdentifier,
    category: NCMECCategory | undefined,
  ) => {
    if (!category) {
      // If we're deselecting a media, remove it from selectedMedia state
      if (selectedMedia.some((it) => areMediaEqual(it, mediaId))) {
        setSelectedMedia(
          selectedMedia.filter((it) => !areMediaEqual(it, mediaId)),
        );
      }
    } else {
      if (!selectedMedia.some((it) => areMediaEqual(it, mediaId))) {
        // If we're adding a previously unselected media, add it with no labels
        setSelectedMedia(
          selectedMedia.concat([{ ...mediaId, category, labels: [] }]),
        );
      } else {
        // Otherwise, update the category of the existing media without changing the labels,
        // unless the category is "None", in which case, remove the labels
        const existingMedia = selectedMedia.find((it) =>
          areMediaEqual(it, mediaId),
        )!;
        setSelectedMedia(
          selectedMedia
            .filter((it) => !areMediaEqual(it, mediaId))
            .concat([
              {
                ...mediaId,
                category,
                labels: category === 'None' ? [] : existingMedia.labels,
              },
            ]),
        );
      }
    }
  };

  const categoryColor = (category: NCMECCategory) => {
    switch (category) {
      case 'A1':
        return 'bg-red-400';
      case 'A2':
        return 'bg-orange-400';
      case 'B1':
        return 'bg-amber-400';
      case 'B2':
        return 'bg-blue-400';
      case 'None':
        return 'bg-slate-500';
    }
  };

  const goToNextMedia = () => {
    const index = allMediaItemsWithUrls.findIndex(
      (it) =>
        it.contentItem.id === mediaInDetailView.itemId &&
        it.urlInfo.url === mediaInDetailView.urlInfo.url,
    );
    if (index < allMediaItemsWithUrls.length - 1) {
      setMediaInDetailView({
        itemId: allMediaItemsWithUrls[index + 1].contentItem.id,
        urlInfo: allMediaItemsWithUrls[index + 1].urlInfo,
        itemTypeId: allMediaItemsWithUrls[index + 1].contentItem.type.id,
      });
    }
  };

  const goToPreviousMedia = () => {
    const index = allMediaItemsWithUrls.findIndex(
      (it) =>
        it.contentItem.id === mediaInDetailView.itemId &&
        it.urlInfo.url === mediaInDetailView.urlInfo.url,
    );
    if (index > 0) {
      setMediaInDetailView({
        itemId: allMediaItemsWithUrls[index - 1].contentItem.id,
        urlInfo: allMediaItemsWithUrls[index - 1].urlInfo,
        itemTypeId: allMediaItemsWithUrls[index - 1].contentItem.type.id,
      });
    }
  };

  const displayName = getFieldValueForRole(item, 'displayName');
  const profilePicUrl = getFieldValueForRole(item, 'profileIcon');

  // If a piece of media errors out, we should hide it since
  // the user can't play it
  const onMediaError = (mediaId: NCMECMediaIdentifier) => {
    if (
      mediaInDetailView.itemId === mediaId.itemId &&
      mediaInDetailView.itemTypeId === mediaId.itemTypeId
    ) {
      goToNextMedia();
    }

    // Update erroredMedia atomically
    setErroredMedia((prevErroredMedia) => {
      const newErrors = prevErroredMedia.concat({
        id: mediaId.itemId,
        typeId: mediaId.itemTypeId,
      });
      return newErrors;
    });

    // Update media items with URLs atomically
    setAllMediaItemsWithUrls((prevAllMediaItemsWithUrls) => {
      const newMedia = prevAllMediaItemsWithUrls.filter(
        (it) =>
          it.contentItem.id !== mediaId.itemId ||
          it.contentItem.type.id !== mediaId.itemTypeId,
      );

      if (newMedia.length > 0) {
        setMediaInDetailView({
          itemId: newMedia[0].contentItem.id,
          urlInfo: newMedia[0].urlInfo,
          itemTypeId: newMedia[0].contentItem.type.id,
        });
      }

      return newMedia;
    });
  };

  const selectedMediaConfirmationGrid = (
    <div className="flex flex-wrap w-full overflow-y-scroll h-[348px] rounded-2xl my-4">
      {selectedMedia
        .filter((media) => media.category !== 'None')
        .map((media) => (
          <div
            key={`${media.itemId}:${media.urlInfo.url}`}
            className="flex flex-col justify-center mb-8 mr-8"
          >
            <div className="overflow-hidden shadow-lg rounded-2xl w-fit">
              {!loading &&
              moderatorSafetyBlurLevel != null &&
              moderatorSafetyGrayscale != null ? (
                media.urlInfo.mediaType === 'IMAGE' ? (
                  <img
                    className={`object-scale-down w-64 h-48 rounded-2xl ${
                      unblurAllMediaInConfirmation
                        ? 'blur-0'
                        : BLUR_LEVELS[moderatorSafetyBlurLevel as BlurStrength]
                    } ${moderatorSafetyGrayscale ? 'grayscale' : ''}`}
                    alt=""
                    src={media.urlInfo.url}
                  />
                ) : (
                  <ManualReviewJobContentBlurableVideo
                    url={media.urlInfo.url}
                    className={`object-scale-down w-64 h-48 rounded-2xl ${
                      moderatorSafetyGrayscale ? 'grayscale' : ''
                    }`}
                    options={{
                      shouldBlur:
                        !unblurAllMediaInConfirmation &&
                        moderatorSafetyBlurLevel > 0,
                      blurStrength: moderatorSafetyBlurLevel as BlurStrength,
                      muted: moderatorSafetyMuteVideo,
                    }}
                  />
                )
              ) : null}
            </div>
            <div className="flex flex-col mt-8">
              <div className="flex items-center my-2">
                <div className="mr-3 font-bold">Category</div>
                <div
                  className={`flex justify-center items-center text-center font-bold text-white rounded-full border-solid border border-neutral-300 px-4 py-1 ${categoryColor(
                    media.category,
                  )}`}
                >
                  {media.category}
                </div>
              </div>
              <div className="flex items-center my-2">
                <div className="mr-3 font-bold">Labels</div>
                <div>
                  {media.labels
                    .map((label) => titleCaseEnumString(label))
                    .join(', ')}
                </div>
              </div>
            </div>
          </div>
        ))}
    </div>
  );

  const sendReportModal = isActionable ? (
    <CoopModal
      visible={sendReportModalVisible}
      onClose={() => setSendReportModalVisible(false)}
      title="Confirm & Send NCMEC Report"
      footer={[
        {
          title: 'Submit Report',
          onClick: async () => {
            await props.submitDecision({
              submitNcmecReport: {
                reportedMedia: selectedMedia
                  .filter((media) => media.category !== 'None')
                  .map((media) => {
                    return {
                      fileAnnotations: media.labels,
                      id: media.itemId,
                      // This cast is safe because of the filter above
                      industryClassification:
                        media.category as GQLNcmecIndustryClassification,
                      url: media.urlInfo.url,
                      typeId: media.itemTypeId,
                    };
                  }),
                reportedMessages: selectedThreadsWithMessages,
                incidentType,
              },
            });
          },
          type: 'primary',
        },
      ]}
    >
      <div className="flex flex-col w-full">
        <div className="!my-4 divider" />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-start">
            <div className="text-base font-bold">Suspect</div>
            <div className="flex flex-row items-center mr-12">
              {profilePicUrl ? (
                <img
                  alt="profile pic"
                  className="w-10 h-10 border-2 border-solid rounded-full border-slate-400"
                  src={profilePicUrl.url}
                />
              ) : null}
              {displayName ? (
                <div className="ml-3 font-bold truncate text-slate-700">
                  {displayName} ({item.id})
                </div>
              ) : (
                <div className="ml-3 font-bold truncate text-slate-700">
                  {item.id}
                </div>
              )}
            </div>
          </div>
          <Button
            onClick={() => setUnblurAllMediaInConfirmation((prev) => !prev)}
          >
            {unblurAllMediaInConfirmation ? 'Blur All' : 'Unblur All'}
          </Button>
        </div>
        <div className="!my-4 divider" />
        <div className="text-base font-bold">Media</div>
        {selectedMediaConfirmationGrid}
        <div className="!my-4 divider" />
        <div className="text-base font-bold">Messages</div>
        {selectedThreadsWithMessages.length > 0
          ? selectedThreadsWithMessages.map((thread) => (
              <div key={thread.threadId}>
                {thread.threadId}: {thread.reportedContent.length} reported
              </div>
            ))
          : undefined}
        <div className="!my-4 divider" />
        <div className="flex flex-col gap-2">
          <div className="text-base font-bold">Incident Type Category</div>
          <select
            value={incidentType}
            onChange={(e) =>
              setIncidentType(e.target.value as GQLNcmecIncidentType)
            }
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {NCMEC_INCIDENT_TYPE_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </CoopModal>
  ) : null;

  const deselectAndIgnoreReportModal = isActionable ? (
    <CoopModal
      visible={deselectAndIgnoreModalVisible}
      onClose={() => setDeselectAndIgnoreModalVisible(false)}
      title="Ignore Report"
      footer={[
        {
          title: 'Deselect Media and Ignore Report',
          onClick: () => {
            setDeselectAndIgnoreModalVisible(false);
            props.submitDecision({ ignore: {} });
          },
          type: 'primary',
        },
      ]}
    >
      <div className="flex flex-col w-full">
        <div className="text-slate-700">
          You are attempting to ignore this report, but you've already assigned
          categories to the following media. Do you want to remove those
          selected categories and ignore the report?
        </div>
        {selectedMediaConfirmationGrid}
      </div>
    </CoopModal>
  ) : null;

  const mediaInDetailViewItem = allMediaItemsWithUrls.find(
    (it) =>
      it.contentItem.id === mediaInDetailView.itemId &&
      it.urlInfo.url === mediaInDetailView.urlInfo.url,
  )?.contentItem;

  const mediaInDetailViewThread =
    mediaInDetailViewItem?.__typename === 'ContentItem'
      ? getFieldValueForRole(mediaInDetailViewItem, 'threadId')
      : undefined;
  return (
    <div
      className="flex flex-col items-start outline-none"
      ref={reviewRef}
      tabIndex={0}
      onKeyDown={(e) => {
        if (
          e.repeat ||
          sendReportModalVisible ||
          deselectAndIgnoreModalVisible ||
          isLabelSelectorInInspectedMediaVisible
        ) {
          return;
        } else if (moveToQueueMenuVisible) {
          if (e.key === 'Escape') {
            setMoveToQueueMenuVisible(false);
          }
        } else if (e.key === 'a') {
          goToPreviousMedia();
          e.preventDefault();
        } else if (e.key === 'd') {
          goToNextMedia();
          e.preventDefault();
        }
      }}
    >
      <FormHeader
        title="NCMEC Reporting"
        subtitle="Review users that are suspected of distributing CSAM or other child exploitation material, and report them to NCMEC if necessary."
        topRightComponent={
          <div className="flex gap-2">
            {isActionable ? (
              <Button
                className="rounded-md"
                danger
                onClick={() => {
                  navigate('/dashboard/manual_review/queues');
                }}
              >
                End Session
              </Button>
            ) : null}
            <Button
              className="rounded-md"
              onClick={() => setBlurAll(!shouldBlurAll)}
            >
              {shouldBlurAll ? 'Unblur All' : 'Blur All'}
            </Button>
          </div>
        }
      />
      <div className="flex items-center justify-between w-full gap-8 mb-2">
        <div className="text-start text-slate-500 font-medium w-fit bg-slate-100 rounded-md p-1.5 flex items-center">
          <BulbOutlined className="pr-2 text-xl" />
          <div className="flex flex-col">
            <div className="text-sm pb-0.5 font-semibold">
              Keyboard shortcuts:
            </div>
            <div className="text-xs">
              - Use "a" and "d" to navigate through all media.
            </div>
            <div className="text-xs">
              - Use "j", "k", "l", ";", and "n" to assign the categories "A1",
              "A2", "B1", "B2", and "None" (respectively) to the media you're
              inspecting.
            </div>
            <div className="text-xs">
              - Use "i" to open the Labels dropdown.
            </div>
          </div>
        </div>
        {isActionable ? (
          <div className="flex flex-col gap-4">
            <NCMECActions
              setSendReportModalVisible={setSendReportModalVisible}
              setDeselectAndIgnoreModalVisible={
                setDeselectAndIgnoreModalVisible
              }
              isAnyMediaSelected={selectedMedia.length > 0}
              isAllMediaSelected={
                selectedMedia.length === allMediaItemsWithUrls.length
              }
              submitDecision={props.submitDecision}
              moveToQueueMenuVisible={moveToQueueMenuVisible}
              setMoveToQueueMenuVisible={setMoveToQueueMenuVisible}
              skipToNextJob={props.skipToNextJob}
              disableKeyboardShortcuts={
                moveToQueueMenuVisible ||
                sendReportModalVisible ||
                deselectAndIgnoreModalVisible ||
                isLabelSelectorInInspectedMediaVisible
              }
            />
            <div className="flex flex-col gap-2 px-4 py-3 bg-slate-50 rounded-lg border border-slate-200">
              <label className="text-sm font-semibold text-slate-700">
                Incident Type Category
              </label>
              <select
                value={incidentType}
                onChange={(e) =>
                  setIncidentType(e.target.value as GQLNcmecIncidentType)
                }
                className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {NCMEC_INCIDENT_TYPE_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500">
                Select the primary incident type for this NCMEC report
              </p>
            </div>
          </div>
        ) : null}
      </div>
      {showMessages ? (
        <TabBar
          tabs={[
            { label: 'Media', value: 'MEDIA' },
            { label: 'Messages', value: 'MESSAGES' },
          ]}
          initialSelectedTab={'MEDIA'}
          onTabClick={setSelectedTab}
        />
      ) : undefined}
      {selectedTab === 'MEDIA' ? (
        <div ref={inspectedMediaRef} className="flex flex-col w-full">
          <NCMECInspectedMedia
            orgId={orgId}
            mediaId={mediaInDetailView}
            fullNcmecContentItem={
              allMediaItemsWithUrls.find(
                (it) =>
                  it.contentItem.id === mediaInDetailView.itemId &&
                  it.urlInfo.url === mediaInDetailView.urlInfo.url,
              )!
            }
            state={selectedMedia.find((it) =>
              areMediaEqual(it, mediaInDetailView),
            )}
            user={item}
            isSelected={selectedMedia.some((it) =>
              areMediaEqual(it, mediaInDetailView),
            )}
            addLabel={addLabel}
            removeLabel={removeLabel}
            updateSelectedCategory={updateSelectedCategory}
            goToNextMedia={goToNextMedia}
            goToPreviousMedia={goToPreviousMedia}
            index={allMediaItemsWithUrls.findIndex(
              (it) =>
                it.contentItem.id === mediaInDetailView.itemId &&
                it.urlInfo.url === mediaInDetailView.urlInfo.url,
            )}
            totalLength={allMediaItemsWithUrls.length}
            disableKeyboardShortcuts={
              // We don't include isLabelSelectorInInspectedMediaVisible because
              // the keyboard shortcut for opening/closing the label selector, which
              // is defined in a child of NCMECInspectedMedia, shouldn't be disabled
              // if isLabelSelectorInInspectedMediaVisible === true (as that would make
              // no sense).
              moveToQueueMenuVisible ||
              sendReportModalVisible ||
              deselectAndIgnoreModalVisible
            }
            shouldBlurAll={shouldBlurAll}
            onMediaError={onMediaError}
            isLabelSelectorInInspectedMediaVisible={
              isLabelSelectorInInspectedMediaVisible
            }
            setIsLabelSelectorInInspectedMediaVisible={
              setIsLabelSelectorInInspectedMediaVisible
            }
            threadId={mediaInDetailViewThread?.id}
            threadInfo={
              threadInfo?.partialItems.__typename ===
              'PartialItemsSuccessResponse'
                ? (threadInfo.partialItems.items.find(
                    (it) =>
                      it.__typename === 'ThreadItem' &&
                      it.id === mediaInDetailViewThread?.id &&
                      it.type.id === mediaInDetailViewThread?.typeId,
                  ) as GQLThreadItem)
                : undefined
            }
            threadLoading={threadLoading}
          />
          {erroredMedia.length > 0 ? (
            <div className="self-start pt-2">
              <CopyTextComponent
                value={erroredMedia.map((it) => it.id).join(',')}
                displayValue={`${erroredMedia.length} video${
                  erroredMedia.length === 1 ? '' : 's'
                } or image${
                  erroredMedia.length === 1 ? '' : 's'
                } failed to load. Click here to copy a list of the IDs that failed to load.`}
                isError={true}
              />
            </div>
          ) : undefined}
          <NCMECMediaGallery
            allMedia={allMediaItemsWithUrls}
            state={selectedMedia}
            mediaInDetailView={mediaInDetailView}
            selectedMediaIDs={selectedMedia.map((it) =>
              pick(it, ['itemId', 'urlInfo', 'itemTypeId']),
            )}
            addLabel={addLabel}
            removeLabel={removeLabel}
            updateSelectedCategory={updateSelectedCategory}
            onClickToInspect={(mediaId) => {
              setMediaInDetailView(mediaId);
              inspectedMediaRef.current?.scrollIntoView({ behavior: 'smooth' });
            }}
            shouldBlurAll={shouldBlurAll}
            onMediaError={onMediaError}
          />
          {sendReportModal}
          {deselectAndIgnoreReportModal}
        </div>
      ) : (
        <NCMECPreviousMessages
          userIdentifier={{ id: item.id, typeId: item.type.id }}
          isActionable={isActionable}
          setSelectedThreadsWithMessages={setSelectedThreadsWithMessages}
          selectedThreadsWithMessages={selectedThreadsWithMessages}
        />
      )}
    </div>
  );
}
