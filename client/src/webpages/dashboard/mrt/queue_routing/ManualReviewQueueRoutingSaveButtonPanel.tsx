import { Tooltip } from 'antd';
import { ReactNode } from 'react';

import CoopButton from '../../components/CoopButton';

export default function ManualReviewQueueRoutingSaveButtonPanel(props: {
  onClickSave: () => void;
  onCancel: () => void;
  loading?: boolean;
  disabledInfo?: {
    saveDisabled: boolean;
    disabledTooltip?: string | ReactNode;
  };
  saveButtonTitle?: string;
}) {
  const {
    onClickSave,
    onCancel,
    loading,
    disabledInfo,
    saveButtonTitle = 'Save',
  } = props;

  const { saveDisabled, disabledTooltip } = disabledInfo ?? {};

  const saveButton = (
    <CoopButton
      title={saveButtonTitle}
      size="middle"
      onClick={saveDisabled || loading ? undefined : onClickSave}
      loading={loading}
      disabled={saveDisabled ?? loading}
    />
  );
  return (
    <div className="flex flex-row gap-4">
      <CoopButton
        title="Cancel"
        type="secondary"
        size="middle"
        onClick={onCancel}
      />
      {saveDisabled ? (
        <Tooltip title={disabledTooltip}>{saveButton}</Tooltip>
      ) : (
        saveButton
      )}
    </div>
  );
}
