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

  const hasFreeTextSentinel = eligibleSubcategories.some(
    (s) => s.id === '__free_text__',
  );
  const hasPolicyOptions = eligibleSubcategories.some((s) =>
    s.id.startsWith('policy:'),
  );
  const isSelfHosted = hasFreeTextSentinel;

  // Look up the label for the stored subcategory ID (e.g. policy name).
  const matchingOption = signal.subcategory
    ? eligibleSubcategories.find((s) => s.id === signal.subcategory)
    : undefined;

  let displayValue: string;
  let tooltipText: string | undefined;

  if (!signal.subcategory) {
    displayValue = hasPolicyOptions
      ? 'Select Policy or Criteria'
      : 'Enter Criteria';
  } else if (matchingOption) {
    // Subcategory is a known option (e.g. a policy) — show its label.
    displayValue = matchingOption.label;
  } else {
    // Subcategory is raw free text — truncate for display, full text as tooltip.
    const text = signal.subcategory;
    displayValue = text.length > 40 ? text.slice(0, 40) + '…' : text;
    tooltipText = text;
  }

  const label = isSelfHosted ? 'Policy Criteria' : 'Signal Subcategory';

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
      <div className="pb-1 text-xs font-bold">{label}</div>
      <Button
        className={`px-3 cursor-text ${
          condition.signal
            ? '!text-black !hover:text-black !focus:text-black'
            : '!text-[#bfbfbf] !hover:text-[#bfbfbf] !focus:text-[#bfbfbf]'
        }`}
        onClick={onClick}
        title={tooltipText}
      >
        {displayValue}{' '}
        <DownOutlined className="!text-xs !text-[#bfbfbf] !hover:text-[#bfbfbf]" />
      </Button>
      <div className="invisible pb-1 text-xs font-bold">{label}</div>
    </div>
  );
}
