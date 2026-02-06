import { AuthenticationError } from 'apollo-server-core';

import { formatItemSubmissionForGQL } from '../../graphql/types.js';
import type { GQLMutationResolvers, GQLQueryResolvers } from '../generated.js';

const typeDefs = /* GraphQL */ `
  type Query {
    ncmecReportById(reportId: ID!): NCMECReport
    ncmecThreads(
      userId: ItemIdentifierInput!
      reportedMessages: [ItemIdentifierInput!]!
    ): [ThreadWithMessagesAndIpAddress!]!
    ncmecOrgSettings: NcmecOrgSettings
  }

  type Mutation {
    updateNcmecOrgSettings(
      input: NcmecOrgSettingsInput!
    ): UpdateNcmecOrgSettingsResponse!
  }

  type NcmecOrgSettings {
    username: String!
    password: String!
    contactEmail: String
    moreInfoUrl: String
    companyTemplate: String
    legalUrl: String
    ncmecPreservationEndpoint: String
    ncmecAdditionalInfoEndpoint: String
  }

  input NcmecOrgSettingsInput {
    username: String!
    password: String!
    contactEmail: String
    moreInfoUrl: String
    companyTemplate: String
    legalUrl: String
    ncmecPreservationEndpoint: String
    ncmecAdditionalInfoEndpoint: String
  }

  type UpdateNcmecOrgSettingsResponse {
    success: Boolean!
  }

  type NCMECReportedMedia {
    id: String!
    xml: String!
  }

  type NcmecAdditionalFile {
    xml: String!
    ncmecFileId: String!
    url: String!
  }

  type NCMECReport {
    reportId: String!
    ts: DateTime!
    userId: String!
    userItemType: UserItemType!
    reviewerId: String
    reportXml: String!
    reportedMedia: [NCMECReportedMedia!]!
    additionalFiles: [NcmecAdditionalFile!]!
    reportedMessages: [NCMECReportedThread!]!
    isTest: Boolean
  }

  type NCMECReportedThread {
    csv: String!
    ncmecFileId: String!
    fileName: String!
  }

  enum NcmecFileAnnotation {
    ANIME_DRAWING_VIRTUAL_HENTAI
    POTENTIAL_MEME
    VIRAL
    POSSIBLE_SELF_PRODUCTION
    PHYSICAL_HARM
    VIOLENCE_GORE
    BESTIALITY
    LIVE_STREAMING
    INFANT
    GENERATIVE_AI
  }

  enum NcmecIndustryClassification {
    A1
    A2
    B1
    B2
  }

  input NcmecMediaInput {
    id: ID!
    typeId: ID!
    url: String!
    fileAnnotations: [NcmecFileAnnotation!]!
    industryClassification: NcmecIndustryClassification!
  }

  type NcmecReportedMediaDetails {
    id: String!
    typeId: ID!
    url: String!
    fileAnnotations: [NcmecFileAnnotation!]!
    industryClassification: NcmecIndustryClassification!
  }

  input NcmecThreadInput {
    threadId: ID!
    threadTypeId: ID!
    reportedContent: [NcmecContentInThreadReport!]!
  }

  input NcmecContentInThreadReport {
    contentId: ID!
    contentTypeId: ID!
    content: String
    creatorId: ID!
    targetId: ID!
    sentAt: DateTime!
    ipAddress: IpAddressInput!
    chatType: String!
    type: String!
  }

  input IpAddressInput {
    ip: String!
    port: Int
  }

  type ThreadWithMessagesAndIpAddress {
    threadId: ID!
    threadTypeId: ID!
    messages: [MessageWithIpAddress!]!
  }

  type MessageWithIpAddress {
    message: ContentItem!
    ipAddress: IpAddress!
  }

  type IpAddress {
    ip: String!
    port: Int
  }
`;

const Query: GQLQueryResolvers = {
  async ncmecReportById(_, { reportId }, context) {
    const user = context.getUser();
    if (!user) {
      throw new AuthenticationError('User required.');
    }
    const report = await context.services.NcmecService.getNcmecReportById({
      orgId: user.orgId,
      reportId,
    });
    if (!report) {
      return null;
    }
    const itemType = await context.services.ModerationConfigService.getItemType(
      {
        orgId: user.orgId,
        itemTypeSelector: { id: report.userItemTypeId },
      },
    );

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
  },
  async ncmecThreads(_, { userId, reportedMessages }, context) {
    const user = context.getUser();
    if (!user) {
      throw new AuthenticationError('User required.');
    }
    const threads = await context.services.NcmecService.getNcmecMessages(
      user.orgId,
      userId,
      reportedMessages,
    );
    return threads.map((thread) => ({
      threadId: thread.threadId,
      threadTypeId: thread.threadTypeId,
      messages: thread.messages.map((message) => ({
        message: formatItemSubmissionForGQL(message.message),
        ipAddress: message.ipAddress,
      })),
    }));
  },
  async ncmecOrgSettings(_, __, context) {
    const user = context.getUser();
    if (!user) {
      throw new AuthenticationError('User required.');
    }
    const settings = await context.services.NcmecService.getNcmecOrgSettings(
      user.orgId,
    );
    return settings;
  },
};

const Mutation: GQLMutationResolvers = {
  async updateNcmecOrgSettings(_, { input }, context) {
    const user = context.getUser();
    if (!user) {
      throw new AuthenticationError('User required.');
    }

    await context.services.NcmecService.updateNcmecOrgSettings({
      orgId: user.orgId,
      username: input.username,
      password: input.password,
      contactEmail: input.contactEmail ?? null,
      moreInfoUrl: input.moreInfoUrl ?? null,
      companyTemplate: input.companyTemplate ?? null,
      legalUrl: input.legalUrl ?? null,
      ncmecPreservationEndpoint: input.ncmecPreservationEndpoint ?? null,
      ncmecAdditionalInfoEndpoint: input.ncmecAdditionalInfoEndpoint ?? null,
    });

    return { success: true };
  },
};

const resolvers = {
  Query,
  Mutation,
};

export { resolvers, typeDefs };
