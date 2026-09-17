import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/coop-ui/Command';
import { Popover, PopoverContent, PopoverTrigger } from '@/coop-ui/Popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/coop-ui/Tooltip';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown, Info, LoaderCircle, X } from 'lucide-react';
import * as React from 'react';

export type ComboboxOption = {
  value: string;
  label: string;
  /** Optional explanation shown in a hover tooltip via an info icon. */
  description?: string;
  disabled?: boolean;
  /**
   * `MultiCombobox` only. Unlike `disabled` (which a `MultiCombobox` row
   * ignores once the option is already selected, so a stale/incompatible
   * selection can still be individually removed — see its `toggle`
   * comment), this keeps the row disabled no matter what. Use it for
   * options that must never be toggled from this control at all, where
   * the only way to clear a pre-existing selection should be the field's
   * own `allowClear`.
   */
  alwaysDisabled?: boolean;
  /**
   * Optional group heading. Options sharing the same `group` are rendered
   * together under a non-selectable heading row, in first-seen order.
   * Options without a `group` render in a single ungrouped list, unchanged.
   */
  group?: string;
};

/** Buckets options by `group`, preserving first-seen order of both groups and options. */
function groupOptions(options: ComboboxOption[]) {
  const groups = new Map<string | undefined, ComboboxOption[]>();
  for (const option of options) {
    const bucket = groups.get(option.group);
    if (bucket) {
      bucket.push(option);
    } else {
      groups.set(option.group, [option]);
    }
  }
  return [...groups.entries()];
}

type TriggerProps = {
  disabled?: boolean;
  className?: string;
  id?: string;
  placeholder?: string;
  'aria-label'?: string;
  onClick?: (e: React.MouseEvent) => void;
};

const triggerClasses =
  'flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm placeholder:text-gray-400 hover:border-gray-300 focus:outline-none focus:border-indigo-500 focus:shadow-focus-indigo disabled:cursor-not-allowed disabled:opacity-50 data-[state=open]:border-indigo-500 dark:border-input dark:bg-background';

function ClearButton({ onClear }: { onClear: (e: React.MouseEvent) => void }) {
  return (
    <span
      role="button"
      tabIndex={-1}
      aria-label="Clear selection"
      className="text-gray-400 hover:text-gray-600"
      onClick={onClear}
    >
      <X className="h-4 w-4" />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Single-select
// ---------------------------------------------------------------------------

export type ComboboxProps = TriggerProps & {
  options: ComboboxOption[];
  value: string | undefined;
  onValueChange: (value: string | undefined) => void;
  searchPlaceholder?: string;
  emptyText?: React.ReactNode;
  /** Show an X to reset the selection. Mirrors antd `allowClear`. */
  allowClear?: boolean;
  contentClassName?: string;
  /** Shows a spinner in place of the chevron and disables the trigger. */
  loading?: boolean;
  /** Hide the search input, e.g. for a short fixed list like AND/OR. */
  showSearch?: boolean;
};

const Combobox = React.forwardRef<HTMLButtonElement, ComboboxProps>(
  (
    {
      options,
      value,
      onValueChange,
      placeholder = 'Select…',
      searchPlaceholder = 'Search…',
      emptyText = 'No results.',
      allowClear = false,
      disabled,
      loading = false,
      showSearch = true,
      className,
      contentClassName,
      id,
      onClick,
      ...rest
    },
    ref,
  ) => {
    const [open, setOpen] = React.useState(false);
    const selected = options.find((o) => o.value === value);

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            ref={ref}
            type="button"
            id={id}
            disabled={loading || disabled}
            onClick={onClick}
            className={cn(triggerClasses, className)}
            {...rest}
          >
            <span className={cn('truncate', !selected && 'text-gray-400')}>
              {selected ? selected.label : placeholder}
            </span>
            <span className="flex shrink-0 items-center gap-1">
              {allowClear && !loading && value != null && value !== '' && (
                <ClearButton
                  onClear={(e) => {
                    e.stopPropagation();
                    onValueChange(undefined);
                  }}
                />
              )}
              {loading ? (
                <LoaderCircle className="h-4 w-4 animate-spin opacity-50" />
              ) : (
                <ChevronsUpDown className="h-4 w-4 opacity-50" />
              )}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          className={cn(
            'w-[--radix-popover-trigger-width] p-0',
            contentClassName,
          )}
          align="start"
        >
          <Command>
            {showSearch && <CommandInput placeholder={searchPlaceholder} />}
            <CommandList>
              <CommandEmpty>{emptyText}</CommandEmpty>
              {groupOptions(options).map(([group, groupOptions]) => (
                <CommandGroup key={group ?? ''} heading={group}>
                  {groupOptions.map((option) => (
                    <CommandItem
                      key={option.value}
                      value={option.value}
                      keywords={
                        option.description
                          ? [option.label, option.description]
                          : [option.label]
                      }
                      disabled={option.disabled}
                      onSelect={() => {
                        onValueChange(option.value);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4 shrink-0',
                          option.value === value ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                      <span className="flex-1 truncate">{option.label}</span>
                      {option.description && (
                        <Tooltip>
                          <TooltipTrigger
                            asChild
                            // Keep the info icon from also acting as the
                            // row's select target.
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Info
                              // Row-level `data-[disabled=true]:pointer-events-none`
                              // (see Command.tsx) would otherwise also block
                              // hovering this icon — override it back on so a
                              // disabled option's tooltip stays reachable.
                              className="ml-2 h-4 w-4 shrink-0 pointer-events-auto text-gray-400"
                            />
                          </TooltipTrigger>
                          <TooltipContent side="right">
                            {option.description}
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  },
);
Combobox.displayName = 'Combobox';

// ---------------------------------------------------------------------------
// Multi-select
// ---------------------------------------------------------------------------

export type MultiComboboxProps = TriggerProps & {
  options: ComboboxOption[];
  value: string[];
  onValueChange: (value: string[]) => void;
  searchPlaceholder?: string;
  emptyText?: React.ReactNode;
  allowClear?: boolean;
  contentClassName?: string;
};

const MultiCombobox = React.forwardRef<HTMLButtonElement, MultiComboboxProps>(
  (
    {
      options,
      value,
      onValueChange,
      placeholder = 'Select…',
      searchPlaceholder = 'Search…',
      emptyText = 'No results.',
      allowClear = false,
      disabled,
      className,
      contentClassName,
      id,
      onClick,
      ...rest
    },
    ref,
  ) => {
    const [open, setOpen] = React.useState(false);
    const selectedLabels = options
      .filter((o) => value.includes(o.value))
      .map((o) => o.label);

    const toggle = (optionValue: string) => {
      onValueChange(
        value.includes(optionValue)
          ? value.filter((v) => v !== optionValue)
          : [...value, optionValue],
      );
    };

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            ref={ref}
            type="button"
            id={id}
            disabled={disabled}
            onClick={onClick}
            className={cn(triggerClasses, 'h-auto min-h-9', className)}
            {...rest}
          >
            <span
              className={cn(
                'truncate text-left',
                selectedLabels.length === 0 && 'text-gray-400',
              )}
            >
              {selectedLabels.length > 0
                ? selectedLabels.join(', ')
                : placeholder}
            </span>
            <span className="flex shrink-0 items-center gap-1">
              {allowClear && value.length > 0 && (
                <ClearButton
                  onClear={(e) => {
                    e.stopPropagation();
                    onValueChange([]);
                  }}
                />
              )}
              <ChevronsUpDown className="h-4 w-4 opacity-50" />
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          className={cn(
            'w-[--radix-popover-trigger-width] p-0',
            contentClassName,
          )}
          align="start"
        >
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {options.map((option) => {
                  const isSelected = value.includes(option.value);
                  return (
                    <CommandItem
                      key={option.value}
                      value={option.value}
                      keywords={
                        option.description
                          ? [option.label, option.description]
                          : [option.label]
                      }
                      // A disabled option can still be individually removed
                      // once selected (e.g. it became incompatible after
                      // selection) — only block adding a *new* disabled one.
                      // `alwaysDisabled` opts out of that carve-out entirely.
                      disabled={
                        option.alwaysDisabled ||
                        (option.disabled && !isSelected)
                      }
                      onSelect={() => toggle(option.value)}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4 shrink-0',
                          isSelected ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                      <span className="flex-1 truncate">{option.label}</span>
                      {option.description && (
                        <Tooltip>
                          <TooltipTrigger
                            asChild
                            // Keep the info icon from also acting as the
                            // row's select target.
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Info
                              // Row-level `data-[disabled=true]:pointer-events-none`
                              // (see Command.tsx) would otherwise also block
                              // hovering this icon — override it back on so a
                              // disabled option's tooltip stays reachable.
                              className="ml-2 h-4 w-4 shrink-0 pointer-events-auto text-gray-400"
                            />
                          </TooltipTrigger>
                          <TooltipContent side="right">
                            {option.description}
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  },
);
MultiCombobox.displayName = 'MultiCombobox';

export { Combobox, MultiCombobox };
