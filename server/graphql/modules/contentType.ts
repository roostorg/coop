import { type GQLContentTypeResolvers } from '../generated.js';
import { unauthenticatedError } from '../utils/errors.js';

const typeDefs = /* GraphQL */ `
  type ContentType {
    id: ID!
    name: String!
    description: String
    actions: [Action!]!
    baseFields: [BaseField!]!
    derivedFields: [DerivedField!]!
  }
`;

const ContentType: GQLContentTypeResolvers = {
  async actions(contentType, _, context) {
    const user = context.getUser();
    if (user == null || user.orgId !== contentType.orgId) {
      throw unauthenticatedError('User required.');
    }
    return context.services.ModerationConfigService.getActionsForItemType({
      orgId: contentType.orgId,
      itemTypeId: contentType.id,
      itemTypeKind: contentType.kind,
    });
  },
  baseFields(contentType) {
    return contentType.fields;
  },
  async derivedFields(contentType, _, context) {
    return context.services.DerivedFieldsService.getDerivedFields(
      contentType.id,
      contentType.fields,
      contentType.orgId,
    );
  },
};

const resolvers = {
  ContentType,
};

export { typeDefs, resolvers };
