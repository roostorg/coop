import { Button } from '@/coop-ui/Button';
import { PencilFilled, TrashCanFilled } from '@/icons';
import { Tooltip } from 'antd';
import { MouseEvent, ReactNode } from 'react';

export type DeleteRowModalInfo = {
  id: string;
  visible: boolean;
};

export default function RowMutations(props: {
  onEdit: (event: MouseEvent) => void;
  onDelete: (event: MouseEvent) => void;
  canEdit?: boolean;
  editDisabledTooltipTitle?: string | ReactNode;
  canDelete?: boolean;
  deleteDisabledTooltipTitle?: string | ReactNode;
}) {
  const {
    onEdit,
    onDelete,
    canEdit = true,
    editDisabledTooltipTitle,
    canDelete = true,
    deleteDisabledTooltipTitle,
  } = props;

  return (
    <div className="flex">
      <Tooltip
        title={
          canEdit || editDisabledTooltipTitle == null
            ? 'Edit'
            : editDisabledTooltipTitle
        }
        placement={
          canEdit || editDisabledTooltipTitle == null ? 'top' : 'topRight'
        }
      >
        <div className="px-2">
          <Button
            size="icon"
            variant="ghost"
            disabled={!canEdit}
            onClick={onEdit}
          >
            <PencilFilled className="w-6 h-6 text-primary" />
          </Button>
        </div>
      </Tooltip>
      <Tooltip
        title={
          canDelete || deleteDisabledTooltipTitle == null
            ? 'Delete'
            : deleteDisabledTooltipTitle
        }
        placement={
          canDelete || deleteDisabledTooltipTitle == null ? 'top' : 'topRight'
        }
      >
        <div className="px-2">
          <Button
            size="icon"
            variant="ghost"
            disabled={!canDelete}
            onClick={onDelete}
          >
            <TrashCanFilled className="w-6 h-6 text-red-800" />
          </Button>
        </div>
      </Tooltip>
    </div>
  );
}
