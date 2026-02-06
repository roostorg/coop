import groupBy from 'lodash/groupBy';

import { GQLUserPenaltySeverity } from '../../../../../../graphql/generated';
import { jsonStringify } from '../../../../../../utils/typescript-types';
import ManualReviewJobEnqueuedRelatedActionEntry from './ManualReviewJobEnqueuedRelatedActionEntry';

// NB: If this type is ever exported, please give it a more descriptive name.
// The only reason 'Action' is acceptable here is because it's a type that's
// private/local to this file. If it were exported, it would be too ambiguous as
// is, so we'd need to specify what it's used for in the typename.
type Action = {
  id: string;
  name: string;
  penalty: GQLUserPenaltySeverity;
  target: {
    itemId: string;
    itemTypeId: string;
    itemTypeName?: string;
    iconUrl?: string;
    displayName: string;
  };
  policyNames: readonly string[];
};

export default function ManualReviewJobEnqueuedRelatedActions(props: {
  actionsData: Action[];
  onRemoveAction: (action: Action) => void;
}) {
  const { actionsData: actions, onRemoveAction } = props;

  // Group actions by action Id and associate with list of targets on which that
  // action will be performed
  const actionsById = groupBy(actions, (action) => action.id);
  const groupedActions = Object.keys(actionsById).map((actionId) => ({
    action: {
      id: actionId,
      name: actionsById[actionId][0].name,
      penalty: actionsById[actionId][0].penalty,
    },
    targetsWithPolicies: actionsById[actionId].map((action) => ({
      target: action.target,
      policyNames: action.policyNames,
    })),
  }));

  if (groupedActions.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col mb-4 text-start">
      <div className="self-start mb-2 text-base font-medium">Other Actions</div>
      <div
        className={`flex flex-col max-h-[360px] max-w-[240px] border border-solid p-4 rounded-md border-gray-200 bg-white overflow-auto`}
      >
        {groupedActions.map((groupedAction, i) => (
          <div className="flex flex-col" key={groupedAction.action.id}>
            <div className="pb-2 font-semibold text-slate-500">
              {groupedAction.action.name}
            </div>
            <div className="flex flex-col space-y-2">
              {groupedAction.targetsWithPolicies.map((targetWithPolicies) => (
                <ManualReviewJobEnqueuedRelatedActionEntry
                  key={jsonStringify([
                    targetWithPolicies.target.itemId,
                    targetWithPolicies.target.itemTypeId,
                  ])}
                  label={targetWithPolicies.target.displayName}
                  sublabel={targetWithPolicies.target.itemTypeName}
                  itemIdentifier={{
                    id: targetWithPolicies.target.itemId,
                    typeId: targetWithPolicies.target.itemTypeId,
                  }}
                  iconUrl={targetWithPolicies.target.iconUrl}
                  policyNames={targetWithPolicies.policyNames}
                  onRemove={() =>
                    onRemoveAction({
                      ...groupedAction.action,
                      ...targetWithPolicies,
                    })
                  }
                />
              ))}
            </div>
            {i !== groupedActions.length - 1 ? (
              <div className="my-4 divider" />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
