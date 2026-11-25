import { type Kysely } from 'kysely';

import { type CoreAppTablesPg } from '../coreAppTables.js';
import { type LocationArea } from '../moderationConfigService/index.js';

/** The only tables this repository can see. */
export type LocationBankPg = Pick<
  CoreAppTablesPg,
  'public.location_banks' | 'public.location_bank_locations'
>;

/** A `Kysely` instance or a `Transaction`: both satisfy this type. */
type Executor = Kysely<LocationBankPg>;

export type LocationBank = Readonly<{
  id: string;
  name: string;
  description: string | null;
  orgId: string;
  ownerId: string;
}>;

const bankColumns = [
  'id',
  'name',
  'description',
  'org_id as orgId',
  'owner_id as ownerId',
] as const;

/**
 * All SQL for location banks. Every method is scoped to an org: either it
 * takes `orgId`, or it takes a `LocationBank`, which only an org-scoped read
 * returns. It holds no business rules and starts no transactions; callers
 * pass a transaction with {@link withExecutor} when they need one.
 */
export class LocationBankRepository {
  constructor(private readonly db: Executor) {}

  withExecutor(db: Executor) {
    return new LocationBankRepository(db);
  }

  async findById(orgId: string, id: string): Promise<LocationBank | undefined> {
    return this.db
      .selectFrom('public.location_banks')
      .select(bankColumns)
      .where('org_id', '=', orgId)
      .where('id', '=', id)
      .executeTakeFirst();
  }

  async listForOrg(orgId: string): Promise<LocationBank[]> {
    return this.db
      .selectFrom('public.location_banks')
      .select(bankColumns)
      .where('org_id', '=', orgId)
      .execute();
  }

  async insert(
    bank: Omit<LocationBank, 'description'> & { description: string | null },
  ): Promise<LocationBank> {
    return this.db
      .insertInto('public.location_banks')
      .values({
        id: bank.id,
        name: bank.name,
        description: bank.description,
        org_id: bank.orgId,
        owner_id: bank.ownerId,
        updated_at: new Date(),
        full_places_api_responses: [],
      })
      .returning(bankColumns)
      .executeTakeFirstOrThrow();
  }

  async update(
    orgId: string,
    id: string,
    patch: { name?: string; description?: string | null },
  ): Promise<LocationBank | undefined> {
    return this.db
      .updateTable('public.location_banks')
      .set({ ...patch, updated_at: new Date() })
      .where('org_id', '=', orgId)
      .where('id', '=', id)
      .returning(bankColumns)
      .executeTakeFirst();
  }

  /** Deletes the bank and its locations. Returns whether the bank existed. */
  async delete(orgId: string, id: string): Promise<boolean> {
    await this.db
      .deleteFrom('public.location_bank_locations')
      .where('bank_id', 'in', (qb) =>
        qb
          .selectFrom('public.location_banks')
          .select('id')
          .where('org_id', '=', orgId)
          .where('id', '=', id),
      )
      .execute();
    const result = await this.db
      .deleteFrom('public.location_banks')
      .where('org_id', '=', orgId)
      .where('id', '=', id)
      .executeTakeFirst();
    return result.numDeletedRows > 0n;
  }

  /** Locations of the org's banks among `bankIds`, keyed by bank id. */
  async findLocations(
    orgId: string,
    bankIds: readonly string[],
  ): Promise<Map<string, LocationArea[]>> {
    const byBank = new Map<string, LocationArea[]>(
      bankIds.map((id) => [id, []]),
    );
    if (bankIds.length === 0) {
      return byBank;
    }
    const rows = await this.db
      .selectFrom('public.location_bank_locations as l')
      .innerJoin('public.location_banks as b', 'b.id', 'l.bank_id')
      .select([
        'l.id',
        'l.bank_id',
        'l.name',
        'l.geometry',
        'l.bounds',
        'l.google_place_info',
      ])
      .where('b.org_id', '=', orgId)
      .where('l.bank_id', 'in', [...bankIds])
      .execute();
    for (const row of rows) {
      byBank.get(row.bank_id)!.push({
        id: row.id,
        name: row.name ?? undefined,
        geometry: row.geometry as LocationArea['geometry'],
        bounds: (row.bounds as LocationArea['bounds']) ?? undefined,
        googlePlaceInfo:
          row.google_place_info as LocationArea['googlePlaceInfo'],
      });
    }
    return byBank;
  }

  async addLocations(bank: LocationBank, areas: readonly LocationArea[]) {
    if (areas.length === 0) {
      return;
    }
    await this.db
      .insertInto('public.location_bank_locations')
      .values(
        areas.map((area) => ({
          id: area.id,
          bank_id: bank.id,
          geometry: area.geometry,
          bounds: area.bounds ?? null,
          name: area.name ?? null,
          google_place_info: area.googlePlaceInfo ?? null,
        })),
      )
      .execute();
  }

  async deleteLocations(bank: LocationBank, locationIds: readonly string[]) {
    if (locationIds.length === 0) {
      return;
    }
    await this.db
      .deleteFrom('public.location_bank_locations')
      .where('bank_id', '=', bank.id)
      .where('id', 'in', [...locationIds])
      .execute();
  }
}
