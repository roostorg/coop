import Geohash from 'latlon-geohash';

import {
  GQLLocationArea,
  GQLLocationAreaInput,
  GQLLocationBank,
} from '../graphql/generated';
import { stripTypename, WithoutTypename } from '../graphql/inputHelpers';
import { safePick } from '../utils/misc';

export type LatLng = {
  lat: number;
  lng: number;
};

export type LocationWithRadius = {
  center: LatLng;
  radius: number;
};

export type LocationArea = WithoutTypename<GQLLocationArea>;

export type GooglePlace = LocationArea & {
  googlePlaceInfo: Exclude<LocationArea['googlePlaceInfo'], null | undefined>;
  name: string;
};

export type GQLGooglePlaceLocationAreaInput = GQLLocationAreaInput & {
  googlePlaceId: string;
};

export type LocationBank = {
  id: string;
  name: string;
  description?: string;
  locations: LocationArea[];
};

export type LocationAreaOrBank = LocationArea | LocationBank;
export type LocationGeometry = Pick<LocationArea, 'geometry'>;

export type LocationFormLocation = {
  id?: string;
  bounds?: {
    northeastCorner: LatLng;
    southwestCorner: LatLng;
  } | null;
  name?: string | null;
  googlePlaceId?: string | null;
  geometry: LocationWithRadius;
};

export function isGooglePlaceLocationAreaInput(
  it: GQLLocationAreaInput,
): it is GQLGooglePlaceLocationAreaInput {
  return Boolean(it.googlePlaceId);
}

export function areLocationGeometriesEqual(
  geo1: LocationGeometry,
  geo2: LocationGeometry,
) {
  return (
    arePointsEqual(geo1.geometry.center, geo2.geometry.center) &&
    geo1.geometry.radius === geo2.geometry.radius
  );
}

function arePointsEqual(a: LatLng, b: LatLng) {
  return a.lat === b.lat && a.lng === b.lng;
}

export function areLocationAreasEqual(
  loc1: Pick<LocationArea, 'bounds' | 'geometry'>,
  loc2: Pick<LocationArea, 'bounds' | 'geometry'>,
) {
  if (loc1.bounds && loc2.bounds) {
    return (
      arePointsEqual(
        loc1.bounds.northeastCorner,
        loc2.bounds.northeastCorner,
      ) &&
      arePointsEqual(loc1.bounds.southwestCorner, loc2.bounds.southwestCorner)
    );
  } else {
    return areLocationGeometriesEqual(loc1, loc2);
  }
}

export function getLocationBankDisplayName(it: Pick<GQLLocationBank, 'name'>) {
  return `Bank: ${it.name}`;
}

export function getLocationDisplayName(
  location: WithoutTypename<Pick<GQLLocationArea, 'name' | 'geometry'>>,
) {
  return (
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    location.name ||
    (() => {
      const { center, radius } = location.geometry;
      const geohash = Geohash.encode(center.lat, center.lng);
      const radiusUnit = radius === 1 ? 'mile' : 'miles';
      return `${radius} ${radiusUnit} from geohash: ${geohash}`;
    })()
  );
}

export function locationAreaToLocationAreaInput(
  location: Pick<
    WithoutTypename<GQLLocationArea>,
    'name' | 'bounds' | 'geometry' | 'googlePlaceInfo'
  >,
): GQLLocationAreaInput {
  return {
    ...stripTypename(safePick(location, ['bounds', 'geometry', 'name'])),
    googlePlaceId: location.googlePlaceInfo?.id,
  };
}
