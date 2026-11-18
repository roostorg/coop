import { type PrismaPgClient } from '../../storage/prisma/index.js';
import {
  type CreateHashBankInput,
  type HashBank,
  type UpdateHashBankInput,
} from './dbTypes.js';

// `source` exists on the table but is not part of HashBank; Kysely's
// `selectAll()` returned it anyway, so it is selected here too.
type HashBankRow = HashBank & { source: string | null };

export class HashBankService {
  constructor(private readonly db: PrismaPgClient) {}

  async create(input: CreateHashBankInput): Promise<HashBank> {
    return asHashBank(
      await this.db.hash_banks.create({
        data: {
          name: input.name,
          hma_name: input.hma_name,
          description: input.description ?? null,
          enabled_ratio: input.enabled_ratio,
          org_id: input.org_id,
        },
      }),
    );
  }

  async findById(id: number, orgId: string): Promise<HashBank | null> {
    const result = await this.db.hash_banks.findFirst({
      where: { id, org_id: orgId },
    });

    return result === null ? null : asHashBank(result);
  }

  async findByName(name: string, orgId: string): Promise<HashBank | null> {
    const result = await this.db.hash_banks.findFirst({
      where: { name, org_id: orgId },
    });

    return result === null ? null : asHashBank(result);
  }

  // Not org-scoped: hma_name is unique across all orgs, so this only answers
  // whether a name is free and never returns another org's bank.
  async isHmaNameTaken(hmaName: string): Promise<boolean> {
    const result = await this.db.hash_banks.findFirst({
      select: { id: true },
      where: { hma_name: hmaName },
    });

    return result !== null;
  }

  async findAllByOrgId(orgId: string): Promise<HashBank[]> {
    const results = await this.db.hash_banks.findMany({
      where: { org_id: orgId },
    });

    return results.map(asHashBank);
  }

  async update(
    id: number,
    orgId: string,
    updates: UpdateHashBankInput,
  ): Promise<HashBank> {
    const [result] = await this.db.hash_banks.updateManyAndReturn({
      data: updates,
      where: { id, org_id: orgId },
    });
    if (result === undefined) {
      throw new Error('no result');
    }

    return asHashBank(result);
  }

  async delete(id: number, orgId: string): Promise<void> {
    await this.db.hash_banks.deleteMany({
      where: { id, org_id: orgId },
    });
  }

  async deleteByName(name: string, orgId: string): Promise<void> {
    await this.db.hash_banks.deleteMany({
      where: { name, org_id: orgId },
    });
  }
}

/**
 * `created_at`/`updated_at` are nullable in the schema (they have defaults but
 * no NOT NULL), while HashBank declares them non-null as the Kysely types did.
 */
function asHashBank(row: {
  [K in keyof HashBankRow]: K extends 'created_at' | 'updated_at'
    ? Date | null
    : HashBankRow[K];
}): HashBank {
  return row as HashBank;
}
