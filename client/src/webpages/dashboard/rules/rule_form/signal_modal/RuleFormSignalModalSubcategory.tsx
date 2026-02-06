import { SignalSubcategory } from '@roostorg/types';

function subcategoryOptionComponent(props: {
  id: string;
  label: string;
  description?: string;
  onSelect: (option: string) => void;
}) {
  const { id, label, description, onSelect } = props;
  return (
    <div
      className="flex flex-col justify-center p-4 bg-white border border-solid rounded-lg cursor-pointer border-slate-200 w-60 drop-shadow hover:bg-sky-100"
      onClick={() => onSelect(id)}
      key={id}
    >
      {label}
      {description ? (
        <div className="overflow-hidden text-xs text-gray-400 overflow-ellipsis line-clamp-2">
          {description}
        </div>
      ) : null}
    </div>
  );
}

export function RuleFormSignalModalSubcategory(props: {
  subcategory: SignalSubcategory;
  onSelectSubcategoryOption: (option: string) => void;
}) {
  const { subcategory, onSelectSubcategoryOption } = props;
  return (
    <div className="flex flex-col mt-4">
      <div className="mb-1 font-semibold">{subcategory.label}</div>
      <div className="grid grid-cols-3 gap-3">
        {subcategory.children?.map((child) =>
          subcategoryOptionComponent({
            ...child,
            onSelect: onSelectSubcategoryOption,
          }),
        )}
      </div>
    </div>
  );
}
