import { readCatalogRefreshInterval } from '../../services/integrationContextSettings/index.js';
import { UserPermission } from '../../services/userManagementService/index.js';
import { isCoopErrorOfType } from '../../utils/errors.js';
import { makeIntegrationConfigUnsupportedIntegrationError } from '../datasources/IntegrationApi.js';
import {
  type GQLIntegrationConfigResolvers,
  type GQLMutationResolvers,
} from '../generated.js';
import { forbiddenError, unauthenticatedError } from '../utils/errors.js';
import { gqlErrorResult, gqlSuccessResult } from '../utils/gqlResult.js';

const typeDefs = /* GraphQL */ `
  enum IntegrationCatalogRefreshStatus {
    NEVER_REFRESHED
    OK
    ERROR
  }

  type IntegrationCatalogStatus {
    status: IntegrationCatalogRefreshStatus!
    version: String
    signalCount: Int
    fetchedAt: DateTime
    errorMessage: String
    "Signals in this org's current catalog, with their subcategories (e.g. policies)."
    signals: [IntegrationCatalogSignal!]!
  }

  type IntegrationCatalogSignal {
    signalTypeId: String!
    displayName: String!
    subcategories: [IntegrationCatalogSignalSubcategory!]!
  }

  type IntegrationCatalogSignalSubcategory {
    id: String!
    label: String!
  }

  "How often Coop refreshes an org's catalog in the background."
  enum IntegrationCatalogRefreshInterval {
    MANUAL
    HOURLY
    EVERY_6_HOURS
    DAILY
    WEEKLY
  }

  extend type IntegrationConfig {
    "The org's background refresh interval; null when the plugin has no catalog."
    catalogRefreshInterval: IntegrationCatalogRefreshInterval
  }

  extend input SetPluginIntegrationConfigInput {
    "Omit to keep the current interval."
    catalogRefreshInterval: IntegrationCatalogRefreshInterval
  }

  type RefreshIntegrationCatalogSuccessResponse {
    integrationId: String!
    version: String!
    signalCount: Int!
    fetchedAt: DateTime!
    addedSignalTypeIds: [String!]!
    removedSignalTypeIds: [String!]!
  }

  type IntegrationCatalogRefreshError implements Error {
    title: String!
    status: Int!
    type: [String!]!
    pointer: String
    detail: String
    requestId: String
  }

  union RefreshIntegrationCatalogResponse =
    | RefreshIntegrationCatalogSuccessResponse
    | IntegrationCatalogRefreshError
    | IntegrationConfigUnsupportedIntegrationError

  extend type Mutation {
    refreshIntegrationCatalog(
      integrationId: String!
    ): RefreshIntegrationCatalogResponse!
  }
`;

const Mutation: GQLMutationResolvers = {
  async refreshIntegrationCatalog(_, params, context) {
    try {
      const user = context.getUser();
      if (user == null) throw unauthenticatedError('Unauthenticated User');
      if (!user.getPermissions().includes(UserPermission.MANAGE_ORG)) {
        throw forbiddenError(
          'User does not have permission to refresh integration catalogs',
        );
      }
      if (
        !context.services.SignalsService.supportsCatalogRefresh(
          params.integrationId,
        )
      ) {
        throw makeIntegrationConfigUnsupportedIntegrationError({
          shouldErrorSpan: true,
        });
      }
      const result = await context.services.SignalsService.refreshPluginCatalog(
        {
          orgId: user.orgId,
          integrationId: params.integrationId,
        },
      );
      return gqlSuccessResult(
        { integrationId: params.integrationId, ...result },
        'RefreshIntegrationCatalogSuccessResponse',
      );
    } catch (e: unknown) {
      if (
        isCoopErrorOfType(e, [
          'IntegrationCatalogRefreshError',
          'IntegrationConfigUnsupportedIntegrationError',
        ])
      ) {
        return gqlErrorResult(e);
      }
      throw e;
    }
  },
};

const IntegrationConfig: GQLIntegrationConfigResolvers = {
  catalogRefreshInterval(it, _, context) {
    return context.services.SignalsService.supportsCatalogRefresh(it.name)
      ? readCatalogRefreshInterval(it.apiCredential)
      : null;
  },
};

const resolvers = {
  IntegrationConfig,
  Mutation,
};

export { typeDefs, resolvers };
