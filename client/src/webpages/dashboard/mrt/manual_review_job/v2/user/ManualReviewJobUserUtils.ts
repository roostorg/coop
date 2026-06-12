import type { ItemTypeFieldFieldData } from '@/webpages/dashboard/item_types/itemTypeUtils';
import { Field, RelatedItem, ScalarType } from '@roostorg/coop-types';
import omit from 'lodash/omit';

const createFieldType = (name: string, type: ScalarType) =>
  ({ name, type, required: false, container: null }) satisfies Field;

const normalizeFieldName = (name: string) => name.trim().toLowerCase();

export const userStrikeCountField = (
  count: number,
): ItemTypeFieldFieldData => ({
  name: 'Strikes',
  type: 'NUMBER',
  required: false,
  container: null,
  value: count,
});

// `schemaRenderedFieldNames` are fields the caller already renders from the
// typed schema; inlined keys matching one are skipped to avoid showing the same
// field twice (roostorg/coop#716). Match is case/whitespace-insensitive.
export const convertRelatedItemToFieldData = (
  relatedItem: RelatedItem,
  schemaRenderedFieldNames: readonly string[] = [],
) => {
  const renderedNames = new Set(
    schemaRenderedFieldNames.map(normalizeFieldName),
  );
  return Object.entries(omit(relatedItem, ['name', 'typeId']))
    .filter(([key]) => !renderedNames.has(normalizeFieldName(key)))
    .map(([key, value]) => ({
      ...createFieldType(key, 'STRING'),
      value,
    })) as ItemTypeFieldFieldData[];
};
