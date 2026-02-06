function escapeColumnIdentifier(it: string) {
  return `"${it}"`;
}
export type WhereCondition<T extends object> = {
  [K in keyof T & string]: [
    field: K,
    operator: '=' | '!=' | '<' | '>' | '>=' | '<=',
    value: T[K],
  ];
}[keyof T & string];

export type OrderSpecifier<T extends object> = {
  [K in keyof T & string]: [field: K, direction: 'ASC' | 'DESC'];
}[keyof T & string];

export type DBDefinition = Record<string, Record<string, unknown>>;

type Select<Cols extends string> = '*' | SelectClause<Cols>;

type SelectClause<Cols extends string> = readonly [
  Selector<Cols>,
  ...Selector<Cols>[],
];

type Selector<Cols extends string> =
  | Cols
  | { aggregate: 'count' | 'sum' | 'avg' | 'min' | 'max'; col: Cols };

export type CqlSelectOptions<
  DBRelations extends DBDefinition,
  RelationName extends keyof DBRelations & string,
  Cols extends keyof DBRelations[RelationName] & string,
> = {
  from: RelationName;
  select: Select<Cols>;
  where?: readonly WhereCondition<DBRelations[RelationName]>[];
  limit?: number;
  sortOrder?: OrderSpecifier<DBRelations[RelationName]>[];
  groupBy?: readonly Cols[];
};
export function buildCQLSelectQuery<
  DB extends DBDefinition,
  RelationName extends keyof DB & string,
  Cols extends keyof DB[RelationName] & string = keyof DB[RelationName] &
    string,
>(opts: CqlSelectOptions<DB, RelationName, Cols>) {
  const { from: tableName, select, where, limit, sortOrder, groupBy } = opts;

  const selection =
    select === '*'
      ? select
      : select
          .map((colOrAgg) => {
            if (typeof colOrAgg === 'string') {
              return escapeColumnIdentifier(colOrAgg);
            }
            return `${colOrAgg.aggregate}(${colOrAgg.col}) AS ${colOrAgg.col}`;
          })
          .join(', ');

  const conditions = where
    ?.map(([field, op, _]) => `${escapeColumnIdentifier(field)} ${op} ?`)
    .join(' AND ');

  const groupByCols = groupBy?.map(escapeColumnIdentifier).join(', ');

  const sort = sortOrder
    ?.map(([column, direction]) => `${column} ${direction}`)
    .join(', ');

  /** SELECT CQL Grammar for reference
   * select_statement:
   *           SELECT [ DISTINCT ] ( `select_clause` | '*' )
   *           : FROM `table_name`
   *           : [ WHERE `where_clause` ]
   *           : [ GROUP BY `group_by_clause` ]
   *           : [ ORDER BY `ordering_clause` ]
   *           : [ PER PARTITION LIMIT (`integer` | `bind_marker`) ]
   *           : [ LIMIT (`integer` | `bind_marker`) ]
   *           : [ ALLOW FILTERING ]
   *           : [ BYPASS CACHE ]
   *           : [ USING TIMEOUT `timeout` ]
   */
  const query =
    `SELECT ${selection} FROM ${tableName}` +
    `${conditions ? ` WHERE ${conditions}` : ''}` +
    `${groupBy ? ` GROUP BY ${groupByCols}` : ''}` +
    `${sortOrder ? ` ORDER BY ${sort}` : ''}` +
    `${limit ? ` LIMIT ${limit}` : ''};`;

  const params = where?.map(([_field, _op, value]) => value) ?? [];
  return { query, params };
}
