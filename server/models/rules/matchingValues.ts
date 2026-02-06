import { type ReadonlyDeep } from 'type-fest';

import { type LocationArea } from '../types/locationArea.js';

export enum MatchingValueType {
  STRING = 'STRING',
  TEXT_BANK = 'TEXT_BANK',
  LOCATION = 'LOCATION',
  LOCATION_BANK = 'LOCATION_BANK',
  IMAGE_BANK = 'IMAGE_BANK',
}

// TODO: Eventually, we probably don't wanna allow undefined or null for each of
// these keys, but these types reflect the reality of what we've historically
// saved in the db.
export type MatchingValues = {
  strings?: readonly string[] | null;
  textBankIds?: readonly string[] | null;
  locations?: readonly ReadonlyDeep<LocationArea>[] | null;
  locationBankIds?: readonly string[] | null;
  imageBankIds?: readonly string[] | null;
};

export function getMatchingValuesType(matchingValues?: MatchingValues) {
  if (!matchingValues) {
    return undefined;
  }
  if (matchingValues.strings?.length) {
    return MatchingValueType.STRING;
  }
  if (matchingValues.textBankIds?.length) {
    return MatchingValueType.TEXT_BANK;
  }
  if (matchingValues.locations?.length) {
    return MatchingValueType.LOCATION;
  }
  if (matchingValues.locationBankIds?.length) {
    return MatchingValueType.LOCATION_BANK;
  }
  if (matchingValues.imageBankIds?.length) {
    return MatchingValueType.IMAGE_BANK;
  }
  return undefined;
}

export function isLocationArea(
  it: string | null | LocationArea,
): it is LocationArea {
  return typeof it === 'object' && it != null && 'geometry' in it;
}
