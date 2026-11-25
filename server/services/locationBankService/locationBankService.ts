import { type Exception } from '@opentelemetry/api';
import { type Kysely } from 'kysely';
import { uid } from 'uid';
import { v1 as uuidV1 } from 'uuid';

import { type Dependencies } from '../../iocContainer/index.js';
import { inject } from '../../iocContainer/utils.js';
import { makeNotFoundError } from '../../utils/errors.js';
import { isUniqueViolationError } from '../../utils/kysely.js';
import {
  makeKyselyTransactionWithRetry,
  type KyselyTransactionWithRetry,
} from '../../utils/kyselyTransactionWithRetry.js';
import { safePick } from '../../utils/misc.js';
import {
  makeLocationBankNameExistsError,
  type LocationArea,
} from '../moderationConfigService/index.js';
import { type PlacesApiService } from '../placesApiService/index.js';
import {
  LocationBankRepository,
  type LocationBank,
  type LocationBankPg,
} from './locationBankRepository.js';

type LatLng = { lat: number; lng: number };

/** A location as a user enters it: coordinates, optionally a Google place. */
export type LocationAreaInput = {
  name?: string | null;
  bounds?: { northeastCorner: LatLng; southwestCorner: LatLng } | null;
  geometry: { center: LatLng; radius: number };
  googlePlaceId?: string | null;
};

export class LocationBankService {
  readonly #repo: LocationBankRepository;
  readonly #replicaRepo: LocationBankRepository;
  readonly #transaction: KyselyTransactionWithRetry<LocationBankPg>;

  constructor(
    db: Kysely<LocationBankPg>,
    replica: Kysely<LocationBankPg>,
    private readonly placesApi: PlacesApiService,
    private readonly tracer: Dependencies['Tracer'],
  ) {
    this.#repo = new LocationBankRepository(db);
    this.#replicaRepo = new LocationBankRepository(replica);
    this.#transaction = makeKyselyTransactionWithRetry(db);
  }

  async getBank(orgId: string, id: string): Promise<LocationBank> {
    const bank = await this.#repo.findById(orgId, id);
    if (bank === undefined) {
      throw makeNotFoundError('Location bank not found', {
        shouldErrorSpan: true,
      });
    }
    return bank;
  }

  async listBanks(orgId: string) {
    return this.#repo.listForOrg(orgId);
  }

  async getLocations(
    orgId: string,
    bankIds: readonly string[],
    opts: { readFromReplica?: boolean } = {},
  ) {
    const repo = opts.readFromReplica ? this.#replicaRepo : this.#repo;
    return repo.findLocations(orgId, bankIds);
  }

  async createBank(input: {
    orgId: string;
    ownerId: string;
    name: string;
    description?: string | null;
    locations: readonly LocationAreaInput[];
  }) {
    // Google is called before the transaction, so a retried transaction
    // doesn't call it again.
    const locations = await this.#expandLocationInputs(input.locations);
    return this.#mapNameConflict(async () =>
      this.#transaction(async (trx) => {
        const repo = this.#repo.withExecutor(trx);
        const bank = await repo.insert({
          id: uid(),
          orgId: input.orgId,
          ownerId: input.ownerId,
          name: input.name,
          description: input.description ?? null,
        });
        await repo.addLocations(bank, locations);
        return bank;
      }),
    );
  }

  async updateBank(input: {
    orgId: string;
    id: string;
    name?: string | null;
    description?: string | null;
    locationsToAdd?: readonly LocationAreaInput[] | null;
    locationsToDelete?: readonly string[] | null;
  }) {
    const { name } = input;
    if (name === null) {
      throw new Error('Cannot clear bank name.');
    }
    const locationsToAdd = await this.#expandLocationInputs(
      input.locationsToAdd ?? [],
    );
    return this.#mapNameConflict(async () =>
      this.#transaction(async (trx) => {
        const repo = this.#repo.withExecutor(trx);
        const bank = await repo.update(input.orgId, input.id, {
          name,
          description: input.description,
        });
        if (bank === undefined) {
          throw makeNotFoundError('Location bank not found', {
            shouldErrorSpan: true,
          });
        }
        await repo.deleteLocations(bank, input.locationsToDelete ?? []);
        await repo.addLocations(bank, locationsToAdd);
        return bank;
      }),
    );
  }

  async deleteBank(orgId: string, id: string): Promise<boolean> {
    try {
      return await this.#transaction(async (trx) =>
        this.#repo.withExecutor(trx).delete(orgId, id),
      );
    } catch (exception) {
      const activeSpan = this.tracer.getActiveSpan();
      if (activeSpan?.isRecording()) {
        activeSpan.recordException(exception as Exception);
      }
      return false;
    }
  }

  async #mapNameConflict<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (e: unknown) {
      throw isUniqueViolationError(e)
        ? makeLocationBankNameExistsError({ shouldErrorSpan: true })
        : e;
    }
  }

  async #expandLocationInputs(inputs: readonly LocationAreaInput[]) {
    return Promise.all(
      inputs.map(async (input) =>
        locationAreaInputToLocationAreaWithGooglePlaceData(
          this.placesApi.lookupPlaceId.bind(this.placesApi),
          input,
        ),
      ),
    );
  }
}

export default inject(
  ['KyselyPg', 'KyselyPgReadReplica', 'PlacesApiService', 'Tracer'],
  LocationBankService,
);

/**
 * Returns a LocationArea based on a user-provided input. Existing
 * LocationAreas are never edited (only deleted and recreated), so every input
 * gets a new id: a uuid, which is unique wherever the LocationArea is stored.
 *
 * The result has no detailed Google place info, only the submitted place id;
 * see {@link locationAreaInputToLocationAreaWithGooglePlaceData} for that.
 */
export function locationAreaInputToLocationArea(
  it: LocationAreaInput,
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
  locationInput: LocationAreaInput,
): Promise<LocationArea> {
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
