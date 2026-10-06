import { MultiCombobox } from '@/coop-ui/Combobox';
import { gql } from '@apollo/client';

import ComponentLoading from '../../../../components/common/ComponentLoading';

import { useGQLMatchingBankIdsQuery } from '../../../../graphql/generated';
import { locationSectionHeader } from './LocationInputModal';

gql`
  query MatchingBankIds {
    myOrg {
      banks {
        textBanks {
          id
          name
          description
          type
        }
        locationBanks {
          id
          name
          description
          locations {
            id
          }
        }
        hashBanks {
          id
          name
          description
          enabled_ratio
        }
      }
    }
  }
`;

export default function LocationInputModalBankTab(props: {
  bankIds: readonly string[];
  // One callback for the whole list: clearing removes several banks at once,
  // and per-bank callbacks would each rebuild from the same stale state.
  setBankIds: (bankIds: string[]) => void;
}) {
  const { bankIds, setBankIds } = props;

  const { loading, error, data } = useGQLMatchingBankIdsQuery();

  if (loading) {
    return <ComponentLoading />;
  }
  if (error) {
    throw error;
  }

  // non null assertions below are safe because data can only be null if we have
  // an error or are still loading (which we checked above) and myOrg can
  // only be null if the user is signed out (which should be guarded by the
  // parent components anyway but, if not, a crash here is ok).
  const locationBanks = data!.myOrg!.banks?.locationBanks;

  return (
    <div className="my-3 text-sm">
      {locationSectionHeader(
        'Select the location banks you would like to match on:',
      )}
      <MultiCombobox
        aria-label="Select the location banks you would like to match on"
        className="flex cursor-pointer !w-full"
        placeholder={`Select a bank`}
        value={[...bankIds]}
        onValueChange={setBankIds}
        allowClear
        options={
          locationBanks?.map((bank) => ({
            value: bank.id,
            label: bank.name,
          })) ?? []
        }
      />
    </div>
  );
}
