import { ReactComponent as UserAlt4 } from '@/icons/lni/User/user-alt-4.svg';
import { ItemIdentifier } from '@roostorg/types';

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
}) {
  const { label, sublabel, itemIdentifier, iconUrl, policyNames, onRemove } =
    props;

  return (
    <div className="flex flex-col items-start max-w-[240px]">
      <div className="flex flex-row items-center w-full pr-2 gap-3">
        <ManualReviewJobMagnifyImageComponent
          itemIdentifier={itemIdentifier}
          imageUrl={iconUrl}
          label={label}
          sublabel={sublabel}
          fallbackComponent={<UserAlt4 className="p-3 fill-slate-500 w-11" />}
          labelTruncationType="wrap"
        />
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
