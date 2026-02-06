import { type Kysely } from 'kysely';
import {
  type HmaServicePg,
  type HashBank,
  type CreateHashBankInput,
  type UpdateHashBankInput,
} from './dbTypes.js';

export class HashBankService {
  constructor(private readonly db: Kysely<HmaServicePg>) {}

  async create(input: CreateHashBankInput): Promise<HashBank> {
    const result = await this.db
      .insertInto('public.hash_banks')
      .values({
        name: input.name,
        hma_name: input.hma_name,
        description: input.description ?? null,
        enabled_ratio: input.enabled_ratio,
        org_id: input.org_id,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return result;
  }

  async findById(id: number, orgId: string): Promise<HashBank | null> {
    const result = await this.db
      .selectFrom('public.hash_banks')
      .selectAll()
      .where('id', '=', id)
      .where('org_id', '=', orgId)
      .executeTakeFirst();

    return result ?? null;
  }

  async findByName(name: string, orgId: string): Promise<HashBank | null> {
    const result = await this.db
      .selectFrom('public.hash_banks')
      .selectAll()
      .where('name', '=', name)
      .where('org_id', '=', orgId)
      .executeTakeFirst();

    return result ?? null;
  }

  async findAllByOrgId(orgId: string): Promise<HashBank[]> {
    const results = await this.db
      .selectFrom('public.hash_banks')
      .selectAll()
      .where('org_id', '=', orgId)
      .execute();

    return results;
  }

  async update(id: number, orgId: string, updates: UpdateHashBankInput): Promise<HashBank> {
    const result = await this.db
      .updateTable('public.hash_banks')
      .set(updates)
      .where('id', '=', id)
      .where('org_id', '=', orgId)
      .returningAll()
      .executeTakeFirstOrThrow();

    return result;
  }

  async delete(id: number, orgId: string): Promise<void> {
    await this.db
      .deleteFrom('public.hash_banks')
      .where('id', '=', id)
      .where('org_id', '=', orgId)
      .execute();
  }

  async deleteByName(name: string, orgId: string): Promise<void> {
    await this.db
      .deleteFrom('public.hash_banks')
      .where('name', '=', name)
      .where('org_id', '=', orgId)
      .execute();
  }
}