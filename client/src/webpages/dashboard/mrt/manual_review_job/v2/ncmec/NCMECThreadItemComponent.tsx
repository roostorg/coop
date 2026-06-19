import { Badge } from '@/coop-ui/Badge';
import { Checkbox } from '@/coop-ui/Checkbox';
import { WarningFilled } from '@ant-design/icons';
import { RelatedItem } from '@roostorg/coop-types';
import { JsonObject } from 'type-fest';

import {
  GQLUserItemType,
  type GQLMessageWithIpAddress,
} from '../../../../../../graphql/generated';
import { getPrimaryContentFields } from '../../../../../../utils/itemUtils';
import FieldsComponent from '../ManualReviewJobFieldsComponent';

export default function NCMECThreadItemComponent(props: {
  threadItemWithIpAddress: GQLMessageWithIpAddress;
  author?: RelatedItem;
  authorData?: JsonObject;
  authorType?: GQLUserItemType;
  timestamp?: string;
  isActionable?: boolean;
  unblurAllMedia?: boolean;
  /** Message was authored by the user under NCMEC review (not the same as being
   * included in this report). */
  isSuspectAuthor?: boolean;
  /** Message item that triggered enqueue into the NCMEC queue. */
  triggeredReport?: boolean;
  checkMessage: (message: GQLMessageWithIpAddress) => void;
  isChecked: boolean;
  disableChecks: boolean;
}) {
  const {
    threadItemWithIpAddress,
    author,
    timestamp,
    isSuspectAuthor = false,
    triggeredReport = false,
    isActionable = true,
    unblurAllMedia = false,
  } = props;
  const { message: threadItem } = threadItemWithIpAddress;

  if (!author) {
    return null;
  }

  return (
    <div className="flex items-start w-full gap-3 py-3">
      <div className="flex flex-col gap-1.5 min-w-0 grow">
        <div className="flex items-center justify-between w-full gap-2">
          <div className="flex items-center min-w-0 gap-2">
            <span className="font-medium truncate text-slate-700">
              {author.name ? `${author.name} (${author.id})` : author.id}
            </span>
            {isSuspectAuthor ? (
              <Badge variant="secondary" size="sm" className="shrink-0">
                Suspect
              </Badge>
            ) : null}
            {triggeredReport ? (
              <Badge
                size="sm"
                className="border-transparent shrink-0 gap-1 bg-amber-500 text-white"
              >
                <WarningFilled />
                Triggered report
              </Badge>
            ) : null}
          </div>
          {timestamp ? (
            <span className="text-xs shrink-0 text-slate-400">
              {new Date(timestamp).toLocaleString()}
            </span>
          ) : null}
        </div>
        <div className="px-3 py-2 bg-white border rounded-md border-slate-200">
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
      <Checkbox
        className={`mt-1 shrink-0 ${!isActionable ? 'invisible' : ''}`}
        disabled={props.disableChecks}
        checked={props.isChecked}
        onCheckedChange={() => props.checkMessage(threadItemWithIpAddress)}
      />
    </div>
  );
}
