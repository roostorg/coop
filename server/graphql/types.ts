import {
  type ItemSubmission,
  type NormalizedItemData,
  type SubmissionId,
} from '../services/itemProcessingService/index.js';
import { type ItemType } from '../services/moderationConfigService/index.js';

export { type ItemIdentifier } from '@roostorg/types';

/**
 * GQL exposes what is essentially an `ItemSubmission` using a different layout
 * of the fields (and called just `Item`), because `ItemSubmission` didn't fully
 * exist when the GQL API started returning item data. So, this types represents
 * an `ItemSubmission` in the shape GQL needs.
 */
export type ItemSubmissionForGQL<T extends ItemType = ItemType> = Readonly<{
  id: string; // the item id.
  type: T;
  data: NormalizedItemData;
  submissionId: SubmissionId;
  submissionTime?: Date;
}>;

/**
 * See note on {@link ItemSubmissionForGQL}.
 */
export function formatItemSubmissionForGQL<T extends ItemType = ItemType>(
  it: ItemSubmission<T>,
): ItemSubmissionForGQL<T> {
  return {
    id: it.itemId,
    type: it.itemType,
    data: it.data,
    submissionId: it.submissionId,
    submissionTime: it.submissionTime,
  };
}
