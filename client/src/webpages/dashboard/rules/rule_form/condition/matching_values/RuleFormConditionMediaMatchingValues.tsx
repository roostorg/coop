import { Form, Select } from 'antd';

import ComponentLoading from '../../../../../../components/common/ComponentLoading';
import { selectFilterByLabelOption } from '@/webpages/dashboard/components/antDesignUtils';
import { useGQLHashBanksQuery } from '../../../../../../graphql/generated';
import { ConditionLocation, RuleFormLeafCondition } from '../../../types';

const { Option } = Select;

export default function RuleFormConditionMediaMatchingValues(props: {
  condition: RuleFormLeafCondition;
  location: ConditionLocation;
  onUpdateMatchingValues: (
    matchingValues: RuleFormLeafCondition['matchingValues'],
  ) => void;
  allConditions?: RuleFormLeafCondition[];
}) {
  const { condition, location, onUpdateMatchingValues, allConditions = [] } = props;
  const { conditionSetIndex, conditionIndex } = location;

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
    <Form.Item
      className="!mb-0 !pl-4 !align-middle"
      name={[conditionSetIndex, conditionIndex, 'media_bank']}
      initialValue={condition.matchingValues}
    >
      {/* Needs to be wrapped in a div for the state to work properly */}
      <div className="flex flex-col items-start">
        <Select
          mode="multiple"
          placeholder="Select media bank(s)"
          defaultValue={condition.matchingValues?.imageBankIds}
          value={condition.matchingValues?.imageBankIds}
          onChange={(values) => {
            // Filter out any duplicate values
            const uniqueValues = Array.from(new Set(values));
            onUpdateMatchingValues({ imageBankIds: uniqueValues });
          }}
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
      </div>
    </Form.Item>
  );
}
