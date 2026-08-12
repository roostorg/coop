import { type GQLActionParameter } from '@/graphql/generated';
import { Tooltip } from 'antd';
import { useEffect, useState } from 'react';

import CoopModal from '@/webpages/dashboard/components/CoopModal';
import { type CoopModalFooterButtonProps } from '@/webpages/dashboard/components/CoopModalFooter';

import ActionParameterInputs, {
  findMissingRequiredParameters,
  type ActionParameterValues,
} from './ActionParameterInputs';

type Props = {
  open: boolean;
  /** Display name shown in the modal title (e.g. action name). */
  actionName: string;
  parameters: ReadonlyArray<GQLActionParameter>;
  /**
   * Values to pre-fill the form with. In `create` mode this is typically the
   * spec's defaults; in `edit` mode it's whatever the moderator previously
   * saved. The modal owns its own working copy and only reports it back via
   * `onSave`, so cancelling never mutates the parent.
   */
  initialValues: ActionParameterValues;
  /** `create` adds a new selection; `edit` updates an existing one. */
  mode: 'create' | 'edit';
  onSave: (values: ActionParameterValues) => void;
  onCancel: () => void;
};

/**
 * Modal wrapper around `ActionParameterInputs` for picking parameter values
 * before an action is committed to the selection. Used in screens where
 * multiple parameterized actions can be selected and inline editing would
 * become visually crowded (e.g. MRT review).
 */
export default function ActionParametersModal({
  open,
  actionName,
  parameters,
  initialValues,
  mode,
  onSave,
  onCancel,
}: Props) {
  const [values, setValues] = useState<ActionParameterValues>(initialValues);

  // Re-seed the working copy whenever the modal is (re-)opened so a stale
  // edit from a previous open doesn't leak into a new session.
  useEffect(() => {
    if (open) {
      setValues(initialValues);
    }
  }, [open, initialValues]);

  const missing = findMissingRequiredParameters(parameters, values);
  const canSave = missing.length === 0;
  const saveTitle = mode === 'create' ? 'Add' : 'Save';

  const footer: CoopModalFooterButtonProps[] = [
    {
      title: 'Cancel',
      type: 'secondary',
      onClick: onCancel,
    },
    {
      title: saveTitle,
      type: 'primary',
      disabled: !canSave,
      onClick: () => onSave(values),
    },
  ];

  return (
    <CoopModal
      visible={open}
      onClose={onCancel}
      title={`"${actionName}" details`}
      footer={footer}
    >
      <div className="flex flex-col min-w-[28rem] max-w-[36rem]">
        <ActionParameterInputs
          parameters={parameters}
          values={values}
          onChange={setValues}
          idPrefix={`action-params-modal-${actionName}`}
        />
        {!canSave && (
          <Tooltip title={`Missing: ${missing.join(', ')}`}>
            <div className="mt-3 text-xs text-coop-alert-red">
              Fill in{' '}
              {missing.length === 1
                ? 'the required field'
                : 'all required fields'}{' '}
              to continue.
            </div>
          </Tooltip>
        )}
      </div>
    </CoopModal>
  );
}

/**
 * Builds an initial `ActionParameterValues` map from a parameter spec by
 * copying each parameter's `defaultValue` (when set). Used to seed the modal
 * the first time an action is selected.
 */
export function defaultValuesForParameters(
  parameters: ReadonlyArray<GQLActionParameter>,
): ActionParameterValues {
  const out: Record<string, unknown> = {};
  for (const param of parameters) {
    if (param.defaultValue !== undefined && param.defaultValue !== null) {
      out[param.name] = param.defaultValue;
    }
  }
  return out;
}
