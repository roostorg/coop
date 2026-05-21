import Pencil from '@/icons/lni/Education/pencil.svg?react';
import UserAlt4 from '@/icons/lni/User/user-alt-4.svg?react';
import { ItemIdentifier } from '@roostorg/types';
import { Tooltip } from 'antd';

import CloseButton from '@/components/common/CloseButton';

import ManualReviewJobMagnifyImageComponent from '../ManualReviewJobMagnifyImageComponent';

/**
 * This component is used to display an enqueued related action within MRT. It
 * includes the entity itself, as well as the policies that were associated with
 * this decision.
 */
export default function ManualReviewJobEnqueuedRelatedActionEntry(props: {
  label: string;
  sublabel?: string;
  itemIdentifier: ItemIdentifier;
  iconUrl?: string;
  policyNames: readonly string[];
  onRemove: () => void;
  // Optional edit affordance for parameterized actions. Hidden when
  // `undefined` so non-parameterized entries stay unchanged.
  onEditParameters?: () => void;
}) {
  const {
    label,
    sublabel,
    itemIdentifier,
    iconUrl,
    policyNames,
    onRemove,
    onEditParameters,
  } = props;

  return (
    <div className="flex flex-col items-start w-full min-w-0">
      <div className="flex flex-row items-center w-full pr-2 gap-3">
        <ManualReviewJobMagnifyImageComponent
          itemIdentifier={itemIdentifier}
          imageUrl={iconUrl}
          label={label}
          sublabel={sublabel}
          fallbackComponent={<UserAlt4 className="p-3 fill-slate-500 w-11" />}
          labelTruncationType="wrap"
        />
        {onEditParameters && (
          <Tooltip title="Edit details">
            <button
              type="button"
              aria-label="Edit action details"
              className="flex items-center justify-center w-5 h-5 text-slate-400 hover:text-slate-700 cursor-pointer bg-transparent border-none p-0"
              onClick={onEditParameters}
            >
              <Pencil className="w-3 h-3 fill-current" />
            </button>
          </Tooltip>
        )}
        <CloseButton onClose={onRemove} />
      </div>
      {policyNames.length > 0 ? (
        <div className="pt-1 text-sm">{`${
          policyNames.length > 1 ? 'Policies' : 'Policy'
        }: ${policyNames.join(', ')}`}</div>
      ) : null}
    </div>
  );
}
