/**
 * Escape per RFC 4180 and neutralize spreadsheet formula injection. A leading
 * =, +, - or @ is prefixed with an apostrophe so Excel treats it as text.
 * This is a moderation audit log; a decision reason is free text a moderator
 * typed, so it can't be trusted not to look like a formula.
 */
export function escapeCsvField(value: string): string {
  const neutralized = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${neutralized.replace(/"/g, '""')}"`;
}
