import { gql } from '@apollo/client';
import { Helmet } from 'react-helmet-async';

import FullScreenLoading from '../../../components/common/FullScreenLoading';
import DashboardHeader from '../components/DashboardHeader';

import {
  GQLIntegration,
  useGQLMyIntegrationsQuery,
} from '../../../graphql/generated';
import IntegrationCard from './IntegrationCard';
import { INTEGRATION_CONFIGS } from './integrationConfigs';

export type IntegrationConfig = {
  name: GQLIntegration;
  title: string;
  logo: string;
  logoWithBackground: string;
  url: string;
  requiresInfo: boolean;
};

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

  const { loading, error, data } = useGQLMyIntegrationsQuery();

  if (loading) {
    return <FullScreenLoading />;
  }

  if (error) {
    throw error;
  }

  const integrationNames =
    data?.myOrg?.integrationConfigs?.map((config) => config.name) ?? [];

  const myIntegrations = INTEGRATION_CONFIGS.filter((it) =>
    integrationNames.includes(it.name),
  );

  const otherIntegrations = INTEGRATION_CONFIGS.filter(
    (it) => !myIntegrations.includes(it),
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
