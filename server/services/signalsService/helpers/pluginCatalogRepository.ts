import type { CatalogSignalEntry } from '@roostorg/coop-types';
import { sql, type ColumnType, type Kysely } from 'kysely';

import { jsonStringify } from '../../../utils/encoding.js';

/** A plugin catalog as stored for one org and integration. */
export type StoredPluginCatalog = Readonly<{
  orgId: string;
  integrationId: string;
  version: string;
  entries: readonly CatalogSignalEntry[];
  /** Entries dropped by a later refresh; rules that use them fail closed. */
  removedEntries: readonly CatalogSignalEntry[];
  status: 'OK' | 'ERROR';
  errorMessage: string | null;
  fetchedAt: Date;
}>;

export type PluginCatalogRepository = Readonly<{
  get(
    orgId: string,
    integrationId: string,
  ): Promise<StoredPluginCatalog | undefined>;
  /** Other integrations' catalogs for the org (collision checks). */
  listForOrg(orgId: string): Promise<StoredPluginCatalog[]>;
  save(catalog: StoredPluginCatalog): Promise<void>;
}>;

type JsonColumn = ColumnType<unknown, string, string>;

export type PluginCatalogPg = {
  'signal_auth_service.integration_signal_catalogs': {
    org_id: string;
    integration_id: string;
    version: string;
    entries: JsonColumn;
    removed_entries: JsonColumn;
    status: 'OK' | 'ERROR';
    error_message: string | null;
    fetched_at: Date;
    created_at: ColumnType<Date, never, never>;
    updated_at: ColumnType<Date, Date | undefined, Date>;
  };
};

const TABLE = 'signal_auth_service.integration_signal_catalogs' as const;

type Row = {
  org_id: string;
  integration_id: string;
  version: string;
  entries: unknown;
  removed_entries: unknown;
  status: 'OK' | 'ERROR';
  error_message: string | null;
  fetched_at: Date;
};

// Entries were validated before they were stored; anything else in the
// column (e.g. manual edits) is ignored rather than trusted.
function entriesFrom(value: unknown): CatalogSignalEntry[] {
  return Array.isArray(value) ? (value as CatalogSignalEntry[]) : [];
}

function fromRow(row: Row): StoredPluginCatalog {
  return {
    orgId: row.org_id,
    integrationId: row.integration_id,
    version: row.version,
    entries: entriesFrom(row.entries),
    removedEntries: entriesFrom(row.removed_entries),
    status: row.status,
    errorMessage: row.error_message,
    fetchedAt: row.fetched_at,
  };
}

export function makePostgresPluginCatalogRepository(
  db: Kysely<PluginCatalogPg>,
): PluginCatalogRepository {
  const columns = [
    'org_id',
    'integration_id',
    'version',
    'entries',
    'removed_entries',
    'status',
    'error_message',
    'fetched_at',
  ] as const;
  return {
    async get(orgId, integrationId) {
      const row = await db
        .selectFrom(TABLE)
        .select(columns)
        .where('org_id', '=', orgId)
        .where('integration_id', '=', integrationId)
        .executeTakeFirst();
      return row ? fromRow(row) : undefined;
    },
    async listForOrg(orgId) {
      const rows = await db
        .selectFrom(TABLE)
        .select(columns)
        .where('org_id', '=', orgId)
        .execute();
      return rows.map(fromRow);
    },
    async save(catalog) {
      const values = {
        version: catalog.version,
        entries: jsonStringify(catalog.entries),
        removed_entries: jsonStringify(catalog.removedEntries),
        status: catalog.status,
        error_message: catalog.errorMessage,
        fetched_at: catalog.fetchedAt,
      };
      await db
        .insertInto(TABLE)
        .values({
          org_id: catalog.orgId,
          integration_id: catalog.integrationId,
          ...values,
        })
        .onConflict((oc) =>
          oc
            .columns(['org_id', 'integration_id'])
            .doUpdateSet({ ...values, updated_at: sql<Date>`now()` }),
        )
        .execute();
    },
  };
}

/** Used in tests and when no database is configured. */
export function makeInMemoryPluginCatalogRepository(): PluginCatalogRepository {
  const rows = new Map<string, StoredPluginCatalog>();
  const key = (orgId: string, integrationId: string) =>
    `${orgId}:${integrationId}`;
  return {
    async get(orgId, integrationId) {
      return rows.get(key(orgId, integrationId));
    },
    async listForOrg(orgId) {
      return [...rows.values()].filter((it) => it.orgId === orgId);
    },
    async save(catalog) {
      rows.set(key(catalog.orgId, catalog.integrationId), catalog);
    },
  };
}
