/* eslint-disable max-lines */
import { AuthenticationError } from 'apollo-server-express';

import { isCoopErrorOfType } from '../../utils/errors.js';
import { __throw } from '../../utils/misc.js';
import {
  type GQLIntegrationConfig,
  type GQLMatchingBanksResolvers,
  type GQLMutationResolvers,
  type GQLOrgResolvers,
  type GQLPendingInvite,
  type GQLQueryResolvers,
} from '../generated.js';
import { gqlErrorResult, gqlSuccessResult } from '../utils/gqlResult.js';

const typeDefs = /* GraphQL */ `
  type Org {
    id: ID!
    name: String!
    email: String!
    websiteUrl: String!
    onCallAlertEmail: String
    users: [User!]!
    pendingInvites: [PendingInvite!]!
    rules: [Rule!]!
    routingRules: [RoutingRule!]!
    appealsRoutingRules: [RoutingRule!]!
    reportingRules: [ReportingRule!]!
    signals(customOnly: Boolean = false): [Signal!]!
    # Deprecated field. Actually returns all item types, whether they're
    # content item types or not, but in this legacy ContentType shape.
    contentTypes: [ContentType!]!
    itemTypes: [ItemType!]!
    actions: [Action!]!
    banks: MatchingBanks
    policies: [Policy!]!
    mrtQueues: [ManualReviewQueue!]!
    apiKey: String!
    publicSigningKey: String!
    integrationConfigs: [IntegrationConfig!]!
    hasReportingRulesEnabled: Boolean!
    hasNCMECReportingEnabled: Boolean!
    hasAppealsEnabled: Boolean!
    ncmecReports: [NCMECReport!]!
    requiresPolicyForDecisionsInMrt: Boolean!
    requiresDecisionReasonInMrt: Boolean!
    previewJobsViewEnabled: Boolean!
    allowMultiplePoliciesPerAction: Boolean!
    hideSkipButtonForNonAdmins: Boolean!
    usersWhoCanReviewEveryQueue: [User!]!
    defaultInterfacePreferences: UserInterfacePreferences!
    userStrikeThresholds: [UserStrikeThreshold!]!
    userStrikeTTL: Int!
    isDemoOrg: Boolean!
    samlEnabled: Boolean!
    ssoUrl: String
    ssoCert: String
    oidcEnabled: Boolean!
    issuerUrl: String
    clientId: String
    clientSecret: String
    oidcCallbackUrl: String
    hasPartialItemsEndpoint: Boolean!
  }

  input CreateOrgInput {
    name: String!
    email: String!
    website: String!
  }

  type CreateOrgSuccessResponse {
    id: ID!
  }

  type OrgWithEmailExistsError implements Error {
    title: String!
    status: Int!
    type: [String!]!
    pointer: String
    detail: String
    requestId: String
  }

  type OrgWithNameExistsError implements Error {
    title: String!
    status: Int!
    type: [String!]!
    pointer: String
    detail: String
    requestId: String
  }

  union CreateOrgResponse =
      CreateOrgSuccessResponse
    | OrgWithEmailExistsError
    | OrgWithNameExistsError

  input AppealSettingsInput {
    appealsCallbackUrl: String
    appealsCallbackHeaders: JSONObject
    appealsCallbackBody: JSONObject
  }

  type AppealSettings {
    appealsCallbackUrl: String
    appealsCallbackHeaders: JSONObject
    appealsCallbackBody: JSONObject
  }

  type UserStrikeThreshold {
    id: String!
    threshold: Int!
    actions: [ID!]!
  }

  input SetUserStrikeThresholdInput {
    threshold: Int!
    actions: [String!]!
  }

  input SetAllUserStrikeThresholdsInput {
    thresholds: [SetUserStrikeThresholdInput!]!
  }

  input UpdateUserStrikeTTLInput {
    ttlDays: Int!
  }

  type Query {
    org(id: ID!): Org
    allOrgs: [Org!]! @publicResolver
    appealSettings: AppealSettings
  }

  type SetAllUserStrikeThresholdsSuccessResponse {
    _: Boolean
  }

  type UpdateUserStrikeTTLSuccessResponse {
    _: Boolean
  }

  input UpdateSSOSamlCredentialsInput {
    samlEnabled: Boolean!
    ssoUrl: String!
    ssoCert: String!
  }
  
  input UpdateSSOOidcCredentialsInput {
    oidcEnabled: Boolean!
    issuerUrl: String!
    clientId: String!
    clientSecret: String!
  }

  enum SSOMethod {
    SAML
    OIDC
  }

  input SwitchSSOMethodInput {
    method: SSOMethod!
    # SAML fields (required when method = SAML)
    ssoUrl: String
    ssoCert: String
    # OIDC fields (required when method = OIDC)
    issuerUrl: String
    clientId: String
    clientSecret: String
  }

  input UpdateOrgInfoInput {
    name: String
    email: String
    websiteUrl: String
    onCallAlertEmail: String
  }

  type UpdateOrgInfoSuccessResponse {
    _: Boolean
  }


  type Mutation {
    createOrg(input: CreateOrgInput!): CreateOrgResponse! @publicResolver
    updateAppealSettings(input: AppealSettingsInput!): AppealSettings!
    setAllUserStrikeThresholds(
      input: SetAllUserStrikeThresholdsInput!
    ): SetAllUserStrikeThresholdsSuccessResponse!
    updateUserStrikeTTL(
      input: UpdateUserStrikeTTLInput!
    ): UpdateUserStrikeTTLSuccessResponse!
    setOrgDefaultSafetySettings(
      orgDefaultSafetySettings: ModeratorSafetySettingsInput!
    ): SetModeratorSafetySettingsSuccessResponse
    updateSSOSamlCredentials(input: UpdateSSOSamlCredentialsInput!): Boolean!
    updateSSOOidcCredentials(input: UpdateSSOOidcCredentialsInput!): Boolean!
    switchSSOMethod(input: SwitchSSOMethodInput!): Org!
    updateOrgInfo(input: UpdateOrgInfoInput!): UpdateOrgInfoSuccessResponse!
  }
`;

const Query: GQLQueryResolvers = {
  async org(_, { id }, context) {
    const user = context.getUser();
    if (user == null || user.orgId !== id) {
      throw new AuthenticationError('Authenticated user required');
    }

    return context.dataSources.orgAPI.getGraphQLOrgFromId(id);
  },
  // TODO(rui): this resolver is currently public in order to support
  // the org dropdown in the signup page. We should deprecate that dropdown
  // and remove the public directive.
  async allOrgs(_, __, context) {
    return context.dataSources.orgAPI.getAllGraphQLOrgs();
  },
  async appealSettings(_, __, context) {
    const user = context.getUser();
    if (user == null || !user.orgId) {
      throw new AuthenticationError('Authenticated user required');
    }
    const settings =
      await context.services.OrgSettingsService.getAppealSettings(user.orgId);
    return {
      appealsCallbackUrl: settings.appealCallbackUrl ?? null,
      appealsCallbackHeaders: settings.appealCallbackHeaders ?? null,
      appealsCallbackBody: settings.appealCallbackBody ?? null,
    };
  },
};

const Org: GQLOrgResolvers = {
  async actions(org, _, context) {
    const user = context.getUser();
    if (!user || user.orgId !== org.id) {
      throw new AuthenticationError('User required.');
    }

    return org.getActions();
  },
  async contentTypes(org, _, context) {
    const user = context.getUser();
    if (!user || user.orgId !== org.id) {
      throw new AuthenticationError('User required.');
    }
    return org.getContentTypes();
  },
  async itemTypes(org, _, context) {
    const user = context.getUser();
    if (!user || user.orgId !== org.id) {
      throw new AuthenticationError('User required.');
    }
    return context.services.ModerationConfigService.getItemTypes({
      orgId: org.id,
    });
  },
  async users(org, _, context) {
    const user = context.getUser();
    if (!user || user.orgId !== org.id) {
      throw new AuthenticationError('User required.');
    }
    return org.getUsers();
  },
  async pendingInvites(org, _, context): Promise<GQLPendingInvite[]> {
    const user = context.getUser();
    if (!user || user.orgId !== org.id) {
      throw new AuthenticationError('User required.');
    }

    if (!user.getPermissions().includes('MANAGE_ORG')) {
      throw new AuthenticationError(
        'User does not have permission to view pending invites',
      );
    }

    const invites =
      await context.services.UserManagementService.getPendingInvites(org.id);
    return invites as GQLPendingInvite[];
  },
  async rules(org, _, context) {
    const user = context.getUser();
    if (!user || user.orgId !== org.id) {
      throw new AuthenticationError('User required.');
    }
    return org.getRules();
  },
  async routingRules(org, _, context) {
    const user = context.getUser();
    if (!user || user.orgId !== org.id) {
      throw new AuthenticationError('User required');
    }

    return context.services.ManualReviewToolService.getRoutingRules({
      orgId: org.id,
      directives: {
        maxAge: 0,
      },
    });
  },
  async appealsRoutingRules(org, _, context) {
    const user = context.getUser();
    if (!user || user.orgId !== org.id) {
      throw new AuthenticationError('User required');
    }

    return context.services.ManualReviewToolService.getAppealsRoutingRules({
      orgId: org.id,
      directives: {
        maxAge: 0,
      },
    });
  },
  async reportingRules(org, _, context) {
    const user = context.getUser();
    if (!user || user.orgId !== org.id) {
      throw new AuthenticationError('User required');
    }

    return context.services.ReportingService.getReportingRules({
      orgId: org.id,
      directives: {
        maxAge: 0,
      },
    });
  },
  async mrtQueues(org, _, context) {
    const user = context.getUser();
    if (!user || user.orgId !== org.id) {
      throw new AuthenticationError('User required');
    }
    return context.services.ManualReviewToolService.getAllQueuesForOrgAndDangerouslyBypassPermissioning(
      {
        orgId: user.orgId,
      },
    );
  },
  async apiKey(org, _, context) {
    const user = context.getUser();
    if (!user || user.orgId !== org.id) {
      throw new AuthenticationError('User required.');
    }
    const apiKey = await context.dataSources.orgAPI.getActivatedApiKeyForOrg(
      org.id,
    );

    // API Keys are required in prod, but no reason to throw outside prod (like
    // on engineers' local machines)
    if (!apiKey) {
      return process.env.NODE_ENV !== 'production'
        ? ''
        : __throw(new AuthenticationError('API Key not found'));
    }

    return apiKey.key;
  },
  async integrationConfigs(org, _, context) {
    const user = context.getUser();
    if (!user || user.orgId !== org.id) {
      throw new AuthenticationError('User required.');
    }

    return context.dataSources.integrationAPI.getAllIntegrationConfigs(
      org.id,
    ) as Promise<GQLIntegrationConfig[]>;
  },
  // customOnly param fetches only the org's custom signals
  async signals(org, { customOnly }, context) {
    const user = context.getUser();
    if (!user || user.orgId !== org.id) {
      throw new AuthenticationError('User required.');
    }

    return customOnly
      ? []
      : context.services.SignalsService.getSignalsForOrg({ orgId: org.id });
  },
  async userStrikeThresholds(org, _, context) {
    const user = context.getUser();
    if (!user || user.orgId !== org.id) {
      throw new AuthenticationError('User required.');
    }

    return context.services.ModerationConfigService.getUserStrikeThresholdsForOrg(
      user.orgId,
    );
  },
  async policies(org, _, context) {
    const user = context.getUser();
    if (!user || user.orgId !== org.id) {
      throw new AuthenticationError('User required.');
    }

    return context.services.ModerationConfigService.getPolicies({
      orgId: user.orgId,
      readFromReplica: true,
    });
  },
  async banks(org, _, context) {
    const user = context.getUser();
    if (!user || user.orgId !== org.id) {
      throw new AuthenticationError('User required.');
    }
    return org;
  },
  async hasReportingRulesEnabled(org, _, context) {
    const user = context.getUser();
    if (!user || user.orgId !== org.id) {
      throw new AuthenticationError('User required.');
    }
    return context.services.OrgSettingsService.hasReportingRulesEnabled(org.id);
  },
  async hasAppealsEnabled(org, _, context) {
    const user = context.getUser();
    if (!user || user.orgId !== org.id) {
      throw new AuthenticationError('User required.');
    }
    return context.services.OrgSettingsService.hasAppealsEnabled(org.id);
  },
  async userStrikeTTL(org, _, context) {
    const user = context.getUser();
    if (!user || user.orgId !== org.id) {
      throw new AuthenticationError('User required.');
    }
    return context.services.OrgSettingsService.userStrikeTTLInDays(org.id);
  },
  async publicSigningKey(org, _, context) {
    const user = context.getUser();
    if (!user || user.orgId !== org.id) {
      throw new AuthenticationError('User required.');
    }
    return context.dataSources.orgAPI.getPublicSigningKeyPem(org.id);
  },
  async hasNCMECReportingEnabled(org, _, context) {
    const user = context.getUser();
    if (!user || user.orgId !== org.id) {
      throw new AuthenticationError('User required.');
    }
    return context.services.NcmecService.hasNCMECReportingEnabled(org.id);
  },
  async ncmecReports(org, _, context) {
    const user = context.getUser();
    if (!user || user.orgId !== org.id) {
      throw new AuthenticationError('User required.');
    }
    const reports = await context.services.NcmecService.getNcmecReports({
      orgId: user.orgId,
      reviewerId: user.id,
    });
    return Promise.all(
      reports.map(async (report) => {
        const itemType =
          await context.services.ModerationConfigService.getItemType({
            orgId: user.orgId,
            itemTypeSelector: { id: report.userItemTypeId },
          });

        // The only way the item type would not exist is if the item type had been
        // deleted between the time the report was enqueued and the time the
        // report is viewed in the NCMEC view.
        if (!itemType || itemType.kind !== 'USER') {
          throw Error('NCMEC user item type is not of kind USER');
        }

        return {
          ...report,
          additionalFiles: report.additionalFiles ?? [],
          userItemType: itemType,
          reportedMessages: report.reportedMessages ?? [],
        };
      }),
    );
  },
  async requiresPolicyForDecisionsInMrt(org, _, context) {
    return context.services.ManualReviewToolService.getRequiresPolicyForDecisions(
      org.id,
    );
  },
  async requiresDecisionReasonInMrt(org, _, context) {
    return context.services.ManualReviewToolService.getRequiresDecisionReason(
      org.id,
    );
  },
  async previewJobsViewEnabled(org, _, context) {
    return context.services.ManualReviewToolService.getPreviewJobsViewEnabled(
      org.id,
    );
  },
  async allowMultiplePoliciesPerAction(org, _, context) {
    return context.services.OrgSettingsService.allowMultiplePoliciesPerAction(
      org.id,
    );
  },
  async hideSkipButtonForNonAdmins(org, _, context) {
    return context.services.ManualReviewToolService.getHideSkipButtonForNonAdmins(
      org.id,
    );
  },
  async usersWhoCanReviewEveryQueue(org, _, __) {
    return (await org.getUsers()).filter((user) =>
      user.getPermissions().includes('EDIT_MRT_QUEUES'),
    );
  },
  async defaultInterfacePreferences(org, _, context) {
    const orgDefaults =
      await context.services.UserManagementService.getOrgDefaultUserInterfaceSettings(
        org.id,
      );
    return {
      ...orgDefaults,
      // Right now, we don't allow orgs to set custom MRT chart configurations.
      // These would prepopulate every user's custom MRT dashboard with charts
      // set by the org's admin. We can always add that ability later, but we're
      // leaving this empty for now.
      mrtChartConfigurations: [],
    };
  },
  async isDemoOrg(org, _, context) {
    return context.services.OrgSettingsService.isDemoOrg(org.id);
  },
  async ssoUrl(org, _, context) {
    const user = context.getUser();
    if (user == null || user.orgId !== org.id) {
      throw new AuthenticationError('Authenticated user required');
    }

    if (!user.getPermissions().includes('MANAGE_ORG')) {
      throw new AuthenticationError(
        'User does not have permission to manage SSO settings',
      );
    }

    const settings = await context.services.OrgSettingsService.getSamlSettings(
      org.id,
    );

    if (!settings) {
      return null;
    }

    return settings.sso_url;
  },
  async ssoCert(org, _, context) {
    const user = context.getUser();
    if (user == null || user.orgId !== org.id) {
      throw new AuthenticationError('Authenticated user required');
    }

    if (!user.getPermissions().includes('MANAGE_ORG')) {
      throw new AuthenticationError(
        'User does not have permission to manage SSO settings',
      );
    }

    const settings = await context.services.OrgSettingsService.getSamlSettings(
      org.id,
    );

    if (!settings) {
      return null;
    }

    return settings.cert;
  },
  
  async clientSecret(org, _, context) {
    const user = context.getUser();
    if (user == null || user.orgId !== org.id) {
      throw new AuthenticationError('Authenticated user required');
    }

    if (!user.getPermissions().includes('MANAGE_ORG')) {
      throw new AuthenticationError(
        'User does not have permission to manage SSO settings',
      );
    }

    const settings = await context.services.OrgSettingsService.getOidcSettings(
      org.id,
    );

    if (!settings) {
      return null;
    }

    return settings.client_secret;
  },
  async issuerUrl(org, _, context) {
    const user = context.getUser();
    if (user == null || user.orgId !== org.id) {
      throw new AuthenticationError('Authenticated user required');
    }

    if (!user.getPermissions().includes('MANAGE_ORG')) {
      throw new AuthenticationError(
        'User does not have permission to manage SSO settings',
      );
    }

    const settings = await context.services.OrgSettingsService.getOidcSettings(
      org.id,
    );

    if (!settings) {
      return null;
    }

    return settings.issuer_url;
  },
  async clientId(org, _, context) {
    const user = context.getUser();
    if (user == null || user.orgId !== org.id) {
      throw new AuthenticationError('Authenticated user required');
    }

    if (!user.getPermissions().includes('MANAGE_ORG')) {
      throw new AuthenticationError(
        'User does not have permission to manage SSO settings',
      );
    }

    const settings = await context.services.OrgSettingsService.getOidcSettings(
      org.id,
    );

    if (!settings) {
      return null;
    }

    return settings.client_id;
  },
  async samlEnabled(org, _, context) {
    const settings = await context.services.OrgSettingsService.getSamlSettings(org.id);
    return settings?.saml_enabled ?? false;
  },
  async oidcEnabled(org, _, context) {
    const settings = await context.services.OrgSettingsService.getOidcSettings(org.id);
    return settings?.oidc_enabled ?? false;
  },
  async hasPartialItemsEndpoint(org, _, context) {
    const partialItemsInfo =
      await context.services.OrgSettingsService.partialItemsInfo(org.id);
    const partialItemsEndpoint = partialItemsInfo?.partialItemsEndpoint;

    return partialItemsEndpoint != null;
  },
};

const MatchingBanks: GQLMatchingBanksResolvers = {
  async textBanks(org, _, context) {
    const user = context.getUser();
    if (!user || user.orgId !== org.id) {
      throw new AuthenticationError('User required.');
    }
    return context.services.ModerationConfigService.getTextBanks({
      orgId: org.id,
    });
  },
  async locationBanks(org, _, context) {
    const user = context.getUser();
    if (!user || user.orgId !== org.id) {
      throw new AuthenticationError('User required.');
    }
    return context.dataSources.locationBankAPI.getGraphQLLocationBanksForOrg(
      org.id,
    );
  },
  async hashBanks(org, _, context) {
    const user = context.getUser();
    if (!user || user.orgId !== org.id) {
      throw new AuthenticationError('User required.');
    }
    return context.services.HMAHashBankService.listBanks(org.id);
  },
};

const Mutation: GQLMutationResolvers = {
  async createOrg(_, params, context) {
    try {
      const org = await context.dataSources.orgAPI.createOrg(params);
      return gqlSuccessResult({ id: org.id }, 'CreateOrgSuccessResponse');
    } catch (e: unknown) {
      if (
        isCoopErrorOfType(e, [
          'OrgWithEmailExistsError',
          'OrgWithNameExistsError',
        ])
      ) {
        return gqlErrorResult(e);
      }

      throw e;
    }
  },
  async updateAppealSettings(_, { input }, context) {
    const user = context.getUser();
    if (!user || !user.orgId) {
      throw new AuthenticationError('User required.');
    }
    const settings =
      await context.services.OrgSettingsService.updateAppealSettings({
        orgId: user.orgId,
        callbackUrl: input.appealsCallbackUrl ?? null,
        callbackHeaders: input.appealsCallbackHeaders ?? null,
        callbackBody: input.appealsCallbackBody ?? null,
      });
    return settings ?? {};
  },

  async setOrgDefaultSafetySettings(_, params, context) {
    const user = context.getUser();
    if (!user) {
      throw new AuthenticationError('User required.');
    }
    await context.services.UserManagementService.upsertOrgDefaultUserInterfaceSettings(
      {
        orgId: user.orgId,
        ...params.orgDefaultSafetySettings,
      },
    );
    return gqlSuccessResult({}, 'SetModeratorSafetySettingsSuccessResponse');
  },

  async setAllUserStrikeThresholds(_, params, context) {
    const user = context.getUser();
    if (!user) {
      throw new AuthenticationError('User required.');
    }

    await context.services.ModerationConfigService.setAllUserStrikeThresholds({
      orgId: user.orgId,
      thresholds: params.input.thresholds,
    });
    return gqlSuccessResult({}, 'SetAllUserStrikeThresholdsSuccessResponse');
  },

  async updateUserStrikeTTL(_, { input }, context) {
    const user = context.getUser();
    if (!user) {
      throw new AuthenticationError('User required.');
    }
    await context.services.OrgSettingsService.updateUserStrikeTTL({
      orgId: user.orgId,
      ttlDays: input.ttlDays,
    });
    return gqlSuccessResult({}, 'UpdateUserStrikeTTLSuccessResponse');
  },
  async updateSSOSamlCredentials(_, { input }, context) {
    const user = context.getUser();
    if (!user) {
      throw new AuthenticationError('User required.');
    }
    const oidcSettings = await context.services.OrgSettingsService.getOidcSettings(user.orgId); 
    if (oidcSettings?.oidc_enabled && input.samlEnabled) {
      throw new Error('SAML cannot enabled as OIDC is enabled.');
    }

    return context.services.OrgSettingsService.updateSamlSettings({
      orgId: user.orgId,
      samlEnabled: input.samlEnabled,
      ssoUrl: input.ssoUrl,
      cert: input.ssoCert,
    });
  },
  async updateSSOOidcCredentials(_, { input }, context) {
    const user = context.getUser();
    if (!user) {
      throw new AuthenticationError('User required.');
    }
    
    const samlSettings = await context.services.OrgSettingsService.getSamlSettings(user.orgId); 
    if (samlSettings?.saml_enabled && input.oidcEnabled) {
      throw new Error('OIDC cannot enabled as SAML is enabled.');
    }

    return context.services.OrgSettingsService.updateOidcSettings({
      orgId: user.orgId,
      oidcEnabled: input.oidcEnabled,
      issuerUrl: input.issuerUrl,
      clientId: input.clientId,
      clientSecret: input.clientSecret,
    });
  },
  async switchSSOMethod(_, { input }, context) {
    const user = context.getUser();
    if (!user) {
      throw new AuthenticationError('User required.');
    }
    if (input.method === 'SAML') {
      if (!input.ssoUrl || !input.ssoCert) {
        throw new Error('ssoUrl and ssoCert are required when switching to SAML.');
      }
      await context.services.OrgSettingsService.switchSSOMethod({
        orgId: user.orgId,
        method: 'saml',
        ssoUrl: input.ssoUrl,
        cert: input.ssoCert,
      });
    } else {
      if (!input.issuerUrl || !input.clientId || !input.clientSecret) {
        throw new Error('issuerUrl, clientId, and clientSecret are required when switching to OIDC.');
      }
      await context.services.OrgSettingsService.switchSSOMethod({
        orgId: user.orgId,
        method: 'oidc',
        issuerUrl: input.issuerUrl,
        clientId: input.clientId,
        clientSecret: input.clientSecret,
      });
    }
    return context.dataSources.orgAPI.getGraphQLOrgFromId(user.orgId);
  },
  async updateOrgInfo(_, { input }, context) {
    const user = context.getUser();
    if (!user) {
      throw new AuthenticationError('User required.');
    }

    if (!user.getPermissions().includes('MANAGE_ORG')) {
      throw new AuthenticationError(
        'User does not have permission to manage org info',
      );
    }

    await context.dataSources.orgAPI.updateOrgInfo(user.orgId, input);

    return gqlSuccessResult({}, 'UpdateOrgInfoSuccessResponse');
  },
};

const resolvers = {
  Query,
  Mutation,
  Org,
  MatchingBanks,
};

export { typeDefs, resolvers };
