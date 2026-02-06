import { gql } from '@apollo/client';
import { Select } from 'antd';

import ComponentLoading from '../../../../components/common/ComponentLoading';

import { useGQLMatchingBankIdsQuery } from '../../../../graphql/generated';
import { locationSectionHeader } from './LocationInputModal';

const { Option } = Select;

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
      <Select
        mode="multiple"
        className="flex cursor-pointer !w-full"
        key="banks-select"
        placeholder={`Select a bank`}
        defaultValue={bankIds as string[]}
        value={bankIds as string[]}
        onSelect={(value: string) => {
          addBank(value);
        }}
        onDeselect={(value: string) => {
          removeBank(value);
        }}
        allowClear
        showSearch
        dropdownMatchSelectWidth={false}
      >
        {locationBanks?.map((bank) => (
          <Option key={bank.id} value={bank.id}>
            {bank.name}
          </Option>
        ))}
      </Select>
    </div>
  );
}
