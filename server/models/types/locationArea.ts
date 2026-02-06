import {
  type GeocodeResult,
  type PlaceData,
} from '@googlemaps/google-maps-services-js';

type LatLng = { lat: number; lng: number };

// A LocationArea describes the data that we store to represent a location,
// whether in a Location Bank or directly in a rule's conditions. As the name
// implies, a LocationArea is an area (not a point).
export type LocationArea = {
  id: string;
  name?: string;

  // The perimeter of our location area is given either as a center + a radius,
  // or as a rectangle with two corner points. Ideally, the `geometry` key would
  // be a union reflecting these two core ways of defining the area, i.e.:
  //
  // type LocationArea = {
  //   geometry:
  //     | { type: "circle", center: LatLng, radius: number }
  //     | { type: "rectangle", northeastCorner: LatLng; southwestCorner: LatLng };
  // }
  //
  // For legacy reasons, though, we put the rectangular verion in a separate
  // key, called `bounds`, which can only arise from querying the Google Places
  // API; i.e., manual location entries are always submitted with a center and
  // radius. However, Google does not return bounds for all searches, and Google
  // never returns a radius, so, even for Google-based locations, when bounds
  // are not returned, we collect the radius manually from the user (to combine
  // with the center returned by google).
  //
  // The correct typing for a LocationArea, then, would have radius as missing
  // when bounds are present, and radius as present when bounds are missing.
  // However, we can't do that yet, because we've been a little sloppy here and
  // have stored the `geometry` key even when we also have bounds. (The frontend
  // sends 0 as the radius in this case.)
  geometry: { center: LatLng; radius: number };
  bounds?: { northeastCorner: LatLng; southwestCorner: LatLng } | null;

  // NB: this type doesn't come straight from the GooglePlacesApiService, even
  // though that's the service that populates this value now, because there are
  // some legacy cases where the types from that service don't match what's in
  // the db (e.g., where `geocode` or `details` is present, but not the other),
  // and because we're making some effort here to make the types intentionally a
  // bit wider than normal (e.g., allowing undefined and null) to accomodate a
  // lot of subtle variation that's likely to get introduced in practice because
  // we're storing this value in a free-form json blob.
  googlePlaceInfo?: {
    id: string;
    geocode?: GeocodeResult | null;
    details?: Partial<PlaceData> | null;
  } | null;
};

export type LocationGeometry = Pick<LocationArea, 'geometry'>;
