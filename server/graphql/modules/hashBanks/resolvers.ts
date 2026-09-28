import { isCoopErrorOfType } from '../../../utils/errors.js';
import type {
  GQLMutationResolvers,
  GQLQueryResolvers,
} from '../../generated.js';
import type { Context } from '../../resolvers.js';
import { unauthenticatedError } from '../../utils/errors.js';
import { gqlErrorResult, gqlSuccessResult } from '../../utils/gqlResult.js';

interface ExchangeConfigInput {
  api_name: string;
  config_json: string;
  credentials_json?: string | null;
}

const Query: GQLQueryResolvers<Context> = {
  async hashBanks(_: unknown, __: unknown, context: Context) {
    const user = context.getUser();
    if (!user?.orgId) {
      throw unauthenticatedError('User required.');
    }

    return context.services.HMAHashBankService.listBanks(user.orgId);
  },

  async hashBank(_: unknown, { name }: { name: string }, context: Context) {
    const user = context.getUser();
    if (!user?.orgId) {
      throw unauthenticatedError('User required.');
    }

    try {
      return await context.services.HMAHashBankService.getBank(
        user.orgId,
        name,
      );
    } catch (e) {
      if (isCoopErrorOfType(e, 'NotFoundError')) {
        return null;
      }
      throw e;
    }
  },

  async hashBankById(_: unknown, { id }: { id: string }, context: Context) {
    const user = context.getUser();
    if (!user?.orgId) {
      throw unauthenticatedError('User required.');
    }

    try {
      return await context.services.HMAHashBankService.getBankById(
        user.orgId,
        parseInt(id, 10),
      );
    } catch (e) {
      if (isCoopErrorOfType(e, 'NotFoundError')) {
        return null;
      }
      throw e;
    }
  },

  async exchangeApis(_: unknown, __: unknown, context: Context) {
    const user = context.getUser();
    if (!user?.orgId) {
      throw unauthenticatedError('User required.');
    }

    return context.services.HMAHashBankService.getExchangeApis();
  },

  async exchangeApiSchema(
    _: unknown,
    { apiName }: { apiName: string },
    context: Context,
  ) {
    const user = context.getUser();
    if (!user?.orgId) {
      throw unauthenticatedError('User required.');
    }

    return context.services.HMAHashBankService.getExchangeApiSchema(apiName);
  },
};

const Mutation: GQLMutationResolvers<Context> = {
  async createHashBank(
    _: unknown,
    {
      input,
    }: {
      input: {
        name: string;
        description?: string | null;
        enabled_ratio: number;
        exchange?: ExchangeConfigInput | null;
      };
    },
    context: Context,
  ) {
    const user = context.getUser();
    if (!user?.orgId) {
      throw unauthenticatedError('User required.');
    }

    try {
      const exchangeConfig = input.exchange
        ? {
            apiName: input.exchange.api_name,
            // eslint-disable-next-line no-restricted-syntax
            apiJson: JSON.parse(input.exchange.config_json) as Record<
              string,
              unknown
            >,
          }
        : undefined;

      const bank = await context.services.HMAHashBankService.createBank(
        user.orgId,
        input.name,
        input.description ?? '',
        input.enabled_ratio,
        exchangeConfig,
      );

      return gqlSuccessResult({ data: bank }, 'MutateHashBankSuccessResponse');
    } catch (e) {
      if (isCoopErrorOfType(e, 'MatchingBankNameExistsError')) {
        return gqlErrorResult(e, '/input/name');
      }
      throw e;
    }
  },

  async updateHashBank(
    _: unknown,
    {
      input,
    }: {
      input: {
        id: string;
        name?: string | null;
        description?: string | null;
        enabled_ratio?: number | null;
      };
    },
    context: Context,
  ) {
    const user = context.getUser();
    if (!user?.orgId) {
      throw unauthenticatedError('User required.');
    }

    try {
      const bank = await context.services.HMAHashBankService.updateBank(
        user.orgId,
        input.id,
        {
          name: input.name ?? undefined,
          description: input.description ?? undefined,
          enabled_ratio: input.enabled_ratio ?? undefined,
        },
      );
      return gqlSuccessResult({ data: bank }, 'MutateHashBankSuccessResponse');
    } catch (e) {
      if (isCoopErrorOfType(e, 'MatchingBankNameExistsError')) {
        return gqlErrorResult(e, '/input/name');
      }
      throw e;
    }
  },

  async deleteHashBank(_: unknown, { id }: { id: string }, context: Context) {
    const user = context.getUser();
    if (!user?.orgId) {
      throw unauthenticatedError('User required.');
    }

    await context.services.HMAHashBankService.deleteBank(user.orgId, id);
    return true;
  },
};

const HashBank = {
  async exchange(
    parent: { hma_name: string },
    _args: unknown,
    context: Context,
  ) {
    return context.services.HMAHashBankService.getExchangeForBank(
      parent.hma_name,
    );
  },
};

export const resolvers = {
  Query,
  Mutation,
  HashBank,
};
