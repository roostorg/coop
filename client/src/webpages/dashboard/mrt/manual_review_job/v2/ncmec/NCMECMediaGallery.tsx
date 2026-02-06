import { GQLNcmecFileAnnotation } from '../../../../../../graphql/generated';
import NCMECMediaViewer from './NCMECMediaViewer';
import {
  NCMECCategory,
  NCMECMediaIdentifier,
  NCMECMediaQueryResult,
  NCMECMediaState,
  NCMECUrlInfo,
} from './NCMECReviewUser';

export default function NCMECMediaGallery(props: {
  allMedia: (NCMECMediaQueryResult & { urlInfo: NCMECUrlInfo })[];
  state: NCMECMediaState[];
  mediaInDetailView: NCMECMediaIdentifier | undefined;
  selectedMediaIDs: NCMECMediaIdentifier[];
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
  onClickToInspect: (mediaId: NCMECMediaIdentifier) => void;
  shouldBlurAll: boolean;
  onMediaError: (mediaId: NCMECMediaIdentifier) => void;
}) {
  const {
    allMedia,
    state,
    mediaInDetailView,
    selectedMediaIDs,
    addLabel,
    removeLabel,
    updateSelectedCategory,
    onClickToInspect,
    onMediaError,
  } = props;
  return (
    <div className="flex flex-wrap w-full overflow-y-scroll h-[576px] p-3 border border-solid border-gray-200 shadow rounded-md gap-3 mt-3">
      {allMedia.map((it) => (
        <div
          key={`${it.contentItem.id}:${it.urlInfo.url}`}
          className="flex flex-col justify-between grow"
        >
          <NCMECMediaViewer
            mediaId={{
              itemId: it.contentItem.id,
              urlInfo: it.urlInfo,
              itemTypeId: it.contentItem.type.id,
            }}
            index={allMedia.findIndex(
              (media) =>
                media.contentItem.id === it.contentItem.id &&
                media.urlInfo.url === it.urlInfo.url,
            )}
            state={state.find(
              (m) =>
                m.itemId === it.contentItem.id &&
                m.urlInfo.url === it.urlInfo.url,
            )}
            options={{
              isSelected: selectedMediaIDs.some(
                (id) =>
                  id.itemId === it.contentItem.id &&
                  id.urlInfo.url === it.urlInfo.url,
              ),
              isInInspectedView: false,
              grayOutThumbnail:
                it.contentItem.id === mediaInDetailView?.itemId &&
                it.urlInfo.url === mediaInDetailView?.urlInfo.url,
              isConfirmedCsam: it.isConfirmedCSAM,
            }}
            addLabel={addLabel}
            removeLabel={removeLabel}
            updateSelectedCategory={updateSelectedCategory}
            onClickToInspect={(mediaId) => onClickToInspect(mediaId)}
            shouldBlur={props.shouldBlurAll}
            onMediaError={onMediaError}
          />
        </div>
      ))}
    </div>
  );
}
