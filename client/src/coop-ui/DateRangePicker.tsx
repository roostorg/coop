import { Button, ButtonProps } from '@/coop-ui/Button';
import { Calendar } from '@/coop-ui/Calendar';
import { DateInput } from '@/coop-ui/DateInput';
import { Popover, PopoverContent, PopoverTrigger } from '@/coop-ui/Popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/coop-ui/Select';
import { Separator } from '@/coop-ui/Separator';
import { cn } from '@/lib/utils';
import {
  endOfDay,
  format,
  isAfter,
  isBefore,
  isSameDay,
  Locale,
  parseISO,
  startOfDay,
  subDays,
  subMonths,
} from 'date-fns';
import { enUS } from 'date-fns/locale';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type FC } from 'react';

export interface DateRangePickerProps {
  /** Click handler for applying the updates from DateRangePicker. */
  onUpdate?: (values: { range: DateRange }) => void;
  /** Initial value for start date */
  initialDateFrom?: Date | string;
  /** Initial value for end date */
  initialDateTo?: Date | string;
  /** Alignment of popover */
  align?: 'start' | 'center' | 'end';
  /** Option for locale */
  locale?: Locale;
  size?: ButtonProps['size'];
  variant?: ButtonProps['variant'];
  isSingleMonthOnly?: boolean;
}

const formatDate = (date: Date, locale: Locale = enUS): string =>
  format(date, 'MMM d, yyyy', { locale });

const getDateAdjustedForTimezone = (dateInput: Date | string): Date => {
  if (typeof dateInput === 'string') {
    return parseISO(dateInput);
  }
  return dateInput;
};

interface DateRange {
  from: Date;
  to: Date | undefined;
}

export enum Preset {
  Today = 'Today',
  Yesterday = 'Yesterday',
  Last7 = 'Last 7 Days',
  Last14 = 'Last 14 Days',
  Last30 = 'Last 30 Days',
}

interface PresetOption {
  name: Preset;
  label: string;
}

export const DateRangePicker: FC<DateRangePickerProps> = ({
  initialDateFrom = new Date(new Date().setHours(0, 0, 0, 0)),
  initialDateTo,
  onUpdate,
  align = 'end',
  locale = enUS,
  size,
  variant = 'white',
  isSingleMonthOnly = false,
}) => {
  const getPresetOptions = (): PresetOption[] =>
    Object.entries(Preset).map(([key, value]) => ({
      name: Preset[key as keyof typeof Preset],
      label: value,
    }));

  const getPresetRange = useCallback((preset: Preset): DateRange => {
    const today = new Date();

    const presetRanges: Record<Preset, () => DateRange> = {
      [Preset.Today]: () => ({
        from: startOfDay(today),
        to: endOfDay(today),
      }),
      [Preset.Yesterday]: () => {
        const date = subDays(today, 1);
        return {
          from: startOfDay(date),
          to: endOfDay(date),
        };
      },
      [Preset.Last7]: () => ({
        from: startOfDay(subDays(today, 6)),
        to: endOfDay(today),
      }),
      [Preset.Last14]: () => ({
        from: startOfDay(subDays(today, 13)),
        to: endOfDay(today),
      }),
      [Preset.Last30]: () => ({
        from: startOfDay(subDays(today, 29)),
        to: endOfDay(today),
      }),
    };

    const getRange = presetRanges[preset];

    if (!getRange) {
      throw new Error(`Unknown date range preset: ${preset}`);
    }

    return getRange();
  }, []);

  const [isOpen, setIsOpen] = useState(false);
  const presetOptions = getPresetOptions();
  const [range, setRange] = useState<DateRange>({
    from: getDateAdjustedForTimezone(initialDateFrom),
    to: initialDateTo
      ? getDateAdjustedForTimezone(initialDateTo)
      : getDateAdjustedForTimezone(initialDateFrom),
  });

  const openedRangeRef = useRef<DateRange | undefined>();
  const [selectedPreset, setSelectedPreset] = useState<Preset | undefined>();

  const [isSmallScreen, setIsSmallScreen] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 960 : false,
  );

  useEffect(() => {
    const handleResize = (): void => {
      setIsSmallScreen(window.innerWidth < 960);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const setPreset = (preset: Preset): void => {
    const range = getPresetRange(preset);
    setRange(range);
  };

  const isSameDayOrUndefined = (date1?: Date, date2?: Date): boolean => {
    if (date1 == null && date2 == null) {
      return true;
    }

    if (date1 != null && date2 != null) {
      return isSameDay(date1, date2);
    }

    return false;
  };

  const resetValues = (): void => {
    setRange({
      from: getDateAdjustedForTimezone(initialDateFrom),
      to: initialDateTo
        ? getDateAdjustedForTimezone(initialDateTo)
        : getDateAdjustedForTimezone(initialDateFrom),
    });
  };

  useEffect(() => {
    const checkPreset = () => {
      const matchingPreset = presetOptions.find((preset) => {
        const presetRange = getPresetRange(preset.name);
        return (
          isSameDay(range.from, presetRange.from) &&
          isSameDayOrUndefined(range.to, presetRange.to)
        );
      });

      setSelectedPreset(matchingPreset ? matchingPreset.name : undefined);
    };

    checkPreset();
  }, [range, presetOptions, getPresetRange]);

  useEffect(() => {
    if (isOpen) {
      openedRangeRef.current = range;
    }
  }, [range, isOpen]);

  const buttonDateContent = `${formatDate(range.from, locale)}${
    range.to != null ? ' - ' + formatDate(range.to, locale) : ''
  }`;

  const updateButtonOnClick = useCallback(() => {
    setIsOpen(false);
    onUpdate?.({ range });
  }, [onUpdate, setIsOpen, range]);

  return (
    <Popover
      modal={true}
      open={isOpen}
      onOpenChange={(open: boolean) => {
        if (!open) {
          resetValues();
        }
        setIsOpen(open);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          size={size}
          variant={variant}
          endIcon={isOpen ? ChevronUp : ChevronDown}
        >
          {buttonDateContent}
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-auto">
        <div className="flex py-2">
          {!isSmallScreen && (
            <div className="flex flex-col items-end gap-1 pt-12 pr-2">
              <div className="flex flex-col items-end w-40 gap-1 pr-2">
                {presetOptions.map(({ name, label }) => {
                  const isSelected = selectedPreset === name;
                  return (
                    <Button
                      key={name}
                      className={cn(isSelected && 'pointer-events-none')}
                      variant="ghost"
                      size="sm"
                      startIcon={isSelected ? Check : undefined}
                      onClick={() => {
                        setPreset(name);
                      }}
                    >
                      {label}
                    </Button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="flex">
            <div className="flex flex-col">
              {isSmallScreen && (
                <Select defaultValue={selectedPreset} onValueChange={setPreset}>
                  <SelectTrigger className="w-[180px] mx-auto mb-2">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {presetOptions.map((preset) => (
                      <SelectItem key={preset.name} value={preset.name}>
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <div>
                <Calendar
                  mode="range"
                  onSelect={(value: { from?: Date; to?: Date } | undefined) => {
                    if (value?.from != null) {
                      setRange({ from: value.from, to: value?.to });
                    }
                  }}
                  selected={range}
                  numberOfMonths={isSingleMonthOnly || isSmallScreen ? 1 : 2}
                  defaultMonth={
                    isSingleMonthOnly || isSmallScreen
                      ? new Date()
                      : subMonths(new Date(), 1)
                  }
                />
              </div>
            </div>
          </div>
        </div>
        <Separator className="mb-4" />
        <div className="flex items-center justify-end gap-4">
          <div className="flex flex-col items-center justify-end gap-2 lg:flex-row lg:items-start">
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <DateInput
                  value={range.from}
                  onChange={(date) => {
                    const toDate =
                      !range.to || isAfter(date, range.to) ? date : range.to;
                    setRange((prevRange) => ({
                      ...prevRange,
                      from: date,
                      to: toDate,
                    }));
                  }}
                />
                <div className="py-1">-</div>
                <DateInput
                  value={range.to}
                  onChange={(date) => {
                    const fromDate = isBefore(date, range.from)
                      ? date
                      : range.from;
                    setRange((prevRange) => ({
                      ...prevRange,
                      from: fromDate,
                      to: date,
                    }));
                  }}
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                setIsOpen(false);
                resetValues();
              }}
              variant="white"
            >
              Cancel
            </Button>
            <Button size="sm" onClick={updateButtonOnClick}>
              Update
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

DateRangePicker.displayName = 'DateRangePicker';
