import { Button, Input } from 'antd';
import { useCallback, useEffect, useState } from 'react';

import ComponentLoading from '../../../../../components/common/ComponentLoading';

import PoweredByGoogle from '../../../../../images/PoweredByGoogle.png';
import {
  isGooglePlaceLocationAreaInput,
  LocationFormLocation,
} from '../../../../../models/locationBank';
import { useMapsApi } from '../../../../../utils/useMapsApis';
import TextToken from '../../TextToken';
import { locationSectionHeader } from '../LocationInputModal';

export default function GooglePlaceInput(props: {
  locations: readonly LocationFormLocation[];
  addPlace: (place: LocationFormLocation) => void;
  removePlace: (place: LocationFormLocation) => void;
}) {
  const { locations, addPlace, removePlace } = props;
  const mapsApi = useMapsApi();
  const [place, setPlace] = useState<string | undefined>(undefined);
  const [radius, setRadius] = useState(0);

  const { autocompleteService, geocoderService } =
    mapsApi.type === 'LOADED'
      ? mapsApi
      : { autocompleteService: null, geocoderService: null };

  const [placePredictions, setPlacePredictions] = useState<
    google.maps.places.AutocompletePrediction[]
  >([]);

  // If constructing a location is a multi-step process (i.e. the
  // user needs to manually input a radius), we build up the
  // location object in two parts. So we have to store a partially
  // constructed location while we construct the rest.
  // TODO: fix types so we're not forced to put a zero radius before we have a real one.
  const [partialLocation, setPartialLocation] = useState<
    LocationFormLocation | undefined
  >(undefined);

  const locationIsComplete = Boolean(
    partialLocation?.bounds ?? partialLocation?.geometry.radius,
  );

  const radiusFieldVisible = partialLocation && !locationIsComplete;

  // When the location state changes, we have to decide if it's complete yet
  // (in which case we call addPlace and reset for the next location). If it
  // isn't, the form will show the radius picker.
  useEffect(() => {
    if (locationIsComplete) {
      addPlace(partialLocation!);
      setPartialLocation(undefined);
    }
  }, [locationIsComplete, partialLocation, addPlace]);

  const fetchSuggestions = useCallback(
    (input: string) => {
      const minLengthAutocomplete = 3;
      if (input.length < minLengthAutocomplete) {
        setPlacePredictions([]);
        return;
      }

      autocompleteService?.getPlacePredictions({ input }, (predictions) => {
        setPlacePredictions(predictions ?? []);
      });
    },
    [autocompleteService],
  );

  const acceptPrediction = (
    prediction: google.maps.places.AutocompletePrediction,
  ) => {
    if (
      locations?.some(
        (location) =>
          location.googlePlaceId &&
          location.googlePlaceId === prediction.place_id,
      )
    ) {
      return;
    }

    geocoderService?.geocode(
      { placeId: prediction.place_id },
      (geocodeResults, status) => {
        if (
          status !== google.maps.GeocoderStatus.OK ||
          !geocodeResults?.length
        ) {
          return;
        }

        const {
          geometry: { location, bounds },
        } = geocodeResults[0];

        const northeast = bounds?.getNorthEast();
        const southwest = bounds?.getSouthWest();

        setPartialLocation({
          googlePlaceId: prediction.place_id,
          name: prediction.description,
          geometry: {
            center: { lat: location.lat(), lng: location.lng() },
            radius: 0, // Dummy value because geometry isn't used when we have bounds.
          },
          bounds:
            northeast && southwest
              ? {
                  northeastCorner: {
                    lat: northeast.lat(),
                    lng: northeast.lng(),
                  },
                  southwestCorner: {
                    lat: southwest.lat(),
                    lng: southwest.lng(),
                  },
                }
              : undefined,
        });
        setPlacePredictions([]);
      },
    );
  };

  const googlePlaces = locations?.filter(isGooglePlaceLocationAreaInput);

  const onAddRadius = (radius: number) => {
    setPartialLocation({
      ...partialLocation!,
      geometry: { ...partialLocation!.geometry, radius },
    });
  };

  if (mapsApi.type === 'ERROR') {
    throw mapsApi.error;
  }

  if (mapsApi.type === 'LOADING') {
    return <ComponentLoading />;
  }

  return (
    <div className="flex flex-col mt-3">
      <Input
        placeholder="Search for a location..."
        allowClear
        onChange={(event) => {
          setPlace(event.target.value);
          fetchSuggestions(event.target.value);
        }}
        value={place}
      />
      {placePredictions?.length > 0 && (
        <div className="flex flex-col -mt-2 overflow-hidden border border-t-0 border-solid rounded-b-lg shadow border-slate-300">
          {/* This is used to make the side borders extend up into the input field */}
          <div className="h-2 -z-50" />
          {placePredictions.map((prediction) => (
            <div
              key={prediction.place_id}
              className="p-2 text-slate-400 text-start cursor-pointer hover:bg-[#e9f6fe]"
              onClick={() => {
                setPlace(prediction.description);
                acceptPrediction(prediction);
              }}
            >
              {prediction.description}
            </div>
          ))}
          <div className="flex justify-end m-2">
            <img src={PoweredByGoogle} alt="Logo" width="108" height="12" />
          </div>
        </div>
      )}
      {radiusFieldVisible ? (
        <>
          {/* When 'bounds' can't be found for a Google Place, we need to ask
                the user for a radius to assign to the Place */}
          {locationSectionHeader(
            'Unfortunately, Google Maps does not have precise information ' +
              "about the size and borders of this location. So you'll have to " +
              "provide your own radius. We'll use this as our search radius " +
              'when determining whether a user is in this location.',
          )}
          <div className="flex items-center text-base gap-4">
            <div className="font-semibold shrink-0">
              <span className="text-red-500">*</span> Radius (in miles):
            </div>
            <div className="w-1/12">
              <Input
                type="number"
                onChange={(e) => setRadius(parseFloat(e.target.value))}
              />
            </div>
            <div className="flex justify-end">
              <Button type="default" onClick={() => onAddRadius(radius)}>
                Add Radius
              </Button>
            </div>
          </div>
        </>
      ) : null}
      {googlePlaces.length > 0 ? (
        <div>
          <div className="divider" />
          <div className="mt-4 font-medium">Selected Locations</div>
          <div className="flex flex-wrap p-1 my-2 border border-solid rounded shadow border-slate-200 bg-slate-100">
            {googlePlaces.map((place) => (
              <TextToken
                title={place.name ?? `Google place ${place.googlePlaceId}`}
                key={place.googlePlaceId}
                onDelete={() => removePlace(place)}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
