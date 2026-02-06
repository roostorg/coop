import { PlusOutlined } from '@ant-design/icons';
import { gql } from '@apollo/client';
import { ItemTypeKind } from '@roostorg/types';
import { Button, Input, Select } from 'antd';
import capitalize from 'lodash/capitalize';
import invert from 'lodash/invert';
import pickBy from 'lodash/pickBy';
import { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import FullScreenLoading from '../../../components/common/FullScreenLoading';
import CoopButton from '../components/CoopButton';
import CoopModal from '../components/CoopModal';
import FormHeader from '../components/FormHeader';
import FormSectionHeader from '../components/FormSectionHeader';

import {
  GQLFieldInput,
  GQLItemTypeDocument,
  GQLScalarType,
  GQLUserPermission,
  namedOperations,
  useGQLCreateContentTypeMutation,
  useGQLCreateThreadTypeMutation,
  useGQLCreateUserTypeMutation,
  useGQLItemTypeFormOrgQuery,
  useGQLItemTypeQuery,
  useGQLPermissionGatedRouteLoggedInUserQuery,
  useGQLUpdateContentTypeMutation,
  useGQLUpdateThreadTypeMutation,
  useGQLUpdateUserTypeMutation,
  type GQLItemType,
} from '../../../graphql/generated';
import { stripTypename } from '../../../graphql/inputHelpers';
import { userHasPermissions } from '../../../routing/permissions';
import { filterNullOrUndefined } from '../../../utils/collections';
import { safePick } from '../../../utils/misc';
import { ITEM_TYPE_FRAGMENT } from '../rules/rule_form/RuleForm';
import ItemTypeFormCustomField, {
  type FieldState,
} from './ItemTypeFormCustomField';
import ItemTypeFormRightPanel from './ItemTypeFormRightPanel';
import {
  displayStringForItemTypeKind,
  SchemaFieldRoles,
  type FieldRoles,
} from './itemTypeUtils';

const { Option } = Select;

gql`
  ${ITEM_TYPE_FRAGMENT}
  query ItemType($id: ID!) {
    itemType(id: $id) {
      ...ItemTypeFragment
    }
  }

  query ItemTypeFormOrg {
    myOrg {
      id
    }
  }

  mutation DeleteItemType($id: ID!) {
    deleteItemType(id: $id) {
      ... on DeleteItemTypeSuccessResponse {
        _
      }
      ... on CannotDeleteDefaultUserError {
        title
      }
    }
  }
  mutation CreateContentType($input: CreateContentItemTypeInput!) {
    createContentItemType(input: $input) {
      ... on MutateContentTypeSuccessResponse {
        data {
          id
        }
      }
      ... on Error {
        title
      }
    }
  }
  mutation UpdateContentType($input: UpdateContentItemTypeInput!) {
    updateContentItemType(input: $input) {
      ... on MutateContentTypeSuccessResponse {
        data {
          id
        }
      }
      ... on Error {
        title
      }
    }
  }
  mutation CreateUserType($input: CreateUserItemTypeInput!) {
    createUserItemType(input: $input) {
      ... on MutateUserTypeSuccessResponse {
        data {
          id
        }
      }
      ... on Error {
        title
      }
    }
  }
  mutation UpdateUserType($input: UpdateUserItemTypeInput!) {
    updateUserItemType(input: $input) {
      ... on MutateUserTypeSuccessResponse {
        data {
          id
        }
      }
      ... on Error {
        title
      }
    }
  }
  mutation CreateThreadType($input: CreateThreadItemTypeInput!) {
    createThreadItemType(input: $input) {
      ... on MutateThreadTypeSuccessResponse {
        data {
          id
        }
      }
      ... on Error {
        title
      }
    }
  }
  mutation UpdateThreadType($input: UpdateThreadItemTypeInput!) {
    updateThreadItemType(input: $input) {
      ... on MutateThreadTypeSuccessResponse {
        data {
          id
        }
      }
      ... on Error {
        title
      }
    }
  }
`;

type ItemTypeFormState = {
  name: string;
  description: string | undefined;
  itemTypeKind: ItemTypeKind;
  customFields: FieldState[];
};

/**
 * Item Type Form screen, where item types can be created or edited.
 * This component has some complexity associated with state and input
 * validation because of some Ant Design bugs. We have to wrap each
 * form input in its own div to make state work properly, and when we do
 * that, the normal 'rules' prop on <Form.Item> doesn't work. So we
 * had to implement custom validation rules that run when the form is
 * submitted.
 */
export default function ItemTypeForm() {
  const [searchParams] = useSearchParams();
  const kindInSearchParams = searchParams.get('kind');

  const [state, setState] = useState<ItemTypeFormState>({
    name: '',
    description: undefined,
    itemTypeKind:
      kindInSearchParams &&
      Object.values(ItemTypeKind).includes(kindInSearchParams as ItemTypeKind)
        ? (kindInSearchParams as ItemTypeKind)
        : ItemTypeKind.CONTENT,
    customFields: [getDefaultEmptyField(0)],
  });

  const [modalInfo, setModalInfo] = useState<{
    visible: boolean;
    body: string | undefined;
  }>({ visible: false, body: '' });
  const { name, description, itemTypeKind, customFields } = state;
  const setName = (name: string) => setState((prev) => ({ ...prev, name }));
  const setDescription = (description: string) =>
    setState((prev) => ({ ...prev, description }));
  const setItemTypeKind = (kind: ItemTypeKind) =>
    setState((prev) => ({ ...prev, itemTypeKind: kind }));
  const setCustomFields = (fields: FieldState[]) =>
    setState((prev) => ({ ...prev, customFields: fields }));

  const showModal = (errorText?: string) =>
    setModalInfo({ visible: true, body: errorText! });
  const hideModal = () => setModalInfo({ visible: false, body: undefined });

  const setNameAlreadyExistsError = () => {
    showModal('An item type with that name already exists. Please try again.');
  };

  const [
    createContentType,
    { loading: createContentTypeLoading, error: createContentTypeError },
  ] = useGQLCreateContentTypeMutation({
    onError: (_error) => showModal(),
    onCompleted: (response) => {
      switch (response?.createContentItemType.__typename) {
        case 'MutateContentTypeSuccessResponse':
          showModal();
          break;
        case 'ItemTypeNameAlreadyExistsError':
          setNameAlreadyExistsError();
          break;
      }
    },
  });
  const [
    updateContentType,
    { loading: updateContentTypeLoading, error: updateContentTypeError },
  ] = useGQLUpdateContentTypeMutation({
    onError: (_error) => showModal(),
    onCompleted: (response) => {
      switch (response?.updateContentItemType.__typename) {
        case 'MutateContentTypeSuccessResponse':
          showModal();
          break;
        case 'ItemTypeNameAlreadyExistsError':
          setNameAlreadyExistsError();
          break;
      }
    },
  });

  const [
    createUserType,
    { loading: createUserTypeLoading, error: createUserTypeError },
  ] = useGQLCreateUserTypeMutation({
    onError: (_error) => showModal(),
    onCompleted: (response) => {
      switch (response?.createUserItemType.__typename) {
        case 'MutateUserTypeSuccessResponse':
          showModal();
          break;
        case 'ItemTypeNameAlreadyExistsError':
          setNameAlreadyExistsError();
          break;
      }
    },
  });
  const [
    updateUserType,
    { loading: updateUserTypeLoading, error: updateUserTypeError },
  ] = useGQLUpdateUserTypeMutation({
    onError: (_error) => showModal(),
    onCompleted: (response) => {
      switch (response?.updateUserItemType.__typename) {
        case 'MutateUserTypeSuccessResponse':
          showModal();
          break;
        case 'ItemTypeNameAlreadyExistsError':
          setNameAlreadyExistsError();
          break;
      }
    },
  });

  const [
    createThreadType,
    { loading: createThreadTypeLoading, error: createThreadTypeError },
  ] = useGQLCreateThreadTypeMutation({
    onError: (_error) => showModal(),
    onCompleted: (response) => {
      switch (response?.createThreadItemType.__typename) {
        case 'MutateThreadTypeSuccessResponse':
          showModal();
          break;
        case 'ItemTypeNameAlreadyExistsError':
          setNameAlreadyExistsError();
          break;
      }
    },
  });
  const [
    updateThreadType,
    { loading: updateThreadTypeLoading, error: updateThreadTypeError },
  ] = useGQLUpdateThreadTypeMutation({
    onError: (_error) => showModal(),
    onCompleted: (response) => {
      switch (response?.updateThreadItemType.__typename) {
        case 'MutateThreadTypeSuccessResponse':
          showModal();
          break;
        case 'ItemTypeNameAlreadyExistsError':
          setNameAlreadyExistsError();
          break;
      }
    },
  });

  const loading = useMemo(
    () =>
      createContentTypeLoading ||
      updateContentTypeLoading ||
      createUserTypeLoading ||
      updateUserTypeLoading ||
      createThreadTypeLoading ||
      updateThreadTypeLoading,
    [
      createContentTypeLoading,
      updateContentTypeLoading,
      createUserTypeLoading,
      updateUserTypeLoading,
      createThreadTypeLoading,
      updateThreadTypeLoading,
    ],
  );
  const hasError = useMemo(
    () =>
      createContentTypeError != null ||
      updateContentTypeError != null ||
      createUserTypeError != null ||
      updateUserTypeError != null ||
      createThreadTypeError != null ||
      updateThreadTypeError != null,
    [
      createContentTypeError,
      updateContentTypeError,
      createUserTypeError,
      updateUserTypeError,
      createThreadTypeError,
      updateThreadTypeError,
    ],
  );

  const readableKind = useMemo(
    () => capitalize(itemTypeKind ?? 'Item'),
    [itemTypeKind],
  );

  const navigate = useNavigate();
  const { id } = useParams<{ id: string | undefined }>();

  const { loading: orgQueryLoading } = useGQLItemTypeFormOrgQuery();

  const itemTypeQueryParams = useGQLItemTypeQuery({
    variables: { id: id ?? '' },
    skip: id == null,
  });
  const itemType = itemTypeQueryParams.data?.itemType;
  const itemTypeQueryLoading = itemTypeQueryParams.loading;
  const itemTypeQueryError = itemTypeQueryParams.error;

  const userQueryParams = useGQLPermissionGatedRouteLoggedInUserQuery();
  const userQueryLoading = userQueryParams.loading;
  const userQueryError = userQueryParams.error;
  const permissions = userQueryParams.data?.me?.permissions;

  /**
   * If editing an existing item type and the item type query
   * has finished, reset the state values to whatever the query returned
   */
  useMemo(() => {
    if (itemType != null) {
      setState({
        name: itemType.name,
        description: itemType.description ?? undefined,
        itemTypeKind: getKindForItemType(itemType),
        customFields: baseFieldsToFieldState(
          itemType.baseFields,
          itemType.schemaFieldRoles,
          itemType.hiddenFields,
        ),
      });
    }
  }, [itemType]);

  if (itemTypeQueryError ?? userQueryError) {
    // eslint-disable-next-line @typescript-eslint/no-throw-literal
    throw itemTypeQueryError ?? userQueryError;
  }
  if (itemTypeQueryLoading || userQueryLoading || orgQueryLoading) {
    return <FullScreenLoading />;
  }
  const canEditItemTypes = userHasPermissions(permissions, [
    GQLUserPermission.ManageOrg,
  ]);
  const roleSelectionIsValid = (() => {
    const roles = new Set(
      filterNullOrUndefined(customFields.map((it) => it.role)),
    );

    if (roles.has(SchemaFieldRoles.PARENT_ID)) {
      return (
        roles.has(SchemaFieldRoles.THREAD_ID) &&
        roles.has(SchemaFieldRoles.CREATED_AT)
      );
    }

    if (roles.has(SchemaFieldRoles.THREAD_ID)) {
      return roles.has(SchemaFieldRoles.CREATED_AT);
    }

    return true;
  })();

  const onCreateItemType = async (values: ItemTypeFormState) => {
    const mutation = (() => {
      switch (itemTypeKind) {
        case 'CONTENT':
          return createContentType;
        case 'USER':
          return createUserType;
        case 'THREAD':
          return createThreadType;
        default:
          throw new Error(
            'Cannot create item type without first selecting a type',
          );
      }
    })();
    mutation({
      variables: {
        input: {
          ...formStateToMutationPayload(values),
        },
      },
      refetchQueries: [namedOperations.Query.ItemTypes],
    });
  };

  const onUpdateItemType = async (id: string, values: ItemTypeFormState) => {
    const mutation = (() => {
      switch (itemTypeKind) {
        case 'CONTENT':
          return updateContentType;
        case 'USER':
          return updateUserType;
        case 'THREAD':
          return updateThreadType;
        default:
          throw new Error(
            'Cannot update item type without first selecting a type',
          );
      }
    })();
    mutation({
      variables: {
        input: {
          id,
          ...formStateToMutationPayload(values),
        },
      },
      refetchQueries: [
        namedOperations.Query.ItemTypes,
        { query: GQLItemTypeDocument, variables: { id } },
      ],
    });
  };

  const { modalTitle, modalBody, modalButtonText } = (() => {
    const isCreateForm = id == null;

    return !hasError
      ? {
          modalTitle: isCreateForm
            ? `${readableKind} Type Created`
            : 'Changes Saved',
          modalBody: isCreateForm
            ? `Your ${readableKind} Type was successfully created!`
            : `Your ${readableKind} Type was successfully updated!`,
          modalButtonText: 'Done',
        }
      : {
          modalTitle: isCreateForm
            ? `Error Creating ${readableKind} Type`
            : 'Error Saving Changes',
          modalBody: isCreateForm
            ? `We encountered an error trying to create your ${readableKind} Type. Please try again.`
            : `We encountered an error trying to update your ${readableKind} Type. Please try again.`,
          modalButtonText: 'OK',
        };
  })();

  const onHideModal = () => {
    hideModal();
    if (!hasError) {
      if (itemTypeKind) {
        navigate(`/dashboard/item_types?kind=${itemTypeKind}`);
      } else {
        navigate(-1);
      }
    }
  };

  const modal = (
    <CoopModal
      title={modalTitle}
      visible={modalInfo.visible}
      onClose={onHideModal}
      footer={[
        {
          title: modalButtonText,
          onClick: onHideModal,
          type: 'primary',
        },
      ]}
    >
      {modalInfo.body ?? modalBody}
    </CoopModal>
  );

  const divider = <div className="my-8 divider" />;
  return (
    <div className="flex flex-col text-start">
      <Helmet>
        <title>
          {id == null ? 'Create Item Type' : `Update ${readableKind} Type`}
        </title>
      </Helmet>
      <FormHeader
        title={id == null ? `Create Item Type` : `Update ${readableKind} Type`}
        subtitle={
          id == null
            ? "Please select which kind of Item Type you'd like to create and add fields to it."
            : undefined
        }
      />
      <div className="flex flex-col mb-4">
        <div className="flex flex-row w-full gap-4">
          <div className="flex flex-col w-48 gap-2">
            <div className="font-semibold">Name</div>
            <Input
              placeholder="Name"
              className="w-full rounded-md"
              onChange={(event) => setName(event.target.value)}
              value={name}
              defaultValue={name}
            />
          </div>
          <div className="flex flex-col gap-2 w-96">
            <div className="font-semibold">Description</div>
            <Input
              placeholder="Description (optional)"
              className="w-full rounded-md"
              onChange={(event) => setDescription(event.target.value)}
              value={description}
              defaultValue={description}
            />
          </div>
          <div className="flex flex-col w-48 gap-2">
            <div className="font-semibold">Item Kind</div>
            <Select
              className="w-full text-start"
              placeholder="e.g. Content, User, Thread"
              dropdownMatchSelectWidth={false}
              value={itemTypeKind}
              defaultValue={itemTypeKind}
              onChange={(value) => {
                setItemTypeKind(value);
                setCustomFields(
                  customFields.map((it) => ({ ...it, role: undefined })),
                );
              }}
              showArrow
              showSearch={false}
              listHeight={500}
              popupClassName="font-normal"
            >
              {Object.values(ItemTypeKind).map((it) => (
                <Option key={it} value={it}>
                  <div className="break-words whitespace-normal text-wrap w-96">
                    {itemKindDropdownEntry(it, it === itemTypeKind)}
                  </div>
                </Option>
              ))}
            </Select>
          </div>
        </div>
        {divider}
        <div className="flex flex-col self-start w-full pt-2 pb-4 text-start">
          <div className="flex justify-between mb-4">
            <FormSectionHeader
              title="Schema"
              subtitle="Tell us which fields you will include with each of these items you send to Coop."
            />
          </div>
          <Button
            className="self-start mb-8 font-semibold bg-white border border-solid rounded-md cursor-pointer select-none border-coop-purple hover:border-coop-purple-hover text-coop-purple hover:text-coop-purple-hover focus:text-coop-purple focus:border-coop-purple"
            onClick={() =>
              setCustomFields([
                ...customFields,
                getDefaultEmptyField(customFields.length),
              ])
            }
          >
            <PlusOutlined />
            Add Field
          </Button>
          <div className="flex flex-row gap-16">
            <div className="flex flex-col">
              {customFields.map((field) => (
                <div className="flex flex-col" key={field.index}>
                  <ItemTypeFormCustomField
                    field={field}
                    availableRoles={availableRolesForItemKind(
                      itemTypeKind,
                    ).filter(
                      (it) =>
                        !filterNullOrUndefined(
                          customFields.map((it) => it.role),
                        ).includes(it),
                    )}
                    itemTypeKind={itemTypeKind}
                    onClickDelete={() =>
                      setCustomFields(
                        customFields.filter((it) => it.index !== field.index),
                      )
                    }
                    updateFieldState={(prevField, newField) =>
                      setCustomFields(
                        customFields.map((it) =>
                          it.index === prevField.index ? newField : it,
                        ),
                      )
                    }
                  />
                  {divider}
                </div>
              ))}
              <CoopButton
                title={
                  id == null ? `Create ${readableKind} Type` : 'Save Changes'
                }
                disabled={
                  !canEditItemTypes ||
                  customFields.every((it) => it.name.length === 0) ||
                  !roleSelectionIsValid
                }
                loading={loading}
                disabledTooltipTitle={
                  !canEditItemTypes
                    ? `To edit ${readableKind} Types, ask your organization's admin to upgrade your role to Admin.`
                    : customFields.every((it) => it.name.length === 0)
                    ? 'Please add at least one field with a name.'
                    : customFields.some(
                        (it) => it.role === SchemaFieldRoles.PARENT_ID,
                      ) &&
                      !customFields.some(
                        (it) => it.role === SchemaFieldRoles.THREAD_ID,
                      )
                    ? `Content items with a Parent field must also have a Thread field.`
                    : `Content items with a Thread field must have a Created-At field.`
                }
                disabledTooltipPlacement="bottomLeft"
                onClick={async () =>
                  id == null
                    ? onCreateItemType(state)
                    : onUpdateItemType(id, state)
                }
              />
            </div>
            <div className="w-2/5">
              <ItemTypeFormRightPanel
                fields={customFields}
                itemTypeId={id}
                itemTypeKind={itemTypeKind}
              />
            </div>
          </div>
        </div>
      </div>
      {modal}
    </div>
  );
}

function getDefaultEmptyField(index: number): FieldState {
  return {
    index,
    name: '',
    type: GQLScalarType.String,
    required: true,
    container: undefined,
    hidden: false,
    role: undefined,
  };
}

const getKindForItemType = (itemType: Pick<GQLItemType, '__typename'>) => {
  switch (itemType.__typename) {
    case 'ContentItemType':
      return 'CONTENT';
    case 'UserItemType':
      return 'USER';
    case 'ThreadItemType':
      return 'THREAD';
  }
};

/**
 * This function takes a field roles object (returned from GraphQL most likely,
 * although it could be an empty schema field roles object as well) and returns
 * a mapping where the keys are the names of the fields with roles and the
 * values are the roles. pickBy removes null values and invert swaps the
 * keys and values so we map from field names to field roles.
 */
function transformFieldRolesToFieldMapping<T extends ItemTypeKind>(
  fieldRoles: FieldRoles<T>,
) {
  const nonNullRoles = pickBy(fieldRoles, (it) => it != null) as FieldRoles<T>;

  return invert(nonNullRoles) as { [key: string]: SchemaFieldRoles };
}

function formStateToMutationPayload(state: ItemTypeFormState) {
  const { name, description, customFields } = state;

  return {
    name,
    description,
    fields: customFields.map((it) =>
      safePick(it, ['name', 'type', 'required', 'container']),
    ),
    fieldRoles: Object.fromEntries(
      customFields
        .filter((it) => it.role != null)
        .map((it) => [it.role, it.name]),
    ),
    hiddenFields: customFields.filter((it) => it.hidden).map((it) => it.name),
  };
}

function baseFieldsToFieldState<T extends ItemTypeKind>(
  baseFields: readonly GQLFieldInput[],
  roles: FieldRoles<T>,
  hiddenFields: readonly string[],
) {
  const fieldsToRoles = transformFieldRolesToFieldMapping(roles);
  return baseFields.map(
    (field, index) =>
      ({
        index,
        name: field.name,
        type: field.type,
        required: field.required,
        container: field.container
          ? {
              ...stripTypename(field.container),
              keyScalarType: field.container.keyScalarType ?? null,
            }
          : undefined,
        hidden: hiddenFields.some((it) => it === field.name),
        role: fieldsToRoles[field.name],
      }) satisfies FieldState,
  );
}

function availableRolesForItemKind(kind: ItemTypeKind): SchemaFieldRoles[] {
  switch (kind) {
    case 'CONTENT':
      return [
        SchemaFieldRoles.CREATED_AT,
        SchemaFieldRoles.CREATOR_ID,
        SchemaFieldRoles.THREAD_ID,
        SchemaFieldRoles.DISPLAY_NAME,
        SchemaFieldRoles.PARENT_ID,
        SchemaFieldRoles.IS_DELETED,
        SchemaFieldRoles.NONE,
      ];
    case 'THREAD':
      return [
        SchemaFieldRoles.CREATED_AT,
        SchemaFieldRoles.DISPLAY_NAME,
        SchemaFieldRoles.CREATOR_ID,
        SchemaFieldRoles.IS_DELETED,
        SchemaFieldRoles.NONE,
      ];
    case 'USER':
      return [
        SchemaFieldRoles.CREATED_AT,
        SchemaFieldRoles.DISPLAY_NAME,
        SchemaFieldRoles.PROFILE_ICON,
        SchemaFieldRoles.BACKGROUND_IMAGE,
        SchemaFieldRoles.IS_DELETED,
        SchemaFieldRoles.NONE,
      ];
  }
}

function itemKindDropdownEntry(kind: ItemTypeKind, isSelected: boolean) {
  const title = displayStringForItemTypeKind(kind);
  const subtitle = (() => {
    switch (kind) {
      case 'CONTENT':
        return 'An individual item that a user on your platform can create. e.g. messages, comments, posts, product listings, reviews, etc.';
      case 'THREAD':
        return 'Anything that contains multiple pieces of Content in order. e.g.  a chat thread is a Thread of messages, where message is a Content Item Type.';
      case 'USER':
        return 'An account or profile on your platform e.g. a marketplace might have buyers and sellers as different types of users.';
    }
  })();

  return (
    <div className="flex flex-col">
      <div className={isSelected ? '' : 'font-bold'}>{title}</div>
      <div className="mb-2 font-normal break-words text-wrap">{subtitle}</div>
    </div>
  );
}
