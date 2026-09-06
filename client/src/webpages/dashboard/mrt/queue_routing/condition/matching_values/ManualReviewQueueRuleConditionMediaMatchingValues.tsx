import { MultiCombobox } from '@/coop-ui/Combobox';

import ComponentLoading from '../../../../../../components/common/ComponentLoading';

import { useGQLHashBanksQuery } from '../../../../../../graphql/generated';
import { RuleFormLeafCondition } from '../../../../rules/types';
import { ManualReviewQueueRoutingStaticTokenField } from '../../ManualReviewQueueRoutingStaticField';

export default function ManualReviewQueueRuleConditionMediaMatchingValues(props: {
  condition: RuleFormLeafCondition;
  editing: boolean;
  onUpdateSelectedBankIds(imageBankIds: readonly string[]): void;
  allConditions?: RuleFormLeafCondition[];
}) {
  const {
    condition,
    editing,
    onUpdateSelectedBankIds,
    allConditions = [],
  } = props;

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
    <div className="flex flex-col items-start">
      {editing ? (
        <MultiCombobox
          placeholder="Select media bank(s)"
          value={[...(condition.matchingValues?.imageBankIds ?? [])]}
          onValueChange={(values) => onUpdateSelectedBankIds(values)}
          allowClear
          options={hashBanks.map((bank) => ({
            value: bank.id,
            label: bank.name,
            disabled: selectedBankIds.has(bank.id),
          }))}
        />
      ) : (
        <ManualReviewQueueRoutingStaticTokenField
          tokens={
            condition.matchingValues?.imageBankIds?.map(
              (id) => hashBanks.find((bank) => bank.id === id)?.name ?? id,
            ) ?? []
          }
        />
      )}
    </div>
  );
}
