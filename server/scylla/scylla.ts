import { type Readable } from 'node:stream';
import { type Client as ScyllaClient } from 'cassandra-driver';
import _S2A from 'stream-to-async-iterator';

import {
  buildCQLSelectQuery,
  type CqlSelectOptions,
  type DBDefinition,
} from './cqlUtils.js';

const StreamToAsyncIterator = _S2A.default;

export default class Scylla<DB extends DBDefinition> {
  constructor(private client: ScyllaClient) {
    this.client = client;
  }

  async insert<RelationName extends keyof DB>(
    opts: {
      [K in RelationName]: {
        into: RelationName;
        row: DB[K];
        ttlInSeconds?: number;
      };
    }[RelationName],
  ) {
    const { into: tableName, row: values, ttlInSeconds } = opts;

    const columnNames = Object.keys(values).join(', ');

    const query = `INSERT INTO ${String(tableName)}(
      ${columnNames}
      ) VALUES (
        ${Object.entries(values)
          .map((_) => ' ?')
          .join(', ')}
      )${ttlInSeconds ? ` USING TTL ${ttlInSeconds}` : ''};`;

    const params = Object.values(values);
    return this.client.execute(query, params, { prepare: true });
  }
  /**
   * Returns an AsyncIterable built from the driver's stream response.
   */
  selectStream<
    RelationName extends keyof DB & string,
    Cols extends keyof DB[RelationName] & string = keyof DB[RelationName] &
      string,
  >(opts: CqlSelectOptions<DB, RelationName, Cols>) {
    const { query, params } = buildCQLSelectQuery(opts);

    const stream = this.client.stream(query, params, {
      prepare: true,
    }) as unknown as Readable;

    /**
     * Note that this cast is technically unsafe, because Cols could be
     * instantiated with a wider type than is actually given to the select option
     * at runtime, e.g.:
     * ```
     * cqlSelect<"item_submission_by_item_id", "item_type_name" | "item_type_version">(
     *   client,
     *   { from: "item_submission_by_item_id", select: ["item_type_name"] }
     * );
     * ```
     * That call will type check just fine, but TS will think that the returned
     * rows contain two columns, whereas they'll actually include only one. A
     * safer cast would be `{ [K in Cols]?: DB[RelationName][K] }`,
     * which acknowledges the reality that the Cols type could be wider than the
     * runtime value of opts.select by making every key optional. However, that's
     * very annoying to work with, as the caller of cqlSelect will have to use `!`
     * on all the result fields that they know are actually defined.
     */
    type Selection = { [K in Cols]: DB[RelationName][K] };
    return new StreamToAsyncIterator<Selection>(
      stream,
    ) satisfies AsyncIterableIterator<Selection> as AsyncIterableIterator<Selection>;
  }

  async select<
    RelationName extends keyof DB & string,
    Cols extends keyof DB[RelationName] & string = keyof DB[RelationName] &
      string,
  >(opts: CqlSelectOptions<DB, RelationName, Cols>) {
    const { query, params } = buildCQLSelectQuery(opts);

    const res = await this.client.execute(query, params, { prepare: true });
    /**
     * Note that this cast is technically unsafe, because Cols could be
     * instantiated with a wider type than is actually given to the select option
     * at runtime, e.g.:
     * ```
     * cqlSelect< "item_submission_by_item_id", "item_type_name" | "item_type_version" >(
     *      client,
     *      { from: "item_submission_by_item_id", select: ["item_type_name"] }
     *      );
     * ```
     * That call will type check just fine, but TS will think that the returned
     * rows contain two columns, whereas they'll actually include only one. A
     * safer cast would be `{ [K in Cols]?: DB[RelationName][K] }`,
     * which acknowledges the reality that the Cols type could be wider than the
     * runtime value of opts.select by making every key optional. However, that's
     * very annoying to work with, as the caller of cqlSelect will have to use `!`
     * on all the result fields that they know are actually defined.
     */
    return res.rows as unknown as {
      [K in Cols]: DB[RelationName][K];
    }[];
  }
}
