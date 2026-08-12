import { formatItemSubmissionForGQL } from '../../graphql/types.js';
import { UserPermission } from '../../services/userManagementService/index.js';
import type {
  GQLMutationResolvers,
  GQLNcmecOrgSettings,
  GQLQueryResolvers,
} from '../generated.js';
import {
  forbiddenError,
  unauthenticatedError,
  userInputError,
} from '../utils/errors.js';
import {
  isValidContactEmail,
  parseInternetDetailType,
  parseMediaReviewPolicy,
  type NcmecOrgSettingsInputShape,
} from './ncmecOrgSettingsValidation.js';

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
    """
    Retries a previously-failed NCMEC submission. Org-scoped: callers can only
    retry decisions that belong to their own org. Returns success on a fresh
    successful submission, or an error with a user-safe summary on failure.
    """
    retryNcmecSubmission(decisionId: ID!): RetryNcmecSubmissionResponse!
  }

  enum NcmecInternetDetailType {
    WEB_PAGE
    EMAIL
    NEWSGROUP
    CHAT_IM
    ONLINE_GAMING
    CELL_PHONE
    NON_INTERNET
    PEER_TO_PEER
  }

  """
  How much media a reviewer must classify before an NCMEC report can be sent.
  ALL requires every piece of media on the account to be reviewed (the original
  behaviour); MINIMUM only requires \`minMediaToReview\` items, so reviewers
  don't have to classify hundreds of items to submit a report.
  """
  enum NcmecMediaReviewRequirement {
    ALL
    MINIMUM
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
    defaultNcmecQueueId: String
    defaultInternetDetailType: NcmecInternetDetailType
    termsOfService: String
    contactPersonEmail: String
    contactPersonFirstName: String
    contactPersonLastName: String
    contactPersonPhone: String
    mediaReviewRequirement: NcmecMediaReviewRequirement
    minMediaToReview: Int
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
    defaultNcmecQueueId: String
    defaultInternetDetailType: NcmecInternetDetailType
    termsOfService: String
    contactPersonEmail: String
    contactPersonFirstName: String
    contactPersonLastName: String
    contactPersonPhone: String
    mediaReviewRequirement: NcmecMediaReviewRequirement
    minMediaToReview: Int
  }

  type UpdateNcmecOrgSettingsResponse {
    success: Boolean!
  }

  type RetryNcmecSubmissionResponse {
    success: Boolean!
    """
    Human-readable error summary if the retry failed. Never includes raw
    NCMEC response bodies; safe to render in the UI.
    """
    error: String
  }

  enum NcmecFailedSubmissionStatus {
    RETRYABLE_ERROR
    PERMANENT_ERROR
    NEVER_ATTEMPTED
  }

  """
  An NCMEC submission that was decisioned in the MRT but never produced a
  successful CyberTip report. Reused on the NCMEC Reports dashboard so that
  reviewers can see and retry failed submissions in the same place as
  successful reports. The userId + userItemTypeId pair uniquely identifies
  the reported user; decisionId is the stable handle for retrying.
  """
  type NcmecFailedSubmission {
    decisionId: ID!
    ts: DateTime!
    reviewerId: String
    userId: String!
    userItemType: UserItemType!
    status: NcmecFailedSubmissionStatus!
    retryCount: Int!
    lastError: String
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
      throw unauthenticatedError('User required.');
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
      throw unauthenticatedError('User required.');
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
  async ncmecOrgSettings(_, __, context): Promise<GQLNcmecOrgSettings | null> {
    const user = context.getUser();
    if (!user) {
      throw unauthenticatedError('User required.');
    }
    if (!user.getPermissions().includes(UserPermission.MANAGE_ORG)) {
      throw forbiddenError(
        'User does not have permission to view NCMEC settings',
      );
    }
    const settings = await context.services.NcmecService.getNcmecOrgSettings(
      user.orgId,
    );
    return settings as GQLNcmecOrgSettings | null;
  },
};

const Mutation: GQLMutationResolvers = {
  async updateNcmecOrgSettings(_, { input: rawInput }, context) {
    const user = context.getUser();
    if (!user) {
      throw unauthenticatedError('User required.');
    }
    if (!user.getPermissions().includes(UserPermission.MANAGE_ORG)) {
      throw forbiddenError(
        'User does not have permission to update NCMEC settings',
      );
    }
    const input = rawInput as NcmecOrgSettingsInputShape;

    const username = input.username?.trim() ?? '';
    const password = input.password ?? '';
    if (username === '' || password === '') {
      throw userInputError('Username and password are required.');
    }
    const contactEmail = input.contactEmail?.trim() ?? '';
    if (contactEmail === '') {
      throw userInputError(
        'Reporter contact email is required for NCMEC reporting.',
      );
    }
    if (!isValidContactEmail(contactEmail)) {
      throw userInputError(
        'Reporter contact email is not a valid email address.',
      );
    }

    const defaultInternetDetailType = parseInternetDetailType(input);

    const { mediaReviewRequirement, minMediaToReview } =
      parseMediaReviewPolicy(input);

    await context.services.NcmecService.updateNcmecOrgSettings({
      orgId: user.orgId,
      username,
      password,
      contactEmail,
      moreInfoUrl: input.moreInfoUrl ?? null,
      companyTemplate: input.companyTemplate ?? null,
      legalUrl: input.legalUrl ?? null,
      ncmecPreservationEndpoint: input.ncmecPreservationEndpoint ?? null,
      ncmecAdditionalInfoEndpoint: input.ncmecAdditionalInfoEndpoint ?? null,
      defaultNcmecQueueId: input.defaultNcmecQueueId ?? null,
      defaultInternetDetailType,
      termsOfService: input.termsOfService ?? null,
      contactPersonEmail: input.contactPersonEmail ?? null,
      contactPersonFirstName: input.contactPersonFirstName ?? null,
      contactPersonLastName: input.contactPersonLastName ?? null,
      contactPersonPhone: input.contactPersonPhone ?? null,
      mediaReviewRequirement,
      minMediaToReview,
    });

    return { success: true };
  },
  async retryNcmecSubmission(_, { decisionId }, context) {
    const user = context.getUser();
    if (!user) {
      throw unauthenticatedError('User required.');
    }
    if (
      !user.getPermissions().includes(UserPermission.VIEW_CHILD_SAFETY_DATA)
    ) {
      throw forbiddenError(
        'VIEW_CHILD_SAFETY_DATA permission required to retry NCMEC submissions.',
      );
    }
    const result = await context.services.NcmecService.retrySubmission({
      orgId: user.orgId,
      decisionId,
      requestingReviewerId: user.id,
    });
    if (result.kind === 'success') {
      return { success: true, error: null };
    }
    if (result.kind === 'not_found') {
      // Don't disclose whether the decision exists in another org. Surface
      // the same response as a missing decision.
      return { success: false, error: 'Decision not found.' };
    }
    return { success: false, error: result.error };
  },
};

const resolvers = {
  Query,
  Mutation,
};

export { resolvers, typeDefs };
