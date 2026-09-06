import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/coop-ui/Command';
import { Popover, PopoverContent, PopoverTrigger } from '@/coop-ui/Popover';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import * as React from 'react';

export type ComboboxOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type TriggerProps = {
  disabled?: boolean;
  className?: string;
  id?: string;
  placeholder?: string;
  'aria-label'?: string;
  onClick?: (e: React.MouseEvent) => void;
};

const triggerClasses =
  'flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm placeholder:text-gray-400 hover:border-gray-300 focus:outline-none focus:border-indigo-500 focus:shadow-focus-indigo disabled:cursor-not-allowed disabled:opacity-50 data-[state=open]:border-indigo-500 dark:border-input dark:bg-background';

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
  emptyText?: string;
  /** Show an X to reset the selection. Mirrors antd `allowClear`. */
  allowClear?: boolean;
  contentClassName?: string;
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
            disabled={disabled}
            onClick={onClick}
            className={cn(triggerClasses, className)}
            {...rest}
          >
            <span className={cn('truncate', !selected && 'text-gray-400')}>
              {selected ? selected.label : placeholder}
            </span>
            <span className="flex shrink-0 items-center gap-1">
              {allowClear && value != null && value !== '' && (
                <ClearButton
                  onClear={(e) => {
                    e.stopPropagation();
                    onValueChange(undefined);
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
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    disabled={option.disabled}
                    onSelect={() => {
                      onValueChange(
                        option.value === value ? undefined : option.value,
                      );
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        option.value === value ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
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
  emptyText?: string;
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
            className={cn(triggerClasses, 'h-auto min-h-10', className)}
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
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    disabled={option.disabled}
                    onSelect={() => toggle(option.value)}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value.includes(option.value)
                          ? 'opacity-100'
                          : 'opacity-0',
                      )}
                    />
                    {option.label}
                  </CommandItem>
                ))}
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
