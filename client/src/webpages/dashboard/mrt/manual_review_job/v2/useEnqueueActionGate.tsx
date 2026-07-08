import { type GQLActionParameter } from '@/graphql/generated';
import groupBy from 'lodash/groupBy';
import { useCallback, useState, type ReactNode } from 'react';

import { type ActionParameterValues } from '@/components/ActionParameterInputs';
import ActionParametersModal, {
  defaultValuesForParameters,
} from '@/components/ActionParametersModal';

import { type ManualReviewJobEnqueuedActionData } from '../ManualReviewJobReview';

type ActionWithParameters = {
  id: string;
  name: string;
  parameters?: ReadonlyArray<GQLActionParameter> | null;
};

type PendingGroup = {
  mode: 'create';
  actionId: string;
  actionName: string;
  parameters: ReadonlyArray<GQLActionParameter>;
  items: ManualReviewJobEnqueuedActionData[];
  initialValues: ActionParameterValues;
};

type EditTarget = {
  mode: 'edit';
  actionId: string;
  actionName: string;
  parameters: ReadonlyArray<GQLActionParameter>;
  initialValues: ActionParameterValues;
  // Predicate identifying the entry whose payload should be updated.
  match: (entry: ManualReviewJobEnqueuedActionData) => boolean;
};

type QueueEntry = PendingGroup | EditTarget;

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
 * Also exposes `editParameters(entry, allEnqueued, replaceAll)` for
 * re-opening the modal against an already-enqueued entry — the saved values
 * replace just that entry's payload via `replaceAll`.
 *
 * Returns the wrapped callback, the editor opener, and a `modalElement` the
 * caller is responsible for rendering once.
 */
export function useEnqueueActionGate(args: {
  allActions: ReadonlyArray<ActionWithParameters>;
  onEnqueueActions: (actions: ManualReviewJobEnqueuedActionData[]) => void;
}): {
  enqueueActions: (actions: ManualReviewJobEnqueuedActionData[]) => void;
  editParameters: (
    entry: ManualReviewJobEnqueuedActionData,
    allEnqueued: ReadonlyArray<ManualReviewJobEnqueuedActionData>,
    replaceAll: (next: ManualReviewJobEnqueuedActionData[]) => void,
  ) => void;
  modalElement: ReactNode;
} {
  const { allActions, onEnqueueActions } = args;
  const [queue, setQueue] = useState<ReadonlyArray<QueueEntry>>([]);
  const [editCommit, setEditCommit] = useState<
    ((values: ActionParameterValues) => void) | null
  >(null);

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
            mode: 'create',
            actionId,
            actionName: actionMeta?.name ?? actionId,
            parameters,
            items: itemsNeedingPrompt,
            initialValues: defaultValuesForParameters(parameters),
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

  const editParameters = useCallback(
    (
      entry: ManualReviewJobEnqueuedActionData,
      allEnqueued: ReadonlyArray<ManualReviewJobEnqueuedActionData>,
      replaceAll: (next: ManualReviewJobEnqueuedActionData[]) => void,
    ) => {
      const actionMeta = allActions.find((a) => a.id === entry.action.id);
      const parameters = actionMeta?.parameters ?? [];
      if (parameters.length === 0) return;
      const initialValues =
        entry.customMrtApiParamDecisionPayload ??
        defaultValuesForParameters(parameters);
      const match = (it: ManualReviewJobEnqueuedActionData) =>
        it.action.id === entry.action.id &&
        it.target.identifier.itemId === entry.target.identifier.itemId &&
        it.target.identifier.itemTypeId === entry.target.identifier.itemTypeId;
      // Snapshot `allEnqueued` so the commit reads from the moment the user
      // opened the editor; the parent's state may move on while the modal is
      // up.
      const commit = (values: ActionParameterValues) => {
        replaceAll(
          allEnqueued.map((it) =>
            match(it)
              ? {
                  ...it,
                  customMrtApiParamDecisionPayload: { ...values },
                }
              : it,
          ),
        );
      };
      setEditCommit(() => commit);
      setQueue((prev) => [
        ...prev,
        {
          mode: 'edit',
          actionId: entry.action.id,
          actionName: actionMeta?.name ?? entry.action.name,
          parameters,
          initialValues,
          match,
        },
      ]);
    },
    [allActions],
  );

  const advance = useCallback(() => {
    setQueue((prev) => prev.slice(1));
    setEditCommit(null);
  }, []);

  const current = queue[0];
  const modalElement = current ? (
    <ActionParametersModal
      open
      mode={current.mode}
      actionName={current.actionName}
      parameters={current.parameters}
      initialValues={current.initialValues}
      onCancel={advance}
      onSave={(values) => {
        if (current.mode === 'create') {
          onEnqueueActions(
            current.items.map((it) => ({
              ...it,
              customMrtApiParamDecisionPayload: { ...values },
            })),
          );
        } else if (editCommit) {
          editCommit(values);
        }
        advance();
      }}
    />
  ) : null;

  return { enqueueActions, editParameters, modalElement };
}
