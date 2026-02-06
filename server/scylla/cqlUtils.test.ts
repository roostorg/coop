import { buildCQLSelectQuery } from './cqlUtils.js';

describe('buildCQLSelectQuery', () => {
  test('should only build valid CQL query strings', () => {
    const query = buildCQLSelectQuery({
      from: 'users',
      select: ['id', 'name'],
      where: [['id', '=', 1]],
      limit: 1,
      sortOrder: [['name', 'ASC']],
    });
    expect(query.query).toEqual(
      `SELECT "id", "name" FROM users WHERE "id" = ? ORDER BY name ASC LIMIT 1;`,
    );
    const itemInvestigationQuery = buildCQLSelectQuery({
      from: 'item_submission_by_thread_and_time',
      select: '*',
      where: [
        ['org_id', '=', 'test_org_id'],
        ['synthetic_thread_id', '=', 1],
        ['item_synthetic_created_at', '<', 2],
        ['item_synthetic_created_at', '>=', 3],
      ],
      limit: 100,
      sortOrder: [['item_synthetic_created_at', 'DESC']],
    });
    expect(itemInvestigationQuery.query).toEqual(
      `SELECT * FROM item_submission_by_thread_and_time WHERE "org_id" = ? AND "synthetic_thread_id" = ? AND "item_synthetic_created_at" < ? AND "item_synthetic_created_at" >= ? ORDER BY item_synthetic_created_at DESC LIMIT 100;`,
    );
  });
  test('should only build valid CQL query strings with aggregate functions', () => {
    const query = buildCQLSelectQuery({
      from: 'users',
      select: ['org_id', 'id', { aggregate: 'count', col: 'integer_column' }],
      where: [['org_id', '=', 1]],
      groupBy: ['id'],
    });
    console.log(query.query);
    expect(query.query).toEqual(
      `SELECT "org_id", "id", count(integer_column) AS integer_column FROM users WHERE "org_id" = ? GROUP BY "id";`,
    );
  });
});
