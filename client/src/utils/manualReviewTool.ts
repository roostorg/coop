import { ManualReviewJobEnqueuedActionData } from '../webpages/dashboard/mrt/manual_review_job/ManualReviewJobReview';

const areRelatedActionsEqual = (
  a: ManualReviewJobEnqueuedActionData,
  b: ManualReviewJobEnqueuedActionData,
) =>
  a.action.id === b.action.id &&
  a.target.identifier.itemTypeId === b.target.identifier.itemTypeId &&
  a.target.identifier.itemId === b.target.identifier.itemId;

/**
 * This function recomputes the enqueued related actions based on the most
 * recently chosen policies for each action. This is more complex than it seems
 * at first glance because of scenarios such as selecting messages within a
 * thread, where we might encounter diverse combinations of selected messages
 * leading to the enqueueing of varied actions. To manage this, we prioritize
 * the new actions introduced over the existing related actions in the queue.
 * More specifically, if a new action comes into play, and there's an associated
 * action already queued for this specific (actionId, itemId, itemTypeId)
 * triplet, we override the existing action with the new one. This operation
 * primarily serves to keep our selected policies up-to-date.
 *
 * @param newActions The new actions that are being enqueued from a user action
 * @param selectedRelatedActions The currently enqueued related actions
 * @param setSelectedRelatedActions Setter passed in from the caller (likely a
 * state update to refresh the UI)
 */
export function recomputeSelectedRelatedActions(
  newActions: ManualReviewJobEnqueuedActionData[],
  selectedRelatedActions: ManualReviewJobEnqueuedActionData[],
) {
  if (selectedRelatedActions.length === 0) {
    return newActions;
  }

  // We concatenate two arrays to recombine our final result before calling
  // our setter:
  // 1. We map over the selectedRelatedActions and replace each element with
  //    the corresponding element from newActions if there is one, otherwise
  //    we keep the current related action
  // 2. We filter out any elements from newActions that had a corresponding
  //    related action in selectedRelatedActions
  return [
    ...selectedRelatedActions.map(
      (relatedAction) =>
        newActions.find((newAction) =>
          areRelatedActionsEqual(relatedAction, newAction),
        ) ?? relatedAction,
    ),
    ...newActions.filter(
      (newAction) =>
        !selectedRelatedActions.some((it) =>
          areRelatedActionsEqual(newAction, it),
        ),
    ),
  ];
}
