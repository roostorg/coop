import { coerceStringThreadId } from './coerceStringThreadId.js';

describe('coerceStringThreadId', () => {
  const itemType = {
    id: 'content-type-1',
    schemaFieldRoles: { threadId: 'threadId', createdAt: 'createdAt' },
  };

  it('wraps a non-empty string threadId as { id, typeId }', () => {
    expect(
      coerceStringThreadId(
        { message: 'hello', threadId: 'thread-1' },
        itemType,
      ),
    ).toEqual({
      message: 'hello',
      threadId: { id: 'thread-1', typeId: 'content-type-1' },
    });
  });

  it('leaves an already-object threadId unchanged', () => {
    const content = {
      message: 'hello',
      threadId: { id: 'thread-1', typeId: 'thread-type-1' },
    };

    expect(coerceStringThreadId(content, itemType)).toBe(content);
  });

  it('leaves an empty string threadId unchanged', () => {
    const content = { message: 'hello', threadId: '' };

    expect(coerceStringThreadId(content, itemType)).toBe(content);
  });

  it('leaves content unchanged when the type has no threadId role', () => {
    const content = { message: 'hello', threadId: 'thread-1' };

    expect(
      coerceStringThreadId(content, {
        id: 'content-type-1',
        schemaFieldRoles: {},
      }),
    ).toBe(content);
  });
});
