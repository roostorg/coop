import {
  HashBankUserError,
  type ExchangeCredentialJson,
} from '../../../services/hmaService/index.js';
import { isCoopErrorOfType } from '../../../utils/errors.js';
import type {
  GQLMutationResolvers,
  GQLQueryResolvers,
} from '../../generated.js';
import type { Context } from '../../resolvers.js';
import {
  forbiddenError,
  unauthenticatedError,
  userInputError,
} from '../../utils/errors.js';
import { gqlErrorResult, gqlSuccessResult } from '../../utils/gqlResult.js';

interface ExchangeConfigInput {
  api_name: string;
  config_json: string;
  credentials_json?: string | null;
}

/**
 * Parses a JSON object argument. The underlying SyntaxError is discarded
 * because its message quotes part of the input, which may be a credential.
 */
function parseJsonObject(
  raw: string,
  argName: string,
): Record<string, unknown> {
  let parsed: unknown;
  try {
    // eslint-disable-next-line no-restricted-syntax
    parsed = JSON.parse(raw);
  } catch {
    throw userInputError(`${argName} must be a valid JSON object.`);
  }
  if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw userInputError(`${argName} must be a valid JSON object.`);
  }
  return parsed as Record<string, unknown>;
}

function parseCredentialJson(
  raw: string,
  argName: string,
): ExchangeCredentialJson {
  const parsed = parseJsonObject(raw, argName);
  const nonScalar = Object.entries(parsed)
    .filter(
      ([, value]) =>
        value !== null &&
        !['string', 'number', 'boolean'].includes(typeof value),
    )
    .map(([name]) => name);
  if (nonScalar.length > 0) {
    throw userInputError(
      `${argName} fields must be scalar values: ${nonScalar.join(', ')}.`,
    );
  }
  return parsed as ExchangeCredentialJson;
}

function toGraphQLError(e: unknown): unknown {
  return e instanceof HashBankUserError ? userInputError(e.message) : e;
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

    // has_auth is deprecated: HMA's API-level credentials are shared by every
    // org, so they aren't reported to tenants. Per-bank state is on
    // HashBank.exchange.
    const apis = await context.services.HMAHashBankService.getExchangeApis();
    return apis.map((api) => ({ ...api, has_auth: false }));
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

    const exchangeConfig = input.exchange
      ? {
          apiName: input.exchange.api_name,
          apiJson: parseJsonObject(
            input.exchange.config_json,
            'exchange.config_json',
          ),
          credentialJson: input.exchange.credentials_json
            ? parseCredentialJson(
                input.exchange.credentials_json,
                'exchange.credentials_json',
              )
            : undefined,
        }
      : undefined;

    try {
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
      throw toGraphQLError(e);
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
      throw toGraphQLError(e);
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

  // Deprecated: it wrote HMA's API-level credentials, which every org's
  // exchanges share, so it always fails. Use updateHashBankExchangeCredentials.
  async updateExchangeCredentials(_: unknown, __: unknown, context: Context) {
    const user = context.getUser();
    if (!user?.orgId) {
      throw unauthenticatedError('User required.');
    }

    throw forbiddenError(
      'Exchange credentials are now set per hash bank. Use updateHashBankExchangeCredentials.',
    );
  },

  // A null credentialsJson clears the exchange's credentials. Only the
  // resulting status is returned, never credential values.
  async updateHashBankExchangeCredentials(
    _: unknown,
    {
      bankId,
      credentialsJson,
    }: { bankId: string; credentialsJson?: string | null },
    context: Context,
  ) {
    const user = context.getUser();
    if (!user?.orgId) {
      throw unauthenticatedError('User required.');
    }

    const id = Number(bankId);
    if (!Number.isSafeInteger(id)) {
      throw userInputError('Hash bank not found.');
    }

    const credentialJson =
      credentialsJson == null
        ? null
        : parseCredentialJson(credentialsJson, 'credentialsJson');

    try {
      return await context.services.HMAHashBankService.setBankExchangeCredentials(
        user.orgId,
        id,
        credentialJson,
      );
    } catch (e) {
      throw toGraphQLError(e);
    }
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
