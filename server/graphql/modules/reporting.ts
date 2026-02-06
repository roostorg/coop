import {
  type GQLQueryResolvers,
  type GQLReportingInsightsResolvers,
} from '../generated.js';

const typeDefs = /* GraphQL */ `
  type ReportingInsights {
    totalIngestedReportsByDay: [CountByDay!]!
  }

  type Query {
    reportingInsights: ReportingInsights!
  }
`;

/**
 * This is the type that's returned by GQL resolvers for queries that return a
 * `ReportingInsights` object (which, right now and for the forseeable
 * future, is only `reportingInsights` root-level query). It's just a dummy/
 * placeholder object, as it'll become the parent object for the individual
 * field resolvers, and we don't actually need any info on it for the field
 * resolvers to work.
 */
export type ReportingInsights = object;

const ReportingInsights: GQLReportingInsightsResolvers = {
  async totalIngestedReportsByDay(_, __, context) {
    const user = context.getUser();
    if (user == null) {
      return [];
    }

    return context.services.ReportingService.getTotalIngestedReportsByDay(
      user.orgId,
    );
  },
};

const Query: GQLQueryResolvers = {
  // See comment for ReportingInsights type.
  reportingInsights(_, __, ___) {
    return {};
  },
};

const resolvers = {
  Query,
  ReportingInsights,
};

export { resolvers, typeDefs };
