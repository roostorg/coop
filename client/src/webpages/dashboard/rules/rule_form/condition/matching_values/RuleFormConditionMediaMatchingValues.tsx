import { MultiCombobox } from '@/coop-ui/Combobox';

import ComponentLoading from '../../../../../../components/common/ComponentLoading';

import { useGQLHashBanksQuery } from '../../../../../../graphql/generated';
import { ConditionLocation, RuleFormLeafCondition } from '../../../types';

export default function RuleFormConditionMediaMatchingValues(props: {
  condition: RuleFormLeafCondition;
  location: ConditionLocation;
  onUpdateMatchingValues: (
    matchingValues: RuleFormLeafCondition['matchingValues'],
  ) => void;
  allConditions?: RuleFormLeafCondition[];
}) {
  const {
    condition,
    location,
    onUpdateMatchingValues,
    allConditions = [],
  } = props;
  const { conditionSetIndex, conditionIndex } = location;

  const { loading, error, data } = useGQLHashBanksQuery();
  const hashBanks = data?.hashBanks ?? [];

  // Get all selected bank IDs from other conditions
  const selectedBankIds = new Set(
    allConditions
      .filter((c) => c !== condition) // Exclude current condition by reference
      .flatMap((c) => c.matchingValues?.imageBankIds ?? []),
  );

  if (loading) {
    return <ComponentLoading />;
  }
  if (error) {
    return <div />;
  }

  return (
    <div
      className="!mb-0 !pl-4 !align-middle"
      key={`media-bank-form-item_set_index_${conditionSetIndex}_index_${conditionIndex}`}
    >
      {/* Needs to be wrapped in a div for the state to work properly */}
      <div className="flex flex-col items-start">
        <MultiCombobox
          placeholder="Select media bank(s)"
          value={[...(condition.matchingValues?.imageBankIds ?? [])]}
          onValueChange={(values) =>
            onUpdateMatchingValues({
              imageBankIds: Array.from(new Set(values)),
            })
          }
          allowClear
          options={hashBanks.map((bank) => ({
            value: bank.id,
            label: bank.name,
            disabled: selectedBankIds.has(bank.id),
          }))}
        />
      </div>
    </div>
  );
}
