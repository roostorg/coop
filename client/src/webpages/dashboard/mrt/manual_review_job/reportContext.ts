export type ReportContextFields = {
  surface?: string | null;
  client?: {
    name?: string | null;
    version?: string | null;
    platform?: string | null;
  } | null;
  attributes?: { [key: string]: unknown } | null;
};

/**
 * Formats the client as e.g. "Ivory 2.3.1 (ios)", omitting missing parts.
 */
export function formatReportClient(
  client: ReportContextFields['client'],
): string | undefined {
  if (!client) {
    return undefined;
  }
  const nameAndVersion = [client.name, client.version]
    .filter(Boolean)
    .join(' ');
  const formatted = [
    nameAndVersion,
    client.platform ? `(${client.platform})` : undefined,
  ]
    .filter(Boolean)
    .join(' ');
  return formatted.length > 0 ? formatted : undefined;
}

/**
 * Returns the labelled parts of a report's context for display, in a stable
 * order: surface, client, then attributes sorted by key.
 */
export function reportContextEntries(
  context: ReportContextFields | null | undefined,
): Array<{ label: string; value: string }> {
  if (!context) {
    return [];
  }
  const client = formatReportClient(context.client);
  const attributes = Object.entries(context.attributes ?? {})
    .filter(([, value]) => value != null)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, value]) => ({ label, value: String(value) }));

  return [
    ...(context.surface ? [{ label: 'Surface', value: context.surface }] : []),
    ...(client ? [{ label: 'Client', value: client }] : []),
    ...attributes,
  ];
}

export function formatReportContext(
  context: ReportContextFields | null | undefined,
): string | undefined {
  const entries = reportContextEntries(context);
  return entries.length > 0
    ? entries.map(({ label, value }) => `${label}: ${value}`).join(' · ')
    : undefined;
}
