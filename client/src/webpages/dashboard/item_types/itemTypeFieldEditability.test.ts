import { describe, expect, it } from 'vitest';

import { getItemTypeFieldEditability } from './itemTypeFieldEditability';

describe('getItemTypeFieldEditability', () => {
  it.each([
    {
      name: 'persisted required field',
      field: {
        persisted: true,
        originallyRequired: true,
        addedToExistingItemType: false,
      },
      expected: {
        canRename: false,
        canChangeType: false,
        canDelete: false,
        canToggleRequired: true,
      },
    },
    {
      name: 'persisted optional field',
      field: {
        persisted: true,
        originallyRequired: false,
        addedToExistingItemType: false,
      },
      expected: {
        canRename: false,
        canChangeType: false,
        canDelete: false,
        canToggleRequired: false,
      },
    },
    {
      name: 'new field on an existing item type',
      field: {
        persisted: false,
        originallyRequired: false,
        addedToExistingItemType: true,
      },
      expected: {
        canRename: true,
        canChangeType: true,
        canDelete: true,
        canToggleRequired: false,
      },
    },
    {
      name: 'field on a new item type',
      field: {
        persisted: false,
        originallyRequired: false,
        addedToExistingItemType: false,
      },
      expected: {
        canRename: true,
        canChangeType: true,
        canDelete: true,
        canToggleRequired: true,
      },
    },
  ])('returns the expected permissions for a $name', ({ field, expected }) => {
    expect(getItemTypeFieldEditability(field)).toEqual(expected);
  });
});
