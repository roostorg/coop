import { Client } from '@googlemaps/google-maps-services-js';

import { inject } from '../../iocContainer/index.js';

class PlacesApiService {
  private readonly client = new Client({});

  async lookupPlaceId(placeId: string) {
    const requestParams = {
      params: {
        place_id: placeId,
        key: String(process.env.GOOGLE_PLACES_API_KEY),
      },
    };

    const [details, geocode] = await Promise.all([
      this.client.placeDetails(requestParams),
      this.client.geocode(requestParams),
    ]);

    const confirmedPlace = details.data.result;
    const confirmedGeocode = geocode.data.results[0];

    // Checking !confirmedPlace is just to be defensive,
    // in case the types in the maps SDK are a bit wrong.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!confirmedPlace || confirmedPlace.place_id !== placeId) {
      throw new Error('Could not find expected place.');
    }

    const name = confirmedPlace.name ?? confirmedPlace.formatted_address;

    // If we get here, which we don't expect to, throw so we can log + investigate.
    if (!name) {
      throw new Error('All google places are expected to have a name.');
    }

    const bounds = (() => {
      if (!confirmedGeocode.geometry.bounds) {
        return undefined;
      }

      const { northeast, southwest } = confirmedGeocode.geometry.bounds;
      return { northeastCorner: northeast, southwestCorner: southwest };
    })();

    return {
      id: placeId,
      name: confirmedPlace.name!,
      geometry: { center: confirmedGeocode.geometry.location },
      ...(bounds ? { bounds } : {}),
      details: confirmedPlace,
      geocode: confirmedGeocode,
    };
  }
}

export default inject([], PlacesApiService);
export { type PlacesApiService };
