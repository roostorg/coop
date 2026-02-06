import { CodeOutlined, UserOutlined } from '@ant-design/icons';
import type { ItemTypeKind } from '@roostorg/types';
import { useState } from 'react';

import TabBar from '../components/TabBar';

import { titleCaseEnumString } from '../../../utils/string';
import type { FieldState } from './ItemTypeFormCustomField';
import ItemTypePreview from './ItemTypePreview';
import ItemTypeRequestCodeSamples from './ItemTypeRequestCodeSamples';
import { SchemaFieldRoles } from './itemTypeUtils';

type RightPanelTabs = 'Preview' | 'SampleRequest';

export default function ItemTypeFormRightPanel(props: {
  itemTypeId?: string;
  itemTypeKind: ItemTypeKind;
  fields: FieldState[];
}) {
  const { itemTypeId, itemTypeKind, fields } = props;
  const [activeTab, setActiveTab] = useState<RightPanelTabs>('Preview');

  return (
    <div className="flex flex-col grow">
      <TabBar
        tabs={[
          {
            label: 'Preview',
            value: 'Preview',
            icon: <UserOutlined />,
          },
          {
            label: 'API Request',
            value: 'SampleRequest',
            icon: <CodeOutlined />,
          },
        ]}
        initialSelectedTab={activeTab}
        onTabClick={setActiveTab}
        currentSelectedTab={activeTab}
      />
      {activeTab === 'Preview' && (
        <div className="mx-4 mt-3 mb-6 text-sm text-gray-500">
          {`Add Roles to your ${titleCaseEnumString(
            itemTypeKind,
          )} Item to better render the Item across Coop and
         help us understand the relationships between your Item Types.`}
        </div>
      )}
      {activeTab === 'Preview' ? (
        <div className="flex flex-col items-center grow-0">
          <ItemTypePreview
            kind={itemTypeKind}
            roles={{
              createdAt: fields.find(
                (it) => it.role === SchemaFieldRoles.CREATED_AT,
              )?.name,
              creatorId: fields.find(
                (it) => it.role === SchemaFieldRoles.CREATOR_ID,
              )?.name,
              threadId: fields.find(
                (it) => it.role === SchemaFieldRoles.THREAD_ID,
              )?.name,
              displayName: fields.find(
                (it) => it.role === SchemaFieldRoles.DISPLAY_NAME,
              )?.name,
              parentId: fields.find(
                (it) => it.role === SchemaFieldRoles.PARENT_ID,
              )?.name,
              profileIcon: fields.find(
                (it) => it.role === SchemaFieldRoles.PROFILE_ICON,
              )?.name,
              backgroundImage: fields.find(
                (it) => it.role === SchemaFieldRoles.BACKGROUND_IMAGE,
              )?.name,
              isDeleted: fields.find(
                (it) => it.role === SchemaFieldRoles.IS_DELETED,
              )?.name,
            }}
          />
        </div>
      ) : (
        <ItemTypeRequestCodeSamples itemTypeId={itemTypeId} />
      )}
    </div>
  );
}
