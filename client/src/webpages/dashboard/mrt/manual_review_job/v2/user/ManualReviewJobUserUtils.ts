import type { ItemTypeFieldFieldData } from '@/webpages/dashboard/item_types/itemTypeUtils';
import { Field, RelatedItem, ScalarType } from '@roostorg/coop-types';

const createFieldType = (name: string, type: ScalarType) =>
  ({ name, type, required: false, container: null }) satisfies Field;

// Only surface the `id`: the related item's other fields are rendered from its
// typed schema elsewhere, so spreading any denormalized keys the reference may
// carry would duplicate those fields (as untyped strings).
export const convertRelatedItemToFieldData = (relatedItem: RelatedItem) =>
  [
    {
      ...createFieldType('id', 'STRING'),
      value: relatedItem.id,
    },
  ] as ItemTypeFieldFieldData[];
