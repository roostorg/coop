import { gql } from '@apollo/client';
import { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useParams } from 'react-router-dom';

import FullScreenLoading from '../../../components/common/FullScreenLoading';
import CoopButton from '../components/CoopButton';
import CoopModal from '../components/CoopModal';

import {
  GQLIntegrationApiCredential,
  GQLIntegrationConfigDocument,
  GQLUserPermission,
  namedOperations,
  useGQLIntegrationConfigQuery,
  useGQLPermissionGatedRouteLoggedInUserQuery,
  useGQLSetIntegrationConfigMutation,
  useGQLSetPluginIntegrationConfigMutation,
  type GQLGoogleContentSafetyApiIntegrationApiCredential,
  type GQLOpenAiIntegrationApiCredential,
  type GQLZentropiIntegrationApiCredential,
} from '../../../graphql/generated';
import {
  stripTypename,
  taggedUnionToOneOfInput,
} from '../../../graphql/inputHelpers';
import { userHasPermissions } from '../../../routing/permissions';
import IntegrationConfigApiCredentialsSection from './IntegrationConfigApiCredentialsSection';
import { INTEGRATION_LOGO_FALLBACKS } from './integrationLogos';
import ModelCardView from './ModelCardView';

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

  mutation SetPluginIntegrationConfig($input: SetPluginIntegrationConfigInput!) {
    setPluginIntegrationConfig(input: $input) {
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

  query IntegrationConfig($name: String!) {
    integrationConfig(name: $name) {
      ... on IntegrationConfigSuccessResult {
        config {
          name
          title
          docsUrl
          requiresConfig
          logoUrl
          logoWithBackgroundUrl
          modelCard {
            modelName
            version
            releaseDate
            sections {
              id
              title
              subsections {
                title
                fields {
                  label
                  value
                }
              }
              fields {
                label
                value
              }
            }
          }
          modelCardLearnMoreUrl
          apiCredential {
            ... on GoogleContentSafetyApiIntegrationApiCredential {
              apiKey
            }
            ... on OpenAiIntegrationApiCredential {
              apiKey
            }
            ... on ZentropiIntegrationApiCredential {
              apiKey
              labelerVersions {
                id
                label
              }
            }
            ... on PluginIntegrationApiCredential {
              credential
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
  name: string,
): GQLIntegrationApiCredential {
  switch (name) {
    case 'GOOGLE_CONTENT_SAFETY_API': {
      return {
        __typename: 'GoogleContentSafetyApiIntegrationApiCredential',
        apiKey: '',
      };
    }
    case 'OPEN_AI': {
      return { __typename: 'OpenAiIntegrationApiCredential', apiKey: '' };
    }
    case 'ZENTROPI': {
      return {
        __typename: 'ZentropiIntegrationApiCredential',
        apiKey: '',
        labelerVersions: [],
      };
    }
    default: {
      return {
        __typename: 'PluginIntegrationApiCredential',
        credential: {},
      };
    }
  }
}

export default function IntegrationConfigForm() {
  const { name } = useParams<{ name: string | undefined }>();
  if (name == null) {
    throw Error('Integration name not provided');
  }
  // Cast back to upper case (see lowercase cast in IntegrationCard.tsx)
  const integrationName = name.toUpperCase();
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
  const [setPluginConfig, setPluginConfigMutationParams] =
    useGQLSetPluginIntegrationConfigMutation({
      onError: () => {
        showModal();
      },
      onCompleted: () => showModal(),
    });
  const mutationError =
    setConfigMutationParams.error ?? setPluginConfigMutationParams.error;
  const mutationLoading =
    setConfigMutationParams.loading || setPluginConfigMutationParams.loading;

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
      const cred = response.config.apiCredential;
      if (cred.__typename === 'PluginIntegrationApiCredential') {
        setApiCredential({
          __typename: 'PluginIntegrationApiCredential',
          credential: cred.credential ?? {},
        });
      } else {
        setApiCredential(cred);
      }
    }
  }, [response]);

  if (configQueryError || userQueryError) {
    return <div />;
  }
  if (loading || userQueryLoading) {
    return <FullScreenLoading />;
  }

  const apiConfig =
    response?.__typename === 'IntegrationConfigSuccessResult'
      ? response.config
      : undefined;
  const formattedName =
    apiConfig?.title ?? integrationName.replace(/_/g, ' ');
  const logo = apiConfig
    ? (apiConfig.logoUrl ??
      INTEGRATION_LOGO_FALLBACKS[apiConfig.name]?.logo ??
      '')
    : '';

  const canEditConfig = userHasPermissions(permissions, [
    GQLUserPermission.ManageOrg,
  ]);

  const mappedApiCredential = taggedUnionToOneOfInput(apiCredential, {
    GoogleContentSafetyApiIntegrationApiCredential: 'googleContentSafetyApi',
    OpenAiIntegrationApiCredential: 'openAi',
    ZentropiIntegrationApiCredential: 'zentropi',
    PluginIntegrationApiCredential: 'pluginCredential',
  });

  const isPluginIntegration = ![
    'GOOGLE_CONTENT_SAFETY_API',
    'OPEN_AI',
    'ZENTROPI',
  ].includes(integrationName);
  const validationMessage = (() => {
    if (isPluginIntegration) {
      return undefined;
    }
    if (
      'googleContentSafetyApi' in mappedApiCredential &&
      !(
        mappedApiCredential[
        'googleContentSafetyApi'
        ] as GQLGoogleContentSafetyApiIntegrationApiCredential
      ).apiKey
    ) {
      return 'Please input the Google Content Safety API key';
    }

    if (
      'openAi' in mappedApiCredential &&
      !(mappedApiCredential['openAi'] as GQLOpenAiIntegrationApiCredential)
        .apiKey
    ) {
      return 'Please input the OpenAI API key';
    }

    if (
      'zentropi' in mappedApiCredential &&
      !(
        mappedApiCredential[
          'zentropi'
        ] as GQLZentropiIntegrationApiCredential
      ).apiKey
    ) {
      return 'Please input the Zentropi API key';
    }

    return undefined;
  })();

  const saveButton = (
    <CoopButton
      title="Save"
      loading={mutationLoading}
      onClick={async () => {
        const refetchQueries = [
          namedOperations.Query.MyIntegrations,
          {
            query: GQLIntegrationConfigDocument,
            variables: { name: integrationName },
          },
        ];
        if (isPluginIntegration) {
          const cred =
            apiCredential.__typename === 'PluginIntegrationApiCredential'
              ? apiCredential.credential ?? {}
              : {};
          await setPluginConfig({
            variables: {
              input: { integrationId: integrationName, credential: cred },
            },
            refetchQueries,
          });
        } else {
          await setConfig({
            variables: {
              input: {
                apiCredential: stripTypename(mappedApiCredential),
              },
            },
            refetchQueries,
          });
        }
      }}
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
    integrationName: string,
    formattedName: string,
  ): React.ReactNode | string | undefined => {
    switch (integrationName) {
      case 'GOOGLE_CONTENT_SAFETY_API':
        return (
          <>
            The Content Safety API is an AI classifier which issues a Child 
            Safety prioritization recommendation on content sent to it. Content Safety API users
            must conduct their own manual review in order to determine whether to take
            action on the content, and comply with applicable local reporting
            laws. Apply for API keys{' '}
            <a
              href="https://protectingchildren.google/tools-for-partners/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              here
            </a>
            {' '}
            and mention in your application that you are using the Coop
            moderation tool. Upon reviewing your application, Google will be
            back in touch shortly to take the application forward if you qualify.
          </>
        );
      case 'OPEN_AI':
        return `The ${formattedName} integration requires one API Key.`;
      default:
        return undefined;
    }
  };

  const apiModelCard = response?.config?.modelCard;
  const apiModelCardLearnMoreUrl = response?.config?.modelCardLearnMoreUrl;
  const hasModelCard = apiModelCard != null;

  return (
    <div className="flex flex-col text-start">
      <Helmet>
        <title>{formattedName} Integration</title>
      </Helmet>
      <div className="flex flex-col justify-between w-4/5 mb-4">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center shrink-0 overflow-hidden">
            <img
              src={logo}
              alt=""
              className="w-full h-full object-contain"
            />
          </div>
          <div className="text-2xl font-bold">{`${formattedName} Integration`}</div>
        </div>
        {!hasModelCard && (
          <div className="mb-4 text-base text-zinc-900">
            {headerSubtitle(integrationName, formattedName)}
          </div>
        )}
      </div>

      {hasModelCard && apiModelCard ? (
        <div className="flex flex-col lg:flex-row gap-8 w-full max-w-5xl">
          <div className="flex-1 min-w-0">
            <ModelCardView card={apiModelCard} />
          </div>
          <div className="flex flex-col lg:w-80 shrink-0">
            {apiModelCardLearnMoreUrl != null && (
              <a
                href={apiModelCardLearnMoreUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline mb-4 inline-flex items-center gap-1"
              >
                <span className="align-middle">ⓘ</span>
                <span>Learn more about how to read model cards</span>
              </a>
            )}
            <div className="font-semibold text-zinc-800 mb-2">Credentials</div>
            <div className="text-sm text-zinc-600 mb-3">
              Configure your credentials below.
            </div>
            <IntegrationConfigApiCredentialsSection
              name={integrationName}
              apiCredential={apiCredential}
              setApiCredential={(cred: GQLIntegrationApiCredential) =>
                setApiCredential(cred)
              }
            />
            {saveButton}
          </div>
        </div>
      ) : (
        <>
          <IntegrationConfigApiCredentialsSection
            name={integrationName}
            apiCredential={apiCredential}
            setApiCredential={(cred: GQLIntegrationApiCredential) =>
              setApiCredential(cred)
            }
          />
          {saveButton}
        </>
      )}
      {modal}
    </div>
  );
}
