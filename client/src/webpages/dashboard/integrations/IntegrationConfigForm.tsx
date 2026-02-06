import { gql } from '@apollo/client';
import { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useParams } from 'react-router-dom';

import FullScreenLoading from '../../../components/common/FullScreenLoading';
import CoopButton from '../components/CoopButton';
import CoopModal from '../components/CoopModal';

import {
  GQLIntegration,
  GQLIntegrationApiCredential,
  GQLIntegrationConfigDocument,
  GQLUserPermission,
  namedOperations,
  useGQLIntegrationConfigQuery,
  useGQLPermissionGatedRouteLoggedInUserQuery,
  useGQLSetIntegrationConfigMutation,
  type GQLOpenAiIntegrationApiCredential,
} from '../../../graphql/generated';
import {
  stripTypename,
  taggedUnionToOneOfInput,
} from '../../../graphql/inputHelpers';
import { userHasPermissions } from '../../../routing/permissions';
import IntegrationConfigApiCredentialsSection from './IntegrationConfigApiCredentialsSection';
import { INTEGRATION_CONFIGS } from './integrationConfigs';

gql`
  mutation SetIntegrationConfig($input: SetIntegrationConfigInput!) {
    setIntegrationConfig(input: $input) {
      ... on SetIntegrationConfigSuccessResponse {
        config {
          name
        }
      }
      ... on IntegrationConfigTooManyCredentialsError {
        title
      }
      ... on IntegrationNoInputCredentialsError {
        title
      }
      ... on IntegrationEmptyInputCredentialsError {
        title
      }
    }
  }

  query IntegrationConfig($name: Integration!) {
    integrationConfig(name: $name) {
      ... on IntegrationConfigSuccessResult {
        config {
          name
          apiCredential {
            ... on OpenAiIntegrationApiCredential {
              apiKey
            }
          }
        }
      }
      ... on IntegrationConfigUnsupportedIntegrationError {
        title
      }
      ... on IntegrationConfigUnsupportedIntegrationError {
        title
      }
    }
  }
`;

/**
 * Each 3rd party integration has different API credential requirements.
 * Hive requires one API key per model (aka 'project'). Others require
 * an API Key and a separate API User string. Etc...
 * This function returns an empty API credential config (type is
 * IntegrationConfigApiCredential), so the UI can display the proper empty inputs.
 */
export function getNewEmptyApiKey(
  name: GQLIntegration,
): GQLIntegrationApiCredential {
  switch (name) {
    case 'OPEN_AI': {
      return { __typename: 'OpenAiIntegrationApiCredential', apiKey: '' };
    }
    default: {
      throw new Error(`${name} integration not implemented.`);
    }
  }
}

export default function IntegrationConfigForm() {
  const { name } = useParams<{ name: string | undefined }>();
  if (name == null) {
    throw Error('Integration name not provided');
  }
  // Cast back to upper case (see lowercase cast in IntegrationCard.tsx)
  const integrationName = name.toUpperCase() as GQLIntegration;
  const config = INTEGRATION_CONFIGS.find((i) => i.name === integrationName);
  if (config == null) {
    throw Error(`Integration with name ${name} not found`);
  }
  const formattedName = config.title;
  const navigate = useNavigate();

  const [modalVisible, setModalVisible] = useState(false);
  const [apiCredential, setApiCredential] = useState(
    getNewEmptyApiKey(integrationName),
  );

  const showModal = () => setModalVisible(true);
  const hideModal = () => setModalVisible(false);

  const [setConfig, setConfigMutationParams] =
    useGQLSetIntegrationConfigMutation({
      onError: () => {
        showModal();
      },
      onCompleted: () => showModal(),
    });
  const mutationError = setConfigMutationParams.error;
  const mutationLoading = setConfigMutationParams.loading;

  const {
    loading,
    error: configQueryError,
    data,
  } = useGQLIntegrationConfigQuery({
    variables: { name: integrationName },
  });
  const response = data?.integrationConfig;

  switch (response?.__typename) {
    case 'IntegrationConfigSuccessResult': {
      break;
    }
    case 'IntegrationConfigUnsupportedIntegrationError': {
      throw new Error('This config is not supported yet');
    }
    case undefined: {
      // Case where nothing has been returned from the query
      // yet (as in it's loading, etc), so just continue
      break;
    }
  }

  const userQueryParams = useGQLPermissionGatedRouteLoggedInUserQuery();
  const userQueryLoading = userQueryParams.loading;
  const userQueryError = userQueryParams.error;
  const permissions = userQueryParams.data?.me?.permissions;

  /**
   * If editing an existing config and the INTEGRATION_CONFIG_QUERY
   * has finished, reset the state values to whatever the query returned
   */
  useMemo(() => {
    if (response?.config != null) {
      setApiCredential(response.config.apiCredential);
    }
  }, [response]);

  if (configQueryError || userQueryError) {
    return <div />;
  }
  if (loading || userQueryLoading) {
    return <FullScreenLoading />;
  }
  const canEditConfig = userHasPermissions(permissions, [
    GQLUserPermission.ManageOrg,
  ]);

  const mappedApiCredential = taggedUnionToOneOfInput(apiCredential, {
    OpenAiIntegrationApiCredential: 'openAi',
  });

  const validationMessage = (() => {
    if (
      'openAi' in mappedApiCredential &&
      !(mappedApiCredential['openAi'] as GQLOpenAiIntegrationApiCredential)
        .apiKey
    ) {
      return 'Please input the OpenAI API key';
    }

    return undefined;
  })();

  const saveButton = (
    <CoopButton
      title="Save"
      loading={mutationLoading}
      onClick={async () =>
        setConfig({
          variables: {
            input: {
              apiCredential: stripTypename(mappedApiCredential),
            },
          },
          refetchQueries: [
            namedOperations.Query.MyIntegrations,
            {
              query: GQLIntegrationConfigDocument,
              variables: { name: integrationName },
            },
          ],
        })
      }
      disabled={!canEditConfig || validationMessage != null}
      disabledTooltipTitle={validationMessage}
    />
  );

  const [modalTitle, modalBody, modalButtonText] =
    mutationError == null
      ? [
          `${formattedName} Config Saved`,
          `Your ${formattedName} Config was successfully saved!`,
          'Done',
        ]
      : [
          `Error Saving ${formattedName} Config`,
          `We encountered an error trying to save your ${formattedName} Config. Please try again.`,
          'OK',
        ];

  const onHideModal = () => {
    hideModal();
    if (mutationError == null) {
      navigate(-1);
    }
  };

  const modal = (
    <CoopModal
      title={modalTitle}
      visible={modalVisible}
      onClose={onHideModal}
      footer={[
        {
          title: modalButtonText,
          onClick: onHideModal,
          type: 'primary',
        },
      ]}
    >
      {modalBody}
    </CoopModal>
  );

  const headerSubtitle = (
    integration: GQLIntegration,
    formattedName: string,
  ): React.ReactNode | string | undefined => {
    switch (integration) {
      case GQLIntegration.OpenAi:
        return `The ${formattedName} integration requires one API Key.`;
      default:
        return undefined;
    }
  };

  return (
    <div className="flex flex-col text-start">
      <Helmet>
        <title>{formattedName} Integration</title>
      </Helmet>
      <div className="flex flex-col justify-between w-4/5 mb-4">
        <div className="mb-1 text-2xl font-bold">{`${formattedName} Integration`}</div>
        <div className="mb-4 text-base text-zinc-900">
          {headerSubtitle(integrationName, formattedName)}
        </div>
      </div>
      <IntegrationConfigApiCredentialsSection
        name={integrationName}
        apiCredential={apiCredential}
        setApiCredential={(cred: GQLIntegrationApiCredential) =>
          setApiCredential(cred)
        }
      />
      {saveButton}
      {modal}
    </div>
  );
}
