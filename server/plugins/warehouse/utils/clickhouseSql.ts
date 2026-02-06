import safeStableStringify from 'safe-stable-stringify';

function escapeString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => formatValue(item)).join(', ')}]`;
  }

  if (value instanceof Date) {
    return `'${value.toISOString()}'`;
  }

  if (Buffer.isBuffer(value)) {
    return `unhex('${value.toString('hex')}')`;
  }

  const type = typeof value;
  if (type === 'number') {
    if (!Number.isFinite(value as number)) {
      throw new Error('ClickHouse adapter does not support non-finite numbers');
    }
    return String(value);
  }

  if (type === 'bigint') {
    return value.toString();
  }

  if (type === 'boolean') {
    return (value as boolean) ? '1' : '0';
  }

  if (type === 'object') {
    const json = safeStableStringify(value);
    return `'${escapeString(json)}'`;
  }

  return `'${escapeString(String(value))}'`;
}

export function formatClickhouseQuery(
  sql: string,
  params: readonly unknown[] = [],
): string {
  const translatedSql = translateFunctions(sql);

  if (!params.length) {
    return translatedSql;
  }

  const positionalPlaceholderRegex = /\$(\d+)/g;

  if (positionalPlaceholderRegex.test(translatedSql)) {
    let result = translatedSql;
    result = result.replace(positionalPlaceholderRegex, (_, index) => {
      const paramIndex = Number(index) - 1;
      if (paramIndex < 0 || paramIndex >= params.length) {
        throw new Error('Not enough parameters supplied for ClickHouse query.');
      }
      return formatValue(params[paramIndex]);
    });
    return result;
  }

  let paramIndex = 0;
  return translatedSql.replace(/\?/g, () => {
    if (paramIndex >= params.length) {
      throw new Error('Not enough parameters supplied for ClickHouse query.');
    }

    const value = params[paramIndex];
    paramIndex += 1;
    return formatValue(value);
  });
}

export { formatValue as formatClickhouseValue };

function translateFunctions(statement: string): string {
  return statement
    .replace(/\bCONVERT_TIMEZONE\b/gi, 'toTimeZone')
    .replace(/\bDATE_TRUNC\b/gi, 'date_trunc')
    .replace(/\bDATE\(/gi, 'toDate(');
}

