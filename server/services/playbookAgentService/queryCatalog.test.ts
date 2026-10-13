import QueryCatalog, { parseCatalogEntry } from './queryCatalog.js';

describe('parseCatalogEntry', () => {
  it('parses a SQL template with metadata comments', () => {
    const sql = `-- catalog_id: login_patterns
-- version: 1.0.0
-- description: Login frequency analysis
-- Human-authored, versioned, pre-approved

SELECT
    DATE(login_timestamp) AS login_date,
    COUNT(*) AS login_count
FROM account_logins
WHERE account_id = :account_id
  AND login_timestamp >= DATEADD(day, -:lookback_days, :alert_timestamp)
LIMIT 30;`;

    const entry = parseCatalogEntry(sql);
    expect(entry.catalogId).toBe('login_patterns');
    expect(entry.version).toBe('1.0.0');
    expect(entry.description).toBe('Login frequency analysis');
    expect(entry.parameters).toEqual(
      expect.arrayContaining(['account_id', 'lookback_days', 'alert_timestamp']),
    );
    expect(entry.sql).toContain('SELECT');
    expect(entry.sql).toContain(':account_id');
  });

  it('throws on missing catalog_id', () => {
    const sql = `-- version: 1.0.0
SELECT 1;`;
    expect(() => parseCatalogEntry(sql)).toThrow('catalog_id');
  });

  it('throws on missing version', () => {
    const sql = `-- catalog_id: test_query
SELECT 1;`;
    expect(() => parseCatalogEntry(sql)).toThrow('version');
  });

  it('deduplicates parameters', () => {
    const sql = `-- catalog_id: test
-- version: 1.0.0
SELECT * FROM t WHERE a = :id AND b = :id;`;

    const entry = parseCatalogEntry(sql);
    // :id appears twice but should be deduplicated
    expect(entry.parameters.filter((p) => p === 'id')).toHaveLength(1);
  });
});

describe('QueryCatalog', () => {
  const entries = [
    {
      catalogId: 'query_a',
      version: '1.0.0',
      description: 'Query A',
      sql: 'SELECT * FROM a WHERE id = :id',
      parameters: ['id'],
    },
    {
      catalogId: 'query_b',
      version: '2.0.0',
      description: 'Query B',
      sql: 'SELECT * FROM b WHERE x = :x AND y = :y',
      parameters: ['x', 'y'],
    },
  ];

  it('resolves by CatalogReference', () => {
    const catalog = new QueryCatalog(entries);
    const result = catalog.resolve({
      catalogId: 'query_a',
      version: { major: 1, minor: 0, patch: 0 },
      catalogType: 'query',
    });
    expect(result).toBeDefined();
    expect(result!.catalogId).toBe('query_a');
  });

  it('resolves by string', () => {
    const catalog = new QueryCatalog(entries);
    expect(catalog.resolveByString('query_b@2.0.0')).toBeDefined();
    expect(catalog.resolveByString('query_b@1.0.0')).toBeUndefined();
  });

  it('renders SQL with positional parameters', () => {
    const catalog = new QueryCatalog(entries);
    const entry = catalog.resolveByString('query_b@2.0.0')!;

    const { sql, bindings } = catalog.renderSql(entry, { x: 'hello', y: 42 });
    expect(sql).toBe('SELECT * FROM b WHERE x = $1 AND y = $2');
    expect(bindings).toEqual(['hello', 42]);
  });

  it('throws on missing parameter', () => {
    const catalog = new QueryCatalog(entries);
    const entry = catalog.resolveByString('query_b@2.0.0')!;

    expect(() => catalog.renderSql(entry, { x: 'hello' })).toThrow("Missing required parameter 'y'");
  });

  it('reports catalog size and keys', () => {
    const catalog = new QueryCatalog(entries);
    expect(catalog.size).toBe(2);
    expect(catalog.catalogKeys).toEqual(
      expect.arrayContaining(['query_a@1.0.0', 'query_b@2.0.0']),
    );
  });

  it('does not match PostgreSQL casts as parameters', () => {
    const sql = `-- catalog_id: cast_test
-- version: 1.0.0
SELECT created_at::date, amount::int FROM t WHERE id = :id;`;
    const entry = parseCatalogEntry(sql);
    expect(entry.parameters).toEqual(['id']);

    const catalog = new QueryCatalog([entry]);
    const resolved = catalog.resolveByString('cast_test@1.0.0')!;
    const { sql: rendered, bindings } = catalog.renderSql(resolved, { id: 42 });
    expect(rendered).toContain('::date');
    expect(rendered).toContain('::int');
    expect(bindings).toEqual([42]);
  });

  it('stops parsing metadata after SQL body starts', () => {
    const sql = `-- catalog_id: meta_test
-- version: 1.0.0
SELECT 1;
-- version: 2.0.0`;
    const entry = parseCatalogEntry(sql);
    expect(entry.version).toBe('1.0.0');
  });

  it('reuses $N placeholder for repeated parameters', () => {
    const entry = {
      catalogId: 'repeat_test',
      version: '1.0.0',
      description: '',
      sql: 'SELECT * FROM t WHERE a = :id AND b = :id',
      parameters: ['id'],
    };
    const catalog = new QueryCatalog([entry]);
    const { sql: rendered, bindings } = catalog.renderSql(entry, { id: 99 });
    expect(rendered).toBe('SELECT * FROM t WHERE a = $1 AND b = $1');
    expect(bindings).toEqual([99]);
  });

  it('throws on duplicate catalog entries', () => {
    const dupes = [
      { catalogId: 'dup', version: '1.0.0', description: '', sql: 'SELECT 1', parameters: [] },
      { catalogId: 'dup', version: '1.0.0', description: '', sql: 'SELECT 2', parameters: [] },
    ];
    expect(() => new QueryCatalog(dupes)).toThrow('Duplicate catalog entry');
  });
});
