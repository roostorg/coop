import difference from 'lodash/difference';
import random from 'lodash/random';

import { GooglePlace, LocationGeometry } from '../models/locationBank';
import { getChangeset } from './collections';

function createGooglePlaces(num: number = 1): GooglePlace[] {
  return Array(num)
    .fill(num)
    .map(() => {
      return {
        id: 'test',
        name: 'Place Name',
        googlePlaceInfo: { id: 'testGooglePlaceInfo' },
        ...createLocationGeometries(1)[0],
      };
    });
}

function createLocationGeometries(num: number = 1): LocationGeometry[] {
  return Array(num)
    .fill(num)
    .map(() => {
      return {
        geometry: {
          center: { lat: random(-90, 90), lng: random(0, 180) },
          radius: random(0, 100),
        },
      };
    });
}
describe('Collections tests', () => {
  describe('Changeset tests', () => {
    it('Value equality', () => {
      const itemOne = { a: true };
      const itemTwo = { a: true };
      expect(getChangeset([itemOne], [itemTwo])).toMatchObject({
        added: [],
        removed: [],
      });
    });
    it('Old array empty', () => {
      const oldLocations = [] as any[];
      const newLocations = createGooglePlaces(2);
      expect(getChangeset(oldLocations, newLocations)).toMatchObject({
        added: newLocations,
        removed: [],
      });
    });
    it('New array empty', () => {
      const oldLocations = createGooglePlaces(2);
      const newLocations = [] as any[];
      expect(getChangeset(oldLocations, newLocations)).toMatchObject({
        added: [],
        removed: oldLocations,
      });
    });
    it('Add objects', () => {
      const oldLocations = createGooglePlaces(2);
      const newLocations = oldLocations.concat(createGooglePlaces(2));
      expect(getChangeset(oldLocations, newLocations)).toMatchObject({
        added: difference(newLocations, oldLocations),
        removed: [],
      });
    });
    it('Remove objects', () => {
      const oldLocations = createGooglePlaces(4);
      const newLocations = oldLocations.slice(0, 2);
      expect(getChangeset(oldLocations, newLocations)).toMatchObject({
        added: [],
        removed: difference(oldLocations, newLocations),
      });
    });
    it('Add and remove objects', () => {
      const oldLocations = createGooglePlaces(4);
      const newLocations = oldLocations
        .slice(0, 2)
        .concat(createGooglePlaces(2));
      expect(getChangeset(oldLocations, newLocations)).toMatchObject({
        added: difference(newLocations, oldLocations),
        removed: difference(oldLocations, newLocations),
      });
    });
  });
});
