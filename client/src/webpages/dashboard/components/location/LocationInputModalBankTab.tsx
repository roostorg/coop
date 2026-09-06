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
  addBank: (bankId: string) => void;
  removeBank: (bankId: string) => void;
}) {
  const { bankIds, addBank, removeBank } = props;

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
        className="flex cursor-pointer !w-full"
        placeholder={`Select a bank`}
        value={[...bankIds]}
        onValueChange={(next) => {
          const prev = [...bankIds];
          next.filter((id) => !prev.includes(id)).forEach(addBank);
          prev.filter((id) => !next.includes(id)).forEach(removeBank);
        }}
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
