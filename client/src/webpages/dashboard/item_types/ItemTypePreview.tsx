import { ItemTypeKind } from '@roostorg/types';
import { Tooltip } from 'antd';

import { getDisplayStringForRole, SchemaFieldRoles } from './itemTypeUtils';

type ItemTypeRoles<T extends ItemTypeKind> = T extends 'CONTENT'
  ? {
      createdAt: string | undefined;
      creatorId: string | undefined;
      threadId: string | undefined;
      displayName: string | undefined;
      parentId: string | undefined;
      isDeleted: string | undefined;
    }
  : T extends 'THREAD'
  ? {
      createdAt: string | undefined;
      displayName: string | undefined;
      isDeleted: string | undefined;
    }
  : T extends 'USER'
  ? {
      createdAt: string | undefined;
      displayName: string | undefined;
      profileIcon: string | undefined;
      backgroundImage: string | undefined;
      isDeleted: string | undefined;
    }
  : never | undefined;

export default function ItemTypePreview<T extends ItemTypeKind>(props: {
  kind: T;
  roles: ItemTypeRoles<T>;
}) {
  const { kind, roles } = props;
  switch (kind) {
    case 'CONTENT':
      return <ContentTypePreview roles={roles as ItemTypeRoles<'CONTENT'>} />;
    case 'THREAD':
      return <ThreadTypePreview roles={roles as ItemTypeRoles<'THREAD'>} />;
    case 'USER':
      return <UserTypePreview roles={roles as ItemTypeRoles<'USER'>} />;
  }
}

function ItemTypeTooltipContent(props: {
  role: SchemaFieldRoles;
  kind: ItemTypeKind;
  value: string | undefined;
}) {
  const { role, kind, value } = props;

  return (
    <table className="mx-2 text-sm">
      <tr className="h-2" />
      <tr>
        <td>
          <div className="mr-2 text-gray-500">Name</div>
        </td>
        <td>
          <div className={`${value ? 'text-black' : 'text-slate-300'}`}>
            {value ?? 'No field assigned'}
          </div>
        </td>
      </tr>
      <tr className="h-2" />
      <tr>
        <td>
          <div className="mr-2 text-gray-500">Role</div>
        </td>
        <td>
          <div className="text-black">
            {getDisplayStringForRole(role, kind)}
          </div>
        </td>
      </tr>
      <tr className="h-2" />
    </table>
  );
}

function ItemTypePreviewTooltip(props: {
  children: React.ReactElement;
  kind: ItemTypeKind;
  role: SchemaFieldRoles;
  value: string | undefined;
}) {
  const { children, role, value, kind } = props;

  return (
    <Tooltip
      title={<ItemTypeTooltipContent role={role} value={value} kind={kind} />}
      showArrow={false}
      overlayInnerStyle={{ borderRadius: '8px' }}
    >
      {children}
    </Tooltip>
  );
}

function ContentTypePreview(props: { roles: ItemTypeRoles<'CONTENT'> }) {
  const { roles } = props;
  const { createdAt, creatorId, threadId, displayName, parentId } = roles;

  return (
    <div className="flex flex-col items-stretch w-56 gap-2">
      <ItemTypePreviewTooltip
        role={SchemaFieldRoles.THREAD_ID}
        value={roles['threadId']}
        kind={'CONTENT'}
      >
        <div
          className={`h-4 rounded-lg ${
            threadId
              ? 'bg-blue-100 hover:bg-blue-200'
              : 'bg-slate-300 hover:bg-slate-400'
          }`}
        />
      </ItemTypePreviewTooltip>
      <ItemTypePreviewTooltip
        role={SchemaFieldRoles.PARENT_ID}
        value={roles['parentId']}
        kind={'CONTENT'}
      >
        <div
          className={`h-4 ml-8 rounded-lg ${
            parentId
              ? 'bg-blue-100 hover:bg-blue-200'
              : 'bg-slate-300 hover:bg-slate-400'
          }`}
        />
      </ItemTypePreviewTooltip>
      <div className="flex flex-col items-stretch p-4 border border-solid rounded-lg gap-2 border-slate-200">
        <ItemTypePreviewTooltip
          role={SchemaFieldRoles.CREATED_AT}
          value={roles['createdAt']}
          kind={'CONTENT'}
        >
          <div
            className={`self-end w-1/6 h-3 rounded-lg ${
              createdAt
                ? 'bg-blue-100 hover:bg-blue-200'
                : 'bg-slate-300 hover:bg-slate-400'
            }`}
          />
        </ItemTypePreviewTooltip>
        <ItemTypePreviewTooltip
          role={SchemaFieldRoles.DISPLAY_NAME}
          value={roles['displayName']}
          kind={'CONTENT'}
        >
          <div
            className={`h-3 rounded-lg ${
              displayName
                ? 'bg-blue-100 hover:bg-blue-200'
                : 'bg-slate-300 hover:bg-slate-400'
            }`}
          />
        </ItemTypePreviewTooltip>
        <div className="h-32 rounded-lg bg-slate-200" />
        <div className="w-4/5 h-3 rounded-lg bg-slate-200 " />
        <ItemTypePreviewTooltip
          role={SchemaFieldRoles.CREATOR_ID}
          value={roles['creatorId']}
          kind={'CONTENT'}
        >
          <div
            className={`flex flex-row items-center gap-2 p-4 mt-4 border border-solid rounded-lg ${
              creatorId
                ? 'border-blue-200 hover:border-blue-300'
                : 'border-slate-300 hover:border-slate-400'
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full ${
                creatorId ? 'bg-blue-100' : 'bg-slate-200'
              }`}
            />
            <div
              className={`h-3 rounded-lg ${
                creatorId ? 'bg-blue-100' : 'bg-slate-200'
              } grow`}
            />
          </div>
        </ItemTypePreviewTooltip>
      </div>
    </div>
  );
}

function ThreadTypePreview(props: { roles: ItemTypeRoles<'THREAD'> }) {
  const { roles } = props;
  const { createdAt, displayName } = roles;

  return (
    <div className="flex flex-col items-stretch w-56 gap-2">
      <ItemTypePreviewTooltip
        role={SchemaFieldRoles.DISPLAY_NAME}
        value={roles['displayName']}
        kind={'THREAD'}
      >
        <div
          className={`h-4 rounded-lg ${
            displayName
              ? 'bg-blue-100 hover:bg-blue-200'
              : 'bg-slate-300 hover:bg-slate-400'
          }`}
        />
      </ItemTypePreviewTooltip>
      <ItemTypePreviewTooltip
        role={SchemaFieldRoles.CREATED_AT}
        value={roles['createdAt']}
        kind={'THREAD'}
      >
        <div
          className={`h-4 mr-8 rounded-lg ${
            createdAt
              ? 'bg-blue-100 hover:bg-blue-200'
              : 'bg-slate-300 hover:bg-slate-400'
          }`}
        />
      </ItemTypePreviewTooltip>
      <div className="flex flex-col items-stretch p-4 mt-4 border border-solid rounded-lg gap-2 border-slate-200">
        <div className="self-end w-1/6 h-3 rounded-lg bg-slate-200" />
        <div className="h-3 rounded-lg bg-slate-200" />
        <div className="h-32 rounded-lg bg-slate-200" />
        <div className="w-4/5 h-3 rounded-lg bg-slate-200 " />
        <div className="flex flex-row items-center p-4 mt-4 border border-solid rounded-lg gap-2 border-slate-200">
          <div className="w-8 h-8 rounded-full bg-slate-200" />
          <div className="h-3 rounded-lg bg-slate-200 grow" />
        </div>
      </div>
    </div>
  );
}

function UserTypePreview(props: { roles: ItemTypeRoles<'USER'> }) {
  const { roles } = props;
  const { createdAt, displayName, profileIcon, backgroundImage } = roles;

  return (
    <div className="flex flex-col w-56 p-4 border border-solid rounded-lg gap-2 border-slate-200">
      <div className="flex flex-row items-center gap-2">
        <ItemTypePreviewTooltip
          role={SchemaFieldRoles.PROFILE_ICON}
          value={roles['profileIcon']}
          kind={'USER'}
        >
          <div
            className={`w-8 h-8 rounded-full ${
              profileIcon
                ? 'bg-blue-100 hover:bg-blue-200'
                : 'bg-slate-300 hover:bg-slate-400'
            }`}
          />
        </ItemTypePreviewTooltip>
        <ItemTypePreviewTooltip
          role={SchemaFieldRoles.DISPLAY_NAME}
          value={roles['displayName']}
          kind={'USER'}
        >
          <div
            className={`h-3 rounded-lg grow ${
              displayName
                ? 'bg-blue-100 hover:bg-blue-200'
                : 'bg-slate-300 hover:bg-slate-400'
            }`}
          />
        </ItemTypePreviewTooltip>
        <ItemTypePreviewTooltip
          role={SchemaFieldRoles.CREATED_AT}
          value={roles['createdAt']}
          kind={'USER'}
        >
          <div
            className={`w-12 h-3 rounded-lg ${
              createdAt
                ? 'bg-blue-100 hover:bg-blue-200'
                : 'bg-slate-300 hover:bg-slate-400'
            }`}
          />
        </ItemTypePreviewTooltip>
      </div>
      <ItemTypePreviewTooltip
        role={SchemaFieldRoles.BACKGROUND_IMAGE}
        value={roles['backgroundImage']}
        kind={'USER'}
      >
        <div
          className={`h-32 mt-4 rounded-lg ${
            backgroundImage
              ? 'bg-blue-100 hover:bg-blue-200'
              : 'bg-slate-300 hover:bg-slate-400'
          }`}
        />
      </ItemTypePreviewTooltip>
    </div>
  );
}
