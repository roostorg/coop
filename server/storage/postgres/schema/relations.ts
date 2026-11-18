import { defineRelations } from 'drizzle-orm';

import * as schema from './schema.js';

export const relations = defineRelations(schema, (r) => ({
  appealsRoutingRules: {
    manualReviewQueues: r.one.manualReviewQueues({
      from: r.appealsRoutingRules.destinationQueueId,
      to: r.manualReviewQueues.id,
    }),
    appealsRoutingRulesToItemTypess: r.many.appealsRoutingRulesToItemTypes(),
  },
  manualReviewQueues: {
    appealsRoutingRuless: r.many.appealsRoutingRules(),
    jobClaimss: r.many.jobClaims(),
    moderatorSkipss: r.many.moderatorSkips(),
    queuesAndClearReportsTriggerActionss:
      r.many.queuesAndClearReportsTriggerActions(),
    queuesAndHiddenActionss: r.many.queuesAndHiddenActions(),
    roles: r.many.roles({
      from: r.manualReviewQueues.id.through(r.rolesAndAccessibleQueues.queueId),
      to: r.roles.id.through(r.rolesAndAccessibleQueues.roleId),
    }),
    rolesAndAccessibleQueuess: r.many.rolesAndAccessibleQueues(),
    routingRuless: r.many.routingRules(),
    usersAndAccessibleQueuess: r.many.usersAndAccessibleQueues(),
    usersAndFavoriteMrtQueuess: r.many.usersAndFavoriteMrtQueues(),
    ncmecOrgSettingss: r.many.ncmecOrgSettings(),
  },
  appealsRoutingRulesToItemTypes: {
    appealsRoutingRules: r.one.appealsRoutingRules({
      from: r.appealsRoutingRulesToItemTypes.appealsRoutingRuleId,
      to: r.appealsRoutingRules.id,
    }),
  },
  jobClaims: {
    manualReviewQueues: r.one.manualReviewQueues({
      from: r.jobClaims.queueId,
      to: r.manualReviewQueues.id,
    }),
  },
  jobPriorityWeights: {
    org: r.one.orgs({
      from: r.jobPriorityWeights.orgId,
      to: r.orgs.id,
    }),
  },
  orgs: {
    jobPriorityWeightss: r.many.jobPriorityWeights(),
    actions: r.many.actions(),
    usersViaApiKeys: r.many.users({
      alias: 'users_id_orgs_id_via_apiKeys',
    }),
    apiKeys: r.many.apiKeys(),
    hashBanks: r.many.hashBanks(),
    rolesViaInviteUserTokens: r.many.roles({
      from: r.orgs.id.through(r.inviteUserTokens.orgId),
      to: r.roles.id.through(r.inviteUserTokens.roleId),
      alias: 'orgs_id_roles_id_via_inviteUserTokens',
    }),
    inviteUserTokens: r.many.inviteUserTokens(),
    itemTypes: r.many.itemTypes(),
    usersViaLocationBanks: r.many.users({
      from: r.orgs.id.through(r.locationBanks.orgId),
      to: r.users.id.through(r.locationBanks.ownerId),
      alias: 'orgs_id_users_id_via_locationBanks',
    }),
    locationBanks: r.many.locationBanks(),
    usersViaMediaBanks: r.many.users({
      from: r.orgs.id.through(r.mediaBanks.orgId),
      to: r.users.id.through(r.mediaBanks.ownerId),
      alias: 'orgs_id_users_id_via_mediaBanks',
    }),
    mediaBanks: r.many.mediaBanks(),
    policies: r.many.policies(),
    rolesOrgId: r.many.roles({
      alias: 'roles_orgId_orgs_id',
    }),
    usersViaRules: r.many.users({
      alias: 'users_id_orgs_id_via_rules',
    }),
    rules: r.many.rules(),
    signingKeys: r.many.signingKeys(),
    usersViaTextBanks: r.many.users({
      from: r.orgs.id.through(r.textBanks.orgId),
      to: r.users.id.through(r.textBanks.ownerId),
      alias: 'orgs_id_users_id_via_textBanks',
    }),
    textBanks: r.many.textBanks(),
    userStrikeThresholds: r.many.userStrikeThresholds(),
    rolesViaUsers: r.many.roles({
      from: r.orgs.id.through(r.users.orgId),
      to: r.roles.id.through(r.users.roleId),
      alias: 'orgs_id_roles_id_via_users',
    }),
    usersOrgId: r.many.users({
      alias: 'users_orgId_orgs_id',
    }),
    integrationConfigss: r.many.integrationConfigs(),
    openAiConfigss: r.many.openAiConfigs(),
  },
  moderatorSkips: {
    manualReviewQueues: r.one.manualReviewQueues({
      from: r.moderatorSkips.queueId,
      to: r.manualReviewQueues.id,
    }),
  },
  queuesAndClearReportsTriggerActions: {
    manualReviewQueues: r.one.manualReviewQueues({
      from: r.queuesAndClearReportsTriggerActions.queueId,
      to: r.manualReviewQueues.id,
    }),
  },
  queuesAndHiddenActions: {
    manualReviewQueues: r.one.manualReviewQueues({
      from: r.queuesAndHiddenActions.queueId,
      to: r.manualReviewQueues.id,
    }),
  },
  roles: {
    manualReviewQueuess: r.many.manualReviewQueues(),
    rolesAndAccessibleQueuess: r.many.rolesAndAccessibleQueues(),
    orgsViaInviteUserTokens: r.many.orgs({
      alias: 'orgs_id_roles_id_via_inviteUserTokens',
    }),
    inviteUserTokens: r.many.inviteUserTokens(),
    rolePermissions: r.many.rolePermissions(),
    org: r.one.orgs({
      from: r.roles.orgId,
      to: r.orgs.id,
      alias: 'roles_orgId_orgs_id',
    }),
    orgsViaUsers: r.many.orgs({
      alias: 'orgs_id_roles_id_via_users',
    }),
    users: r.many.users(),
  },
  rolesAndAccessibleQueues: {
    manualReviewQueues: r.one.manualReviewQueues({
      from: r.rolesAndAccessibleQueues.queueId,
      to: r.manualReviewQueues.id,
    }),
    role: r.one.roles({
      from: r.rolesAndAccessibleQueues.roleId,
      to: r.roles.id,
    }),
  },
  routingRules: {
    manualReviewQueues: r.one.manualReviewQueues({
      from: r.routingRules.destinationQueueId,
      to: r.manualReviewQueues.id,
    }),
    routingRulesToItemTypess: r.many.routingRulesToItemTypes(),
  },
  routingRulesToItemTypes: {
    routingRules: r.one.routingRules({
      from: r.routingRulesToItemTypes.routingRuleId,
      to: r.routingRules.id,
    }),
  },
  usersAndAccessibleQueues: {
    manualReviewQueues: r.one.manualReviewQueues({
      from: r.usersAndAccessibleQueues.queueId,
      to: r.manualReviewQueues.id,
    }),
  },
  usersAndFavoriteMrtQueues: {
    manualReviewQueues: r.one.manualReviewQueues({
      from: r.usersAndFavoriteMrtQueues.queueId,
      to: r.manualReviewQueues.id,
    }),
  },
  ncmecOrgSettings: {
    manualReviewQueues: r.one.manualReviewQueues({
      from: r.ncmecOrgSettings.defaultNcmecQueueId,
      to: r.manualReviewQueues.id,
    }),
  },
  actions: {
    org: r.one.orgs({
      from: r.actions.orgId,
      to: r.orgs.id,
    }),
    itemTypes: r.many.itemTypes({
      from: r.actions.id.through(r.actionsAndItemTypes.actionId),
      to: r.itemTypes.id.through(r.actionsAndItemTypes.itemTypeId),
    }),
    actionsAndItemTypes: r.many.actionsAndItemTypes(),
    rules: r.many.rules({
      from: r.actions.id.through(r.rulesAndActions.actionId),
      to: r.rules.id.through(r.rulesAndActions.ruleId),
    }),
    rulesAndActions: r.many.rulesAndActions(),
  },
  itemTypes: {
    actions: r.many.actions(),
    actionsAndItemTypes: r.many.actionsAndItemTypes(),
    org: r.one.orgs({
      from: r.itemTypes.orgId,
      to: r.orgs.id,
    }),
    rules: r.many.rules({
      from: r.itemTypes.id.through(r.rulesAndItemTypes.itemTypeId),
      to: r.rules.id.through(r.rulesAndItemTypes.ruleId),
    }),
    rulesAndItemTypes: r.many.rulesAndItemTypes(),
  },
  actionsAndItemTypes: {
    action: r.one.actions({
      from: r.actionsAndItemTypes.actionId,
      to: r.actions.id,
    }),
    itemType: r.one.itemTypes({
      from: r.actionsAndItemTypes.itemTypeId,
      to: r.itemTypes.id,
    }),
  },
  users: {
    orgsViaApiKeys: r.many.orgs({
      from: r.users.id.through(r.apiKeys.createdBy),
      to: r.orgs.id.through(r.apiKeys.orgId),
      alias: 'users_id_orgs_id_via_apiKeys',
    }),
    apiKeys: r.many.apiKeys(),
    rulesViaBacktests: r.many.rules({
      from: r.users.id.through(r.backtests.creatorId),
      to: r.rules.id.through(r.backtests.ruleId),
      alias: 'users_id_rules_id_via_backtests',
    }),
    backtests: r.many.backtests(),
    orgsViaLocationBanks: r.many.orgs({
      alias: 'orgs_id_users_id_via_locationBanks',
    }),
    locationBanks: r.many.locationBanks(),
    orgsViaMediaBanks: r.many.orgs({
      alias: 'orgs_id_users_id_via_mediaBanks',
    }),
    mediaBanks: r.many.mediaBanks(),
    notifications: r.many.notifications(),
    orgsViaRules: r.many.orgs({
      from: r.users.id.through(r.rules.creatorId),
      to: r.orgs.id.through(r.rules.orgId),
      alias: 'users_id_orgs_id_via_rules',
    }),
    rulesCreatorId: r.many.rules({
      alias: 'rules_creatorId_users_id',
    }),
    orgsViaTextBanks: r.many.orgs({
      alias: 'orgs_id_users_id_via_textBanks',
    }),
    textBanks: r.many.textBanks(),
    org: r.one.orgs({
      from: r.users.orgId,
      to: r.orgs.id,
      alias: 'users_orgId_orgs_id',
    }),
    roleRelation: r.one.roles({
      from: r.users.roleId,
      to: r.roles.id,
    }),
    rulesViaUsersAndFavoriteRules: r.many.rules({
      alias: 'rules_id_users_id_via_usersAndFavoriteRules',
    }),
    usersAndFavoriteRules: r.many.usersAndFavoriteRules(),
  },
  apiKeys: {
    user: r.one.users({
      from: r.apiKeys.createdBy,
      to: r.users.id,
    }),
    org: r.one.orgs({
      from: r.apiKeys.orgId,
      to: r.orgs.id,
    }),
  },
  rules: {
    usersViaBacktests: r.many.users({
      alias: 'users_id_rules_id_via_backtests',
    }),
    backtests: r.many.backtests(),
    user: r.one.users({
      from: r.rules.creatorId,
      to: r.users.id,
      alias: 'rules_creatorId_users_id',
    }),
    org: r.one.orgs({
      from: r.rules.orgId,
      to: r.orgs.id,
    }),
    actions: r.many.actions(),
    rulesAndActions: r.many.rulesAndActions(),
    itemTypes: r.many.itemTypes(),
    rulesAndItemTypes: r.many.rulesAndItemTypes(),
    policies: r.many.policies(),
    rulesAndPolicies: r.many.rulesAndPolicies(),
    usersViaUsersAndFavoriteRules: r.many.users({
      from: r.rules.id.through(r.usersAndFavoriteRules.ruleId),
      to: r.users.id.through(r.usersAndFavoriteRules.userId),
      alias: 'rules_id_users_id_via_usersAndFavoriteRules',
    }),
    usersAndFavoriteRules: r.many.usersAndFavoriteRules(),
  },
  backtests: {
    user: r.one.users({
      from: r.backtests.creatorId,
      to: r.users.id,
    }),
    rule: r.one.rules({
      from: r.backtests.ruleId,
      to: r.rules.id,
    }),
  },
  hashBanks: {
    org: r.one.orgs({
      from: r.hashBanks.orgId,
      to: r.orgs.id,
    }),
  },
  inviteUserTokens: {
    org: r.one.orgs({
      from: r.inviteUserTokens.orgId,
      to: r.orgs.id,
    }),
    roleRelation: r.one.roles({
      from: r.inviteUserTokens.roleId,
      to: r.roles.id,
    }),
  },
  locationBankLocations: {
    locationBank: r.one.locationBanks({
      from: r.locationBankLocations.bankId,
      to: r.locationBanks.id,
    }),
  },
  locationBanks: {
    locationBankLocations: r.many.locationBankLocations(),
    org: r.one.orgs({
      from: r.locationBanks.orgId,
      to: r.orgs.id,
    }),
    user: r.one.users({
      from: r.locationBanks.ownerId,
      to: r.users.id,
    }),
  },
  mediaBanks: {
    org: r.one.orgs({
      from: r.mediaBanks.orgId,
      to: r.orgs.id,
    }),
    user: r.one.users({
      from: r.mediaBanks.ownerId,
      to: r.users.id,
    }),
  },
  notifications: {
    user: r.one.users({
      from: r.notifications.userId,
      to: r.users.id,
    }),
  },
  policies: {
    org: r.one.orgs({
      from: r.policies.orgId,
      to: r.orgs.id,
    }),
    policy: r.one.policies({
      from: r.policies.parentId,
      to: r.policies.id,
      alias: 'policies_parentId_policies_id',
    }),
    policies: r.many.policies({
      alias: 'policies_parentId_policies_id',
    }),
    rules: r.many.rules({
      from: r.policies.id.through(r.rulesAndPolicies.policyId),
      to: r.rules.id.through(r.rulesAndPolicies.ruleId),
    }),
    rulesAndPolicies: r.many.rulesAndPolicies(),
  },
  rolePermissions: {
    role: r.one.roles({
      from: r.rolePermissions.roleId,
      to: r.roles.id,
    }),
  },
  rulesAndActions: {
    action: r.one.actions({
      from: r.rulesAndActions.actionId,
      to: r.actions.id,
    }),
    rule: r.one.rules({
      from: r.rulesAndActions.ruleId,
      to: r.rules.id,
    }),
  },
  rulesAndItemTypes: {
    itemType: r.one.itemTypes({
      from: r.rulesAndItemTypes.itemTypeId,
      to: r.itemTypes.id,
    }),
    rule: r.one.rules({
      from: r.rulesAndItemTypes.ruleId,
      to: r.rules.id,
    }),
  },
  rulesAndPolicies: {
    policy: r.one.policies({
      from: r.rulesAndPolicies.policyId,
      to: r.policies.id,
    }),
    rule: r.one.rules({
      from: r.rulesAndPolicies.ruleId,
      to: r.rules.id,
    }),
  },
  signingKeys: {
    org: r.one.orgs({
      from: r.signingKeys.orgId,
      to: r.orgs.id,
    }),
  },
  textBanks: {
    org: r.one.orgs({
      from: r.textBanks.orgId,
      to: r.orgs.id,
    }),
    user: r.one.users({
      from: r.textBanks.ownerId,
      to: r.users.id,
    }),
  },
  userStrikeThresholds: {
    org: r.one.orgs({
      from: r.userStrikeThresholds.orgId,
      to: r.orgs.id,
    }),
  },
  usersAndFavoriteRules: {
    rule: r.one.rules({
      from: r.usersAndFavoriteRules.ruleId,
      to: r.rules.id,
    }),
    user: r.one.users({
      from: r.usersAndFavoriteRules.userId,
      to: r.users.id,
    }),
  },
  reportingRulesToActions: {
    reportingRule: r.one.reportingRules({
      from: r.reportingRulesToActions.reportingRuleId,
      to: r.reportingRules.id,
    }),
  },
  reportingRules: {
    reportingRulesToActions: r.many.reportingRulesToActions(),
    reportingRulesToItemTypes: r.many.reportingRulesToItemTypes(),
    reportingRulesToPolicies: r.many.reportingRulesToPolicies(),
  },
  reportingRulesToItemTypes: {
    reportingRule: r.one.reportingRules({
      from: r.reportingRulesToItemTypes.reportingRuleId,
      to: r.reportingRules.id,
    }),
  },
  reportingRulesToPolicies: {
    reportingRule: r.one.reportingRules({
      from: r.reportingRulesToPolicies.reportingRuleId,
      to: r.reportingRules.id,
    }),
  },
  integrationConfigs: {
    org: r.one.orgs({
      from: r.integrationConfigs.orgId,
      to: r.orgs.id,
    }),
  },
  openAiConfigs: {
    org: r.one.orgs({
      from: r.openAiConfigs.orgId,
      to: r.orgs.id,
    }),
  },
}));
