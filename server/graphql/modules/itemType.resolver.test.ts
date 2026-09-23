import { ScalarTypes } from '@roostorg/coop-types';
import { type GraphQLResolveInfo } from 'graphql';

import { type Context } from '../resolvers.js';
import { resolvers } from './itemType.js';

const orgId = 'org-id';
const itemTypeId = 'item-type-id';
const hiddenFields = ['email'];
const itemType = { id: itemTypeId };
const trx = { transaction: true };

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
  const KyselyPg = {
    transaction: () => ({
      execute: (run: (transaction: object) => unknown) => run(trx),
    }),
  };
  return {
    context: {
      getUser: () => ({ orgId }),
      services: {
        KyselyPg,
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
  ['createContentItemType', 'createContentType', 'updateContentItemType'],
  ['createThreadItemType', 'createThreadType', 'updateThreadItemType'],
  ['createUserItemType', 'createUserType', 'updateUserItemType'],
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

describe('item type configuration mutations', () => {
  it.each(variants)(
    '%s creates the item type and hidden fields in one transaction',
    async (createResolver, createService) => {
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
          fields: [{ name: 'id', type: ScalarTypes.STRING, required: true }],
          fieldRoles: {},
          hiddenFields,
        },
        context,
      );
      expect(ModerationConfigService.forTransaction).toHaveBeenCalledWith(trx);
      expect(transactionConfig[createService]).toHaveBeenCalledWith(
        orgId,
        expect.any(Object),
      );
      expect(
        ManualReviewToolService.setHiddenFieldsForItemType,
      ).toHaveBeenCalledWith({ orgId, itemTypeId, hiddenFields });
      expect(
        ModerationConfigService.invalidateLatestItemTypesCache,
      ).toHaveBeenCalledWith(orgId);
    },
  );

  it.each(variants)(
    '%s defaults omitted hidden fields to an empty list',
    async (createResolver) => {
      const { context, ManualReviewToolService } = makeContext();
      await callMutation(
        createResolver,
        {
          name: 'type name',
          fields: [{ name: 'id', type: ScalarTypes.STRING, required: true }],
          fieldRoles: {},
        },
        context,
      );
      expect(
        ManualReviewToolService.setHiddenFieldsForItemType,
      ).toHaveBeenCalledWith({ orgId, itemTypeId, hiddenFields: [] });
    },
  );

  it.each(variants)(
    '%s preserves omitted hidden fields and clears an explicit empty list',
    async (_createResolver, _createService, updateResolver) => {
      const first = makeContext();
      await callMutation(updateResolver, { id: itemTypeId }, first.context);
      expect(
        first.ManualReviewToolService.setHiddenFieldsForItemType,
      ).not.toHaveBeenCalled();

      const second = makeContext();
      await callMutation(
        updateResolver,
        { id: itemTypeId, hiddenFields: [] },
        second.context,
      );
      expect(
        second.ManualReviewToolService.setHiddenFieldsForItemType,
      ).toHaveBeenCalledWith({ orgId, itemTypeId, hiddenFields: [] });
    },
  );
});
