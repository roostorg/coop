type ItemData = { readonly [key: string]: unknown };

/** Coerce a string threadId to { id, typeId } when the content type has that field role. */
export function coerceStringThreadId(
  content: ItemData,
  itemType: { readonly id: string; readonly schemaFieldRoles: unknown },
): ItemData {
  const roles = itemType.schemaFieldRoles;
  if (typeof roles !== 'object' || roles === null || !('threadId' in roles)) {
    return content;
  }

  const threadIdField = roles.threadId;
  if (
    typeof threadIdField !== 'string' ||
    typeof content[threadIdField] !== 'string' ||
    content[threadIdField].length === 0
  ) {
    return content;
  }

  return {
    ...content,
    [threadIdField]: {
      id: content[threadIdField],
      typeId: itemType.id,
    },
  };
}
