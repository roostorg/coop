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
import { RuleFormLeafCondition } from '../../../../rules/types';
import { ManualReviewQueueRoutingStaticTokenField } from '../../ManualReviewQueueRoutingStaticField';

export default function ManualReviewQueueRuleConditionLocationMatchingValues(props: {
  condition: RuleFormLeafCondition;
  editing: boolean;
  onUpdateMatchingValues: (
    values: RuleFormLeafCondition['matchingValues'],
  ) => void;
}) {
  const { condition, editing, onUpdateMatchingValues } = props;
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
  const removeLocationArea = (location: GQLLocationAreaInput) =>
    onUpdateMatchingValues({
      ...matchingValues,
      locations: (matchingValues?.locations ?? []).filter(
        (it) => !areLocationAreasEqual(it, location),
      ),
    });
  const addBank = (bankId: string) => {
    if (matchingValues?.locationBankIds?.includes(bankId)) {
      return;
    }

    onUpdateMatchingValues({
      ...matchingValues,
      locationBankIds: [...(matchingValues?.locationBankIds ?? []), bankId],
    });
  };
  const removeBank = (bankId: string) =>
    onUpdateMatchingValues({
      ...matchingValues,
      locationBankIds: (matchingValues?.locationBankIds ?? []).filter(
        (it) => it !== bankId,
      ),
    });

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
          className="font-semibold rounded-lg text-primary hover:border hover:border-solid hover:border-slate-200 hover:bg-slate-100"
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
      <div className="flex flex-col items-start pl-4 mb-0 align-middle">
        <div className="pb-1 text-sm font-bold whitespace-nowrap">
          Locations to Match
        </div>
        <div className="flex flex-row flex-wrap py-[3px] px-[10px] rounded-lg border border-solid border-slate-200 cursor-text text-sm bg-white">
          <div className="flex flex-wrap">
            {editing ? (
              <>
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
                  className="rounded-lg p-0 ml-[2px] mr-[2px]"
                  onClick={() => setModalVisible(true)}
                  icon={<PlusOutlined />}
                />
              </>
            ) : (
              <ManualReviewQueueRoutingStaticTokenField
                tokens={locationBanksOrLocations.map((it) => it.name ?? '')}
              />
            )}
          </div>
        </div>
        <div className="invisible pb-1 text-sm font-bold whitespace-nowrap">
          Locations to Match
        </div>
        {locationModal}
      </div>
    </div>
  );
}
