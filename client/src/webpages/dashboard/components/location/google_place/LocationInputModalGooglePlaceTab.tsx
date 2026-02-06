import { LocationFormLocation } from '../../../../../models/locationBank';
import { locationSectionHeader } from '../LocationInputModal';
import GooglePlaceInput from './GooglePlaceInput';

export default function LocationInputModalGooglePlaceTab(props: {
  locations: readonly LocationFormLocation[] | undefined;
  addPlace: (place: LocationFormLocation) => void;
  removePlace: (place: LocationFormLocation) => void;
}) {
  const { locations, addPlace, removePlace } = props;
  return (
    <div className="my-3 text-sm">
      {locationSectionHeader(
        "Search for the name of the location you'd like to select. " +
          "This search box uses Google's Maps API, so you can search for " +
          'locations the same way you would on Google Maps.',
      )}
      <GooglePlaceInput
        locations={locations ?? []}
        addPlace={addPlace}
        removePlace={removePlace}
      />
    </div>
  );
}
