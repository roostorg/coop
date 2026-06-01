import { Loader } from '@googlemaps/js-api-loader';
import { useEffect, useState } from 'react';

import { GOOGLE_PLACES_API_KEY } from '../lib/config';

// Use this variable to not load the Google APIs twice.
let placesApiLoaded = false;

export function useMapsApi() {
  const [mapsApi, setMapsApi] = useState<
    | {
        type: 'LOADED';
        autocompleteService: google.maps.places.AutocompleteService;
        geocoderService: google.maps.Geocoder;
      }
    | { type: 'LOADING' }
    | { type: 'ERROR'; error: Error }
  >({ type: 'LOADING' });

  useEffect(() => {
    if (placesApiLoaded) {
      setMapsApi({
        type: 'LOADED',
        autocompleteService: new google.maps.places.AutocompleteService(),
        geocoderService: new google.maps.Geocoder(),
      });
    } else {
      new Loader({
        apiKey: GOOGLE_PLACES_API_KEY,
        libraries: ['places'],
      })
        .load()
        .then(
          () => {
            placesApiLoaded = true;
            setMapsApi({
              type: 'LOADED',
              autocompleteService: new google.maps.places.AutocompleteService(),
              geocoderService: new google.maps.Geocoder(),
            });
          },
          (e: Error) => {
            setMapsApi({ type: 'ERROR', error: e });
          },
        );
    }
  }, []);

  return mapsApi;
}
