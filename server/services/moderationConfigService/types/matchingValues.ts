import { type ReadonlyDeep } from 'type-fest';

import { type LocationArea } from './locationArea.js';

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

export function isLocationArea(
  it: string | null | LocationArea,
): it is LocationArea {
  return typeof it === 'object' && it != null && 'geometry' in it;
}
