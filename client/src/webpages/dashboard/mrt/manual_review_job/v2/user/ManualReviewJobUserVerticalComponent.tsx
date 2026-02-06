import { ReactComponent as UserAlt4 } from '@/icons/lni/User/user-alt-4.svg';
import type { ItemTypeFieldFieldData } from '@/webpages/dashboard/item_types/itemTypeUtils';
import { Button } from 'antd';
import { JsonObject } from 'type-fest';

import { GQLUserItemType } from '../../../../../../graphql/generated';
import { getFieldValueForRole } from '../../../../../../utils/itemUtils';
import FieldsComponent from '../ManualReviewJobFieldsComponent';
import ManualReviewJobMagnifyImageComponent from '../ManualReviewJobMagnifyImageComponent';

export default function ManualReviewJobUserVerticalComponent(props: {
  user: {
    id: string;
    type: Pick<GQLUserItemType, 'id' | 'baseFields' | 'schemaFieldRoles'>;
    data: JsonObject;
  };
  submissionTime?: string;
}) {
  const { user } = props;

  const displayNameKey = user.type.schemaFieldRoles['displayName'];
  const profileIconKey = user.type.schemaFieldRoles['profileIcon'];

  const displayName = getFieldValueForRole(user, 'displayName');
  const profilePicUrl = getFieldValueForRole(user, 'profileIcon');

  return (
    <div className="flex flex-col p-6 ml-6 border border-gray-200 border-solid rounded-2xl">
      <div className="flex flex-row items-center justify-between gap-4">
        <ManualReviewJobMagnifyImageComponent
          imageUrl={profilePicUrl?.url}
          itemIdentifier={{ id: user.id, typeId: user.type.id }}
          label={displayName ? `${displayName} (${user.id})` : user.id}
          fallbackComponent={<UserAlt4 className="p-3 fill-slate-500 w-11" />}
        />
        <Button
          className="rounded-md"
          type="default"
          href={`/dashboard/manual_review/investigation?id=${user.id}&typeId=${
            user.type.id
          }${
            props.submissionTime
              ? `&submissionTime=${props.submissionTime}`
              : ''
          }`}
          target="_blank"
        >
          Full History
        </Button>
      </div>
      <div className="flex h-px my-4 bg-gray-200" />
      <div className="flex flex-col gap-3">
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
    </div>
  );
}
