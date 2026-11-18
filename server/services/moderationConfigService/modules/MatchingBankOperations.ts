import { uid } from 'uid';

import {
  type Prisma,
  type PrismaPgQueryable,
} from '../../../storage/prisma/index.js';
import {
  CoopError,
  ErrorType,
  type ErrorInstanceData,
} from '../../../utils/errors.js';
import { isUniqueViolationError } from '../../../utils/kysely.js';

const textBankPrismaSelect = {
  id: true,
  name: true,
  description: true,
  type: true,
  strings: true,
  org_id: true,
  created_at: true,
  updated_at: true,
  owner_id: true,
} as const satisfies Prisma.text_banksSelect;

function toTextBank(
  row: Prisma.text_banksGetPayload<{ select: typeof textBankPrismaSelect }>,
) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.type,
    strings: row.strings,
    orgId: row.org_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ownerId: row.owner_id,
  };
}

export default class MatchingBankOperations {
  constructor(
    private readonly pgQuery: PrismaPgQueryable,
    private readonly pgQueryReplica: PrismaPgQueryable,
  ) {}

  async getTextBank(opts: {
    orgId: string;
    id: string;
    readFromReplica?: boolean;
  }) {
    const { orgId, id, readFromReplica } = opts;
    const pgQuery = readFromReplica ? this.pgQueryReplica : this.pgQuery;

    const textBank = await pgQuery.text_banks.findFirst({
      select: textBankPrismaSelect,
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

    return toTextBank(textBank);
  }

  async getTextBanks(opts: { orgId: string; readFromReplica?: boolean }) {
    const { orgId, readFromReplica } = opts;
    const pgQuery = readFromReplica ? this.pgQueryReplica : this.pgQuery;

    const textBanks = await pgQuery.text_banks.findMany({
      select: textBankPrismaSelect,
      where: { org_id: orgId },
    });

    return textBanks.map(toTextBank);
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
      const newTextBank = await this.pgQuery.text_banks.create({
        data: {
          id: uid(),
          name,
          description,
          type,
          strings,
          org_id: orgId,
          updated_at: new Date(),
          owner_id: ownerId,
        },
        select: textBankPrismaSelect,
      });

      return toTextBank(newTextBank);
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
      const [updatedTextBank] =
        await this.pgQuery.text_banks.updateManyAndReturn({
          data: {
            name,
            description,
            type,
            strings,
            owner_id: ownerId,
            updated_at: new Date(),
          },
          where: { id, org_id: orgId },
          select: textBankPrismaSelect,
        });
      if (updatedTextBank === undefined) {
        throw new Error('no result');
      }

      return toTextBank(updatedTextBank);
    } catch (error) {
      if (isUniqueViolationError(error)) {
        throw makeMatchingBankNameExistsError({ shouldErrorSpan: true });
      }
      throw error;
    }
  }

  async deleteTextBank(orgId: string, id: string) {
    await this.pgQuery.text_banks.deleteMany({
      where: { id, org_id: orgId },
    });

    // Unconditional, as in the Kysely implementation, whose check on the
    // length of `execute()`'s result (always one DeleteResult) always passed.
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
