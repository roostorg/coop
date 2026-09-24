import { ScalarTypes } from '@roostorg/coop-types';
import { type GraphQLResolveInfo } from 'graphql';

import {
  makeInvalidItemTypeHiddenFieldsError,
  makeInvalidItemTypeSchemaError,
  makeItemTypeNameAlreadyExistsError,
  makeItemTypeSchemaIncompatibleError,
} from '../../services/moderationConfigService/index.js';
import { makeNotFoundError } from '../../utils/errors.js';
import { type Context } from '../resolvers.js';
import { resolvers } from './itemType.js';

const orgId = 'org-id';
const itemTypeId = 'item-type-id';
const hiddenFields = ['email'];
const itemType = { id: itemTypeId };
const trx = { transaction: true };
const fields = [
  { name: 'headline', type: ScalarTypes.STRING, required: true },
  { name: 'publishedAt', type: ScalarTypes.DATETIME, required: false },
];
const errorData = { detail: 'Invalid item type', shouldErrorSpan: false };
const domainErrors = [
  [makeItemTypeSchemaIncompatibleError(errorData), '/input/fields'],
  [makeInvalidItemTypeSchemaError(errorData), '/input/fields'],
  [makeInvalidItemTypeHiddenFieldsError(errorData), '/input/hiddenFields'],
  [makeItemTypeNameAlreadyExistsError(errorData), '/input/name'],
  [makeNotFoundError('Item type not found', errorData), '/input/id'],
] as const;

type ResolverFn = (
  source: unknown,
  args: { input: object },
  context: Context,
  info: GraphQLResolveInfo,
) => unknown;

const makeContext = () => {
  const transactionConfig = {
    createContentType: jest.fn().mockResolvedValue(itemType),
    createThreadType: jest.fn().mockResolvedValue(itemType),
    createUserType: jest.fn().mockResolvedValue(itemType),
    updateContentType: jest.fn().mockResolvedValue(itemType),
    updateThreadType: jest.fn().mockResolvedValue(itemType),
    updateUserType: jest.fn().mockResolvedValue(itemType),
  };
  const transactionReview = {
    setHiddenFieldsForItemType: jest.fn().mockResolvedValue(undefined),
  };
  const ModerationConfigService = {
    forTransaction: jest.fn().mockReturnValue(transactionConfig),
    invalidateLatestItemTypesCache: jest.fn().mockResolvedValue(undefined),
  };
  const ManualReviewToolService = {
    forTransaction: jest.fn().mockReturnValue(transactionReview),
  };
  return {
    context: {
      getUser: () => ({ orgId }),
      services: {
        transaction: (run: (transaction: object) => unknown) => run(trx),
        ModerationConfigService,
        ManualReviewToolService,
      },
    } as unknown as Context,
    ModerationConfigService,
    ManualReviewToolService: transactionReview,
    transactionConfig,
  };
};

const variants = [
  [
    'createContentItemType',
    'createContentType',
    'updateContentItemType',
    'updateContentType',
    { displayName: 'headline', threadId: 'discussionId' },
  ],
  [
    'createThreadItemType',
    'createThreadType',
    'updateThreadItemType',
    'updateThreadType',
    { createdAt: 'publishedAt', creatorId: 'threadAuthorId' },
  ],
  [
    'createUserItemType',
    'createUserType',
    'updateUserItemType',
    'updateUserType',
    { email: 'contactAddress', profileIcon: 'avatarUrl' },
  ],
] as const;

const callMutation = async (
  name: (typeof variants)[number][0 | 2],
  input: object,
  context: Context,
) => {
  const resolver = resolvers.Mutation[name];
  if (typeof resolver !== 'function')
    throw new Error(`Missing resolver ${name}`);
  return (resolver as unknown as ResolverFn)(
    {},
    { input },
    context,
    {} as GraphQLResolveInfo,
  );
};

describe.each(variants)(
  '%s / %s / %s / %s',
  (
    createResolver,
    createService,
    updateResolver,
    updateService,
    fieldRoles,
  ) => {
    it.each([
      { fields: hiddenFields, expected: ['email'] },
      { fields: undefined, expected: [] },
    ])(
      'creates with hidden fields $fields and invalidates the cache',
      async ({ fields: suppliedHiddenFields, expected }) => {
        const {
          context,
          ModerationConfigService,
          ManualReviewToolService,
          transactionConfig,
        } = makeContext();
        await callMutation(
          createResolver,
          {
            name: 'type name',
            description: 'A deliberately detailed type',
            fields,
            fieldRoles,
            hiddenFields: suppliedHiddenFields,
          },
          context,
        );
        expect(ModerationConfigService.forTransaction).toHaveBeenCalledWith(
          trx,
        );
        expect(transactionConfig[createService]).toHaveBeenCalledWith(orgId, {
          name: 'type name',
          description: 'A deliberately detailed type',
          fields,
          fieldRoles,
          hiddenFields: suppliedHiddenFields,
          schema: fields,
          schemaFieldRoles: fieldRoles,
        });
        expect(
          ManualReviewToolService.setHiddenFieldsForItemType,
        ).toHaveBeenCalledWith({ orgId, itemTypeId, hiddenFields: expected });
        expect(
          ModerationConfigService.invalidateLatestItemTypesCache,
        ).toHaveBeenCalledWith(orgId);
      },
    );

    it('maps all supplied update values and hidden fields', async () => {
      const { context, ManualReviewToolService, transactionConfig } =
        makeContext();
      await callMutation(
        updateResolver,
        {
          id: itemTypeId,
          name: 'renamed type',
          description: 'Updated description',
          fields,
          fieldRoles,
          hiddenFields,
        },
        context,
      );

      expect(transactionConfig[updateService]).toHaveBeenCalledWith(orgId, {
        id: itemTypeId,
        name: 'renamed type',
        description: 'Updated description',
        schema: fields,
        schemaFieldRoles: fieldRoles,
      });
      expect(
        ManualReviewToolService.setHiddenFieldsForItemType,
      ).toHaveBeenCalledWith({ orgId, itemTypeId, hiddenFields });
    });

    it('preserves omitted hidden fields and clears an explicit empty list', async () => {
      const first = makeContext();
      await callMutation(updateResolver, { id: itemTypeId }, first.context);
      expect(first.transactionConfig[updateService]).toHaveBeenCalledWith(
        orgId,
        {
          id: itemTypeId,
          name: undefined,
          description: undefined,
          schema: undefined,
          schemaFieldRoles: {},
        },
      );
      expect(
        first.ManualReviewToolService.setHiddenFieldsForItemType,
      ).not.toHaveBeenCalled();

      const second = makeContext();
      await callMutation(
        updateResolver,
        { id: itemTypeId, hiddenFields: [] },
        second.context,
      );
      expect(second.transactionConfig[updateService]).toHaveBeenCalledWith(
        orgId,
        {
          id: itemTypeId,
          name: undefined,
          description: undefined,
          schema: undefined,
          schemaFieldRoles: {},
        },
      );
      expect(
        second.ManualReviewToolService.setHiddenFieldsForItemType,
      ).toHaveBeenCalledWith({ orgId, itemTypeId, hiddenFields: [] });
    });

    it.each(domainErrors)(
      'maps %s from create and update mutations to %s',
      async (error, pointer) => {
        for (const [resolver, service, input] of [
          [createResolver, createService, { name: 'type name', fields }],
          [updateResolver, updateService, { id: itemTypeId }],
        ] as const) {
          const { context, transactionConfig } = makeContext();
          transactionConfig[service].mockRejectedValueOnce(error);

          await expect(callMutation(resolver, input, context)).resolves.toEqual(
            expect.objectContaining({
              __typename: error.name,
              pointer,
              detail: error.detail,
            }),
          );
        }
      },
    );
  },
);
