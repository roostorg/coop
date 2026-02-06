import { gql } from '@apollo/client';
import { Input, Select } from 'antd';
import Link from 'antd/lib/typography/Link';
import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useParams } from 'react-router-dom';

import FullScreenLoading from '../../../components/common/FullScreenLoading';
import { selectFilterByLabelOption } from '../components/antDesignUtils';
import CoopButton from '../components/CoopButton';
import CoopModal from '../components/CoopModal';
import FormHeader from '../components/FormHeader';
import FormSectionHeader from '../components/FormSectionHeader';
import NameDescriptionInput from '../components/NameDescriptionInput';

import {
  GQLActionDocument,
  GQLUserPermission,
  namedOperations,
  useGQLActionFormQuery,
  useGQLActionQuery,
  useGQLCreateActionMutation,
  useGQLUpdateActionMutation,
} from '../../../graphql/generated';
import { userHasPermissions } from '../../../routing/permissions';
import { prettyPrintJsonValue } from '../../../utils/string';

const { Option } = Select;

gql`
  fragment CustomActionFragment on CustomAction {
    id
    name
    description
    itemTypes {
      ... on ItemTypeBase {
        id
      }
    }
    callbackUrl
    callbackUrlHeaders
    callbackUrlBody
  }

  query Action($id: ID!) {
    action(id: $id) {
      ... on CustomAction {
        ...CustomActionFragment
      }
    }
  }

  query ActionForm {
    myOrg {
      itemTypes {
        ... on ItemTypeBase {
          id
          name
        }
      }
    }
    me {
      permissions
    }
  }

  mutation CreateAction($input: CreateActionInput!) {
    createAction(input: $input) {
      ... on MutateActionSuccessResponse {
        data {
          ... on CustomAction {
            ...CustomActionFragment
          }
        }
      }
      ... on ActionNameExistsError {
        title
        status
        type
      }
    }
  }

  mutation UpdateAction($input: UpdateActionInput!) {
    updateAction(input: $input) {
      ... on MutateActionSuccessResponse {
        data {
          ... on CustomAction {
            ...CustomActionFragment
          }
        }
      }
      ... on ActionNameExistsError {
        title
        status
        type
      }
    }
  }
`;

/**
 * Action Form screen, where actions can be created or edited
 */
export default function ActionForm() {
  const [modalVisible, setModalVisible] = useState(false);
  const [actionName, setActionName] = useState<string | undefined>(undefined);
  const [actionDescription, setActionDescription] = useState<
    string | undefined
  >(undefined);
  const [actionItemTypeIds, setActionItemTypeIds] = useState<
    string[] | undefined
  >(undefined);
  const [actionCallbackUrl, setActionCallbackUrl] = useState<
    string | undefined
  >(undefined);
  const [actionCallbackUrlHeaders, setActionCallbackUrlHeaders] = useState<
    string | undefined
  >(undefined);
  const [actionCallbackUrlBody, setActionCallbackUrlBody] = useState<
    string | undefined
  >(undefined);

  const showModal = () => {
    setModalVisible(true);
  };

  const hideModal = () => {
    setModalVisible(false);
  };

  const [
    createAction,
    {
      error: createMutationError,
      data: createMutationData,
      loading: createMutationLoading,
    },
  ] = useGQLCreateActionMutation({
    onError: () => showModal(),
    onCompleted: () => showModal(),
  });

  const [
    updateAction,
    {
      error: updateMutationError,
      data: updateMutationData,
      loading: updateMutationLoading,
    },
  ] = useGQLUpdateActionMutation({
    onError: () => showModal(),
    onCompleted: () => showModal(),
  });

  const navigate = useNavigate();
  const { id } = useParams<{ id: string | undefined }>();

  const actionQueryParams = useGQLActionQuery({
    variables: { id: id! },
    skip: id == null,
  });

  const action = actionQueryParams.data?.action;
  const actionQueryLoading = actionQueryParams.loading;
  const actionQueryError = actionQueryParams.error;

  const actionFormQueryParams = useGQLActionFormQuery();
  const itemTypes = actionFormQueryParams.data?.myOrg?.itemTypes;
  const permissions = actionFormQueryParams.data?.me?.permissions;
  const actionFormQueryLoading = actionFormQueryParams.loading;
  const actionFormQueryError = actionFormQueryParams.error;

  useEffect(() => {
    if (action == null || action.__typename !== 'CustomAction') {
      return;
    }

    setActionName(action.name);
    setActionDescription(action.description ?? undefined);
    setActionItemTypeIds(action.itemTypes.map((it) => it.id));
    setActionCallbackUrl(action.callbackUrl);
    setActionCallbackUrlHeaders(
      action.callbackUrlHeaders
        ? prettyPrintJsonValue(action.callbackUrlHeaders)
        : undefined,
    );
    setActionCallbackUrlBody(
      action.callbackUrlBody
        ? prettyPrintJsonValue(action.callbackUrlBody)
        : undefined,
    );
  }, [action]);

  if (actionQueryError ?? actionFormQueryError) {
    // eslint-disable-next-line @typescript-eslint/no-throw-literal
    throw actionQueryError ?? actionFormQueryError;
  }

  if (actionQueryLoading || actionFormQueryLoading) {
    return <FullScreenLoading />;
  }

  const canEditActions = userHasPermissions(permissions, [
    GQLUserPermission.ManageOrg,
  ]);

  const onCreateAction = async () =>
    createAction({
      variables: {
        input: {
          name: actionName!,
          description: actionDescription ?? undefined,
          itemTypeIds: actionItemTypeIds!,
          callbackUrl: actionCallbackUrl!,
          callbackUrlHeaders: actionCallbackUrlHeaders
            ? JSON.parse(actionCallbackUrlHeaders)
            : undefined,
          callbackUrlBody: actionCallbackUrlBody
            ? JSON.parse(actionCallbackUrlBody)
            : undefined,
        },
      },
      refetchQueries: [namedOperations.Query.Actions],
    });

  const onUpdateAction = async () =>
    updateAction({
      variables: {
        input: {
          id: id!,
          name: actionName!,
          description: actionDescription ?? undefined,
          itemTypeIds: actionItemTypeIds,
          callbackUrl: actionCallbackUrl,
          callbackUrlHeaders: actionCallbackUrlHeaders
            ? JSON.parse(actionCallbackUrlHeaders)
            : undefined,
          callbackUrlBody: actionCallbackUrlBody
            ? JSON.parse(actionCallbackUrlBody)
            : undefined,
        },
      },
      refetchQueries: [
        namedOperations.Query.Actions,
        { query: GQLActionDocument, variables: { id } },
      ],
    });

  const itemTypeSection = (
    <div className="flex flex-col justify-start">
      <FormSectionHeader
        title="Eligible Item Types"
        subtitle="Select the item types that this action can be run on."
      />
      <Select<string[]>
        mode="multiple"
        placeholder="Select item types"
        allowClear
        showSearch
        dropdownMatchSelectWidth={false}
        filterOption={selectFilterByLabelOption}
        onChange={setActionItemTypeIds}
        value={actionItemTypeIds}
      >
        {itemTypes
          ?.slice()
          ?.sort((a, b) => a.name.localeCompare(b.name))
          ?.map((itemType) => (
            <Option key={itemType.id} value={itemType.id} label={itemType.name}>
              {itemType.name}
            </Option>
          ))}
      </Select>
    </div>
  );

  const callbackSectionHeader = (content: string) => (
    <div className="mt-4 mb-1 text-lg font-medium text-gray-900">{content}</div>
  );

  const callbackUrlInput = (
    <div className="flex flex-col justify-start">
      <FormSectionHeader
        title="Callback URL"
        subtitle="To execute this action on your behalf, we'll need you to expose the action through an API endpoint that faces the public internet so that Coop's servers can access it. We will send an HTTP request to that API endpoint to execute the action. Please specify the endpoint's URL below."
      />
      <Input
        placeholder="https://yourwebsite.com/api/your_action..."
        style={{ borderRadius: '8px' }}
        onChange={(e) => setActionCallbackUrl(e.target.value)}
        value={actionCallbackUrl}
      />
      <div className="my-4 text-base text-zinc-900">
        <span className="font-semibold">Note</span>: For each HTTP request we
        send to that URL, we will include a JSON body with information about the
        action. See the{' '}
        <Link href="https://docs.getcoop.com/docs/action-api">
          documentation
        </Link>{' '}
        for more information.
      </div>
      {callbackSectionHeader('Headers (Optional)')}
      <div className="mb-4 text-base text-zinc-900">
        If necessary, you can specify HTTP headers that we will attach to every
        request we send to the Callback URL above. For example, if an API key is
        required to access your API, you can add it below, in the normal HTTP
        header JSON format.
      </div>
      <Input.TextArea
        className="mt-3 rounded-xl"
        autoSize={{ minRows: 6, maxRows: 24 }}
        placeholder={`{
    "my-header": "SOME_API_KEY",
     ...
}`}
        onChange={(e) => setActionCallbackUrlHeaders(e.target.value)}
        value={actionCallbackUrlHeaders}
      />
      {callbackSectionHeader('Body (Optional)')}
      <div className="mb-4 text-base text-zinc-900">
        If necessary, you can specify HTTP body parameters that we will attach
        to every request we send to the Callback URL above. For example, if your
        API endpoint needs additional information to execute this action
        properly, you can add that information below, in the normal HTTP body
        JSON format.
      </div>
      <Input.TextArea
        className="mt-3 rounded-xl"
        autoSize={{ minRows: 6, maxRows: 24 }}
        placeholder={`{
    "my-param-1": "SOME_VALUE",
    "my-param-2": "SOME_OTHER_VALUE"
     ...
}`}
        style={{ borderRadius: '12px' }}
        onChange={(e) => setActionCallbackUrlBody(e.target.value)}
        value={actionCallbackUrlBody}
      />
    </div>
  );

  const { modalTitle, modalBody, modalButtonText } = (() => {
    const isCreateForm = id == null;

    if (
      createMutationData?.createAction?.__typename ===
        'ActionNameExistsError' ||
      updateMutationData?.updateAction?.__typename === 'ActionNameExistsError'
    ) {
      return {
        modalTitle: isCreateForm
          ? 'Error Creating Action'
          : 'Error Saving Changes',
        modalBody: 'Your organization already has an action with this name.',
        modalButtonText: 'OK',
      };
    }

    const hasError = createMutationError != null || updateMutationError != null;

    return !hasError
      ? {
          modalTitle: isCreateForm ? 'Action Created' : 'Changes Saved',
          modalBody: (
            <div>
              <div>
                Your Action was successfully{' '}
                {isCreateForm ? 'created' : 'updated'}!
              </div>
              <div className="mt-2">
                You can test your action in the{' '}
                <Link href="/dashboard/bulk-actioning" target="_blank">
                  Bulk Actioning Dashboard
                </Link>
                .
              </div>
            </div>
          ),
          modalButtonText: 'Done',
        }
      : {
          modalTitle: isCreateForm
            ? 'Error Creating Action'
            : 'Error Saving Changes',
          modalBody: isCreateForm
            ? 'We encountered an error trying to create your Action. Please try again.'
            : 'We encountered an error trying to update your Action. Please try again.',
          modalButtonText: 'OK',
        };
  })();

  const onHideModal = () => {
    hideModal();
    if (createMutationError == null && updateMutationError == null) {
      // Go back
      navigate(-1);
    }
  };

  const divider = () => <div className="mt-5 divider mb-9" />;
  return (
    <div className="flex flex-col text-start">
      <Helmet>
        <title>{id == null ? 'Create Action' : 'Update Action'}</title>
      </Helmet>
      <FormHeader title={id == null ? 'Create Action' : 'Update Action'} />
      <NameDescriptionInput
        nameInitialValue={actionName}
        descriptionInitialValue={actionDescription}
        onChangeName={setActionName}
        onChangeDescription={setActionDescription}
      />
      {divider()}
      {itemTypeSection}
      {divider()}
      {callbackUrlInput}
      {divider()}
      <CoopButton
        title={id == null ? 'Create Action' : 'Save Changes'}
        disabled={
          !canEditActions ||
          !actionName ||
          !actionItemTypeIds?.length ||
          !actionCallbackUrl ||
          !validateJson(actionCallbackUrlHeaders) ||
          !validateJson(actionCallbackUrlBody)
        }
        loading={createMutationLoading || updateMutationLoading}
        disabledTooltipTitle={(() => {
          if (!canEditActions) {
            return "To edit Actions, ask your organization's admin to upgrade your role to Admin.";
          }
          if (!actionName) {
            return 'Please enter a name for your Action.';
          }
          if (!actionItemTypeIds?.length) {
            return 'Please select at least one item type for your Action.';
          }
          if (!actionCallbackUrl) {
            return 'Please enter a callback URL for your Action.';
          }
          if (!validateJson(actionCallbackUrlHeaders)) {
            return 'Please enter a valid JSON for the callback URL headers.';
          }
          if (!validateJson(actionCallbackUrlBody)) {
            return 'Please enter a valid JSON for the callback URL body.';
          }
        })()}
        disabledTooltipPlacement="bottomLeft"
        onClick={() => {
          if (id == null) {
            onCreateAction();
          } else {
            onUpdateAction();
          }
        }}
      />
      <CoopModal
        title={modalTitle}
        visible={modalVisible}
        onClose={onHideModal}
        footer={[
          { title: modalButtonText, onClick: onHideModal, type: 'primary' },
        ]}
      >
        {modalBody}
      </CoopModal>
    </div>
  );
}

const validateJson = (value: string | undefined) => {
  if (value == null || value.length === 0) {
    return true;
  }

  try {
    const parsed = JSON.parse(value);
    return typeof parsed === 'object' && parsed != null;
  } catch {
    return false;
  }
};
