import { gql } from '@apollo/client';
import { Helmet } from 'react-helmet-async';

import FullScreenLoading from '../../../components/common/FullScreenLoading';
import DashboardHeader from '../components/DashboardHeader';

import {
  useGQLAvailableIntegrationsQuery,
  useGQLMyIntegrationsQuery,
} from '../../../graphql/generated';
import IntegrationCard from './IntegrationCard';

export default function IntegrationsDashboard() {
  gql`
    query MyIntegrations {
      myOrg {
        integrationConfigs {
          name
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
      }
    }
  `;

  const { loading: loadingCatalog, data: catalogData } =
    useGQLAvailableIntegrationsQuery({
      fetchPolicy: 'network-only',
    });
  const { loading: loadingMy, error, data: myData } =
    useGQLMyIntegrationsQuery();

  const loading = loadingCatalog ?? loadingMy;

  if (loading) {
    return <FullScreenLoading />;
  }

  if (error) {
    throw error;
  }

  const allIntegrations = catalogData?.availableIntegrations ?? [];
  const myIntegrationNames =
    myData?.myOrg?.integrationConfigs?.map((config) => config.name) ?? [];

  const myIntegrations = allIntegrations.filter((it) =>
    myIntegrationNames.includes(it.name),
  );
  const otherIntegrations = allIntegrations.filter(
    (it) => !myIntegrationNames.includes(it.name),
  ).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="flex flex-col">
      <Helmet>
        <title>Integrations</title>
      </Helmet>
      <DashboardHeader
        title="Integrations"
        subtitle="Coop comes with pre-built integrations to common software used for online safety. Add your API key to enable the integration."
      />
      <div className="items-center align-center">
        {myIntegrations.length > 0 ? (
          <>
            <div className="flex pt-4 text-xl font-bold text-start">
              My Custom Integrations
            </div>
            <div className="grid auto-rows-[minmax(240px,_auto)] grid-rows-auto grid-cols-[repeat(auto-fill,_minmax(280px,_1fr))] gap-6 justify-center items-center pr-11 pt-4 pb-8">
              {myIntegrations
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((integration, i) => (
                  <IntegrationCard key={i} integration={integration} />
                ))}
            </div>
          </>
        ) : null}
        <>
          {otherIntegrations.length > 0 ? (
            <div className="flex pt-4 text-xl font-bold text-start">
              All Integrations
            </div>
          ) : null}
          <div className="grid auto-rows-[minmax(240px,_auto)] grid-rows-auto grid-cols-[repeat(auto-fill,_minmax(280px,_1fr))] gap-6 justify-center items-center pr-11 pt-4 pb-8">
            {otherIntegrations.map((integration, i) => (
              <IntegrationCard key={i} integration={integration} />
            ))}
          </div>
        </>
      </div>
    </div>
  );
}
