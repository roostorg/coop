import type { ItemTypeFieldFieldData } from '@/webpages/dashboard/item_types/itemTypeUtils';
import { Field, RelatedItem, ScalarType } from '@roostorg/types';
import omit from 'lodash/omit';

const createFieldType = (name: string, type: ScalarType) =>
  ({ name, type, required: false, container: null }) satisfies Field;

export const convertRelatedItemToFieldData = (
  relatedItem: RelatedItem,
  userScore?: number,
) =>
  [
    ...Object.entries(omit(relatedItem, ['name', 'typeId'])).map(
      ([key, value]) => ({
        ...createFieldType(key, 'STRING'),
        value,
      }),
    ),
    userScore
      ? { ...createFieldType('User Score', 'NUMBER'), value: userScore }
      : {},
  ] as ItemTypeFieldFieldData[];
