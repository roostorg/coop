import { RelatedItem } from '@roostorg/types';

import { GQLContentItem } from '../../../../../../graphql/generated';
import { getFieldValueForRole } from '../../../../../../utils/itemUtils';

export const areAllUsersMessagesSelected = (
  threadMessages: readonly GQLContentItem[],
  selectedMessages: readonly GQLContentItem[],
  author?: RelatedItem,
) => {
  if (!author) {
    return false;
  }
  const allUsersMessages = threadMessages.filter(
    (msg) => getFieldValueForRole(msg, 'creatorId')?.id === author.id,
  );
  const selectedUsersMessages = selectedMessages.filter(
    (msg) => getFieldValueForRole(msg, 'creatorId')?.id === author.id,
  );
  return allUsersMessages.length === selectedUsersMessages.length;
};

export const selectAllUsersMessages = (
  threadMessages: readonly GQLContentItem[],
  selectedMessages: readonly GQLContentItem[],
  setSelectedMessages: (messages: GQLContentItem[]) => void,
  author: RelatedItem,
) => {
  const allOtherSelectedMessages = selectedMessages.filter(
    (msg) => getFieldValueForRole(msg, 'creatorId')?.id !== author.id,
  );
  const allUsersMessages = threadMessages.filter(
    (msg) => getFieldValueForRole(msg, 'creatorId')?.id === author.id,
  );
  setSelectedMessages([...allOtherSelectedMessages, ...allUsersMessages]);
};

export const deselectAllUsersMessages = (
  selectedMessages: readonly GQLContentItem[],
  setSelectedMessages: (messages: GQLContentItem[]) => void,
  author: RelatedItem,
) => {
  setSelectedMessages(
    selectedMessages.filter(
      (msg) => getFieldValueForRole(msg, 'creatorId')?.id !== author.id,
    ),
  );
};
