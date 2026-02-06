import { ReactComponent as Sparkles } from '@/icons/lni/Weather/sparkles.svg';
import { ReactComponent as CopyAlt } from '@/icons/lni/Web and Technology/copy-alt.svg';
import { ReadOutlined } from '@ant-design/icons';
import { gql } from '@apollo/client';
import { ItemTypeKind } from '@roostorg/types';
import capitalize from 'lodash/capitalize';
import { MouseEvent, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useSearchParams } from 'react-router-dom';

import CopyTextComponent from '../../../components/common/CopyTextComponent';
import FullScreenLoading from '../../../components/common/FullScreenLoading';
import CoopButton from '../components/CoopButton';
import CoopModal from '../components/CoopModal';
import DashboardHeader from '../components/DashboardHeader';
import EmptyDashboard from '../components/EmptyDashboard';
import RowMutations, { DeleteRowModalInfo } from '../components/RowMutations';
import TabBar from '../components/TabBar';
import { ColumnProps, DefaultColumnFilter } from '../components/table/filters';
import { stringSort } from '../components/table/sort';
import Table from '../components/table/Table';

import {
  GQLUserPermission,
  useGQLDeleteItemTypeMutation,
  useGQLItemTypesQuery,
  type GQLItemType,
} from '../../../graphql/generated';
import CollectionIcon from '../../../icons/CollectionIcon';
import ContentIcon from '../../../icons/ContentIcon';
import QuestionCircleIcon from '../../../icons/QuestionCircleIcon';
import UserIcon from '../../../icons/UserIcon';
import { userHasPermissions } from '../../../routing/permissions';
import { ITEM_TYPE_FRAGMENT } from '../rules/rule_form/RuleForm';
import ItemTypesExplainer from './ItemTypesExplainer';
import {
  displayStringForItemTypeKind,
  generateFakeItemsForItemType,
} from './itemTypeUtils';

export const ITEM_FRAGMENT = gql`
  ${ITEM_TYPE_FRAGMENT}
  fragment ItemFields on ItemBase {
    id
    submissionId
    submissionTime
    type {
      ...ItemTypeFragment
      ... on UserItemType {
        schemaFieldRoles {
          displayName
          createdAt
          profileIcon
          backgroundImage
          isDeleted
        }
      }
      ... on ContentItemType {
        schemaFieldRoles {
          displayName
          parentId
          threadId
          createdAt
          creatorId
          isDeleted
        }
      }
      ... on ThreadItemType {
        schemaFieldRoles {
          displayName
          createdAt
          creatorId
          isDeleted
        }
      }
    }
    data
  }
`;

export const ITEM_TYPES_QUERY = gql`
  ${ITEM_TYPE_FRAGMENT}
  query ItemTypes {
    myOrg {
      itemTypes {
        ... on ItemTypeBase {
          ...ItemTypeFragment
        }
        ... on UserItemType {
          isDefaultUserType
        }
      }
    }
    me {
      permissions
    }
  }
`;

const ItemTypeDashboardTabs = [
  'CONTENT',
  'THREAD',
  'USER',
  'EXPLAINER',
] as const;
type ItemTypeDashboardTab = (typeof ItemTypeDashboardTabs)[number];

/**
 * Item Types Dashboard screen
 */
export default function ItemTypesDashboard() {
  const { loading, error, data, refetch } = useGQLItemTypesQuery({
    fetchPolicy: 'network-only',
  });

  const [deleteItemType] = useGQLDeleteItemTypeMutation({
    onError: (error) =>
      setErrorMessage(
        error.name === 'CannotDeleteDefaultUserError'
          ? "You cannot delete your organization's default item type"
          : 'Error deleting item type.',
      ),
    onCompleted: async () => refetch(),
  });

  const [modalInfo, setModalInfo] = useState<DeleteRowModalInfo | null>(null);
  const [canEditItemTypes, setCanEditItemTypes] = useState(true);
  const [searchParams] = useSearchParams();
  const kindInSearchParams = searchParams.get('kind');
  const [selectedTab, setSelectedTab] = useState<ItemTypeDashboardTab>(
    kindInSearchParams &&
      ItemTypeDashboardTabs.includes(kindInSearchParams as ItemTypeDashboardTab)
      ? (kindInSearchParams as ItemTypeDashboardTab)
      : ItemTypeKind.CONTENT,
  );
  const [errorMessage, setErrorMessage] = useState<string | undefined>(
    undefined,
  );
  const [itemTypeIdToGenerate, setItemTypeIdToGenerate] = useState<
    string | undefined
  >(undefined);
  const navigate = useNavigate();

  const permissions = data?.me?.permissions;
  useMemo(
    () =>
      setCanEditItemTypes(
        userHasPermissions(permissions, [GQLUserPermission.ManageOrg]),
      ),
    [permissions],
  );

  const { itemTypes: allItemTypes } = data?.myOrg ?? {};

  const labelForTab = (tab: ItemTypeDashboardTab) => {
    switch (tab) {
      case 'CONTENT':
      case 'THREAD':
      case 'USER':
        return displayStringForItemTypeKind(tab);
      case 'EXPLAINER':
        return 'What are Item Types?';
    }
  };
  const iconForTab = (tab: ItemTypeDashboardTab) => {
    switch (tab) {
      case 'CONTENT':
        return <ContentIcon width="22px" />;
      case 'THREAD':
        return <CollectionIcon width="22px" />;
      case 'USER':
        return <UserIcon width="22px" />;
      case 'EXPLAINER':
        return <QuestionCircleIcon width="22px" />;
    }
  };
  const tabBar = (
    <TabBar
      tabs={ItemTypeDashboardTabs.map((value) => ({
        label: labelForTab(value),
        icon: iconForTab(value),
        value,
      }))}
      initialSelectedTab={selectedTab ?? 'CONTENT'}
      onTabClick={(val) => setSelectedTab(val)}
      currentSelectedTab={selectedTab}
    />
  );

  const mutations = (itemType: { id: string; isDefaultUserType?: boolean }) => {
    const { id, isDefaultUserType } = itemType;
    const canDelete =
      canEditItemTypes && (selectedTab !== 'USER' || !isDefaultUserType);

    if (selectedTab == null) {
      return;
    }

    if (
      process.env.NODE_ENV === 'development' &&
      !itemTypes
        ?.find((it) => it.id === id)
        ?.baseFields?.some((it) =>
          ['RELATED_ITEM', 'AUDIO', 'POLICY_ID'].includes(it.type),
        )
    ) {
      return (
        <div className="flex flex-row">
          <RowMutations
            onEdit={(event: MouseEvent) => editItemType(id, event)}
            onDelete={(event: MouseEvent) => showModal(id, event)}
            canDelete={canDelete}
          />
          <div
            className="pt-1 ml-1 cursor-pointer"
            onClick={() => setItemTypeIdToGenerate(id)}
            title="Generate Mock Items"
          >
            <Sparkles className="w-4 h-4" />
          </div>
        </div>
      );
    }

    return (
      <RowMutations
        onEdit={(event: MouseEvent) => editItemType(id, event)}
        onDelete={(event: MouseEvent) => showModal(id, event)}
        canDelete={canDelete}
        deleteDisabledTooltipTitle={
          isDefaultUserType
            ? "You cannot delete your organization's default user type."
            : "To delete Item Types, ask your organization's admin to upgrade your role to Admin."
        }
      />
    );
  };

  const editItemType = (id: string, event: MouseEvent) => {
    // This ensures that the row's onClick isn't called because
    // the row is the parent component
    event.stopPropagation();
    if (allItemTypes == null) {
      return;
    }
    navigate(`form/${id}`);
  };

  const showModal = (id: string, event: MouseEvent) => {
    // This ensures that the row's onClick isn't called because
    // the row is the parent component
    event.stopPropagation();
    setModalInfo({
      id,
      visible: true,
    });
  };

  const columns = useMemo(
    () => [
      {
        Header: 'Name',
        accessor: 'name',
        Filter: (props: ColumnProps) =>
          DefaultColumnFilter({
            columnProps: props,
            accessor: 'name',
          }),
        filter: 'text',
        sortType: stringSort,
      },
      {
        Header: 'Description',
        accessor: 'description',
        Filter: (props: ColumnProps) =>
          DefaultColumnFilter({
            columnProps: props,
            accessor: 'description',
          }),
        filter: 'text',
        sortType: stringSort,
      },
      {
        Header: 'ID',
        accessor: 'id',
        Filter: (props: ColumnProps) =>
          DefaultColumnFilter({
            columnProps: props,
            accessor: 'id',
          }),
        filter: 'text',
        canSort: false,
      },
      {
        Header: '',
        accessor: 'mutations', // accessor is the "key" in the data
        canSort: false,
      },
    ],
    [],
  );
  const itemTypes = useMemo(() => {
    switch (selectedTab) {
      case 'CONTENT':
        return allItemTypes?.filter(
          (it) => it.__typename === 'ContentItemType',
        );
      case 'USER':
        return allItemTypes?.filter((it) => it.__typename === 'UserItemType');
      case 'THREAD':
        return allItemTypes?.filter((it) => it.__typename === 'ThreadItemType');
      default:
        return [];
    }
  }, [selectedTab, allItemTypes]);

  const itemTypesData = useMemo(() => {
    return itemTypes?.map((itemType) => ({
      name: itemType.name,
      description: itemType.description,
      id: itemType.id,
      kind: selectedTab,
    }));
  }, [itemTypes, selectedTab]);

  const tableData = useMemo(
    () =>
      itemTypes
        ?.slice()
        ?.sort((a, b) => a.name.localeCompare(b.name))
        .map((itemType) => {
          return {
            mutations: mutations(itemType),
            name: (
              <div className="flex flex-col items-start">
                <div className="text-base font-bold">{itemType.name}</div>
                {itemType.__typename === 'UserItemType' &&
                itemType.isDefaultUserType ? (
                  <div className="text-xs">Default User Type</div>
                ) : null}
              </div>
            ),
            description: itemType.description,
            id: <CopyTextComponent value={itemType.id} />,
            itemType,
            values: itemType,
          };
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      canEditItemTypes, // Included because it's used in mutations()
      mutations,
      itemTypes,
    ],
  );

  useEffect(() => {
    // Orgs will always start with one item type, which is the default
    // user item type. If that's the only one that has been created, we should
    // default to the explainer tab.
    if (allItemTypes && allItemTypes.length <= 1) {
      setSelectedTab('EXPLAINER');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allItemTypes?.length]);

  if (error) {
    throw error;
  }
  if (loading) {
    return <FullScreenLoading />;
  }

  const onCancel = () => setModalInfo(null);

  const deleteModal = (
    <CoopModal
      title={
        modalInfo == null || itemTypes == null
          ? `Delete ${capitalize(selectedTab)} Type`
          : `Delete '${itemTypes.find((it) => it.id === modalInfo.id)!.name}'`
      }
      visible={modalInfo?.visible ?? false}
      footer={[
        {
          title: 'Cancel',
          onClick: onCancel,
          type: 'secondary',
        },
        {
          title: 'Delete',
          onClick: () => {
            if (modalInfo == null || itemTypes == null) {
              return;
            }

            const itemToDelete = itemTypes.find((it) => it.id === modalInfo.id);

            if (itemToDelete == null) {
              return;
            }

            if (
              itemToDelete.__typename === 'UserItemType' &&
              itemToDelete.isDefaultUserType
            ) {
              setErrorMessage('Cannot delete default user type');
              return;
            }

            deleteItemType({
              variables: {
                id: modalInfo.id,
              },
            });
            setModalInfo(null);
          },
          type: 'primary',
        },
      ]}
      onClose={onCancel}
    >
      Are you sure you want to delete this {selectedTab?.toLowerCase()} type?
      You can't undo this action.
    </CoopModal>
  );

  const errorModal = (
    <CoopModal
      title="Error"
      visible={errorMessage != null}
      onClose={() => setErrorMessage(undefined)}
      footer={[
        {
          title: 'OK',
          onClick: () => setErrorMessage(undefined),
        },
      ]}
    >
      {errorMessage}
    </CoopModal>
  );

  const createButton = (
    <CoopButton
      title="Create Item Type"
      destination={`form?kind=${selectedTab}`}
      disabled={!canEditItemTypes}
      disabledTooltipTitle="To create Item Types, ask your organization's admin to upgrade your role to Admin."
      disabledTooltipPlacement="bottomRight"
    />
  );

  const emptyDashboard = (
    <EmptyDashboard
      buttonLinkPath={`form?kind=${selectedTab}`}
      buttonTitle={`Create ${capitalize(selectedTab)} Type`}
      dashboardName={`${capitalize(selectedTab)} Types`}
      icon={<ReadOutlined />}
      buttonDisabled={!canEditItemTypes}
    />
  );

  const noItemTypesYet = itemTypesData && itemTypesData.length === 0;

  const itemTypeToGenerate = itemTypeIdToGenerate
    ? itemTypes?.find((it) => it.id === itemTypeIdToGenerate)
    : undefined;
  return (
    <div className="flex flex-col">
      <Helmet>
        <title>Item Types</title>
      </Helmet>
      <DashboardHeader
        title="Item Types"
        subtitle="Item types are used to define the schemas of the different types of content you'll be sending to Coop."
        rightComponent={
          selectedTab !== 'EXPLAINER' && noItemTypesYet ? null : createButton
        }
      />
      {tabBar}
      {selectedTab === 'EXPLAINER' ? (
        <ItemTypesExplainer />
      ) : noItemTypesYet ? (
        emptyDashboard
      ) : (
        /* @ts-ignore */
        <Table columns={columns} data={tableData} />
      )}
      {deleteModal}
      {errorModal}
      <ItemTypeGeneratorModal
        itemType={itemTypeToGenerate as GQLItemType}
        visible={itemTypeIdToGenerate != null}
        onClose={() => setItemTypeIdToGenerate(undefined)}
      />
    </div>
  );
}

function ItemTypeGeneratorModal(props: {
  itemType?: GQLItemType;
  visible: boolean;
  onClose: () => void;
}) {
  const { itemType, visible, onClose } = props;
  const [numItems, setNumItems] = useState(5);

  if (process.env.NODE_ENV !== 'development' || !itemType) {
    return undefined;
  }

  const generatedItems = JSON.stringify(
    generateFakeItemsForItemType(itemType, numItems),
    null,
    2,
  );

  return (
    <CoopModal visible={visible} onClose={onClose} title="Generate Mock Items">
      <div className="flex flex-col">
        <div className="flex flex-row items-center mb-2">
          Num items:{' '}
          <input
            className="w-24 h-8 ml-2"
            value={numItems}
            onChange={(e) => setNumItems(Number(e.target.value))}
          />
          <div title="Copy to clipboard">
            <CopyAlt
              className="w-8 h-8 ml-4 cursor-pointer"
              onClick={async () =>
                navigator.clipboard.writeText(generatedItems)
              }
            />
          </div>
        </div>
        <textarea cols={50} rows={20} value={generatedItems} />
      </div>
    </CoopModal>
  );
}
