import { and, eq } from 'drizzle-orm';
import { uid } from 'uid';

import { schema, type CoopDbOrTx } from '../../../storage/postgres/drizzle.js';
import {
  CoopError,
  ErrorType,
  type ErrorInstanceData,
} from '../../../utils/errors.js';
import { isUniqueViolationError } from '../../../utils/kysely.js';

const textBanks = schema.textBanks;

const TEXT_BANK_COLUMNS = {
  id: textBanks.id,
  name: textBanks.name,
  description: textBanks.description,
  type: textBanks.type,
  strings: textBanks.strings,
  orgId: textBanks.orgId,
  createdAt: textBanks.createdAt,
  updatedAt: textBanks.updatedAt,
  ownerId: textBanks.ownerId,
};

// Kysely's executeTakeFirstOrThrow message, which callers may match on.
function throwNoResult(): never {
  throw new Error('no result');
}

export default class MatchingBankOperations {
  constructor(
    private readonly pgQuery: CoopDbOrTx,
    private readonly pgQueryReplica: CoopDbOrTx,
  ) {}

  async getTextBank(opts: {
    orgId: string;
    id: string;
    readFromReplica?: boolean;
  }) {
    const { orgId, id, readFromReplica } = opts;
    const pgQuery = readFromReplica ? this.pgQueryReplica : this.pgQuery;

    const [textBank] = await pgQuery
      .select(TEXT_BANK_COLUMNS)
      .from(textBanks)
      .where(and(eq(textBanks.orgId, orgId), eq(textBanks.id, id)))
      .limit(1);

    if (!textBank) {
      throw new CoopError({
        status: 404,
        type: [ErrorType.NotFound],
        title: 'Text bank not found',
        name: 'MatchingBankNotFoundError',
        shouldErrorSpan: true,
      });
    }

    return textBank;
  }

  async getTextBanks(opts: { orgId: string; readFromReplica?: boolean }) {
    const { orgId, readFromReplica } = opts;
    const pgQuery = readFromReplica ? this.pgQueryReplica : this.pgQuery;

    return pgQuery
      .select(TEXT_BANK_COLUMNS)
      .from(textBanks)
      .where(eq(textBanks.orgId, orgId));
  }

  async createTextBank(
    orgId: string,
    input: {
      name: string;
      description: string | null;
      type: 'STRING' | 'REGEX';
      ownerId?: string | null;
      strings: string[];
    },
  ) {
    const { name, description, type, strings, ownerId } = input;

    try {
      const [newTextBank] = await this.pgQuery
        .insert(textBanks)
        .values({
          id: uid(),
          name,
          description,
          type,
          strings,
          orgId,
          updatedAt: new Date(),
          ownerId,
        })
        .returning(TEXT_BANK_COLUMNS);

      return newTextBank ?? throwNoResult();
    } catch (error) {
      if (isUniqueViolationError(error)) {
        throw makeMatchingBankNameExistsError({ shouldErrorSpan: true });
      }
      throw error;
    }
  }

  async updateTextBank(
    orgId: string,
    input: {
      id: string;
      name?: string;
      description?: string | null;
      type?: 'STRING' | 'REGEX';
      ownerId?: string | null;
      strings?: string[];
    },
  ) {
    const { id, name, description, type, strings, ownerId } = input;

    try {
      // Drizzle skips undefined keys in .set(), as Kysely did.
      const [updatedTextBank] = await this.pgQuery
        .update(textBanks)
        .set({
          name,
          description,
          type,
          strings,
          ownerId,
          updatedAt: new Date(),
        })
        .where(and(eq(textBanks.id, id), eq(textBanks.orgId, orgId)))
        .returning(TEXT_BANK_COLUMNS);

      return updatedTextBank ?? throwNoResult();
    } catch (error) {
      if (isUniqueViolationError(error)) {
        throw makeMatchingBankNameExistsError({ shouldErrorSpan: true });
      }
      throw error;
    }
  }

  async deleteTextBank(orgId: string, id: string) {
    await this.pgQuery
      .delete(textBanks)
      .where(and(eq(textBanks.id, id), eq(textBanks.orgId, orgId)));

    // Kysely's `execute()` on a DELETE always returned one result object, so
    // the old `rowsDeleted.length === 1` was always true; kept as-is.
    return true;
  }
}

export type MatchingBankErrorType =
  'MatchingBankNameExistsError' | 'MatchingBankNotFoundError';

export const makeMatchingBankNameExistsError = (data: ErrorInstanceData) =>
  new CoopError({
    status: 409,
    type: [ErrorType.UniqueViolation],
    title:
      'A matching bank with that name already exists in this organization.',
    name: 'MatchingBankNameExistsError',
    ...data,
  });
