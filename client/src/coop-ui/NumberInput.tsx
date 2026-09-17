import { Input, type InputProps } from '@/coop-ui/Input';
import { cn } from '@/lib/utils';
import * as React from 'react';

export type NumberInputProps = Omit<
  InputProps,
  'type' | 'inputMode' | 'value' | 'onChange' | 'min' | 'max'
> & {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  min?: number;
  max?: number;
  /** Allow a decimal point. Defaults to integers only. */
  allowDecimal?: boolean;
  /** Allow a leading `-`. Defaults to non-negative only. */
  allowNegative?: boolean;
};

/**
 * A number input that never lets the DOM display diverge from what's
 * actually stored. `<input type="number">` lets you type non-numeric text
 * (e.g. "abc123xyz") and keeps showing it on screen while the real `.value`
 * silently normalizes to '' underneath — a React-controlled number input
 * doesn't reliably resync the DOM once that happens (worse in Firefox), so
 * the field can show text that was never actually stored, with no error
 * styling. This filters to only the characters the field allows (so you
 * can't type a disallowed character at all) and validates the result,
 * showing an inline error and withholding `onChange` until it's fixed
 * rather than silently clamping or dropping invalid input.
 *
 * Known gap: no IME composition handling (unlike e.g. React Aria's
 * useNumberField, which exposes onCompositionStart/End for this). A
 * full-width-digit IME's in-progress composition text could get run
 * through the character filter before it's finalized. Left unaddressed
 * since this is a digits-only field and composition input is rare there;
 * revisit if that stops being true.
 */
const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  (
    {
      value,
      onChange,
      min,
      max,
      allowDecimal = false,
      allowNegative = false,
      className,
      onFocus,
      onBlur,
      ...rest
    },
    ref,
  ) => {
    const [rawText, setRawText] = React.useState(
      value === undefined ? '' : String(value),
    );
    const [error, setError] = React.useState<string | undefined>(undefined);
    // While focused, `rawText` (not `value`) is the source of truth for
    // what's on screen. A caller whose own `value` type can't hold
    // `undefined` (e.g. a required `number` field) has to coerce a
    // momentarily-empty field back to some default on every keystroke,
    // which bounces straight back down as this `value` prop — resyncing
    // from it unconditionally would then fight the user out of ever
    // clearing the field to retype. Only external, not-actively-being-typed
    // changes to `value` (e.g. a parent-driven reset) should resync.
    const isFocused = React.useRef(false);

    React.useEffect(() => {
      if (!isFocused.current) {
        setRawText(value === undefined ? '' : String(value));
        setError(undefined);
      }
    }, [value]);

    const allowedCharsPattern = new RegExp(
      `[^${allowNegative ? '-' : ''}\\d${allowDecimal ? '.' : ''}]`,
      'g',
    );

    const validate = (
      raw: string,
    ): { parsed: number | undefined; error: string | undefined } => {
      if (raw === '' || raw === '-') {
        return { parsed: undefined, error: undefined };
      }
      const parsed = Number(raw);
      if (!Number.isFinite(parsed)) {
        return { parsed: undefined, error: 'Enter a valid number' };
      }
      if (min !== undefined && parsed < min) {
        return { parsed: undefined, error: `Must be at least ${min}` };
      }
      if (max !== undefined && parsed > max) {
        return { parsed: undefined, error: `Must be at most ${max}` };
      }
      return { parsed, error: undefined };
    };

    return (
      <div className={className}>
        <Input
          ref={ref}
          type="text"
          inputMode={allowDecimal ? 'decimal' : 'numeric'}
          className={cn(error && 'border-red-500 focus:border-red-500')}
          value={rawText}
          onChange={(e) => {
            const filtered = e.target.value.replace(allowedCharsPattern, '');
            setRawText(filtered);
            const result = validate(filtered);
            setError(result.error);
            onChange(result.parsed);
          }}
          onFocus={(e) => {
            isFocused.current = true;
            onFocus?.(e);
          }}
          onBlur={(e) => {
            isFocused.current = false;
            // Normalize the display to whatever's actually committed once
            // the user leaves — e.g. a field left blank shows the fallback
            // the caller coerced `undefined` to, and a trailing "." or "-"
            // with nothing after it goes away.
            setRawText(value === undefined ? '' : String(value));
            setError(undefined);
            onBlur?.(e);
          }}
          {...rest}
        />
        {error && <div className="mt-1 text-xs text-red-500">{error}</div>}
      </div>
    );
  },
);
NumberInput.displayName = 'NumberInput';

export { NumberInput };
