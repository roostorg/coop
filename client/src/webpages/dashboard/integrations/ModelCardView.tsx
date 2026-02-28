import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

import type {
  GQLModelCard,
  GQLModelCardField,
  GQLModelCardSection,
  GQLModelCardSubsection,
} from '../../../graphql/generated';

type ModelCardViewProps = { card: GQLModelCard };

/**
 * Renders a single label-value row. Linkifies URLs in value.
 */
function ModelCardFieldRow({ field }: { field: GQLModelCardField }) {
  const isUrl =
    field.value.startsWith('http://') || field.value.startsWith('https://');
  return (
    <div className="flex flex-col gap-0.5 py-1 text-sm">
      <span className="font-medium text-zinc-600">{field.label}</span>
      {isUrl ? (
        <a
          href={field.value}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline break-all"
        >
          {field.value}
        </a>
      ) : (
        <span className="text-zinc-900">{field.value}</span>
      )}
    </div>
  );
}

function SubsectionBlock({
  subsection,
}: {
  subsection: GQLModelCardSubsection;
}) {
  return (
    <div className="mb-4 last:mb-0">
      <div className="mb-2 font-semibold text-zinc-800">{subsection.title}</div>
      <div className="flex flex-col gap-0">
        {subsection.fields.map((field, i) => (
          <ModelCardFieldRow key={i} field={field} />
        ))}
      </div>
    </div>
  );
}

function ModelCardSectionBlock({
  section,
  defaultOpen = true,
}: {
  section: GQLModelCardSection;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const hasSubsections = section.subsections && section.subsections.length > 0;
  const hasFields = section.fields && section.fields.length > 0;
  const hasContent = hasSubsections ?? hasFields;

  return (
    <div className="border-b border-zinc-200 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between py-3 text-left font-semibold text-zinc-900 hover:bg-zinc-50 rounded"
        aria-expanded={open}
      >
        {section.title}
        {hasContent ? (
          open ? (
            <ChevronDown className="shrink-0 text-zinc-500" size={18} />
          ) : (
            <ChevronRight className="shrink-0 text-zinc-500" size={18} />
          )
        ) : null}
      </button>
      {open && hasContent && (
        <div className="pb-4 pl-0">
          {hasSubsections &&
            section.subsections?.map((sub) => (
              <SubsectionBlock key={sub.title} subsection={sub} />
            ))}
          {hasFields && !hasSubsections && (
            <div className="flex flex-col gap-0">
              {section.fields?.map((field, i) => (
                <ModelCardFieldRow key={i} field={field} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ModelCardView({ card }: ModelCardViewProps) {
  const sections = card.sections ?? [];
  return (
    <div className="flex flex-col">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-lg font-semibold text-zinc-900">
          {card.modelName}
        </span>
        <span className="text-sm text-zinc-600">{card.version}</span>
        {card.releaseDate != null && (
          <span className="text-sm text-zinc-500">{card.releaseDate}</span>
        )}
      </div>
      <div className="flex flex-col">
        {sections.map((section) => (
          <ModelCardSectionBlock
            key={section.id}
            section={section}
            defaultOpen={sections.length <= 3}
          />
        ))}
      </div>
    </div>
  );
}
