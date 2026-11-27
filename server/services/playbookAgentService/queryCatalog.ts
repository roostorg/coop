/**
 * Query Catalog — Pre-approved SQL template loader and resolver.
 *
 * The agent requests evidence by catalog_id@version. It never writes SQL
 * or sees table names. The catalog resolves IDs to pre-approved, parameterized
 * SQL templates that are executed by the evidence store.
 *
 * Template format:
 *   -- catalog_id: login_patterns
 *   -- version: 1.0.0
 *   -- description: Login frequency analysis
 *   SELECT ... WHERE account_id = :account_id
 *
 * Parameters use `:field_name` syntax for safe substitution.
 *
 * @license Apache-2.0
 */

import {
  type CatalogReference,
  type Playbook,
  formatCatalogReference,
} from './playbookTypes.js';

// ── Types ───────────────────────────────────────────────────────────────────

export type CatalogEntry = {
  readonly catalogId: string;
  readonly version: string;
  readonly description: string;
  readonly sql: string;
  readonly parameters: readonly string[];
};

export type CatalogEntryMap = ReadonlyMap<string, CatalogEntry>;

// ── Parsing ─────────────────────────────────────────────────────────────────

const METADATA_PATTERN =
  /^--\s*(catalog_id|version|description):\s*(.+)$/;
const PARAMETER_PATTERN = /(?<!:):([a-z_][a-z0-9_]*)/g;

/**
 * Parse a SQL template file into a CatalogEntry.
 *
 * Extracts metadata from comment headers and discovers parameters
 * from `:field_name` tokens in the SQL body.
 */
export function parseCatalogEntry(sql: string): CatalogEntry {
  const lines = sql.split('\n');
  const metadata: Record<string, string> = {};
  const sqlLines: string[] = [];
  let headerDone = false;

  for (const line of lines) {
    if (!headerDone) {
      const match = METADATA_PATTERN.exec(line.trim());
      if (match) {
        metadata[match[1]] = match[2].trim();
        continue;
      }
      if (!line.trim().startsWith('--')) {
        headerDone = true;
      }
    }
    if (headerDone) {
      sqlLines.push(line);
    }
  }

  const sqlBody = sqlLines.join('\n').trim();

  if (!metadata['catalog_id']) {
    throw new Error('SQL template missing required "catalog_id" metadata comment');
  }
  if (!metadata['version']) {
    throw new Error(
      `SQL template '${metadata['catalog_id']}' missing required "version" metadata comment`,
    );
  }

  // Extract parameter names from :field_name tokens
  const parameterMatches = sqlBody.matchAll(PARAMETER_PATTERN);
  const parameters = [...new Set([...parameterMatches].map((m) => m[1]))];

  return {
    catalogId: metadata['catalog_id'],
    version: metadata['version'],
    description: metadata['description'] ?? '',
    sql: sqlBody,
    parameters,
  };
}

// ── Query Catalog ───────────────────────────────────────────────────────────

export default class QueryCatalog {
  readonly #entries: Map<string, CatalogEntry>;

  constructor(entries: readonly CatalogEntry[]) {
    this.#entries = new Map();
    for (const e of entries) {
      const key = `${e.catalogId}@${e.version}`;
      if (this.#entries.has(key)) {
        throw new Error(`Duplicate catalog entry: '${key}'`);
      }
      this.#entries.set(key, e);
    }
  }

  /**
   * Resolve a catalog reference to a SQL template.
   *
   * Returns undefined if the reference is not found.
   */
  resolve(ref: CatalogReference): CatalogEntry | undefined {
    const key = formatCatalogReference(ref);
    return this.#entries.get(key);
  }

  /**
   * Resolve a catalog_id@version string to a SQL template.
   */
  resolveByString(refString: string): CatalogEntry | undefined {
    return this.#entries.get(refString);
  }

  /**
   * Validate that a catalog reference is in the playbook's allowed set.
   *
   * Returns true only if the ref exists in the catalog AND is listed
   * in the playbook's allowed_catalog_refs.
   */
  isAllowed(refString: string, playbook: Playbook): boolean {
    const allowedKeys = new Set(
      playbook.allowedCatalogRefs.map(formatCatalogReference),
    );
    return allowedKeys.has(refString) && this.#entries.has(refString);
  }

  /**
   * Render a SQL template by substituting :param tokens with positional $N
   * placeholders and collecting bindings.
   *
   * Uses parameterized substitution (not string interpolation) to prevent injection.
   * Throws if a required parameter is missing.
   */
  renderSql(
    entry: CatalogEntry,
    parameters: Record<string, unknown>,
  ): { readonly sql: string; readonly bindings: readonly unknown[] } {
    // Build ordered bindings array and replace :param with $N positional params
    const bindings: unknown[] = [];
    const paramIndexMap = new Map<string, number>();
    const renderedSql = entry.sql.replace(PARAMETER_PATTERN, (_match, name: string) => {
      if (!Object.hasOwn(parameters, name)) {
        throw new Error(
          `Missing required parameter '${name}' for query '${entry.catalogId}'`,
        );
      }
      const existing = paramIndexMap.get(name);
      if (existing !== undefined) {
        return `$${existing}`;
      }
      bindings.push(parameters[name]);
      const idx = bindings.length;
      paramIndexMap.set(name, idx);
      return `$${idx}`;
    });

    return { sql: renderedSql, bindings };
  }

  get size(): number {
    return this.#entries.size;
  }

  /** Returns all catalogId@version keys in the catalog. */
  get catalogKeys(): string[] {
    return [...this.#entries.keys()];
  }
}
