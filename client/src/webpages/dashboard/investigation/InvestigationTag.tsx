import CollapsibleText from '@/webpages/dashboard/mrt/manual_review_job/v2/components/CollapsibleText';

/**
 * An action's parameter spec allows up to 50 parameters, 100 options on a
 * MULTISELECT, and a STRING `maxLength` of 100,000 — so a large value is valid
 * input, not a degenerate case. Values past this length get their own line and
 * a line-clamp with a "Read more" toggle, keeping the table row bounded.
 *
 * Compared as UTF-16 length, which is always >= the grapheme count, so a value
 * under the threshold is definitely short. Anything over is handed to
 * `CollapsibleText`, which does the precise grapheme check itself.
 */
const INLINE_VALUE_MAX_CHARS = 120;
const COLLAPSED_LINES = 2;

/**
 * A label in the investigation and review console views. `parameters` carries
 * the runtime values an action ran with, keyed by parameter name; omitted or
 * empty renders the tag exactly as before, so callers without parameters are
 * unaffected.
 */
export default function InvestigationTag({
  title,
  parameters,
}: {
  title: string;
  parameters?: Readonly<Record<string, unknown>>;
}) {
  const entries = Object.entries(parameters ?? {});

  return (
    <div className="p-2 m-0.5 rounded-md border-solid border-gray-200 text-gray-500 bg-gray-50">
      {title}
      {entries.length > 0 && (
        <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1 text-xs">
          {entries.map(([name, value]) => {
            const formatted = formatParameterValue(value);
            const label = <span className="font-medium">{name}</span>;

            // `w-full` inside the wrapping flex container gives a long value
            // its own line, so it can clamp without shoving the short entries
            // that share the row out of alignment.
            return formatted.length > INLINE_VALUE_MAX_CHARS ? (
              <div key={name} className="w-full text-gray-400">
                {label}
                {': '}
                <CollapsibleText
                  text={formatted}
                  maxLines={COLLAPSED_LINES}
                  maxGraphemes={INLINE_VALUE_MAX_CHARS}
                />
              </div>
            ) : (
              <span key={name} className="text-gray-400">
                {label}
                {': '}
                <span>{formatted}</span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Parameter values are whatever the action's spec allows — string, number,
 * boolean, or a multiselect's array. Nested objects shouldn't occur for a
 * declared parameter, but they can reach this view when the action's metadata
 * is unavailable and the stored map is shown unfiltered, so render them as
 * JSON rather than `[object Object]`.
 */
function formatParameterValue(value: unknown): string {
  if (value == null) {
    return '—';
  }
  if (Array.isArray(value)) {
    // Recursive so an array of objects reads as JSON rather than a row of
    // `[object Object]`, which is what `join` alone produces.
    return value.map(formatParameterValue).join(', ');
  }
  if (typeof value === 'object') {
    return JSON.stringify(value) ?? '—';
  }
  return String(value);
}
