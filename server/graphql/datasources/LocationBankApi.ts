import { type Exception } from '@opentelemetry/api';
import { and, eq, inArray } from 'drizzle-orm';
import { uid } from 'uid';
import { v1 as uuidV1 } from 'uuid';

import { type Dependencies } from '../../iocContainer/index.js';
import { inject } from '../../iocContainer/utils.js';
import {
  makeLocationBankNameExistsError,
  type LocationArea,
} from '../../services/moderationConfigService/index.js';
import { type PlacesApiService } from '../../services/placesApiService/index.js';
import {
  schema,
  transactionWithRetry,
  type CoopDb,
} from '../../storage/postgres/drizzle.js';
import { makeNotFoundError } from '../../utils/errors.js';
import { isUniqueViolationError } from '../../utils/kysely.js';
import { safePick } from '../../utils/misc.js';
import {
  type GQLCreateLocationBankInput,
  type GQLLocationAreaInput,
  type GQLUpdateLocationBankInput,
} from '../generated.js';

const { locationBanks, locationBankLocations } = schema;

type LocationBankRow = {
  id: string;
  name: string;
  description: string | null;
  orgId: string;
  ownerId: string;
};

const LOCATION_BANK_FIELDS = {
  id: locationBanks.id,
  name: locationBanks.name,
  description: locationBanks.description,
  orgId: locationBanks.orgId,
  ownerId: locationBanks.ownerId,
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

class LocationBankAPI {
  private lookupPlaceId: PlacesApiService['lookupPlaceId'];

  constructor(
    placesApiService: PlacesApiService,
    private readonly db: CoopDb,
    private readonly tracer: Dependencies['Tracer'],
  ) {
    this.lookupPlaceId = placesApiService.lookupPlaceId.bind(placesApiService);
  }

  #rowToParent(row: LocationBankRow): LocationBankWithoutFullPlacesAPIResponse {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      orgId: row.orgId,
      ownerId: row.ownerId,
      getLocations: async () => this.#loadLocationsForBank(row.id),
    };
  }

  async #loadLocationsForBank(bankId: string): Promise<LocationArea[]> {
    const rows = await this.db
      .select()
      .from(locationBankLocations)
      .where(eq(locationBankLocations.bankId, bankId));
    return rows.map(locationRowToLocationArea);
  }

  async getGraphQLLocationBankFromId(opts: { id: string; orgId: string }) {
    const { id, orgId } = opts;
    const row = (
      await this.db
        .select(LOCATION_BANK_FIELDS)
        .from(locationBanks)
        .where(and(eq(locationBanks.id, id), eq(locationBanks.orgId, orgId)))
        .limit(1)
    ).at(0);

    if (row == null) {
      throw makeNotFoundError('Location bank not found', {
        shouldErrorSpan: true,
      });
    }

    return this.#rowToParent(row);
  }

  async getGraphQLLocationBanksForOrg(orgId: string) {
    const rows = await this.db
      .select(LOCATION_BANK_FIELDS)
      .from(locationBanks)
      .where(eq(locationBanks.orgId, orgId));

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
      return await transactionWithRetry(this.db, async (trx) => {
        await trx.insert(locationBanks).values({
          id: newBankId,
          name,
          description: description ?? null,
          orgId,
          ownerId,
          updatedAt: new Date(),
          fullPlacesApiResponses: [],
        });

        if (expandedLocations.length > 0) {
          await trx
            .insert(locationBankLocations)
            .values(
              expandedLocations.map((loc) =>
                locationAreaToLocationInsertRow(loc.bankId, loc),
              ),
            );
        }

        return this.#rowToParent({
          id: newBankId,
          name,
          description: description ?? null,
          orgId,
          ownerId,
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

    const row = (
      await this.db
        .select(LOCATION_BANK_FIELDS)
        .from(locationBanks)
        .where(and(eq(locationBanks.id, id), eq(locationBanks.orgId, orgId)))
        .limit(1)
    ).at(0);

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
      return await transactionWithRetry(this.db, async (trx) => {
        await trx
          .update(locationBanks)
          .set({
            name: nextName,
            description: nextDescription,
            updatedAt: new Date(),
          })
          .where(and(eq(locationBanks.id, id), eq(locationBanks.orgId, orgId)));

        if (locationsToDelete?.length) {
          await trx
            .delete(locationBankLocations)
            .where(
              and(
                eq(locationBankLocations.bankId, id),
                inArray(locationBankLocations.id, [...locationsToDelete]),
              ),
            );
        }

        if (expandedLocationsToAdd?.length) {
          await trx
            .insert(locationBankLocations)
            .values(
              expandedLocationsToAdd.map((loc) =>
                locationAreaToLocationInsertRow(loc.bankId, loc),
              ),
            );
        }

        return this.#rowToParent({
          id: row.id,
          name: nextName,
          description: nextDescription,
          orgId: row.orgId,
          ownerId: row.ownerId,
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
      const numDeletedRows = await transactionWithRetry(
        this.db,
        async (trx) => {
          const bank = (
            await trx
              .select({ id: locationBanks.id })
              .from(locationBanks)
              .where(
                and(eq(locationBanks.id, id), eq(locationBanks.orgId, orgId)),
              )
              .limit(1)
          ).at(0);

          if (!bank) {
            return 0;
          }

          await trx
            .delete(locationBankLocations)
            .where(eq(locationBankLocations.bankId, id));
          const result = await trx
            .delete(locationBanks)
            .where(
              and(eq(locationBanks.id, id), eq(locationBanks.orgId, orgId)),
            );
          return result.rowCount ?? 0;
        },
      );

      if (!numDeletedRows) {
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
  r: typeof locationBankLocations.$inferSelect,
): LocationArea {
  return {
    id: r.id,
    name: r.name ?? undefined,
    geometry: r.geometry as LocationArea['geometry'],
    bounds: (r.bounds as LocationArea['bounds']) ?? undefined,
    googlePlaceInfo: r.googlePlaceInfo as LocationArea['googlePlaceInfo'],
  };
}

function locationAreaToLocationInsertRow(
  bankId: string,
  area: LocationArea & { bankId?: string },
) {
  return {
    id: area.id,
    bankId,
    geometry: area.geometry,
    bounds: area.bounds ?? null,
    name: area.name ?? null,
    googlePlaceInfo: area.googlePlaceInfo ?? null,
  };
}

export default inject(
  ['PlacesApiService', 'DrizzlePg', 'Tracer'],
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
