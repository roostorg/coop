/* eslint-disable max-lines */
import { AuthenticationError } from 'apollo-server-express';

import { isCoopErrorOfType } from '../../utils/errors.js';
import { __throw } from '../../utils/misc.js';
import {
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
    ssoUrl: String
    ssoCert: String
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

  input UpdateSSOCredentialsInput {
    ssoUrl: String!
    ssoCert: String!
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
    updateSSOCredentials(input: UpdateSSOCredentialsInput!): Boolean!
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

    return context.dataSources.integrationAPI.getAllIntegrationConfigs(org.id);
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
  async updateSSOCredentials(_, { input }, context) {
    const user = context.getUser();
    if (!user) {
      throw new AuthenticationError('User required.');
    }

    return context.services.OrgSettingsService.updateSamlSettings({
      orgId: user.orgId,
      ssoUrl: input.ssoUrl,
      cert: input.ssoCert,
    });
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
