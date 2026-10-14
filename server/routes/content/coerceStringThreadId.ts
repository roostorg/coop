type ItemData = { readonly [key: string]: unknown };

/** Coerce a string threadId to { id, typeId } when the content type has that field role. */
export function coerceStringThreadId<T extends ItemData>(
  content: T,
  itemType: { id: string; schemaFieldRoles: { readonly threadId?: string } },
): T {
  const threadIdField =
    'threadId' in itemType.schemaFieldRoles
      ? itemType.schemaFieldRoles.threadId
      : undefined;
  if (
    !threadIdField ||
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
  } as T;
}
