import type { Kysely } from 'kysely';
import { uid } from 'uid';

import {
  CoopError,
  ErrorType,
  type ErrorInstanceData,
} from '../../../utils/errors.js';
import { isUniqueViolationError } from '../../../utils/kysely.js';
import type { ModerationConfigServicePg } from '../dbTypes.js';

const TEXT_BANK_COLUMNS = [
  'id',
  'name',
  'description',
  'type',
  'strings',
  'org_id as orgId',
  'created_at as createdAt',
  'updated_at as updatedAt',
  'owner_id as ownerId',
] as const;

export default class MatchingBankOperations {
  constructor(
    private readonly pgQuery: Kysely<ModerationConfigServicePg>,
    private readonly pgQueryReplica: Kysely<ModerationConfigServicePg>,
  ) {}

  async getTextBank(opts: {
    orgId: string;
    id: string;
    readFromReplica?: boolean;
  }) {
    const { orgId, id, readFromReplica } = opts;
    const pgQuery = readFromReplica ? this.pgQueryReplica : this.pgQuery;

    const textBank = await pgQuery
      .selectFrom('public.text_banks')
      .select(TEXT_BANK_COLUMNS)
      .where('org_id', '=', orgId)
      .where('id', '=', id)
      .executeTakeFirst();

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

    const textBanks = await pgQuery
      .selectFrom('public.text_banks')
      .select(TEXT_BANK_COLUMNS)
      .where('org_id', '=', orgId)
      .execute();

    return textBanks;
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
      const newTextBank = await this.pgQuery
        .insertInto('public.text_banks')
        .values({
          id: uid(),
          name,
          description,
          type,
          strings,
          org_id: orgId,
          updated_at: new Date(),
          owner_id: ownerId,
        })
        .returning(TEXT_BANK_COLUMNS)
        .executeTakeFirstOrThrow();

      return newTextBank;
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
      const updatedTextBank = await this.pgQuery
        .updateTable('public.text_banks')
        .set({
          name,
          description,
          type,
          strings,
          owner_id: ownerId,
          updated_at: new Date(),
        })
        .where('id', '=', id)
        .where('org_id', '=', orgId)
        .returning(TEXT_BANK_COLUMNS)
        .executeTakeFirstOrThrow();

      return updatedTextBank;
    } catch (error) {
      if (isUniqueViolationError(error)) {
        throw makeMatchingBankNameExistsError({ shouldErrorSpan: true });
      }
      throw error;
    }
  }

  async deleteTextBank(orgId: string, id: string) {
    const rowsDeleted = await this.pgQuery
      .deleteFrom('public.text_banks')
      .where('id', '=', id)
      .where('org_id', '=', orgId)
      .execute();

    return rowsDeleted.length === 1;
  }
}

export type MatchingBankErrorType =
  | 'MatchingBankNameExistsError'
  | 'MatchingBankNotFoundError';

export const makeMatchingBankNameExistsError = (data: ErrorInstanceData) =>
  new CoopError({
    status: 409,
    type: [ErrorType.UniqueViolation],
    title:
      'A matching bank with that name already exists in this organization.',
    name: 'MatchingBankNameExistsError',
    ...data,
  });
