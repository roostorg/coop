/* eslint-disable max-lines */
import {
  ContainerTypes,
  ScalarTypes,
  type ContainerType,
  type Field,
  type FieldType,
  type ScalarType,
} from '@roostorg/types';
import { AuthenticationError } from 'apollo-server-core';

import {
  type ContentItemType as ContentItemTypeT,
  type ItemTypeSchemaVariant,
  type ItemTypeSelector,
  type ItemType as ItemTypeT,
  type ThreadItemType as ThreadItemTypeT,
  type UserItemType as UserItemTypeT,
} from '../../services/moderationConfigService/index.js';
import { filterNullOrUndefined } from '../../utils/collections.js';
import { isCoopErrorOfType } from '../../utils/errors.js';
import { assertUnreachable } from '../../utils/misc.js';
import { isNonEmptyArray } from '../../utils/typescript-types.js';
import {
  type GQLFieldInput,
  type GQLItemBaseResolvers,
  type GQLItemResolvers,
  type GQLItemTypeBaseResolvers,
  type GQLItemTypeResolvers,
  type GQLMutationResolvers,
  type GQLQueryResolvers,
  type GQLUserItemResolvers,
  type GQLUserItemTypeResolvers,
} from '../generated.js';
import { type Context } from '../resolvers.js';
import { formatItemSubmissionForGQL } from '../types.js';
import { gqlErrorResult, gqlSuccessResult } from '../utils/gqlResult.js';

export type ItemTypeResolversParentType = ItemTypeT | ItemTypeSelector;
export type ThreadItemTypeResolversParentType =
  | ThreadItemTypeT
  | ItemTypeSelector;
export type UserItemTypeResolversParentType = UserItemTypeT | ItemTypeSelector;
export type ContentItemTypeResolversParentType =
  | ContentItemTypeT
  | ItemTypeSelector;

const typeDefs = /* GraphQL */ `
  interface Field {
    name: String!
    type: FieldType!
    container: Container
  }

  type BaseField implements Field {
    name: String!
    required: Boolean!
    type: FieldType!
    container: Container
  }

  type DerivedField implements Field {
    name: String!
    type: FieldType!
    container: Container
    spec: DerivedFieldSpec!
  }

  type Container {
    containerType: ContainerType!
    keyScalarType: ScalarType
    valueScalarType: ScalarType!
  }

  input FieldInput {
    name: String!
    type: FieldType!
    required: Boolean!
    container: ContainerInput
  }

  input ContainerInput {
    containerType: ContainerType!
    keyScalarType: ScalarType
    valueScalarType: ScalarType!
  }

  # We're intentionally omitting action and rule resolvers here because we
  # expect to want the latest Actions/Rules and we're not updating the
  # ItemType's version when its associated Actions/Rules change. That's a sign
  # that the actions/rules really aren't part of the item type's data. The
  # ItemTypes returned from this interface in GraphQL really represent a
  # snapshot of an ItemType at a version, and we should query ItemType from
  # Actions and Rules instead.
  interface ItemTypeBase {
    id: ID!
    name: String!
    description: String
    baseFields: [BaseField!]!
    derivedFields: [DerivedField!]!
    # Version is a date/timestamp, and that fact is a part of the contract that the
    # server can't break, as we expect that clients might use it to order item type
    # versions. However, version is serialized as a string to avoid problems that
    # would arise from different systems/languages having different levels of precision
    # in their native timestamp representations.
    version: String!
    schemaVariant: ItemTypeSchemaVariant!
    # NB: Hidden fields do not appear in MRT, the investigation tool, and
    # elsewhere. They aren't stored in the item types table and are not
    # part of the core data model.
    hiddenFields: [String!]!
  }

  type UserItemType implements ItemTypeBase {
    id: ID!
    name: String!
    description: String
    baseFields: [BaseField!]!
    derivedFields: [DerivedField!]!
    schemaFieldRoles: UserSchemaFieldRoles!
    version: String!
    schemaVariant: ItemTypeSchemaVariant!
    isDefaultUserType: Boolean!
    hiddenFields: [String!]!
  }

  type ContentItemType implements ItemTypeBase {
    id: ID!
    name: String!
    description: String
    baseFields: [BaseField!]!
    derivedFields: [DerivedField!]!
    schemaFieldRoles: ContentSchemaFieldRoles!
    version: String!
    schemaVariant: ItemTypeSchemaVariant!
    hiddenFields: [String!]!
  }

  type ThreadItemType implements ItemTypeBase {
    id: ID!
    name: String!
    description: String
    baseFields: [BaseField!]!
    derivedFields: [DerivedField!]!
    schemaFieldRoles: ThreadSchemaFieldRoles!
    version: String!
    schemaVariant: ItemTypeSchemaVariant!
    hiddenFields: [String!]!
  }

  union ItemType = UserItemType | ContentItemType | ThreadItemType

  type ItemTypeIdentifier {
    id: String!
    version: NonEmptyString!
    schemaVariant: ItemTypeSchemaVariant!
  }

  input ItemTypeIdentifierInput {
    id: NonEmptyString!
    version: NonEmptyString!
    schemaVariant: ItemTypeSchemaVariantInput!
  }

  input ItemInput {
    itemId: NonEmptyString!
    itemType: ItemTypeIdentifierInput!
    data: JSONObject!
  }

  type ItemIdentifier {
    id: String!
    typeId: String!
  }

  # ItemBase, and the Item union below, actually represent what our backend
  # refers to as "ItemSubmissions". However, for back-compat/legacy reasons,
  # these are just called "Items" in our GQL types.
  interface ItemBase {
    id: ID!
    type: ItemTypeBase!
    data: JSONObject!
    submissionId: ID!
    submissionTime: DateTime
  }

  union Item = ContentItem | UserItem | ThreadItem

  type ContentItem implements ItemBase {
    id: ID!
    type: ContentItemType!
    data: JSONObject!
    submissionId: ID!
    submissionTime: DateTime
  }

  type UserItem implements ItemBase {
    id: ID!
    type: UserItemType!
    data: JSONObject!
    submissionId: ID!
    submissionTime: DateTime
    userScore: Int!
  }

  type ThreadItem implements ItemBase {
    id: ID!
    type: ThreadItemType!
    data: JSONObject!
    submissionId: ID!
    submissionTime: DateTime
  }

  type UserSchemaFieldRoles {
    displayName: String
    createdAt: String
    profileIcon: String
    backgroundImage: String
    isDeleted: String
  }

  type ThreadSchemaFieldRoles {
    displayName: String
    createdAt: String
    creatorId: String
    isDeleted: String
  }

  type ContentSchemaFieldRoles {
    displayName: String
    parentId: String
    threadId: String
    createdAt: String
    creatorId: String
    isDeleted: String
  }

  union SchemaFieldRoles =
      ContentSchemaFieldRoles
    | ThreadSchemaFieldRoles
    | UserSchemaFieldRoles

  type PartialItemsSuccessResponse {
    items: [Item!]!
  }

  type PartialItemsMissingEndpointError implements Error {
    title: String!
    status: Int!
    type: [String!]!
    pointer: String
    detail: String
    requestId: String
  }

  type PartialItemsEndpointResponseError implements Error {
    title: String!
    status: Int!
    type: [String!]!
    pointer: String
    detail: String
    requestId: String
  }

  type PartialItemsInvalidResponseError implements Error {
    title: String!
    status: Int!
    type: [String!]!
    pointer: String
    detail: String
    requestId: String
  }

  input UserSchemaFieldRolesInput {
    displayName: String
    createdAt: String
    profileIcon: String
    backgroundImage: String
    isDeleted: String
  }

  input ThreadSchemaFieldRolesInput {
    displayName: String
    createdAt: String
    creatorId: String
    isDeleted: String
  }

  input ContentSchemaFieldRolesInput {
    displayName: String
    parentId: String
    threadId: String
    createdAt: String
    creatorId: String
    isDeleted: String
  }

  input CreateUserItemTypeInput {
    name: String!
    description: String
    fields: [FieldInput!]!
    fieldRoles: UserSchemaFieldRolesInput!
    hiddenFields: [String!]
  }

  input UpdateUserItemTypeInput {
    id: ID!
    name: String
    description: String
    fields: [FieldInput!]
    fieldRoles: UserSchemaFieldRolesInput
    hiddenFields: [String!]
  }

  input CreateThreadItemTypeInput {
    name: String!
    description: String
    fields: [FieldInput!]!
    fieldRoles: ThreadSchemaFieldRolesInput!
    hiddenFields: [String!]
  }

  input UpdateThreadItemTypeInput {
    id: ID!
    name: String
    description: String
    fields: [FieldInput!]
    fieldRoles: ThreadSchemaFieldRolesInput
    hiddenFields: [String!]
  }

  input CreateContentItemTypeInput {
    name: String!
    description: String
    fields: [FieldInput!]!
    fieldRoles: ContentSchemaFieldRolesInput!
    hiddenFields: [String!]
  }

  input UpdateContentItemTypeInput {
    id: ID!
    name: String
    description: String
    fields: [FieldInput!]
    fieldRoles: ContentSchemaFieldRolesInput
    hiddenFields: [String!]
  }

  enum ItemTypeSchemaVariant {
    ORIGINAL
    PARTIAL
  }

  enum ItemTypeSchemaVariantInput {
    ORIGINAL
  }

  input ItemIdentifierInput {
    id: String!
    typeId: String!
  }

  type MutateContentTypeSuccessResponse {
    data: ContentItemType
  }

  type MutateUserTypeSuccessResponse {
    data: UserItemType
  }

  type MutateThreadTypeSuccessResponse {
    data: ThreadItemType
  }

  type ItemTypeNameAlreadyExistsError implements Error {
    title: String!
    status: Int!
    type: [String!]!
    pointer: String
    detail: String
    requestId: String
  }

  type CannotDeleteDefaultUserError implements Error {
    title: String!
    status: Int!
    type: [String!]!
    pointer: String
    detail: String
    requestId: String
  }

  type DeleteItemTypeSuccessResponse {
    _: Boolean
  }

  # Changed to not clash with existing response
  union MutateContentItemTypeResponse =
      MutateContentTypeSuccessResponse
    | ItemTypeNameAlreadyExistsError
  union MutateUserItemTypeResponse =
      MutateUserTypeSuccessResponse
    | ItemTypeNameAlreadyExistsError
  union MutateThreadItemTypeResponse =
      MutateThreadTypeSuccessResponse
    | ItemTypeNameAlreadyExistsError
  union PartialItemsResponse =
      PartialItemsSuccessResponse
    | PartialItemsMissingEndpointError
    | PartialItemsEndpointResponseError
    | PartialItemsInvalidResponseError
  union DeleteItemTypeResponse =
      DeleteItemTypeSuccessResponse
    | CannotDeleteDefaultUserError

  type Query {
    itemType(id: ID!, version: String): ItemType
    itemTypes(identifiers: [ItemTypeIdentifierInput!]!): [ItemType!]!
    partialItems(input: [ItemIdentifierInput!]!): PartialItemsResponse!
  }

  type Mutation {
    createContentItemType(
      input: CreateContentItemTypeInput!
    ): MutateContentItemTypeResponse!
    updateContentItemType(
      input: UpdateContentItemTypeInput!
    ): MutateContentItemTypeResponse!
    createThreadItemType(
      input: CreateThreadItemTypeInput!
    ): MutateThreadItemTypeResponse!
    updateThreadItemType(
      input: UpdateThreadItemTypeInput!
    ): MutateThreadItemTypeResponse!
    createUserItemType(
      input: CreateUserItemTypeInput!
    ): MutateUserItemTypeResponse!
    updateUserItemType(
      input: UpdateUserItemTypeInput!
    ): MutateUserItemTypeResponse!
    deleteItemType(id: ID!): DeleteItemTypeResponse!
  }
`;

const Item: GQLItemResolvers = {
  __resolveType(it) {
    switch (it.type.kind) {
      case 'CONTENT': {
        return 'ContentItem';
      }
      case 'USER': {
        return 'UserItem';
      }
      case 'THREAD': {
        return 'ThreadItem';
      }
      default:
        assertUnreachable(it.type);
    }
  },
};

const ItemType: GQLItemTypeResolvers = {
  async __resolveType(it, context) {
    const itemType = await getItemTypeFromItemTypeOrSelector(it, context);
    switch (itemType.kind) {
      case 'CONTENT': {
        return 'ContentItemType';
      }
      case 'USER': {
        return 'UserItemType';
      }
      case 'THREAD': {
        return 'ThreadItemType';
      }
      default:
        assertUnreachable(itemType);
    }
  },
};

const ItemBase: GQLItemBaseResolvers = {
  __resolveType(it) {
    switch (it.type.kind) {
      case 'CONTENT':
        return 'ContentItem';
      case 'USER':
        return 'UserItem';
      case 'THREAD':
        return 'ThreadItem';
      default:
        assertUnreachable(it.type);
    }
  },
};

// This actually is a resolver, which maps every ItemTypeSchemaVariant -- which
// are lowercase internally for legacy reasons -- to uppercase when receiving or
// serializing the ItemTypeSchemaVariant GQL enum. Apollo accepts resolvers like
// this for enums, to automatically transform the enum values as they
// enter/leave parent resolvers.
const ItemTypeSchemaVariantResolver = {
  ORIGINAL: 'original',
  PARTIAL: 'partial',
} as const satisfies { [K in ItemTypeSchemaVariant as Uppercase<K>]: K };

// The internal type that values of the GQL ItemTypeSchemaVariant enum have when
// they're inside/returned from a resolver. NB: This is different from how
// ItemTypeSchemaVariant values ultimately reach the client, which is CONSTANT_CASE.
export type ItemTypeSchemaVariantResolverValue =
  (typeof ItemTypeSchemaVariantResolver)[keyof typeof ItemTypeSchemaVariantResolver];

// This actually is a resolver, which maps every ItemTypeSchemaVariantInput -- which
// are lowercase internally for legacy reasons -- to uppercase when receiving or
// serializing the ItemTypeSchemaVariantInput GQL enum. Apollo accepts resolvers like
// this for enums, to automatically transform the enum values as they
// enter/leave parent resolvers.
const ItemTypeSchemaVariantInputResolver = {
  ORIGINAL: 'original',
} as const satisfies {
  [K in ItemTypeSchemaVariant & 'original' as Uppercase<K>]: K;
};

// The internal type that values of the GQL ItemTypeSchemaVariantInput enum have when
// they're inside/returned from a resolver. NB: This is different from how
// ItemTypeSchemaVariantInput values ultimately reach the client, which is CONSTANT_CASE.
export type ItemTypeSchemaVariantInputResolverValue =
  (typeof ItemTypeSchemaVariantInputResolver)[keyof typeof ItemTypeSchemaVariantInputResolver];

const UserItem: GQLUserItemResolvers = {
  async userScore(userItem, __, context) {
    const user = context.getUser();
    if (!user) {
      throw new AuthenticationError('User required.');
    }

    const { id, type } = userItem;
    return context.services.UserStatisticsService.getUserScore(user.orgId, {
      id,
      typeId: type.id,
    });
  },
};

const ItemTypeBase: GQLItemTypeBaseResolvers = {
  async __resolveType(it, context) {
    const itemType = await getItemTypeFromItemTypeOrSelector(it, context);
    switch (itemType.kind) {
      case 'CONTENT': {
        return 'ContentItemType';
      }
      case 'USER': {
        return 'UserItemType';
      }
      case 'THREAD': {
        return 'ThreadItemType';
      }
      default:
        assertUnreachable(itemType);
    }
  },
  async baseFields(it, _, context) {
    const user = context.getUser();
    if (!user) {
      throw new AuthenticationError('User required.');
    }
    const itemType = await getItemTypeFromItemTypeOrSelector(it, context);
    return itemType.schema;
  },
  async derivedFields(itemTypeOrSelector, _, context) {
    const user = context.getUser();
    if (!user) {
      throw new AuthenticationError('User required.');
    }
    const itemType = await getItemTypeFromItemTypeOrSelector(
      itemTypeOrSelector,
      context,
    );
    return context.services.DerivedFieldsService.getDerivedFields(
      itemType.id,
      itemType.schema,
      itemType.orgId,
    );
  },
  async name(itemTypeOrSelector, _, context) {
    const user = context.getUser();
    if (!user) {
      throw new AuthenticationError('User required.');
    }
    const itemType = await getItemTypeFromItemTypeOrSelector(
      itemTypeOrSelector,
      context,
    );
    return itemType.name;
  },
  async description(itemTypeOrSelector, _, context) {
    const user = context.getUser();
    if (!user) {
      throw new AuthenticationError('User required.');
    }
    const itemType = await getItemTypeFromItemTypeOrSelector(
      itemTypeOrSelector,
      context,
    );
    return itemType.description;
  },
  async version(itemTypeOrSelector, _, context) {
    const user = context.getUser();
    if (!user) {
      throw new AuthenticationError('User required.');
    }
    const itemType = await getItemTypeFromItemTypeOrSelector(
      itemTypeOrSelector,
      context,
    );
    return itemType.version;
  },
  async schemaVariant(itemTypeOrSelector, _, context) {
    const user = context.getUser();
    if (!user) {
      throw new AuthenticationError('User required.');
    }
    const itemType = await getItemTypeFromItemTypeOrSelector(
      itemTypeOrSelector,
      context,
    );
    return itemType.schemaVariant;
  },
  async hiddenFields(itemTypeOrSelector, _, context) {
    const user = context.getUser();
    if (!user) {
      throw new AuthenticationError('User required.');
    }

    return context.services.ManualReviewToolService.getHiddenFieldsForItemType({
      orgId: user.orgId,
      itemTypeId: itemTypeOrSelector.id,
    });
  },
};

const ContentItemType = {
  ...ItemTypeBase,
};

const UserItemType: GQLUserItemTypeResolvers = {
  ...ItemTypeBase,
  async isDefaultUserType(itemTypeOrSelector, _, context) {
    const user = context.getUser();
    if (!user) {
      throw new AuthenticationError('User required.');
    }
    const itemType = await getItemTypeFromItemTypeOrSelector(
      itemTypeOrSelector,
      context,
    );

    return itemType.kind === 'USER' && itemType.isDefaultUserType;
  },
};

const ThreadItemType = {
  ...ItemTypeBase,
};

const Query: GQLQueryResolvers = {
  async itemType(_, { id, version }, context) {
    const user = context.getUser();
    if (!user) {
      throw new AuthenticationError('User required.');
    }

    return (
      (await context.services.ModerationConfigService.getItemType({
        orgId: user.orgId,
        itemTypeSelector: {
          id,
          version: version ?? undefined,
        },
      })) ?? null
    );
  },
  async itemTypes(_, { identifiers }, context) {
    const user = context.getUser();
    if (!user) {
      throw new AuthenticationError('User required.');
    }

    return filterNullOrUndefined(
      await Promise.all(
        identifiers.map(async ({ id, version }) => {
          return context.services.ModerationConfigService.getItemType({
            orgId: user.orgId,
            itemTypeSelector: {
              id,
              version,
              schemaVariant: 'original',
            },
          });
        }),
      ),
    );
  },
  async partialItems(_, { input }, context) {
    try {
      const user = context.getUser();
      if (!user) {
        throw new AuthenticationError('User required.');
      }

      const partialItemSubmissions =
        await context.services.PartialItemsService.getPartialItems(
          user.orgId,
          input,
        );

      return gqlSuccessResult(
        { items: partialItemSubmissions.map(formatItemSubmissionForGQL) },
        'PartialItemsSuccessResponse',
      );
    } catch (e: unknown) {
      if (
        isCoopErrorOfType(e, [
          'PartialItemsMissingEndpointError',
          'PartialItemsEndpointResponseError',
          'PartialItemsInvalidResponseError',
        ])
      ) {
        return gqlErrorResult(e);
      }

      throw e;
    }
  },
};

const Mutation: GQLMutationResolvers = {
  async createContentItemType(__, params, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('User required.');
    }

    const { fields, hiddenFields, fieldRoles } = params.input;
    const { orgId } = user;
    if (!fields.every(isValidField)) {
      throw new Error('Invalid field shape for item type');
    }

    if (!isNonEmptyArray(fields)) {
      throw new Error('Empty fields for item type');
    }

    const contentItemType =
      await context.services.ModerationConfigService.createContentType(orgId, {
        ...params.input,
        schemaFieldRoles: fieldRoles,
        schema: fields,
      });

    if (hiddenFields && hiddenFields.length > 0) {
      await context.services.ManualReviewToolService.setHiddenFieldsForItemType(
        {
          orgId,
          itemTypeId: contentItemType.id,
          hiddenFields,
        },
      );
    }

    return gqlSuccessResult(
      contentItemType,
      'MutateContentTypeSuccessResponse',
    );
  },
  async updateContentItemType(_, params, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('User required.');
    }

    const { id, name, description, fields, hiddenFields, fieldRoles } =
      params.input;
    const { orgId } = user;
    if (fields !== undefined) {
      if (fields == null || !fields.every(isValidField)) {
        throw new Error('Invalid field shape for item type');
      }

      if (!isNonEmptyArray(fields)) {
        throw new Error('Empty fields for item type');
      }
    }

    const contentItemType =
      await context.services.ModerationConfigService.updateContentType(
        user.orgId,
        {
          id,
          description,
          name: name ?? undefined,
          schemaFieldRoles: fieldRoles ?? {},
          schema: fields,
        },
      );

    if (hiddenFields && hiddenFields.length > 0) {
      await context.services.ManualReviewToolService.setHiddenFieldsForItemType(
        {
          orgId,
          itemTypeId: contentItemType.id,
          hiddenFields,
        },
      );
    }

    return gqlSuccessResult(
      contentItemType,
      'MutateContentTypeSuccessResponse',
    );
  },
  async createThreadItemType(__, params, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('User required.');
    }

    const { fields, hiddenFields, fieldRoles } = params.input;
    const { orgId } = user;

    if (!fields.every(isValidField)) {
      throw new Error('Invalid field shape for item type');
    }

    if (!isNonEmptyArray(fields)) {
      throw new Error('Empty fields for item type');
    }

    const threadItemType =
      await context.services.ModerationConfigService.createThreadType(orgId, {
        ...params.input,
        schemaFieldRoles: fieldRoles,
        schema: fields,
      });

    if (hiddenFields && hiddenFields.length > 0) {
      await context.services.ManualReviewToolService.setHiddenFieldsForItemType(
        {
          orgId,
          itemTypeId: threadItemType.id,
          hiddenFields,
        },
      );
    }

    return gqlSuccessResult(threadItemType, 'MutateThreadTypeSuccessResponse');
  },
  async updateThreadItemType(_, params, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('User required.');
    }

    const { id, name, description, fields, hiddenFields, fieldRoles } =
      params.input;
    const { orgId } = user;

    if (fields !== undefined) {
      if (fields == null || !fields.every(isValidField)) {
        throw new Error('Invalid field shape for item type');
      }

      if (!isNonEmptyArray(fields)) {
        throw new Error('Empty fields for item type');
      }
    }

    const threadItemType =
      await context.services.ModerationConfigService.updateThreadType(
        user.orgId,
        {
          id,
          description,
          name: name ?? undefined,
          schemaFieldRoles: fieldRoles ?? {},
          schema: fields,
        },
      );

    if (hiddenFields && hiddenFields.length > 0) {
      await context.services.ManualReviewToolService.setHiddenFieldsForItemType(
        {
          orgId,
          itemTypeId: threadItemType.id,
          hiddenFields,
        },
      );
    }

    return gqlSuccessResult(threadItemType, 'MutateThreadTypeSuccessResponse');
  },
  async createUserItemType(__, params, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('User required.');
    }

    const { fields, hiddenFields, fieldRoles } = params.input;
    const { orgId } = user;

    if (!fields.every(isValidField)) {
      throw new Error('Invalid field shape for item type');
    }

    if (!isNonEmptyArray(fields)) {
      throw new Error('Empty fields for item type');
    }

    const userItemType =
      await context.services.ModerationConfigService.createUserType(
        user.orgId,
        {
          ...params.input,
          schemaFieldRoles: fieldRoles,
          schema: fields,
        },
      );

    if (hiddenFields && hiddenFields.length > 0) {
      await context.services.ManualReviewToolService.setHiddenFieldsForItemType(
        {
          orgId,
          itemTypeId: userItemType.id,
          hiddenFields,
        },
      );
    }

    return gqlSuccessResult(userItemType, 'MutateUserTypeSuccessResponse');
  },
  async updateUserItemType(_, params, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('User required.');
    }

    const { id, name, description, fields, hiddenFields, fieldRoles } =
      params.input;
    const { orgId } = user;
    if (fields !== undefined) {
      if (fields == null || !fields.every(isValidField)) {
        throw new Error('Invalid field shape for item type');
      }

      if (!isNonEmptyArray(fields)) {
        throw new Error('Empty fields for item type');
      }
    }
    const contentItemType =
      await context.services.ModerationConfigService.updateUserType(
        user.orgId,
        {
          id,
          description,
          name: name ?? undefined,
          schemaFieldRoles: fieldRoles ?? {},
          schema: fields,
        },
      );

    if (hiddenFields && hiddenFields.length > 0) {
      await context.services.ManualReviewToolService.setHiddenFieldsForItemType(
        {
          orgId,
          itemTypeId: contentItemType.id,
          hiddenFields,
        },
      );
    }

    return gqlSuccessResult(contentItemType, 'MutateUserTypeSuccessResponse');
  },
  async deleteItemType(_, params, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('User required.');
    }

    const { id } = params;
    const { orgId } = user;

    try {
      await Promise.all([
        context.services.ModerationConfigService.deleteItemType({
          orgId: user.orgId,
          itemTypeId: params.id,
        }),
        context.services.ManualReviewToolService.setHiddenFieldsForItemType({
          orgId,
          itemTypeId: id,
          hiddenFields: [],
        }),
      ]);

      return gqlSuccessResult({ _: true }, 'DeleteItemTypeSuccessResponse');
    } catch (e: unknown) {
      if (isCoopErrorOfType(e, 'CannotDeleteDefaultUserError')) {
        return gqlErrorResult(e);
      }
      throw e;
    }
  },
};

export const getItemTypeFromItemTypeOrSelector = async (
  itemTypeOrSelector: ItemTypeResolversParentType,
  context: Context,
) => {
  const user = context.getUser();
  if (user == null) {
    throw new AuthenticationError('User required.');
  }
  if ('name' in itemTypeOrSelector) {
    return itemTypeOrSelector;
  }
  const itemType = await context.services.getItemTypeEventuallyConsistent({
    orgId: user.orgId,
    typeSelector: itemTypeOrSelector,
  });
  if (itemType === undefined) {
    throw new Error(`No Item Type found for id: ${itemTypeOrSelector.id}`);
  }
  return itemType;
};

const scalarTypes = Object.keys(ScalarTypes);
const containerTypes = Object.keys(ContainerTypes);

function isValidField(it: GQLFieldInput): it is Field {
  // This satisfies check leverages TS to verify that every GQLFieldType value
  // is also a legal FieldType value. If we rename (or deprecate + remove) a
  // FieldType, we'll get a type error if we're still allowing the old value in
  // via GQL; ditto if we add a new value to the GQL enum that the backend isn't
  // updated to expect.
  const type = it.type satisfies FieldType;

  const isValidScalarType = scalarTypes.includes(type) && it.container == null;

  if (isValidScalarType) {
    return true;
  }

  // similar idea to the `satisfies` checks above.
  const containerType = it.container?.containerType satisfies
    | ContainerType
    | null
    | undefined;
  const keyScalarType = it.container?.keyScalarType satisfies
    | ScalarType
    | null
    | undefined;

  const isValidContainerType =
    containerTypes.includes(type) &&
    // For legacy reasons, the container object has it's own containerType key,
    // which must match the field's type.
    containerType === type &&
    // GQL type allows keyScalarType to be null | undefined | GQLScalarType,
    // but the TS type never allows undefined and forbids null when the
    // container is a Map, while requiring null when the container is an array.
    (containerType === ContainerTypes.MAP
      ? keyScalarType !== null
      : // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      containerType === ContainerTypes.ARRAY
      ? keyScalarType === null
      : assertUnreachable(containerType));

  return isValidContainerType;
}

const resolvers = {
  Query,
  ItemType,
  ItemTypeBase,
  ItemBase,
  Item,
  UserItem,
  Mutation,
  ContentItemType,
  ThreadItemType,
  UserItemType,
  ItemTypeSchemaVariant: ItemTypeSchemaVariantResolver,
  ItemTypeSchemaVariantInput: ItemTypeSchemaVariantInputResolver,
};

export { resolvers, typeDefs };
