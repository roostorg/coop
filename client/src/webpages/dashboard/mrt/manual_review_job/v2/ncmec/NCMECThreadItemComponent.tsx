import { Checkbox } from '@/coop-ui/Checkbox';
import { ReactComponent as UserAlt4 } from '@/icons/lni/User/user-alt-4.svg';
import { WarningFilled } from '@ant-design/icons';
import { RelatedItem } from '@roostorg/types';
import { JsonObject } from 'type-fest';

import {
  GQLUserItemType,
  type GQLMessageWithIpAddress,
} from '../../../../../../graphql/generated';
import {
  getFieldValueForRole,
  getPrimaryContentFields,
} from '../../../../../../utils/itemUtils';
import FieldsComponent from '../ManualReviewJobFieldsComponent';
import ManualReviewJobMagnifyImageComponent from '../ManualReviewJobMagnifyImageComponent';

export default function NCMECThreadItemComponent(props: {
  threadItemWithIpAddress: GQLMessageWithIpAddress;
  author?: RelatedItem;
  authorData?: JsonObject;
  authorType?: GQLUserItemType;
  timestamp?: string;
  isActionable?: boolean;
  unblurAllMedia?: boolean;
  isReported: boolean;
  checkMessage: (message: GQLMessageWithIpAddress) => void;
  isChecked: boolean;
  disableChecks: boolean;
}) {
  const {
    threadItemWithIpAddress,
    author,
    authorType,
    timestamp,
    authorData,
    isReported,
    isActionable = true,
    unblurAllMedia = false,
  } = props;
  const { message: threadItem } = threadItemWithIpAddress;

  if (!author || !authorType) {
    return null;
  }
  const [profileImage, backgroundImage] = authorData
    ? [
        getFieldValueForRole(
          { type: authorType, data: authorData },
          'profileIcon',
        ),
        getFieldValueForRole(
          { type: authorType, data: authorData },
          'backgroundImage',
        ),
      ]
    : [undefined, undefined];

  return (
    <div className="flex flex-row w-full">
      <div className="flex flex-col grow">
        <div className="flex flex-row mb-1.5 items-start">
          <span className="mr-3">
            <ManualReviewJobMagnifyImageComponent
              itemIdentifier={{ id: author.id, typeId: author.typeId }}
              imageUrl={profileImage?.url}
              magnifiedUrls={backgroundImage ? [backgroundImage.url] : []}
              fallbackComponent={
                <UserAlt4 className="p-3 fill-slate-500 w-11" />
              }
            />
          </span>
          <div className="flex flex-col grow">
            <div className="flex items-center justify-between w-full mb-1 gap-2">
              <div className="flex items-center gap-2">
                <div
                  className={`self-start font-medium
                    text-slate-500
                  `}
                >
                  {author?.name
                    ? `${author?.name} (${author?.id})`
                    : `${author?.id}`}
                </div>
                {isReported ? (
                  <div className="flex px-2 py-1 text-xs font-medium text-white rounded gap-1 bg-coop-alert-red">
                    Reported
                    <WarningFilled className="flex items-center justify-center" />
                  </div>
                ) : null}
              </div>
              {timestamp ? (
                <div className="self-end pt-2 text-slate-400">
                  {new Date(timestamp).toLocaleString()}
                </div>
              ) : null}
            </div>
            <div className="flex flex-row items-center justify-between">
              <div className="flex flex-col w-full">
                <div className="flex flex-row items-center justify-between rounded bg-slate-200 grow">
                  <FieldsComponent
                    fields={getPrimaryContentFields(
                      threadItem.type.baseFields,
                      threadItem.data,
                    )}
                    itemTypeId={threadItem.type.id}
                    options={{
                      hideLabels: true,
                      maxWidthImage: 300,
                      maxWidthVideo: 300,
                      unblurAllMedia,
                      transparentBackground: true,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="ml-2 mr-2">
        <Checkbox
          className={`self-center ml-4 grow-0 mt-6 mr-4 ${
            !isActionable ? 'invisible' : ''
          }`}
          disabled={props.disableChecks}
          checked={props.isChecked}
          onCheckedChange={() => props.checkMessage(threadItemWithIpAddress)}
        />
      </div>
    </div>
  );
}
