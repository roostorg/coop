import { type GQLContentTypeResolvers } from '../generated.js';

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
  async actions(contentType) {
    return contentType.getActions();
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
