import { DownOutlined } from '@ant-design/icons';
import { Button } from 'antd';

import { RuleFormConditionParams } from '../../ManualReviewQueueRuleFormCondition';

export default function ManualReviewQueueRuleConditionSignalSubcategory(props: {
  params: RuleFormConditionParams;
  editing: boolean;
  onClick: () => void;
}) {
  const { params, editing, onClick } = props;
  const { condition, location } = params;

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
      className="flex flex-col items-start pl-4 mb-0 align-middle"
    >
      <div className="pb-1 text-sm font-bold whitespace-nowrap">
        Signal Subcategory
      </div>
      <Button
        className={`px-3 rounded-lg ${
          condition.signal
            ? 'hover:text-black focus:text-black'
            : '!text-[#bfbfbf] !hover:text-[#bfbfbf] !focus:text-[#bfbfbf]'
        } ${editing ? 'cursor-pointer' : ''}`}
        disabled={!editing}
        onClick={onClick}
      >
        {signal.subcategory ?? 'Select Subcategory'}{' '}
        {editing ? (
          <DownOutlined className="text-xs !text-[#bfbfbf] !hover:text-[#bfbfbf]" />
        ) : null}
      </Button>
      <div className="invisible pb-1 text-sm font-bold whitespace-nowrap">
        Signal Subcategory
      </div>
    </div>
  );
}
