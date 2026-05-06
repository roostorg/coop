import ActionParametersModal, {
  defaultValuesForParameters,
} from '@/components/ActionParametersModal';
import { type GQLActionParameter } from '@/graphql/generated';
import groupBy from 'lodash/groupBy';
import { type ReactNode, useCallback, useState } from 'react';

import { type ManualReviewJobEnqueuedActionData } from '../ManualReviewJobReview';

type ActionWithParameters = {
  id: string;
  name: string;
  parameters?: ReadonlyArray<GQLActionParameter> | null;
};

type PendingGroup = {
  actionId: string;
  actionName: string;
  parameters: ReadonlyArray<GQLActionParameter>;
  items: ManualReviewJobEnqueuedActionData[];
};

/**
 * Wraps an `onEnqueueActions` callback so that any incoming items whose
 * action declares `parameters` are gated behind the shared
 * `ActionParametersModal`. Items for an action without parameters (or that
 * already carry a `customMrtApiParamDecisionPayload` from another flow) pass
 * through unchanged.
 *
 * Multiple targets enqueued for the same action in one batch share a single
 * modal prompt; the saved values are applied to every target in that group.
 *
 * Returns the wrapped callback and a `modalElement` the caller is
 * responsible for rendering once.
 */
export function useEnqueueActionGate(args: {
  allActions: ReadonlyArray<ActionWithParameters>;
  onEnqueueActions: (actions: ManualReviewJobEnqueuedActionData[]) => void;
}): {
  enqueueActions: (actions: ManualReviewJobEnqueuedActionData[]) => void;
  modalElement: ReactNode;
} {
  const { allActions, onEnqueueActions } = args;
  const [queue, setQueue] = useState<ReadonlyArray<PendingGroup>>([]);

  const enqueueActions = useCallback(
    (actions: ManualReviewJobEnqueuedActionData[]) => {
      const passthrough: ManualReviewJobEnqueuedActionData[] = [];
      const newGroups: PendingGroup[] = [];

      const grouped = groupBy(actions, (a) => a.action.id);
      for (const [actionId, items] of Object.entries(grouped)) {
        const actionMeta = allActions.find((a) => a.id === actionId);
        const parameters = actionMeta?.parameters ?? [];
        const needsPrompt = (it: ManualReviewJobEnqueuedActionData) =>
          parameters.length > 0 && it.customMrtApiParamDecisionPayload == null;
        const itemsNeedingPrompt = items.filter(needsPrompt);
        const itemsReady = items.filter((it) => !needsPrompt(it));

        if (itemsReady.length > 0) passthrough.push(...itemsReady);
        if (itemsNeedingPrompt.length > 0) {
          newGroups.push({
            actionId,
            actionName: actionMeta?.name ?? actionId,
            parameters,
            items: itemsNeedingPrompt,
          });
        }
      }

      if (passthrough.length > 0) onEnqueueActions(passthrough);
      if (newGroups.length > 0) {
        setQueue((prev) => [...prev, ...newGroups]);
      }
    },
    [allActions, onEnqueueActions],
  );

  const advance = useCallback(
    () => setQueue((prev) => prev.slice(1)),
    [],
  );

  const current = queue[0];
  const modalElement = current ? (
    <ActionParametersModal
      open
      mode="create"
      actionName={current.actionName}
      parameters={current.parameters}
      initialValues={defaultValuesForParameters(current.parameters)}
      onCancel={advance}
      onSave={(values) => {
        onEnqueueActions(
          current.items.map((it) => ({
            ...it,
            customMrtApiParamDecisionPayload: { ...values },
          })),
        );
        advance();
      }}
    />
  ) : null;

  return { enqueueActions, modalElement };
}
