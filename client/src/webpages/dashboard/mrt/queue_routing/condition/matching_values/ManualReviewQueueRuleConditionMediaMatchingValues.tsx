/* eslint-disable no-console */
import { Select } from 'antd';

import ComponentLoading from '../../../../../../components/common/ComponentLoading';
import { selectFilterByLabelOption } from '@/webpages/dashboard/components/antDesignUtils';
import { useGQLHashBanksQuery } from '../../../../../../graphql/generated';
import { RuleFormLeafCondition } from '../../../../rules/types';
import { ManualReviewQueueRoutingStaticTokenField } from '../../ManualReviewQueueRoutingStaticField';

const { Option } = Select;

export default function ManualReviewQueueRuleConditionMediaMatchingValues(props: {
  condition: RuleFormLeafCondition;
  editing: boolean;
  onUpdateSelectedBankIds(imageBankIds: readonly string[]): void;
  allConditions?: RuleFormLeafCondition[];
}) {
  const { condition, editing, onUpdateSelectedBankIds, allConditions = [] } = props;

  const { loading, error, data } = useGQLHashBanksQuery();
  const hashBanks = data?.hashBanks ?? [];

  // Get all selected bank IDs from other conditions
  const selectedBankIds = new Set(
    allConditions
      .filter((c) => c !== condition) // Exclude current condition by reference
      .flatMap((c) => c.matchingValues?.imageBankIds ?? [])
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
        <Select
          placeholder="Select media bank(s)"
          defaultValue={condition.matchingValues?.imageBankIds}
          value={condition.matchingValues?.imageBankIds}
          onChange={(values) => onUpdateSelectedBankIds([...values])}
          allowClear
          showSearch
          filterOption={selectFilterByLabelOption}
          dropdownMatchSelectWidth={false}
        >
          {hashBanks.map((bank) => (
            <Option 
              key={bank.id} 
              value={bank.id} 
              label={bank.name}
              disabled={selectedBankIds.has(bank.id)}
            >
              {bank.name}
            </Option>
          ))}
        </Select>
      ) : (
        <ManualReviewQueueRoutingStaticTokenField
          tokens={condition.matchingValues?.imageBankIds?.map(id => 
            hashBanks.find(bank => bank.id === id)?.name ?? id
          ) ?? []}
        />
      )}
    </div>
  );
}
