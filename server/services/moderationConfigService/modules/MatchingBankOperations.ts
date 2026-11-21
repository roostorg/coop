import { uid } from 'uid';

import { managerOf, type TypeormDb } from '../../../storage/typeorm/db.js';
import {
  TextBanks,
  type TextBankType,
} from '../../../storage/typeorm/entities/index.js';
import {
  CoopError,
  ErrorType,
  type ErrorInstanceData,
} from '../../../utils/errors.js';
import { isUniqueViolationError } from '../../../utils/kysely.js';
import { removeUndefinedKeys } from '../../../utils/misc.js';

type TextBankRow = {
  id: string;
  name: string;
  description: string | null;
  type: TextBankType;
  strings: string[];
  orgId: string;
  createdAt: Date;
  updatedAt: Date;
  ownerId: string | null;
};

function toRow(bank: TextBanks): TextBankRow {
  return {
    id: bank.id,
    name: bank.name,
    description: bank.description,
    type: bank.type,
    strings: bank.strings,
    orgId: bank.org_id,
    createdAt: bank.created_at,
    updatedAt: bank.updated_at,
    ownerId: bank.owner_id,
  };
}

export default class MatchingBankOperations {
  constructor(
    private readonly pgQuery: TypeormDb,
    private readonly pgQueryReplica: TypeormDb,
  ) {}

  async #manager(readFromReplica?: boolean) {
    return managerOf(readFromReplica ? this.pgQueryReplica : this.pgQuery);
  }

  async getTextBank(opts: {
    orgId: string;
    id: string;
    readFromReplica?: boolean;
  }) {
    const { orgId, id, readFromReplica } = opts;
    const manager = await this.#manager(readFromReplica);
    const textBank = await manager.findOne(TextBanks, {
      where: { org_id: orgId, id },
    });

    if (!textBank) {
      throw new CoopError({
        status: 404,
        type: [ErrorType.NotFound],
        title: 'Text bank not found',
        name: 'MatchingBankNotFoundError',
        shouldErrorSpan: true,
      });
    }

    return toRow(textBank);
  }

  async getTextBanks(opts: { orgId: string; readFromReplica?: boolean }) {
    const manager = await this.#manager(opts.readFromReplica);
    const textBanks = await manager.find(TextBanks, {
      where: { org_id: opts.orgId },
    });
    return textBanks.map(toRow);
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
    const manager = await this.#manager();

    try {
      const result = await manager
        .createQueryBuilder()
        .insert()
        .into(TextBanks)
        .values({
          id: uid(),
          name,
          description,
          type,
          strings,
          org_id: orgId,
          updated_at: new Date(),
          owner_id: ownerId ?? null,
        })
        .returning('*')
        .execute();
      return toRow(result.raw[0] as TextBanks);
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
    const manager = await this.#manager();

    let rows: TextBanks[];
    try {
      const result = await manager
        .createQueryBuilder()
        .update(TextBanks)
        .set(
          removeUndefinedKeys({
            name,
            description,
            type,
            strings,
            owner_id: ownerId,
            updated_at: new Date(),
          }),
        )
        .where('id = :id AND org_id = :orgId', { id, orgId })
        .returning('*')
        .execute();
      rows = result.raw as TextBanks[];
    } catch (error) {
      if (isUniqueViolationError(error)) {
        throw makeMatchingBankNameExistsError({ shouldErrorSpan: true });
      }
      throw error;
    }
    if (rows.length === 0) {
      throw new Error('No text bank to update');
    }
    return toRow(rows[0]);
  }

  async deleteTextBank(orgId: string, id: string) {
    const manager = await this.#manager();
    const result = await manager.delete(TextBanks, { id, org_id: orgId });
    return result.affected === 1;
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
