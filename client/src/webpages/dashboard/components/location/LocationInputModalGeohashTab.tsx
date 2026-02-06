import { Input } from 'antd';
import Geohash from 'latlon-geohash';
import { useState } from 'react';

import {
  getLocationDisplayName,
  LocationFormLocation,
} from '../../../../models/locationBank';
import CoopButton from '../CoopButton';
import TextToken from '../TextToken';
import { locationSectionHeader } from './LocationInputModal';

type GeohashLocationInput = {
  geohash?: string;
  radius?: string;
};

export default function LocationInputModalGeohashTab(props: {
  locations: readonly LocationFormLocation[] | undefined;
  addLocation: (location: LocationFormLocation) => void;
  removeLocation: (location: LocationFormLocation) => void;
}) {
  const { locations, addLocation, removeLocation } = props;
  const [error, setError] = useState(false);

  const [location, setLocation] = useState<GeohashLocationInput | undefined>(
    undefined,
  );

  const locationInput = (
    <div className="flex gap-4">
      <div className="flex flex-col items-stretch flex-grow">
        <div className="mb-2 text-base">Geohash</div>
        <Input
          placeholder="9q9hgv"
          value={location?.geohash}
          onChange={(event) => {
            setError(false);
            setLocation({ ...location, geohash: event.target.value });
          }}
        />
      </div>
      <div className="flex flex-col items-stretch flex-grow">
        <div className="mb-2 text-base">Radius (in miles)</div>
        <Input
          placeholder="2"
          value={location?.radius}
          onChange={(event) => {
            setLocation({ ...location, radius: event.target.value });
          }}
        />
      </div>
      <div className="self-end">
        <CoopButton
          title="Add"
          size="small"
          disabled={!location || !location.geohash || !location.radius}
          onClick={() => {
            const radiusNum = parseFloat(location!.radius!);
            if (isNaN(radiusNum)) {
              return;
            }
            try {
              const { lat, lon: lng } = Geohash.decode(location!.geohash!);
              addLocation({
                geometry: { center: { lat, lng }, radius: radiusNum },
              });
              setLocation(undefined);
            } catch (_) {
              setError(true);
              return;
            }
          }}
        />
      </div>
    </div>
  );

  const geohashLocations =
    locations?.filter((location) => Boolean(location.googlePlaceId)) ?? [];

  return (
    <div className="my-3 text-sm">
      {locationSectionHeader('Input the geohashes you would like to match on.')}
      {locationSectionHeader(
        "Each geohash represents just a single point, which isn't very useful on its own. You need to add a radius so that Coop knows how large to make its search radius around the geohash location.",
      )}
      {locationInput}
      {geohashLocations.length > 0 && (
        <div>
          <div className="divider" />
          <div className="mt-4 font-medium">Selected Locations</div>
          <div className="flex flex-wrap p-1 my-2 border border-solid rounded shadow border-slate-200 bg-slate-100">
            {geohashLocations.map((location, idx) => {
              return (
                <TextToken
                  title={getLocationDisplayName(location)}
                  key={idx}
                  onDelete={() => removeLocation(location)}
                />
              );
            })}
          </div>
        </div>
      )}
      {error && (
        <div className="mt-2 text-red-500">Invalid geohash or radius</div>
      )}
    </div>
  );
}
