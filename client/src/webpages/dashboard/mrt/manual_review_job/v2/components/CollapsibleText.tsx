import { memo, useMemo, useState } from 'react';

type CollapsibleTextProps = {
  text: string;
  maxLines?: number;
  maxGraphemes?: number;
};

/** Count graphemes using Intl.Segmenter (handles all scripts correctly). */
function countGraphemes(text: string): number {
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  let count = 0;
  for (const _ of segmenter.segment(text)) {
    count += 1;
  }
  return count;
}

/**
 * Renders text with wrapping. When the text exceeds `maxGraphemes`, it is
 * collapsed to `maxLines` visible lines with a "Read more" / "Read less"
 * toggle. Short text renders in full with no toggle.
 *
 * Memoized: props are primitives (string, number), so React.memo's shallow
 * comparison prevents re-renders (and re-segmentation) when a parent re-renders
 * but the text hasn't changed — important for thread histories with many copies
 * of the same message.
 */
function CollapsibleTextImpl({
  text,
  maxLines = 12,
  maxGraphemes = 2000,
}: CollapsibleTextProps) {
  const isCollapsible = useMemo(
    () => countGraphemes(text) > maxGraphemes,
    [text, maxGraphemes],
  );
  const [expanded, setExpanded] = useState(false);

  if (!isCollapsible) {
    return (
      <div className="whitespace-normal break-words text-start">{text}</div>
    );
  }

  return (
    <div className="flex flex-col text-start">
      <div
        className="whitespace-normal break-words overflow-hidden"
        // Inline style rather than Tailwind's line-clamp-N so the line count
        // is fully dynamic (Tailwind's JIT won't generate line-clamp-${maxLines}
        // from a template literal). This is exactly what line-clamp compiles to.
        style={{
          display: '-webkit-box',
          WebkitBoxOrient: 'vertical',
          WebkitLineClamp: expanded ? 'none' : maxLines,
        }}
      >
        {text}
      </div>
      <button
        type="button"
        className="self-start pt-1 font-semibold text-blue-500 cursor-pointer"
        onClick={() => setExpanded((e) => !e)}
      >
        {expanded ? 'Read less' : 'Read more'}
      </button>
    </div>
  );
}

const CollapsibleText = memo(CollapsibleTextImpl);
export default CollapsibleText;
