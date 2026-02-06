import { DownOutlined } from '@ant-design/icons';
import { Button } from 'antd';

import { ConditionLocation, RuleFormLeafCondition } from '../../../types';

export default function RuleFormConditionSignalSubcategory(props: {
  condition: RuleFormLeafCondition;
  location: ConditionLocation;
  onClick: () => void;
}) {
  const { condition, location, onClick } = props;

  const signal = condition.signal;
  if (!condition.input || !signal || !signal.eligibleSubcategories) {
    return null;
  }
  const eligibleSubcategories = signal.eligibleSubcategories;
  if (eligibleSubcategories.length === 0) {
    return null;
  }
  const { conditionIndex, conditionSetIndex } = location;

  return (
    <div
      key={
        'signal_subcategory_wrapper_set_index_' +
        conditionSetIndex +
        '_index_' +
        conditionIndex
      }
      className="!mb-0 !pl-4 !align-middle flex flex-col items-start"
    >
      <div className="pb-1 text-xs font-bold">Signal Subcategory</div>
      <Button
        className={`px-3 cursor-text ${
          condition.signal
            ? '!text-black !hover:text-black !focus:text-black'
            : '!text-[#bfbfbf] !hover:text-[#bfbfbf] !focus:text-[#bfbfbf]'
        }`}
        onClick={onClick}
      >
        {signal.subcategory ?? 'Select Subcategory'}{' '}
        <DownOutlined className="!text-xs !text-[#bfbfbf] !hover:text-[#bfbfbf]" />
      </Button>
      <div className="invisible pb-1 text-xs font-bold">Signal Subcategory</div>
    </div>
  );
}
