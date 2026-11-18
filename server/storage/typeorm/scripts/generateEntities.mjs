// Generates TypeORM entity classes from a live Postgres database built by the
// current migrations. TypeORM has no maintained database-first generator, so
// the PoC introspects pg_catalog directly and emits one file per schema.
//
// Usage (from server/): node --env-file-if-exists=.env storage/typeorm/scripts/generateEntities.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, '../entities');

// Tables without a primary key. TypeORM requires one on every entity, so these
// get a pseudo-key that exists only in the ORM metadata, and the entity opts
// out of schema synchronization so TypeORM never tries to create it.
const PSEUDO_PRIMARY_KEYS = {
  'public.actions_history': ['id', 'sys_period'],
  'public.actions_and_item_types_history': [
    'action_id',
    'item_type_id',
    'sys_period',
  ],
  'public.item_types_history': ['id', 'sys_period'],
  'public.policy_history': ['id', 'sys_period'],
  'public.rules_history': ['id', 'sys_period'],
  'public.rules_and_actions_history': ['rule_id', 'action_id', 'sys_period'],
  'public.rules_and_item_types_history': [
    'rule_id',
    'item_type_id',
    'sys_period',
  ],
  'public.rules_and_policies_history': ['rule_id', 'policy_id', 'sys_period'],
  'manual_review_tool.job_claims': ['org_id', 'queue_id', 'job_id'],
  'manual_review_tool.appeals_routing_rule_history': ['id', 'sys_period'],
  'manual_review_tool.routing_rule_history': ['id', 'sys_period'],
  'manual_review_tool.dim_mrt_decisions_materialized': [
    'org_id',
    'job_id',
    'action_id',
    'policy_id',
    'type',
    'item_id',
    'item_type_id',
  ],
  'manual_review_tool.moderator_skips': [
    'org_id',
    'queue_id',
    'user_id',
    'job_id',
  ],
  'reporting_rules.reporting_rule_history': ['id', 'sys_period'],
};

// Hand-written TS types for JSON(B) columns, keyed by schema.table.column.
// Columns not listed here are typed `unknown`.
// [TS type, module to import it from, imported name]; paths are relative to
// storage/typeorm/entities.
const MC = '../../../services/moderationConfigService/types';
const TS_TYPE_OVERRIDES = {
  'public.item_types.fields': ['ItemSchema', `${MC}/itemTypes.js`],
  'public.item_type_versions.fields': ['ItemSchema', `${MC}/itemTypes.js`],
  'public.item_type_latest_versions.fields': [
    'ItemSchema',
    `${MC}/itemTypes.js`,
  ],
  'public.item_types_history.fields': ['ItemSchema', `${MC}/itemTypes.js`],
  'public.rules.condition_set': ['ConditionSet', `${MC}/rules.js`],
  'public.rules_history.condition_set': ['ConditionSet', `${MC}/rules.js`],
  'public.rules_latest_versions.condition_set': [
    'ConditionSet',
    `${MC}/rules.js`,
  ],
  'public.rule_versions.condition_set': ['ConditionSet', `${MC}/rules.js`],
  'manual_review_tool.routing_rules.condition_set': [
    'ConditionSet',
    `${MC}/rules.js`,
  ],
  'manual_review_tool.appeals_routing_rules.condition_set': [
    'ConditionSet',
    `${MC}/rules.js`,
  ],
  'reporting_rules.reporting_rules.condition_set': [
    'ConditionSet',
    `${MC}/rules.js`,
  ],
  // Free-form JSON columns get non-recursive types: type-fest's recursive
  // JsonObject/JsonValue make TypeORM's QueryDeepPartialEntity and
  // FindOptionsWhere hit TS2589 ("type instantiation is excessively deep").
  'public.rules_and_actions.action_parameters': ['Record<string, unknown>'],
  'public.user_strike_thresholds.action_parameters': [
    'Record<string, unknown>',
  ],
  'public.actions.callback_url_headers': ['Record<string, unknown>'],
  'public.actions.callback_url_body': ['Record<string, unknown>'],
  'public.actions.custom_mrt_api_params': ['unknown[]'],
  'public.action_versions.custom_mrt_api_params': ['unknown[]'],
  'public.signing_keys.key_data': ['Record<string, unknown>'],
};

const pascal = (s) =>
  s
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join('');

const q = (s) => JSON.stringify(s);

// Emits a column default in the form TypeORM's schema diff reads back from the
// database: casted literals become plain values; anything else stays raw SQL.
function defaultOption(def, typname, isArray) {
  const literal = def.match(/^'((?:[^']|'')*)'::[\w\s."\-]+$/);
  if (literal && !isArray) {
    const value = literal[1].replaceAll("''", "'");
    if (typname === 'json' || typname === 'jsonb')
      return `() => ${q(`'${literal[1]}'`)}`;
    return q(value);
  }
  if (/^-?\d+$/.test(def)) return def;
  if (def === 'true' || def === 'false') return def;
  return `() => ${q(def)}`;
}

async function main() {
  const client = new pg.Client({
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT ?? 5432),
    database: process.env.DATABASE_NAME,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
  });
  await client.connect();
  const rows = async (sql, params) => (await client.query(sql, params)).rows;

  const sysSchemas = `('pg_catalog','information_schema','pg_toast')`;

  const tables = await rows(`
    select c.oid, n.nspname as schema, c.relname as name, c.relkind as kind,
           case when c.relkind in ('v','m') then pg_get_viewdef(c.oid, true) end as viewdef,
           obj_description(c.oid, 'pg_class') as comment
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where c.relkind in ('r','v','m') and n.nspname not in ${sysSchemas}
      and c.relname <> 'SequelizeMeta'
    order by n.nspname, c.relname`);

  const columns = await rows(`
    select a.attrelid as oid, a.attname as name, a.attnum as num,
           format_type(a.atttypid, a.atttypmod) as formatted,
           a.attnotnull as notnull, a.attidentity as identity, a.attgenerated as generated,
           pg_get_expr(d.adbin, d.adrelid) as def,
           col_description(a.attrelid, a.attnum) as comment,
           t.typtype, t.typname, tn.nspname as typschema, t.typcategory,
           et.typtype as elemtyptype, et.typname as elemtypname, etn.nspname as elemtypschema
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_type t on t.oid = a.atttypid
    join pg_namespace tn on tn.oid = t.typnamespace
    left join pg_type et on et.oid = t.typelem and t.typcategory = 'A'
    left join pg_namespace etn on etn.oid = et.typnamespace
    left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
    where a.attnum > 0 and not a.attisdropped and n.nspname not in ${sysSchemas}
    order by a.attrelid, a.attnum`);

  const enumValues = await rows(`
    select n.nspname as schema, t.typname as name,
           array_agg(e.enumlabel order by e.enumsortorder)::text[] as labels
    from pg_type t join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace group by 1, 2`);
  const enums = new Map(
    enumValues.map((e) => [`${e.schema}.${e.name}`, e.labels]),
  );

  const constraints = await rows(`
    select con.conrelid as oid, con.conname as name, con.contype as type,
           con.condeferrable as deferrable, con.condeferred as deferred,
           con.confdeltype as deltype, con.confupdtype as updtype,
           (select array_agg(a.attname order by k.ord)::text[] from unnest(con.conkey) with ordinality k(attnum, ord)
              join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.attnum) as cols,
           (select array_agg(a.attname order by k.ord)::text[] from unnest(con.confkey) with ordinality k(attnum, ord)
              join pg_attribute a on a.attrelid = con.confrelid and a.attnum = k.attnum) as refcols,
           rn.nspname as refschema, rc.relname as reftable,
           pg_get_constraintdef(con.oid) as def
    from pg_constraint con
    join pg_class c on c.oid = con.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    left join pg_class rc on rc.oid = con.confrelid
    left join pg_namespace rn on rn.oid = rc.relnamespace
    where n.nspname not in ${sysSchemas}
    order by con.conname`);

  const indexes = await rows(`
    select i.indrelid as oid, ic.relname as name, i.indisunique as unique,
           i.indexprs is not null as has_expr, am.amname as method,
           exists (select 1 from unnest(i.indoption) o where o <> 0) as has_options,
           pg_get_expr(i.indpred, i.indrelid) as predicate,
           (select array_agg(a.attname order by k.ord)::text[] from unnest(i.indkey) with ordinality k(attnum, ord)
              join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.attnum) as cols,
           exists (select 1 from pg_constraint con where con.conindid = i.indexrelid and con.contype in ('p','u','x')) as backs_constraint,
           pg_get_indexdef(i.indexrelid) as def
    from pg_index i
    join pg_class ic on ic.oid = i.indexrelid
    join pg_class c on c.oid = i.indrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_am am on am.oid = ic.relam
    where n.nspname not in ${sysSchemas}
    order by ic.relname`);

  await client.end();

  // Class names: PascalCase table name, schema-prefixed when the name repeats
  // across schemas.
  const nameCounts = new Map();
  for (const t of tables)
    nameCounts.set(t.name, (nameCounts.get(t.name) ?? 0) + 1);
  const classNameOf = new Map(
    tables.map((t) => [
      `${t.schema}.${t.name}`,
      (nameCounts.get(t.name) > 1 && t.schema !== 'public'
        ? pascal(t.schema)
        : '') +
        pascal(t.name) +
        (t.kind === 'r' ? '' : 'View'),
    ]),
  );

  const actionOf = {
    a: 'NO ACTION',
    r: 'RESTRICT',
    c: 'CASCADE',
    n: 'SET NULL',
    d: 'SET DEFAULT',
  };

  const bySchema = new Map();
  const summary = { tables: 0, views: 0, pseudoPk: [], unsyncedIndexes: [] };

  for (const t of tables) {
    const key = `${t.schema}.${t.name}`;
    const className = classNameOf.get(key);
    const cols = columns.filter((c) => c.oid === t.oid);
    const cons = constraints.filter((c) => c.oid === t.oid);
    const idxs = indexes.filter((i) => i.oid === t.oid);
    const lines = [];
    const enumTypes = [];
    const typeImports = [];
    const externalImports = [];

    const tsTypeOf = (c) => {
      const override = TS_TYPE_OVERRIDES[`${key}.${c.name}`];
      if (override) {
        const [type, from, name = type] = override;
        if (from) externalImports.push([from, name]);
        return type;
      }
      const isArray = c.typcategory === 'A';
      const typtype = isArray ? c.elemtyptype : c.typtype;
      const typname = isArray ? c.elemtypname : c.typname;
      const typschema = isArray ? c.elemtypschema : c.typschema;
      let base;
      if (typtype === 'e') {
        base = pascal(typname);
        enumTypes.push([base, enums.get(`${typschema}.${typname}`)]);
      } else {
        base =
          {
            uuid: 'string',
            text: 'string',
            varchar: 'string',
            bpchar: 'string',
            int2: 'number',
            int4: 'number',
            float4: 'number',
            float8: 'number',
            int8: 'string',
            numeric: 'string',
            bool: 'boolean',
            timestamptz: 'Date',
            timestamp: 'Date',
            date: 'Date',
            json: 'unknown',
            jsonb: 'unknown',
            tstzrange: 'string',
            xml: 'string',
          }[typname] ?? 'unknown';
      }
      return isArray ? `${base}[]` : base;
    };

    const columnOptions = (c) => {
      const isArray = c.typcategory === 'A';
      const typtype = isArray ? c.elemtyptype : c.typtype;
      const typname = isArray ? c.elemtypname : c.typname;
      const typschema = isArray ? c.elemtypschema : c.typschema;
      const opts = [`name: ${q(c.name)}`];
      const formatted = c.formatted.replace(/\[\]$/, '');
      if (typtype === 'e') {
        opts.push(
          `type: 'enum'`,
          `enum: ${q(enums.get(`${typschema}.${typname}`))}`,
        );
        opts.push(`enumName: ${q(typname)}`);
      } else {
        const varchar = formatted.match(/^character varying(?:\((\d+)\))?$/);
        const numeric = formatted.match(/^numeric(?:\((\d+),(\d+)\))?$/);
        const ts = formatted.match(
          /^timestamp(?:\((\d+)\))? (with|without) time zone$/,
        );
        if (varchar) {
          opts.push(`type: 'varchar'`);
          if (varchar[1]) opts.push(`length: ${varchar[1]}`);
        } else if (numeric) {
          opts.push(`type: 'numeric'`);
          if (numeric[1])
            opts.push(`precision: ${numeric[1]}`, `scale: ${numeric[2]}`);
        } else if (ts) {
          opts.push(
            `type: ${q(ts[2] === 'with' ? 'timestamptz' : 'timestamp')}`,
          );
          if (ts[1]) opts.push(`precision: ${ts[1]}`);
        } else {
          opts.push(`type: ${q(typname)}`);
        }
      }
      if (isArray) opts.push('array: true');
      if (!c.notnull) opts.push('nullable: true');
      if (c.generated === 's') {
        opts.push(`generatedType: 'STORED'`, `asExpression: ${q(c.def)}`);
      } else if (c.identity) {
        opts.push(
          `generated: 'identity'`,
          `generatedIdentity: ${q(c.identity === 'a' ? 'ALWAYS' : 'BY DEFAULT')}`,
        );
      } else if (c.def === 'gen_random_uuid()' && typname === 'uuid') {
        // Read back by TypeORM as a uuid-generated column (see uuidExtension).
        opts.push(`generated: 'uuid'`);
      } else if (c.def && !/^nextval\(/.test(c.def)) {
        opts.push(`default: ${defaultOption(c.def, typname, isArray)}`);
      }
      if (c.comment) opts.push(`comment: ${q(c.comment)}`);
      return opts;
    };

    const pk = cons.find((c) => c.type === 'p');
    const pseudoPk =
      !pk && t.kind === 'r' ? PSEUDO_PRIMARY_KEYS[key] : undefined;
    if (!pk && t.kind === 'r') {
      if (!pseudoPk)
        throw new Error(`No PK and no pseudo-PK configured for ${key}`);
      summary.pseudoPk.push(key);
    }
    const pkCols = pk?.cols ?? pseudoPk ?? [];
    for (const col of pkCols) {
      if (!cols.some((c) => c.name === col))
        throw new Error(`${key} has no column ${col}`);
    }

    if (t.kind === 'r') {
      summary.tables++;
      for (const c of cons.filter((c) => c.type === 'u')) {
        lines.push(`@Unique(${q(c.name)}, ${q(c.cols)})`);
      }
      for (const c of cons.filter((c) => c.type === 'c')) {
        const expr = c.def
          .replace(/^CHECK \(/, '')
          .replace(/\)( NOT VALID)?$/, '');
        lines.push(`@Check(${q(c.name)}, ${q(expr)})`);
      }
      for (const i of idxs.filter((i) => !i.backs_constraint)) {
        // TypeORM's @Index can't express expression indexes, non-btree access
        // methods or per-column ordering, so those stay migration-only.
        if (i.has_expr || i.method !== 'btree' || i.has_options) {
          summary.unsyncedIndexes.push(i.def);
          lines.push(`// ${i.def}`);
          lines.push(`@Index(${q(i.name)}, { synchronize: false })`);
          continue;
        }
        const opts = [];
        if (i.unique) opts.push('unique: true');
        if (i.predicate) opts.push(`where: ${q(i.predicate)}`);
        lines.push(
          `@Index(${q(i.name)}, ${q(i.cols)}${opts.length ? `, { ${opts.join(', ')} }` : ''})`,
        );
      }
      const entityOpts = [`name: ${q(t.name)}`, `schema: ${q(t.schema)}`];
      if (t.comment) entityOpts.push(`comment: ${q(t.comment)}`);
      if (pseudoPk) entityOpts.push('synchronize: false');
      if (pseudoPk)
        lines.push(
          `// No primary key in the database; ${q(pseudoPk)} is ORM-only.`,
        );
      lines.push(`@Entity({ ${entityOpts.join(', ')} })`);
      lines.push(`export class ${className} {`);
      for (const c of cols) {
        const opts = columnOptions(c);
        const isPk = pkCols.includes(c.name);
        const isSerial = c.def && /^nextval\(/.test(c.def);
        let deco = 'Column';
        const isUuidGen = opts.includes(`generated: 'uuid'`);
        if (isPk && isUuidGen) {
          opts.splice(opts.indexOf(`generated: 'uuid'`), 1);
          if (pk) opts.push(`primaryKeyConstraintName: ${q(pk.name)}`);
          lines.push(
            `  @PrimaryGeneratedColumn('uuid', { ${opts.filter((o) => !o.startsWith('type:')).join(', ')} })`,
          );
          lines.push(`  ${c.name}!: ${tsTypeOf(c)};`);
          lines.push('');
          continue;
        }
        if (isPk && isSerial) deco = 'PrimaryGeneratedColumn';
        else if (isPk) deco = 'PrimaryColumn';
        else if (isSerial) opts.push(`generated: 'increment'`);
        if (isPk && pk) opts.push(`primaryKeyConstraintName: ${q(pk.name)}`);
        // TypeORM rejects nullable primary columns, even ORM-only ones.
        if (isPk && !pk && !c.notnull) {
          opts.splice(opts.indexOf('nullable: true'), 1);
          lines.push(
            '  // Nullable in the database; TypeORM forbids nullable primary columns.',
          );
        }
        if (deco === 'PrimaryGeneratedColumn') {
          lines.push(
            `  @PrimaryGeneratedColumn('increment', { ${opts.filter((o) => !o.startsWith('type:')).join(', ')} })`,
          );
        } else {
          lines.push(`  @${deco}({ ${opts.join(', ')} })`);
        }
        lines.push(
          `  ${c.name}!: ${tsTypeOf(c)}${c.notnull ? '' : ' | null'};`,
        );
        lines.push('');
      }
      const usedNames = new Set(cols.map((c) => c.name));
      for (const fk of cons.filter((c) => c.type === 'f')) {
        const target = classNameOf.get(`${fk.refschema}.${fk.reftable}`);
        if (fk.refschema !== t.schema) typeImports.push([fk.refschema, target]);
        let prop = fk.cols[0].replace(/_id$/, '');
        if (usedNames.has(prop)) prop = `${fk.cols[0]}_rel`;
        while (usedNames.has(prop)) prop = `${prop}_`;
        usedNames.add(prop);
        const nullable = fk.cols.some(
          (col) => !cols.find((c) => c.name === col)?.notnull,
        );
        const relOpts = [
          `onDelete: ${q(actionOf[fk.deltype])}`,
          `onUpdate: ${q(actionOf[fk.updtype])}`,
        ];
        if (!nullable) relOpts.push('nullable: false');
        if (fk.deferrable)
          relOpts.push(
            `deferrable: ${q(fk.deferred ? 'INITIALLY DEFERRED' : 'INITIALLY IMMEDIATE')}`,
          );
        const join = fk.cols.map(
          (col, n) =>
            `{ name: ${q(col)}, referencedColumnName: ${q(fk.refcols[n])}, foreignKeyConstraintName: ${q(fk.name)} }`,
        );
        lines.push(`  @ManyToOne(${q(target)}, { ${relOpts.join(', ')} })`);
        lines.push(
          `  @JoinColumn(${join.length === 1 ? join[0] : `[${join.join(', ')}]`})`,
        );
        lines.push(`  ${prop}?: Relation<${target}>;`);
        lines.push('');
      }
      lines.push('}');
    } else {
      summary.views++;
      const opts = [`name: ${q(t.name)}`, `schema: ${q(t.schema)}`];
      if (t.kind === 'm') opts.push('materialized: true');
      // Views are created and refreshed by the SQL migrations and triggers, so
      // TypeORM only reads them.
      opts.push('synchronize: false');
      opts.push(`expression: ${q(t.viewdef.trim())}`);
      lines.push(`@ViewEntity({ ${opts.join(', ')} })`);
      lines.push(`export class ${className} {`);
      for (const c of cols) {
        lines.push(`  @ViewColumn({ name: ${q(c.name)} })`);
        lines.push(`  ${c.name}!: ${tsTypeOf(c)} | null;`);
        lines.push('');
      }
      lines.push('}');
    }

    const entry = bySchema.get(t.schema) ?? {
      classes: [],
      enums: new Map(),
      typeImports: new Map(),
      externalImports: new Map(),
    };
    entry.classes.push({ className, code: lines.join('\n') });
    for (const [from, name] of externalImports) {
      const set = entry.externalImports.get(from) ?? new Set();
      set.add(name);
      entry.externalImports.set(from, set);
    }
    for (const [schema, cls] of typeImports) {
      const set = entry.typeImports.get(schema) ?? new Set();
      set.add(cls);
      entry.typeImports.set(schema, set);
    }
    for (const [name, labels] of enumTypes) entry.enums.set(name, labels);
    bySchema.set(t.schema, entry);
  }

  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const header =
    '/* eslint-disable */\n' +
    '// GENERATED by storage/typeorm/scripts/generateEntities.mjs from a database\n' +
    '// built by the current migrations. Do not edit by hand; edit the generator.\n';
  const index = [];
  for (const [
    schema,
    { classes, enums: schemaEnums, typeImports, externalImports },
  ] of bySchema) {
    const file = schema.replace(/_/g, '-');
    const decorators = new Set();
    for (const { code } of classes) {
      for (const m of code.matchAll(/@(\w+)\(/g)) decorators.add(m[1]);
    }
    const body = [
      header,
      `import { ${[...decorators].sort().join(', ')}, type Relation } from 'typeorm';`,
      ...[...externalImports].map(
        ([from, set]) =>
          `import type { ${[...set].sort().join(', ')} } from '${from}';`,
      ),
      ...[...typeImports].map(
        ([s, set]) =>
          `import type { ${[...set].sort().join(', ')} } from './${s.replace(/_/g, '-')}.js';`,
      ),
      '',
      ...[...schemaEnums].map(
        ([n, labels]) => `export type ${n} = ${labels.map(q).join(' | ')};`,
      ),
      '',
      ...classes.map((c) => c.code + '\n'),
    ].join('\n');
    fs.writeFileSync(path.join(outDir, `${file}.ts`), body);
    index.push({ file, classNames: classes.map((c) => c.className) });
  }
  fs.writeFileSync(
    path.join(outDir, 'index.ts'),
    header.replace('/* eslint-disable */\n', '') +
      index
        .map(({ file }) => `import * as ${pascal(file)} from './${file}.js';`)
        .join('\n') +
      '\n\n' +
      index.map(({ file }) => `export * from './${file}.js';`).join('\n') +
      '\n\nexport const entities = [\n' +
      index
        .map(({ file, classNames }) =>
          classNames.map((c) => `  ${pascal(file)}.${c},`).join('\n'),
        )
        .join('\n') +
      '\n];\n',
  );
  console.log(JSON.stringify(summary, null, 2));
}

await main();
