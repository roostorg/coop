import { ManualReviewJobAction } from '../ManualReviewJobReview';
import ManualReviewJobEnqueueRelatedActionWithPoliciesButton from './related_actions/ManualReviewJobEnqueueRelatedActionWithPoliciesButton';

export default function ManualReviewJobRelatedActionsButtonPanel(props: {
  label?: string;
  actions: readonly ManualReviewJobAction[];
  allPolicies: readonly { id: string; name: string }[];
  selectedPolicyIds: (action: ManualReviewJobAction) => readonly string[];
  requirePolicySelection?: boolean;
  allowMoreThanOnePolicySelection: boolean;
  onChangeSelectedPolicies: (
    action: ManualReviewJobAction,
    selectedPolicyIds: string | readonly string[],
  ) => void;
}) {
  const {
    label,
    actions,
    allPolicies,
    selectedPolicyIds,
    onChangeSelectedPolicies,
    requirePolicySelection = false,
    allowMoreThanOnePolicySelection,
  } = props;

  return actions.length > 0 ? (
    <div className="flex flex-col items-start py-2">
      <div className="font-semibold">{label}</div>
      <div className="flex flex-row flex-wrap gap-2">
        {actions.map((action) => (
          <ManualReviewJobEnqueueRelatedActionWithPoliciesButton
            key={action.id}
            actionName={action.name}
            allPolicies={allPolicies}
            selectedPolicyIds={selectedPolicyIds(action)}
            onChangeSelectedPolicies={onChangeSelectedPolicies.bind(
              null,
              action,
            )}
            requirePolicySelection={requirePolicySelection}
            allowMoreThanOnePolicySelection={allowMoreThanOnePolicySelection}
          />
        ))}
      </div>
    </div>
  ) : null;
}
