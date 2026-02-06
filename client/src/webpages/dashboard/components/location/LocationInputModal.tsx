import { useState } from 'react';

import { LocationFormLocation } from '../../../../models/locationBank';
import CoopModal from '../CoopModal';
import TabBar from '../TabBar';
import LocationInputModalGooglePlaceTab from './google_place/LocationInputModalGooglePlaceTab';
import LocationInputModalBankTab from './LocationInputModalBankTab';
import LocationInputModalGeohashTab from './LocationInputModalGeohashTab';

enum LocationInputModalTab {
  GEOHASH = 'GEOHASH',
  GOOGLE_PLACE = 'GOOGLE_PLACE',
  LOCATION_BANK = 'LOCATION_BANK',
}

export function locationSectionHeader(header: string) {
  return <div className="my-3 text-sm">{header}</div>;
}

export default function LocationInputModal(props: {
  visible: boolean;
  onClose: () => void;
  updateCallbacks: {
    addLocation: (place: LocationFormLocation) => void;
    removeLocation: (place: LocationFormLocation) => void;
    addBank?: (bankId: string) => void;
    removeBank?: (bankId: string) => void;
  };
  showBanksTab?: boolean;
  locations: readonly LocationFormLocation[];
  locationBankIds: readonly string[];
}) {
  const {
    visible,
    locations,
    locationBankIds,
    onClose,
    showBanksTab,
    updateCallbacks,
  } = props;

  const [activeTab, setActiveTab] = useState<LocationInputModalTab>(
    LocationInputModalTab.GOOGLE_PLACE,
  );

  return (
    <CoopModal visible={visible} onClose={onClose}>
      <div className="mb-1 text-base font-semibold text-zinc-900">
        Select Location(s)
      </div>
      <TabBar
        tabs={[
          {
            label: 'Points of Interest',
            value: LocationInputModalTab.GOOGLE_PLACE,
          },
          {
            label: 'Geohashes',
            value: LocationInputModalTab.GEOHASH,
          },
          ...(showBanksTab
            ? [
                {
                  label: 'Location Banks',
                  value: LocationInputModalTab.LOCATION_BANK,
                },
              ]
            : []),
        ]}
        initialSelectedTab={activeTab}
        onTabClick={setActiveTab}
        currentSelectedTab={activeTab}
      />
      {activeTab === LocationInputModalTab.GOOGLE_PLACE && (
        <LocationInputModalGooglePlaceTab
          locations={locations}
          addPlace={updateCallbacks.addLocation}
          removePlace={updateCallbacks.removeLocation}
        />
      )}
      {activeTab === LocationInputModalTab.GEOHASH && (
        <LocationInputModalGeohashTab
          locations={locations}
          addLocation={updateCallbacks.addLocation}
          removeLocation={updateCallbacks.removeLocation}
        />
      )}
      {activeTab === LocationInputModalTab.LOCATION_BANK &&
        updateCallbacks.addBank &&
        updateCallbacks.removeBank && (
          <LocationInputModalBankTab
            bankIds={locationBankIds}
            addBank={updateCallbacks.addBank}
            removeBank={updateCallbacks.removeBank}
          />
        )}
    </CoopModal>
  );
}
