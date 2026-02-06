import { type Exception } from '@opentelemetry/api';
import { DataSource } from 'apollo-datasource';
import { uid } from 'uid';
import { v1 as uuidV1 } from 'uuid';

import { inject, type Dependencies } from '../../iocContainer/index.js';
import { type LocationBank as TLocationBank } from '../../models/banks/LocationBankModel.js';
import { isUniqueConstraintError } from '../../models/errors.js';
import { type LocationArea } from '../../models/types/locationArea.js';
import { type User } from '../../models/UserModel.js';
// TODO: delete the import below when we move the location bank mutation logic
// into the moderation config service, which is where it should be.
// eslint-disable-next-line import/no-restricted-paths
import { makeLocationBankNameExistsError } from '../../services/moderationConfigService/moderationConfigService.js';
import { type PlacesApiService } from '../../services/placesApiService/index.js';
import { patchInPlace, safePick } from '../../utils/misc.js';
import {
  type GQLCreateLocationBankInput,
  type GQLLocationAreaInput,
  type GQLUpdateLocationBankInput,
} from '../generated.js';

// NB: this is the type that our GQL resolvers for a location bank rely on
// getting as the parent object. (I.e., we don't promise the location bank field
// resolvers that they'll be able to see the fullPlacesApiResponse).
export type LocationBankWithoutFullPlacesAPIResponse = Omit<
  TLocationBank,
  'fullPlacesApiResponse'
>;

class LocationBankAPI extends DataSource {
  private lookupPlaceId: PlacesApiService['lookupPlaceId'];
  constructor(
    placesApiService: PlacesApiService,
    private readonly sequelize: Dependencies['Sequelize'],
    private readonly tracer: Dependencies['Tracer'],
  ) {
    super();
    this.lookupPlaceId = placesApiService.lookupPlaceId.bind(placesApiService);
  }

  async getGraphQLLocationBankFromId(opts: { id: string; orgId: string }) {
    const { id, orgId } = opts;
    return this.sequelize.LocationBank.findOne({
      where: { id, orgId },
      rejectOnEmpty: true,
      attributes: { exclude: ['fullPlacesApiResponses'] },
    }) as Promise<LocationBankWithoutFullPlacesAPIResponse>;
  }

  async getGraphQLLocationBanksForOrg(orgId: string) {
    return this.sequelize.LocationBank.findAll({
      where: { orgId },
      attributes: { exclude: ['fullPlacesApiResponses'] },
    }) as Promise<LocationBankWithoutFullPlacesAPIResponse[]>;
  }

  async createLocationBank(input: GQLCreateLocationBankInput, user: User) {
    const { name, description, locations: locationInputs } = input;
    const { orgId, id: ownerId } = user;

    const newBankId = uid();
    const locations = this.sequelize.LocationBankLocation.bulkBuild(
      await this.expandLocationAreaInputs(newBankId, locationInputs),
    );

    try {
      return await this.sequelize.transactionWithRetry(async () => {
        const bank = this.sequelize.LocationBank.build(
          {
            id: newBankId,
            name,
            description,
            ownerId,
            orgId,
            locations,
          },
          {
            include: [
              { model: this.sequelize.LocationBankLocation, as: 'locations' },
            ],
          },
        );

        await bank.save();

        return bank;
      });
    } catch (e: unknown) {
      throw isUniqueConstraintError(e)
        ? makeLocationBankNameExistsError({ shouldErrorSpan: true })
        : e;
    }
  }

  async updateLocationBank(input: GQLUpdateLocationBankInput, orgId: string) {
    const { id, name, description, locationsToAdd, locationsToDelete } = input;

    const expandedLocationsToAdd = locationsToAdd?.length
      ? await this.expandLocationAreaInputs(id, locationsToAdd)
      : undefined;

    const bank = await this.sequelize.LocationBank.findOne({
      where: { id, orgId },
      rejectOnEmpty: true,
    });

    // Name can be missing in the input object (in which case it'll be
    // undefined), but it can't be present + null (which would normally have the
    // semantic of trying to unset the name, which is invalid b/c name is
    // required).
    if (name === null) {
      throw new Error('Cannot clear bank name.');
    }

    patchInPlace(bank, {
      name,
      description: description ?? undefined,
    });

    try {
      return await this.sequelize.transactionWithRetry(async () => {
        await bank.save();
        await Promise.all([
          locationsToDelete?.length &&
            this.sequelize.LocationBankLocation.destroy({
              where: {
                id: locationsToDelete,
                bankId: bank.id,
              },
            }),
          expandedLocationsToAdd
            ? this.sequelize.LocationBankLocation.bulkCreate(
                expandedLocationsToAdd,
              )
            : null,
        ]);
        return bank;
      });
    } catch (e: unknown) {
      throw isUniqueConstraintError(e)
        ? makeLocationBankNameExistsError({ shouldErrorSpan: true })
        : e;
    }
  }

  async deleteLocationBank(opts: { id: string; orgId: string }) {
    const { id, orgId } = opts;

    try {
      const bank = await this.sequelize.LocationBank.findOne({
        where: { id, orgId },
      });
      await bank?.destroy();
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

export default inject(
  ['PlacesApiService', 'Sequelize', 'Tracer'],
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
