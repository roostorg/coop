import { type Kysely } from 'kysely';

import { deleteSessionsForUser } from './sessionPersistence.js';

// Build a mock Kysely whose `deleteFrom(...)` returns a chainable
// `{ where, execute }`, so we can assert the issued query shape.
function makeMockDb() {
  const execute = jest.fn().mockResolvedValue([]);
  const where = jest.fn();
  const builder = { where, execute };
  where.mockReturnValue(builder);
  const deleteFrom = jest.fn().mockReturnValue(builder);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = { deleteFrom } as unknown as Kysely<any>;
  return { db, deleteFrom, where, execute };
}

describe('deleteSessionsForUser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deletes session rows matching the user id', async () => {
    const { db, deleteFrom, where, execute } = makeMockDb();

    await deleteSessionsForUser(db, 'user-123');

    expect(deleteFrom).toHaveBeenCalledWith('public.session');
    // Matches on the passport user id; no `sid` exclusion when none requested.
    expect(where).toHaveBeenCalledTimes(1);
    expect(where).toHaveBeenCalledWith(expect.anything(), '=', 'user-123');
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('preserves the caller session when exceptSid is given', async () => {
    const { db, where, execute } = makeMockDb();

    await deleteSessionsForUser(db, 'user-123', { exceptSid: 'sid-abc' });

    expect(where).toHaveBeenCalledWith(expect.anything(), '=', 'user-123');
    expect(where).toHaveBeenCalledWith('sid', '!=', 'sid-abc');
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
