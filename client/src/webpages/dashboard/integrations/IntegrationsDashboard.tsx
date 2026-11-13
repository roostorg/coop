import { gql } from '@apollo/client';
import { Helmet } from 'react-helmet-async';

import FullScreenLoading from '../../../components/common/FullScreenLoading';
import DashboardHeader from '../components/DashboardHeader';

import {
  useGQLAvailableIntegrationsQuery,
  useGQLMyIntegrationsQuery,
  type GQLMyIntegrationsQuery,
} from '../../../graphql/generated';
import IntegrationCard from './IntegrationCard';

type MyIntegrationCredential = NonNullable<
  NonNullable<GQLMyIntegrationsQuery['myOrg']>['integrationConfigs']
>[number]['apiCredential'];

/** An integration counts as active once its credential has a value saved. */
function hasConfiguredCredential(cred: MyIntegrationCredential): boolean {
  switch (cred.__typename) {
    case 'GoogleContentSafetyApiIntegrationApiCredential':
    case 'OpenAiIntegrationApiCredential':
    case 'ZentropiIntegrationApiCredential':
      return Boolean(cred.apiKey);
    case 'PluginIntegrationApiCredential':
      return Object.keys(cred.credential ?? {}).length > 0;
    default:
      return false;
  }
}

export default function IntegrationsDashboard() {
  gql`
    query MyIntegrations {
      myOrg {
        integrationConfigs {
          name
          apiCredential {
            ... on GoogleContentSafetyApiIntegrationApiCredential {
              apiKey
            }
            ... on OpenAiIntegrationApiCredential {
              apiKey
            }
            ... on ZentropiIntegrationApiCredential {
              apiKey
            }
            ... on PluginIntegrationApiCredential {
              credential
            }
          }
        }
      }
    }
  `;

  gql`
    query AvailableIntegrations {
      availableIntegrations {
        name
        title
        docsUrl
        requiresConfig
        logoUrl
        logoWithBackgroundUrl
        modelCards {
          modelName
          version
          releaseDate
        }
      }
    }
  `;

  const { loading: loadingCatalog, data: catalogData } =
    useGQLAvailableIntegrationsQuery({
      fetchPolicy: 'network-only',
    });
  const {
    loading: loadingMy,
    error,
    data: myData,
  } = useGQLMyIntegrationsQuery();

  const loading = loadingCatalog || loadingMy;

  if (loading) {
    return <FullScreenLoading />;
  }

  if (error) {
    throw error;
  }

  const allIntegrations = catalogData?.availableIntegrations ?? [];
  // An integration is "active" only once a credential has actually been saved.
  // getAllIntegrationConfigs returns an entry for every integration (with empty
  // defaults), so presence alone does not mean it is configured.
  const activeIntegrationNames = new Set(
    (myData?.myOrg?.integrationConfigs ?? [])
      .filter((config) => hasConfiguredCredential(config.apiCredential))
      .map((config) => config.name),
  );

  const integrations = [...allIntegrations].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  return (
    <div className="flex flex-col">
      <Helmet>
        <title>Integrations</title>
      </Helmet>
      <DashboardHeader
        title="Integrations"
        subtitle="Coop's built-in integrations are free to use. Add your API key to enable one, or build your own integration backed by a model you host or any SaaS provider you use."
      />
      <div className="items-center align-center">
        <div className="grid auto-rows-[minmax(240px,_auto)] grid-rows-auto grid-cols-[repeat(auto-fill,_minmax(280px,_1fr))] gap-6 justify-center items-center pr-11 pt-4 pb-8">
          {integrations.map((integration, i) => (
            <IntegrationCard
              key={i}
              integration={integration}
              active={activeIntegrationNames.has(integration.name)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
