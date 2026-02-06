import { Loader } from '@googlemaps/js-api-loader';
import { useEffect, useState } from 'react';

// TODO: use Webpack define plugin to make this more-dynamically bundled in.
// The key should be available at build time in process.env.GOOGLE_PLACES_API_KEY
// It's not a secret key, though, so hardcoding it is fine.
const placesApiKey = process.env.GOOGLE_PLACES_API_KEY ?? '';

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
      new Loader({ apiKey: placesApiKey, libraries: ['places'] }).load().then(
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
