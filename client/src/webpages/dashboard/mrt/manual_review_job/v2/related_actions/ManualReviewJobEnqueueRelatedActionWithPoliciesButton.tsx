import { Button, Popover } from 'antd';
import { useState } from 'react';

import PolicyDropdown from '../../../../components/PolicyDropdown';

export default function ManualReviewJobEnqueueRelatedActionWithPoliciesButton(props: {
  actionName: string;
  allPolicies: readonly { id: string; name: string }[];
  selectedPolicyIds: readonly string[];
  onChangeSelectedPolicies: (
    selectedPolicyIds: string | readonly string[],
  ) => void;
  requirePolicySelection: boolean;
  allowMoreThanOnePolicySelection: boolean;
}) {
  const {
    actionName,
    allPolicies,
    selectedPolicyIds,
    onChangeSelectedPolicies,
    requirePolicySelection,
    allowMoreThanOnePolicySelection,
  } = props;

  const [menuVisible, setMenuVisible] = useState(false);
  // Use timeout here to prevent the popover from disappearing when the user
  // moves their mouse from the button to the policy selector
  let timer: ReturnType<typeof setTimeout> | null = null;

  return (
    <div
      onMouseEnter={() => {
        if (timer != null) {
          clearTimeout(timer);
        }

        setMenuVisible(true);
      }}
      onMouseLeave={() => {
        timer = setTimeout(() => setMenuVisible(false), 250);
      }}
    >
      <Popover
        open={menuVisible}
        trigger="hover"
        showArrow={false}
        placement="bottomLeft"
        overlayInnerStyle={{ marginTop: '-12px' }}
        content={
          <PolicyDropdown
            className="min-w-[144px]"
            policies={allPolicies}
            onChange={onChangeSelectedPolicies}
            selectedPolicyIds={selectedPolicyIds}
            multiple={allowMoreThanOnePolicySelection}
          />
        }
      >
        <Button
          className="rounded-md"
          onClick={() => {
            if (!requirePolicySelection) {
              onChangeSelectedPolicies(selectedPolicyIds);
            }
          }}
        >
          {actionName}
        </Button>
      </Popover>
    </div>
  );
}
