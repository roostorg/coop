import { ScalarTypes } from '@roostorg/types';
import Geohash from 'latlon-geohash';

import { isLocationArea } from '../../../models/rules/matchingValues.js';
import { type LocationArea } from '../../../models/types/locationArea.js';
import { SignalPricingStructure as SignalPricingStructureType } from '../types/SignalPricingStructure.js';
import { SignalType } from '../types/SignalType.js';
import SignalBase, { type SignalInput } from './SignalBase.js';

const MILES_RADIUS = 3959;
// const KM_RADIUS = 6371;

export default class GeoContainedWithinSignal extends SignalBase<
  ScalarTypes['GEOHASH'],
  { scalarType: ScalarTypes['BOOLEAN'] },
  LocationArea
> {
  override get id() {
    return { type: SignalType.GEO_CONTAINED_WITHIN };
  }

  override get supportedLanguages() {
    return 'ALL' as const;
  }

  override get displayName() {
    return 'Is location in';
  }

  override get description() {
    return (
      'Returns whether the input geohash is contained in any ' +
      'geographic area from the matching values.'
    );
  }

  get pricingStructure(): SignalPricingStructureType {
    return SignalPricingStructureType.FREE;
  }

  override get eligibleInputs() {
    return [ScalarTypes.GEOHASH];
  }

  override async getDisabledInfo() {
    return { disabled: false as const };
  }

  override getCost() {
    // TODO - make the cost dependent on the size of the location bank
    // For now, this cost is >1 because some users have large banks.
    return 5;
  }

  override get allowedInAutomatedRules() {
    return true;
  }

  override get docsUrl() {
    return null;
  }

  override get recommendedThresholds() {
    return null;
  }

  override get needsActionPenalties() {
    return false;
  }

  override get integration() {
    return null;
  }

  override get needsMatchingValues() {
    return true as const;
  }

  override get eligibleSubcategories() {
    return [];
  }

  override get outputType() {
    return { scalarType: ScalarTypes.BOOLEAN };
  }

  async run(
    input: SignalInput<ScalarTypes['GEOHASH'], true, boolean, LocationArea>,
  ) {
    const inputHash = input.value.value;
    const inputPoint = Geohash.decode(inputHash);
    // Some legacy conditions still have a list of geohash strings in their
    // matchingValues, so we have to filter those out below.
    //
    // TODO: Even though the types here say that input.matchingValues must be a
    // LocationArea[] -- which is logically correct, as a simple string geohash,
    // with no radius, doesn't represent an area, and we can't sensibly compute
    // whether the input is "contained within" a point -- we don't actually have
    // a runtime representation (let alone validation) of a signal's legal
    // matchingValues types.  Instead, right now, it just falls to the frontend
    // to only offer sensible options for matchingValues. That's how these
    // legacy geohash strings can slip in. So, the TODO here is to eventually
    // add a `getValidMatchingValuesTypes(): MatchingValueKind[]` method on
    // `SignalBase`, which could be used for runtime validation (in the signal
    // execution service) and might replace `needsMatchingValues()`.
    const firstMatch = input.matchingValues.find(
      (it) => isLocationArea(it) && pointIsInLocationArea(inputPoint, it),
    );

    // Derive the returned matchedValue string from the first match, or, if
    // there was no match, from the first LocationArea in the matchingValues.
    // This logic doesn't make much sense, probably, but is here for back
    // compat. NB: duplicated isLocationArea check here is important for
    // performance; see git history.
    const matchedValueSource =
      firstMatch ?? input.matchingValues.find((it) => isLocationArea(it));

    return {
      score: Boolean(firstMatch), // return true iff there was a match.
      matchedValue: matchedValueSource
        ? getLocationDisplayName(matchedValueSource)
        : 'Unknown',
      outputType: { scalarType: ScalarTypes.BOOLEAN },
    };
  }
}

function getLocationDisplayName(location: LocationArea) {
  if (location.name) {
    return location.name;
  } else {
    const { center, radius } = location.geometry;
    const geohash = Geohash.encode(center.lat, center.lng);
    const radiusUnit = radius === 1 ? 'mile' : 'miles';
    return `${radius} ${radiusUnit} from geohash: ${geohash}`;
  }
}

/**
 * NB: this is very hot-path code that consumes a decent amount of our prod CPU
 * usage, so be very careful about changing it in any way that might cause a
 * performance regression.
 */
function pointIsInLocationArea(
  point: { lat: number; lon: number },
  location: LocationArea,
) {
  const { lat, lon } = point;
  const bounds = location.bounds;

  if (bounds) {
    const { southwestCorner, northeastCorner } = bounds;
    return (
      lat > southwestCorner.lat &&
      lon > southwestCorner.lng &&
      lat < northeastCorner.lat &&
      lon < northeastCorner.lng
    );
  }

  const { center, radius } = location.geometry;
  return (
    radius >
    distanceBetweenCoordinates(
      point,
      { lat: center.lat, lon: center.lng },
      MILES_RADIUS,
    )
  );
}

// TODO: when we introduce kilometers as an option, uncomment this
// function geohashDistanceInKm(firstHash: string, secondHash: string) {
//   const loc1 = Geohash.decode(firstHash);
//   const loc2 = Geohash.decode(secondHash);
//   return distanceBetweenCoordinates(loc1, loc2, KM_RADIUS);
// }

// function geohashDistanceInMiles(firstHash: string, secondHash: string) {
//   const loc1 = Geohash.decode(firstHash);
//   const loc2 = Geohash.decode(secondHash);
//   return distanceBetweenCoordinates(loc1, loc2, MILES_RADIUS);
// }

function degreesToRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

function distanceBetweenCoordinates(
  loc1: Geohash.Point,
  loc2: Geohash.Point,
  radius: number,
) {
  const dLat = degreesToRadians(loc2.lat - loc1.lat);
  const dLon = degreesToRadians(loc2.lon - loc1.lon);

  const lat1 = degreesToRadians(loc1.lat);
  const lat2 = degreesToRadians(loc2.lat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return radius * c;
}
