type ItemTypeFieldOrigin = {
  persisted: boolean;
  originallyRequired: boolean;
  addedToExistingItemType: boolean;
};

export function getItemTypeFieldEditability(field: ItemTypeFieldOrigin) {
  return {
    canRename: !field.persisted,
    canChangeType: !field.persisted,
    canDelete: !field.persisted,
    canToggleRequired:
      (!field.persisted && !field.addedToExistingItemType) ||
      (field.persisted && field.originallyRequired),
  };
}
