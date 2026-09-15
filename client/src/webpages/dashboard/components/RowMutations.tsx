import { Button } from '@/coop-ui/Button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/coop-ui/Tooltip';
import { placementToSideAlign } from '@/lib/tooltip';
import { Pencil as PencilFilled, Trash2 as TrashCanFilled } from 'lucide-react';
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
      <Tooltip>
        <TooltipTrigger asChild>
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
        </TooltipTrigger>
        <TooltipContent
          {...placementToSideAlign(
            canEdit || editDisabledTooltipTitle == null ? 'top' : 'topRight',
          )}
        >
          {canEdit || editDisabledTooltipTitle == null
            ? 'Edit'
            : editDisabledTooltipTitle}
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
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
        </TooltipTrigger>
        <TooltipContent
          {...placementToSideAlign(
            canDelete || deleteDisabledTooltipTitle == null
              ? 'top'
              : 'topRight',
          )}
        >
          {canDelete || deleteDisabledTooltipTitle == null
            ? 'Delete'
            : deleteDisabledTooltipTitle}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
