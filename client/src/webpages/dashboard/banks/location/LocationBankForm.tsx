import { PlusOutlined } from '@ant-design/icons';
import { gql } from '@apollo/client';
import { Button } from 'antd';
import { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useParams } from 'react-router-dom';

import FullScreenLoading from '../../../../components/common/FullScreenLoading';
import CoopButton from '../../components/CoopButton';
import CoopModal from '../../components/CoopModal';
import FormHeader from '../../components/FormHeader';
import FormSectionHeader from '../../components/FormSectionHeader';
import LocationInputModal from '../../components/location/LocationInputModal';
import NameDescriptionInput from '../../components/NameDescriptionInput';
import TextToken from '../../components/TextToken';

import {
  GQLLocationAreaInput,
  GQLLocationBankDocument,
  GQLUserPermission,
  namedOperations,
  useGQLCreateLocationBankMutation,
  useGQLLocationBankFormQuery,
  useGQLLocationBankQuery,
  useGQLUpdateLocationBankMutation,
} from '../../../../graphql/generated';
import {
  areLocationAreasEqual,
  getLocationDisplayName,
  LocationFormLocation,
} from '../../../../models/locationBank';
import { userHasPermissions } from '../../../../routing/permissions';
import { getChangeset } from '../../../../utils/collections';

export type LocationBankFormState = {
  modalVisible: boolean;
  locationModalVisible: boolean;
  locations: readonly LocationFormLocation[];
  oldLocations: readonly LocationFormLocation[];
  submitButtonLoading: boolean;
  bankMutationError: boolean;
};

gql`
  mutation CreateLocationBank($input: CreateLocationBankInput!) {
    createLocationBank(input: $input) {
      ... on MutateLocationBankSuccessResponse {
        data {
          id
        }
      }
    }
  }

  mutation UpdateLocationBank($input: UpdateLocationBankInput!) {
    updateLocationBank(input: $input) {
      ... on MutateLocationBankSuccessResponse {
        data {
          id
        }
      }
    }
  }

  query LocationBank($id: ID!) {
    locationBank(id: $id) {
      id
      name
      description
      locations {
        id
        name
        geometry {
          center {
            lat
            lng
          }
          radius
        }
        googlePlaceInfo {
          id
        }
        bounds {
          northeastCorner {
            lat
            lng
          }
          southwestCorner {
            lat
            lng
          }
        }
      }
    }
  }

  query LocationBankForm {
    me {
      permissions
    }
  }
`;

export default function LocationBankForm() {
  const [bankName, setBankName] = useState<string | undefined>(undefined);
  const [bankDescription, setBankDescription] = useState<string | undefined>(
    undefined,
  );
  const [modalInfo, setModalInfo] = useState<
    | {
        title: string;
        body: string;
        buttonText: string;
      }
    | undefined
  >(undefined);
  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const [locations, setLocations] = useState<readonly LocationFormLocation[]>(
    [],
  );
  const [oldLocations, setOldLocations] = useState<
    readonly LocationFormLocation[]
  >([]);

  const [createLocationBank, createMutationParams] =
    useGQLCreateLocationBankMutation({
      onError: (_error) => {
        setModalInfo({
          title: 'Error Creating Location Bank',
          body: 'We encountered an error trying to create your Location Bank. Please try again.',
          buttonText: 'OK',
        });
      },
      onCompleted: ({ createLocationBank }) => {
        switch (createLocationBank.__typename) {
          case 'MutateLocationBankSuccessResponse':
            setModalInfo({
              title: 'Location Bank Created',
              body: 'Your Location Bank was successfully created!',
              buttonText: 'Done',
            });
            break;
          case 'LocationBankNameExistsError':
            setModalInfo({
              title: 'Error Creating Location Bank',
              body: 'Your organization already has a location bank with this name.',
              buttonText: 'OK',
            });
            break;
        }
      },
    });

  const [updateLocationBank, updateMutationParams] =
    useGQLUpdateLocationBankMutation({
      onError: () => {
        setModalInfo({
          title: 'Error Saving Changes',
          body: 'We encountered an error trying to update your Location Bank. Please try again.',
          buttonText: 'OK',
        });
      },
      onCompleted: ({ updateLocationBank }) => {
        switch (updateLocationBank.__typename) {
          case 'MutateLocationBankSuccessResponse':
            setModalInfo({
              title: 'Changes Saved',
              body: 'Your Location Bank was successfully updated!',
              buttonText: 'Done',
            });
            break;
          case 'LocationBankNameExistsError':
            setModalInfo({
              title: 'Error Saving Changes',
              body: 'Your organization already has a location bank with this name.',
              buttonText: 'OK',
            });
            break;
        }
      },
    });

  const { id } = useParams<{ id?: string }>();

  const bankQueryParams = useGQLLocationBankQuery({
    // not-null assertion is safe b/c, per skip below, id is defined
    // whenever this query actually runs
    variables: { id: id! },
    skip: id == null,
    fetchPolicy: 'no-cache',
  });
  const bank = bankQueryParams.data?.locationBank;
  const bankQueryLoading = bankQueryParams.loading;
  const bankQueryError = bankQueryParams.error;

  const bankFormQueryParams = useGQLLocationBankFormQuery();
  const permissions = bankFormQueryParams.data?.me?.permissions;
  const bankFormQueryLoading = bankFormQueryParams.loading;
  const bankFormQueryError = bankFormQueryParams.error;

  useMemo(() => {
    if (bank != null) {
      setBankName(bank.name);
      setBankDescription(bank.description ?? '');
      setOldLocations(bank.locations);
      setLocations(bank.locations);
    }
  }, [bank]);

  if (bankQueryError || bankFormQueryError) {
    // eslint-disable-next-line @typescript-eslint/no-throw-literal
    throw bankQueryError ?? bankFormQueryError;
  }

  if (bankQueryLoading || bankFormQueryLoading) {
    return <FullScreenLoading />;
  }
  const canEditLocationBanks = userHasPermissions(permissions, [
    GQLUserPermission.MutateLiveRules,
  ]);

  const onCreateBank = async () => {
    createLocationBank({
      variables: {
        input: {
          name: bankName!,
          description: bankDescription,
          locations: locations.map((location) =>
            locationFormLocationToGQLLocationAreaInput(location),
          ),
        },
      },
      refetchQueries: [namedOperations.Query.LocationBanks],
    });
  };

  const onUpdateBank = async () => {
    const changeset = getChangeset([...oldLocations], [...locations]);
    updateLocationBank({
      variables: {
        input: {
          id: id!,
          name: bankName,
          description: bankDescription,
          locationsToAdd: changeset.added.map((location) =>
            locationFormLocationToGQLLocationAreaInput(location),
          ),
          locationsToDelete: changeset.removed.map(
            (locationFormLocation) => locationFormLocation.id!,
          ),
        },
      },
      refetchQueries: [
        namedOperations.Query.LocationBanks,
        { query: GQLLocationBankDocument, variables: { id } },
      ],
    });
  };

  const addLocationButton = (
    <Button
      size="middle"
      type="default"
      className="mt-4"
      onClick={() => setLocationModalVisible(true)}
      icon={<PlusOutlined />}
    >
      Add Location
    </Button>
  );

  const createButton = (
    <CoopButton
      title={id == null ? 'Create Location Bank' : 'Save Changes'}
      disabled={
        !canEditLocationBanks ||
        bankName == null ||
        bankName.length === 0 ||
        locations.length === 0
      }
      loading={createMutationParams.loading || updateMutationParams.loading}
      size={'middle'}
      disabledTooltipTitle={
        !canEditLocationBanks
          ? "To edit Location Banks, ask your organization's admin to upgrade your role to Rules Manager or Admin."
          : bankName == null || bankName.length === 0
            ? 'Please provide a name for the Location Bank.'
            : locations.length === 0
              ? 'Please add at least one location to the Location Bank.'
              : undefined
      }
      disabledTooltipPlacement="bottomLeft"
      onClick={id == null ? onCreateBank : onUpdateBank}
    />
  );

  const matchingLocationsSection = (
    <div className="flex flex-col justify-start w-4/5">
      <FormSectionHeader
        title={`Locations`}
        subtitle={`These are the locations that we'll store in this bank`}
      />
      <div className="flex justify-between mb-2">{addLocationButton}</div>
      {locations.length > 0 && (
        <div className="flex flex-wrap border border-solid border-[#d9d9d9] rounded-lg p-1 shadow bg-[#f8f8f8]">
          {locations.map((location, idx) => {
            return (
              <TextToken
                title={getLocationDisplayName(location)}
                key={idx}
                onDelete={() =>
                  setLocations(locations.filter((_, index) => index !== idx))
                }
              />
            );
          })}
        </div>
      )}
      <div className="mt-4">{locations.length > 0 && createButton}</div>
    </div>
  );

  const modal = (
    <CoopModal
      title={modalInfo?.title}
      visible={modalInfo != null}
      onClose={() => setModalInfo(undefined)}
      footer={[
        {
          title: modalInfo?.buttonText ?? '',
          onClick: () => setModalInfo(undefined),
          type: 'primary',
        },
      ]}
    >
      {modalInfo?.body}
    </CoopModal>
  );

  const addLocationArea = (location: LocationFormLocation) => {
    if (locations.some((it) => areLocationAreasEqual(it, location))) {
      return;
    }
    setLocations([...locations, location]);
  };

  const removeLocationArea = (location: LocationFormLocation) => {
    setLocations(
      locations.filter((it) => !areLocationAreasEqual(it, location)),
    );
  };

  const locationModal = (
    <LocationInputModal
      visible={locationModalVisible}
      locations={locations}
      locationBankIds={[]} // dummy value, unused bc of showBanksTab=false
      onClose={() => setLocationModalVisible(false)}
      updateCallbacks={{
        addLocation: addLocationArea,
        removeLocation: removeLocationArea,
      }}
      showBanksTab={false}
    />
  );

  return (
    <div className="flex flex-col text-start">
      <Helmet>
        <title>
          {id == null ? 'Create Location Bank' : 'Update Location Bank'}
        </title>
      </Helmet>
      <FormHeader
        title={id == null ? 'Create Location Bank' : 'Update Location Bank'}
      />
      <NameDescriptionInput
        nameInitialValue={bank?.name}
        descriptionInitialValue={bank?.description ?? undefined}
        onChangeName={setBankName}
        onChangeDescription={setBankDescription}
      />
      <div className="flex h-px mt-5 mb-9 bg-slate-200" />
      {matchingLocationsSection}
      {locationModal}
      {modal}
    </div>
  );
}

/**
 * This function doesn't do anything right now because at runtime
 * LocationFormLocation is always identical to GQLLocationAreaInput because
 * the only extra property on LocationFormLocation id is always missing, but
 * we should update in the future if they ever diverge.
 */
function locationFormLocationToGQLLocationAreaInput(
  location: LocationFormLocation,
): GQLLocationAreaInput {
  return location;
}
