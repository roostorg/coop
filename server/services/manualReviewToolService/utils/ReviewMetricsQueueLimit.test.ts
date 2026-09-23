import QueueOperations from '../modules/QueueOperations.js';

const typed = <T>(value: unknown) => value as T;

it('bounds the SQL queue query for monitoring and leaves normal callers unbounded', async () => {
  let limit: number | undefined;
  const rows = Array.from({ length: 60 }, (_, id) => ({ id: `${id}` }));
  const query = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn(),
    execute: jest.fn(async () =>
      limit === undefined ? rows : rows.slice(0, limit),
    ),
  };
  query.limit.mockImplementation((value: number) => {
    limit = value;
    return query;
  });
  const db = {
    selectFrom: jest.fn(() => {
      limit = undefined;
      return query;
    }),
  };
  const args: ConstructorParameters<typeof QueueOperations> = [
    typed(db),
    typed({}),
    typed({}),
    typed({}),
    typed({}),
  ];
  const queues = new QueueOperations(...args);
  const bounded =
    await queues.getAllQueuesForOrgAndDangerouslyBypassPermissioning('org', 51);
  expect(query.limit).toHaveBeenCalledWith(51);
  expect(bounded).toHaveLength(51);
  expect(bounded.length).toBeGreaterThan(50);
  expect(query.where).toHaveBeenCalledWith('org_id', '=', 'org');
  query.limit.mockClear();
  expect(
    await queues.getAllQueuesForOrgAndDangerouslyBypassPermissioning('org'),
  ).toHaveLength(60);
  expect(query.limit).not.toHaveBeenCalled();
});
