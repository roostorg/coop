import { PlusOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import { useState } from 'react';

import ComponentLoading from '../../../../../../components/common/ComponentLoading';
import LocationInputModal from '../../../../components/location/LocationInputModal';
import TextToken from '../../../../components/TextToken';

import {
  GQLLocationAreaInput,
  useGQLMatchingBankIdsQuery,
} from '../../../../../../graphql/generated';
import {
  areLocationAreasEqual,
  getLocationBankDisplayName,
  getLocationDisplayName,
} from '../../../../../../models/locationBank';
import { RuleFormLeafCondition } from '../../../types';

export default function RuleFormConditionLocationMatchingValues(props: {
  condition: RuleFormLeafCondition;
  onUpdateMatchingValues: (
    matchingValues: RuleFormLeafCondition['matchingValues'],
  ) => void;
}) {
  const { condition, onUpdateMatchingValues } = props;
  const matchingValues = condition.matchingValues;

  // This allows the user to switch the matchingValuesInput between a
  // LocationGeometryInput (which lets them input geohash-based locations)
  // and a dropdown where they can select a matching bank.
  const [modalVisible, setModalVisible] = useState(false);

  const { loading, error, data } = useGQLMatchingBankIdsQuery();
  const allLocationBanks = data?.myOrg?.banks?.locationBanks;
  if (loading) {
    return <ComponentLoading />;
  } else if (error || !allLocationBanks) {
    throw error ?? new Error('Location banks were unexpectedly missing.');
  }

  const locationBankIds = new Set(matchingValues?.locationBankIds ?? []);
  const locationBanksOrLocations = [
    ...(matchingValues?.locations ?? []).map((it) => ({
      // `matchingValues.locations` holds mutation input objects, which don't
      // have a __typename, so we add one to make it easier to tell what we're
      // working with when using the `locationBanksOrLocations` array.
      ...it,
      __typename: 'LocationArea' as const,
    })),
    ...allLocationBanks.filter((it) => locationBankIds.has(it.id)),
  ];

  const addLocationArea = (location: GQLLocationAreaInput) => {
    // Check if the location is already in matchingValues.locations
    if (
      matchingValues?.locations?.some((it) =>
        areLocationAreasEqual(it, location),
      )
    ) {
      return;
    }
    onUpdateMatchingValues({
      ...matchingValues,
      locations: [...(matchingValues?.locations ?? []), location],
    });
  };

  const removeLocationArea = (location: GQLLocationAreaInput) => {
    onUpdateMatchingValues({
      ...matchingValues,
      locations: (matchingValues?.locations ?? []).filter(
        (it) => !areLocationAreasEqual(it, location),
      ),
    });
  };

  const addBank = (bankId: string) => {
    if (matchingValues?.locationBankIds?.includes(bankId)) {
      return;
    }
    onUpdateMatchingValues({
      ...matchingValues,
      locationBankIds: [...(matchingValues?.locationBankIds ?? []), bankId],
    });
  };

  const removeBank = (bankId: string) => {
    onUpdateMatchingValues({
      ...matchingValues,
      locationBankIds: (matchingValues?.locationBankIds ?? []).filter(
        (it) => it !== bankId,
      ),
    });
  };

  const locationModal = (
    <LocationInputModal
      visible={modalVisible}
      onClose={() => setModalVisible(false)}
      locationBankIds={matchingValues?.locationBankIds ?? []}
      locations={matchingValues?.locations ?? []}
      updateCallbacks={{
        addLocation: addLocationArea,
        removeLocation: removeLocationArea,
        addBank,
        removeBank,
      }}
      showBanksTab={true}
    />
  );

  if (!locationBanksOrLocations.length) {
    return (
      <div className="ml-3">
        <Button
          className="!text-slate-500"
          icon={<PlusOutlined />}
          onClick={() => setModalVisible(true)}
        >
          Select Locations
        </Button>
        {locationModal}
      </div>
    );
  }

  return (
    <div>
      <div className="!mb-0 !pl-4 !align-middle flex flex-col items-start">
        <div className="pb-1 text-xs font-bold">Locations to Match</div>
        <div className="flex flex-row flex-wrap py-[3px] px-2.5 border border-solid border-[#d9d9d9] cursor-text text-sm bg-white hover:border-primary focus:border-primary">
          <div className="flex flex-wrap">
            {locationBanksOrLocations.map((location, idx) => {
              return (
                <TextToken
                  title={
                    location.__typename === 'LocationBank'
                      ? getLocationBankDisplayName(location)
                      : getLocationDisplayName(location)
                  }
                  key={idx}
                  onDelete={() => {
                    const locationToRemove = locationBanksOrLocations[idx];
                    if (locationToRemove.__typename === 'LocationBank') {
                      removeBank(locationToRemove.id);
                    } else {
                      removeLocationArea(locationToRemove);
                    }
                  }}
                />
              );
            })}
            <Button
              onClick={() => setModalVisible(true)}
              icon={<PlusOutlined />}
            />
          </div>
        </div>
        <div className="invisible pb-1 text-xs font-bold">
          Locations to Match
        </div>
        {locationModal}
      </div>
    </div>
  );
}
