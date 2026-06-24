import { type GQLActionParameter } from '@/graphql/generated';
import { Pencil } from 'lucide-react';
import { useState } from 'react';

import {
  findMissingRequiredParameters,
  type ActionParameterValues,
} from '@/components/ActionParameterInputs';
import ActionParametersModal, {
  defaultValuesForParameters,
} from '@/components/ActionParametersModal';

export type ParameterizedActionOption = {
  id: string;
  name: string;
  parameters: readonly GQLActionParameter[];
};

type Props = {
  // `value`/`onChange` are supplied by the wrapping `Form.Item`.
  value?: Record<string, ActionParameterValues>;
  onChange?: (next: Record<string, ActionParameterValues>) => void;
  actions: readonly ParameterizedActionOption[];
  selectedActionIds: readonly string[];
  disabled?: boolean;
};

/**
 * Lets an author configure the parameter values a proactive rule sends when it
 * fires a parameterized action — proactive rules run with no moderator, so the
 * values are set here. Each selected action with a spec gets a row that opens
 * {@link ActionParametersModal}.
 */
export default function RuleActionParametersEditor({
  value,
  onChange,
  actions,
  selectedActionIds,
  disabled,
}: Props) {
  const valueMap = value ?? {};
  const [editingActionId, setEditingActionId] = useState<string | null>(null);

  const selectedParameterized = selectedActionIds
    .map((actionId) => actions.find((a) => a.id === actionId))
    .filter(
      (a): a is ParameterizedActionOption =>
        a != null && a.parameters.length > 0,
    );

  if (selectedParameterized.length === 0) {
    return null;
  }

  const valuesForAction = (
    action: ParameterizedActionOption,
  ): ActionParameterValues =>
    valueMap[action.id] ?? defaultValuesForParameters(action.parameters);

  const editingAction =
    editingActionId != null
      ? (selectedParameterized.find((a) => a.id === editingActionId) ?? null)
      : null;

  return (
    <div className="flex flex-col gap-2 mt-2">
      <div className="text-sm font-medium text-slate-700">
        Action parameters
      </div>
      {selectedParameterized.map((action) => {
        const current = valuesForAction(action);
        const missing = findMissingRequiredParameters(
          action.parameters,
          current,
        );
        return (
          <div
            key={action.id}
            className="flex items-center gap-3 rounded-md border border-solid border-slate-200 p-2"
          >
            <span className="text-sm font-medium">{action.name}</span>
            {missing.length > 0 ? (
              <span className="text-xs text-coop-alert-red">
                Missing: {missing.join(', ')}
              </span>
            ) : (
              <span className="text-xs text-slate-500">Configured</span>
            )}
            {!disabled && (
              <button
                type="button"
                className="ml-auto flex items-center gap-1 text-xs font-medium text-primary"
                onClick={() => setEditingActionId(action.id)}
              >
                <Pencil height={14} width={14} />
                Edit
              </button>
            )}
          </div>
        );
      })}
      {editingAction != null && (
        <ActionParametersModal
          open
          actionName={editingAction.name}
          parameters={editingAction.parameters}
          initialValues={valuesForAction(editingAction)}
          mode="edit"
          onSave={(values) => {
            onChange?.({ ...valueMap, [editingAction.id]: values });
            setEditingActionId(null);
          }}
          onCancel={() => setEditingActionId(null)}
        />
      )}
    </div>
  );
}
