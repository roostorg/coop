import type Bottle from '@ethanresnick/bottlejs';
import { DataSource } from 'apollo-datasource';

import makeActionAPI, {
  type ActionAPI,
} from '../../graphql/datasources/ActionApi.js';
import makeIntegrationAPI, {
  type IntegrationAPI,
} from '../../graphql/datasources/IntegrationApi.js';
import makeInvestigationAPI, {
  type InvestigationAPI,
} from '../../graphql/datasources/InvestigationApi.js';
import makeLocationBankAPI, {
  type LocationBankAPI,
} from '../../graphql/datasources/LocationBankApi.js';
import makeOrgAPI, { type OrgAPI } from '../../graphql/datasources/OrgApi.js';
import makeRuleAPI, {
  type RuleAPI,
} from '../../graphql/datasources/RuleApi.js';
import { type HmaService } from '../../services/hmaService/index.js';
import makeUserAPI, {
  type UserAPI,
} from '../../graphql/datasources/UserApi.js';
import { type Dependencies } from '../index.js';
import { register } from '../utils.js';
// HMA service will be registered in main IoC container to avoid circular dependencies

declare module '../index.js' {
  interface Dependencies {
    // GraphQL Api Data Sources
    ActionAPIDataSource: ActionAPI;
    IntegrationAPIDataSource: IntegrationAPI;
    InvestigationAPIDataSource: InvestigationAPI;
    LocationBankAPIDataSource: LocationBankAPI;
    OrgAPIDataSource: OrgAPI;
    RuleAPIDataSource: RuleAPI;
    UserAPIDataSource: UserAPI;
    DataSources: DataSources;
    HMAHashBankService: HmaService;
  }
}

export type DataSources = ReturnType<typeof makeDataSources>;

export function registerGqlDataSources(bottle: Bottle<Dependencies>) {
  // GraphQL Api Data Sources
  register(bottle, 'ActionAPIDataSource', makeActionAPI);
  register(bottle, 'IntegrationAPIDataSource', makeIntegrationAPI);
  register(bottle, 'InvestigationAPIDataSource', makeInvestigationAPI);
  register(bottle, 'LocationBankAPIDataSource', makeLocationBankAPI);
  register(bottle, 'OrgAPIDataSource', makeOrgAPI);
  register(bottle, 'RuleAPIDataSource', makeRuleAPI);
  register(bottle, 'UserAPIDataSource', makeUserAPI);

  // HMA Service will be registered in main IoC container

  // Master dataSource service. Exists so that we can easily propagate the type
  // of this whole dataSources object to all the places we need to reference the
  // GraphQL context's type.
  bottle.factory('DataSources', makeDataSources);
}

function makeDataSources(deps: Dependencies) {
  return {
    actionAPI: deps.ActionAPIDataSource,
    integrationAPI: deps.IntegrationAPIDataSource,
    investigationAPI: deps.InvestigationAPIDataSource,
    locationBankAPI: deps.LocationBankAPIDataSource,
    orgAPI: deps.OrgAPIDataSource,
    ruleAPI: deps.RuleAPIDataSource,
    userAPI: deps.UserAPIDataSource,
    notificationsAPI: new (class extends DataSource<unknown> {
      private service = deps.NotificationsService;
      public async getNotificationsForUser(id: string) {
        return this.service.getNotificationsForUser(id);
      }
    })(),
  };
}
