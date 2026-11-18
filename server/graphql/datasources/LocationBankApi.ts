import { type Exception } from '@opentelemetry/api';
import { uid } from 'uid';
import { v1 as uuidV1 } from 'uuid';

import { type Dependencies } from '../../iocContainer/index.js';
import { inject } from '../../iocContainer/utils.js';
import {
  makeLocationBankNameExistsError,
  type LocationArea,
} from '../../services/moderationConfigService/index.js';
import { type PlacesApiService } from '../../services/placesApiService/index.js';
import { Prisma, type PrismaPgClient } from '../../storage/prisma/index.js';
import { makeNotFoundError } from '../../utils/errors.js';
import { isUniqueViolationError } from '../../utils/kysely.js';
import { safePick } from '../../utils/misc.js';
import {
  makePrismaTransactionWithRetry,
  type PrismaTransactionWithRetry,
} from '../../utils/prismaTransactionWithRetry.js';
import {
  type GQLCreateLocationBankInput,
  type GQLLocationAreaInput,
  type GQLUpdateLocationBankInput,
} from '../generated.js';

type LocationBankRow = {
  id: string;
  name: string;
  description: string | null;
  org_id: string;
  owner_id: string;
};

/**
 * GraphQL parent for `LocationBank` (no Sequelize, no `fullPlacesApiResponse`).
 * Resolvers use {@link LocationBankWithoutFullPlacesAPIResponse.getLocations}.
 */
export type LocationBankWithoutFullPlacesAPIResponse = {
  id: string;
  name: string;
  description: string | null;
  orgId: string;
  ownerId: string;
  getLocations: () => Promise<LocationArea[]>;
};

const LOCATION_BANK_ROW_SELECT = {
  id: true,
  name: true,
  description: true,
  org_id: true,
  owner_id: true,
} as const;

class LocationBankAPI {
  private lookupPlaceId: PlacesApiService['lookupPlaceId'];
  private readonly db: PrismaPgClient;
  private readonly transactionWithRetry: PrismaTransactionWithRetry;

  constructor(
    placesApiService: PlacesApiService,
    db: Dependencies['PrismaPg'],
    private readonly tracer: Dependencies['Tracer'],
  ) {
    this.lookupPlaceId = placesApiService.lookupPlaceId.bind(placesApiService);
    this.db = db;
    this.transactionWithRetry = makePrismaTransactionWithRetry(this.db);
  }

  #rowToParent(row: LocationBankRow): LocationBankWithoutFullPlacesAPIResponse {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      orgId: row.org_id,
      ownerId: row.owner_id,
      getLocations: async () => this.#loadLocationsForBank(row.id),
    };
  }

  async #loadLocationsForBank(bankId: string): Promise<LocationArea[]> {
    const rows = await this.db.location_bank_locations.findMany({
      where: { bank_id: bankId },
    });
    return rows.map(locationRowToLocationArea);
  }

  async getGraphQLLocationBankFromId(opts: { id: string; orgId: string }) {
    const { id, orgId } = opts;
    const row = await this.db.location_banks.findFirst({
      select: LOCATION_BANK_ROW_SELECT,
      where: { id, org_id: orgId },
    });

    if (row == null) {
      throw makeNotFoundError('Location bank not found', {
        shouldErrorSpan: true,
      });
    }

    return this.#rowToParent(row);
  }

  async getGraphQLLocationBanksForOrg(orgId: string) {
    const rows: LocationBankRow[] = await this.db.location_banks.findMany({
      select: LOCATION_BANK_ROW_SELECT,
      where: { org_id: orgId },
    });

    return rows.map((r) => this.#rowToParent(r));
  }

  async createLocationBank(
    input: GQLCreateLocationBankInput,
    user: { id: string; orgId: string },
  ) {
    const { name, description, locations: locationInputs } = input;
    const { orgId, id: ownerId } = user;

    const newBankId = uid();
    const expandedLocations = await this.expandLocationAreaInputs(
      newBankId,
      locationInputs,
    );

    try {
      return await this.transactionWithRetry(async (trx) => {
        await trx.location_banks.create({
          data: {
            id: newBankId,
            name,
            description: description ?? null,
            org_id: orgId,
            owner_id: ownerId,
            updated_at: new Date(),
            full_places_api_responses: [],
          },
        });

        if (expandedLocations.length > 0) {
          await trx.location_bank_locations.createMany({
            data: expandedLocations.map((loc) =>
              locationAreaToLocationInsertRow(loc.bankId, loc),
            ),
          });
        }

        return this.#rowToParent({
          id: newBankId,
          name,
          description: description ?? null,
          org_id: orgId,
          owner_id: ownerId,
        });
      });
    } catch (e: unknown) {
      throw isUniqueViolationError(e)
        ? makeLocationBankNameExistsError({ shouldErrorSpan: true })
        : e;
    }
  }

  async updateLocationBank(input: GQLUpdateLocationBankInput, orgId: string) {
    const { id, name, description, locationsToAdd, locationsToDelete } = input;

    const expandedLocationsToAdd = locationsToAdd?.length
      ? await this.expandLocationAreaInputs(id, locationsToAdd)
      : undefined;

    const row = await this.db.location_banks.findFirst({
      select: LOCATION_BANK_ROW_SELECT,
      where: { id, org_id: orgId },
    });

    if (row == null) {
      throw makeNotFoundError('Location bank not found', {
        shouldErrorSpan: true,
      });
    }

    if (name === null) {
      throw new Error('Cannot clear bank name.');
    }

    const nextName = name ?? row.name;
    const nextDescription =
      description !== undefined ? (description ?? null) : row.description;

    try {
      return await this.transactionWithRetry(async (trx) => {
        await trx.location_banks.updateMany({
          data: {
            name: nextName,
            description: nextDescription,
            updated_at: new Date(),
          },
          where: { id, org_id: orgId },
        });

        if (locationsToDelete?.length) {
          await trx.location_bank_locations.deleteMany({
            where: { bank_id: id, id: { in: [...locationsToDelete] } },
          });
        }

        if (expandedLocationsToAdd?.length) {
          await trx.location_bank_locations.createMany({
            data: expandedLocationsToAdd.map((loc) =>
              locationAreaToLocationInsertRow(loc.bankId, loc),
            ),
          });
        }

        return this.#rowToParent({
          id: row.id,
          name: nextName,
          description: nextDescription,
          org_id: row.org_id,
          owner_id: row.owner_id,
        });
      });
    } catch (e: unknown) {
      throw isUniqueViolationError(e)
        ? makeLocationBankNameExistsError({ shouldErrorSpan: true })
        : e;
    }
  }

  async deleteLocationBank(opts: { id: string; orgId: string }) {
    const { id, orgId } = opts;

    try {
      const result = await this.transactionWithRetry(async (trx) => {
        const bank = await trx.location_banks.findFirst({
          select: { id: true },
          where: { id, org_id: orgId },
        });

        if (!bank) {
          return { count: 0 };
        }

        await trx.location_bank_locations.deleteMany({
          where: { bank_id: id },
        });
        return trx.location_banks.deleteMany({ where: { id, org_id: orgId } });
      });

      if (!result.count) {
        return false;
      }
    } catch (exception) {
      const activeSpan = this.tracer.getActiveSpan();
      if (activeSpan?.isRecording()) {
        activeSpan.recordException(exception as Exception);
      }

      return false;
    }
    return true;
  }

  /**
   * When a user adds a location to a location bank, we need to convert their
   * input, which might be geographic coordinates or a google place id (for
   * which we have to fetch more details from google), into a
   * LocationBankLocation object that we can actually save along with the bank.
   */
  private async expandLocationAreaInputs(
    locationBankId: string,
    locations: readonly GQLLocationAreaInput[],
  ) {
    const locationAreas = await Promise.all(
      locations.map(async (it) =>
        locationAreaInputToLocationAreaWithGooglePlaceData(
          this.lookupPlaceId,
          it,
        ),
      ),
    );

    return locationAreas.map((locationArea) => ({
      ...locationArea,
      bankId: locationBankId,
    }));
  }
}

function locationRowToLocationArea(
  r: Record<string, unknown> & {
    id: string;
    bank_id: string;
    geometry: unknown;
    bounds: unknown | null;
    name: string | null;
    google_place_info: unknown | null;
  },
): LocationArea {
  return {
    id: r.id,
    name: r.name ?? undefined,
    geometry: r.geometry as LocationArea['geometry'],
    bounds: (r.bounds as LocationArea['bounds']) ?? undefined,
    googlePlaceInfo: r.google_place_info as LocationArea['googlePlaceInfo'],
  };
}

function locationAreaToLocationInsertRow(
  bankId: string,
  area: LocationArea & { bankId?: string },
): Prisma.location_bank_locationsCreateManyInput {
  // `LocationArea`'s nested types aren't assignable to Prisma's JSON input
  // type; they are plain JSON. A missing value is SQL NULL (`DbNull`), as the
  // plain `null` written through Kysely was.
  return {
    id: area.id,
    bank_id: bankId,
    geometry: area.geometry as Prisma.InputJsonValue,
    bounds: (area.bounds as Prisma.InputJsonValue | undefined) ?? Prisma.DbNull,
    name: area.name ?? null,
    google_place_info:
      (area.googlePlaceInfo as Prisma.InputJsonValue | undefined) ??
      Prisma.DbNull,
  };
}

export default inject(
  ['PlacesApiService', 'PrismaPg', 'Tracer'],
  LocationBankAPI,
);
export type { LocationBankAPI };

/**
 * Returns a LocationArea based on a user-provided GQLLocationAreaInput.
 * The LocationArea returned will have a newly-generated/assigned id; since
 * existing LocationAreas can never be edited (just deleted and recreated),
 * we're always in the position of needing to make a new id if we're receiving
 * new input. This id will be a uuid to ensure global uniqueness (which is
 * helpful for apollo) regardless of where the LocationArea is stored.
 *
 * The returned LocationArea will not have any detailed google place info; just
 * the id of the place submitted in the GQLLocationAreaInput, if any. If you
 * need the detailed google info, see {@link locationAreaInputToLocationAreaWithGooglePlaceData}.
 */
export function locationAreaInputToLocationArea(
  it: GQLLocationAreaInput,
): LocationArea {
  const { googlePlaceId } = it;

  return {
    id: uuidV1(),
    ...safePick(it, ['bounds', 'geometry']),
    name: it.name ?? undefined,
    ...(googlePlaceId ? { googlePlaceInfo: { id: googlePlaceId } } : {}),
  };
}

export async function locationAreaInputToLocationAreaWithGooglePlaceData(
  lookupPlaceId: PlacesApiService['lookupPlaceId'],
  locationInput: GQLLocationAreaInput,
) {
  const baseLocationArea = locationAreaInputToLocationArea(locationInput);

  return !baseLocationArea.googlePlaceInfo
    ? baseLocationArea
    : {
        ...baseLocationArea,
        googlePlaceInfo: {
          ...baseLocationArea.googlePlaceInfo,
          ...safePick(
            await lookupPlaceId(baseLocationArea.googlePlaceInfo.id),
            ['details', 'geocode'],
          ),
        },
      };
}
