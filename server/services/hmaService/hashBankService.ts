import { and, eq } from 'drizzle-orm';

import { schema, type CoopDb } from '../../storage/postgres/drizzle.js';
import {
  type CreateHashBankInput,
  type HashBank,
  type UpdateHashBankInput,
} from './dbTypes.js';

const hashBanks = schema.hashBanks;

const hashBankColumns = {
  id: hashBanks.id,
  name: hashBanks.name,
  hma_name: hashBanks.hmaName,
  description: hashBanks.description,
  enabled_ratio: hashBanks.enabledRatio,
  org_id: hashBanks.orgId,
  created_at: hashBanks.createdAt,
  updated_at: hashBanks.updatedAt,
};

type HashBankRow = Omit<HashBank, 'created_at' | 'updated_at'> & {
  created_at: Date | null;
  updated_at: Date | null;
};

// created_at/updated_at are nullable in the schema but always filled by their
// column defaults, so a stored row always has them.
function toHashBank(row: HashBankRow): HashBank {
  return row as HashBank;
}

export class HashBankService {
  constructor(private readonly db: CoopDb) {}

  async create(input: CreateHashBankInput): Promise<HashBank> {
    const result = (
      await this.db
        .insert(hashBanks)
        .values({
          name: input.name,
          hmaName: input.hma_name,
          description: input.description ?? null,
          enabledRatio: input.enabled_ratio,
          orgId: input.org_id,
        })
        .returning(hashBankColumns)
    ).at(0);

    if (!result) {
      throw new Error('Inserting a hash bank returned no row');
    }
    return toHashBank(result);
  }

  async findById(id: number, orgId: string): Promise<HashBank | null> {
    const result = (
      await this.db
        .select(hashBankColumns)
        .from(hashBanks)
        .where(and(eq(hashBanks.id, id), eq(hashBanks.orgId, orgId)))
        .limit(1)
    ).at(0);

    return result ? toHashBank(result) : null;
  }

  async findByName(name: string, orgId: string): Promise<HashBank | null> {
    const result = (
      await this.db
        .select(hashBankColumns)
        .from(hashBanks)
        .where(and(eq(hashBanks.name, name), eq(hashBanks.orgId, orgId)))
        .limit(1)
    ).at(0);

    return result ? toHashBank(result) : null;
  }

  // Not org-scoped: hma_name is unique across all orgs, so this only answers
  // whether a name is free and never returns another org's bank.
  async isHmaNameTaken(hmaName: string): Promise<boolean> {
    const result = (
      await this.db
        .select({ id: hashBanks.id })
        .from(hashBanks)
        .where(eq(hashBanks.hmaName, hmaName))
        .limit(1)
    ).at(0);

    return result !== undefined;
  }

  async findAllByOrgId(orgId: string): Promise<HashBank[]> {
    const results = await this.db
      .select(hashBankColumns)
      .from(hashBanks)
      .where(eq(hashBanks.orgId, orgId));

    return results.map(toHashBank);
  }

  async update(
    id: number,
    orgId: string,
    updates: UpdateHashBankInput,
  ): Promise<HashBank> {
    const result = (
      await this.db
        .update(hashBanks)
        .set({
          name: updates.name,
          hmaName: updates.hma_name,
          description: updates.description,
          enabledRatio: updates.enabled_ratio,
        })
        .where(and(eq(hashBanks.id, id), eq(hashBanks.orgId, orgId)))
        .returning(hashBankColumns)
    ).at(0);

    if (!result) {
      throw new Error(`Hash bank ${id} not found`);
    }
    return toHashBank(result);
  }

  async delete(id: number, orgId: string): Promise<void> {
    await this.db
      .delete(hashBanks)
      .where(and(eq(hashBanks.id, id), eq(hashBanks.orgId, orgId)));
  }

  async deleteByName(name: string, orgId: string): Promise<void> {
    await this.db
      .delete(hashBanks)
      .where(and(eq(hashBanks.name, name), eq(hashBanks.orgId, orgId)));
  }
}
