import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import * as React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  startSlot?: React.ReactNode;
  endSlot?: React.ReactNode;
  /** Show an X to clear the value once non-empty. Mirrors antd `allowClear`. */
  allowClear?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type,
      startSlot,
      endSlot,
      allowClear = false,
      value,
      ...props
    },
    ref,
  ) => {
    const innerRef = React.useRef<HTMLInputElement>(null);

    const showClear = allowClear && value != null && value !== '';

    const inputClasses = cn(
      'py-2 px-3 w-full text-sm font-medium transition-colors placeholder:text-gray-400 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 disabled:pointer-events-none',
      'border border-gray-200 bg-white',
      'hover:border-gray-300',
      'focus:z-10 focus:outline-none focus:border-indigo-500 focus:shadow-focus-indigo',
      showClear && 'pr-8',
      startSlot && endSlot
        ? 'rounded-none'
        : startSlot
          ? 'rounded-r-lg rounded-l-none'
          : endSlot
            ? 'rounded-l-lg rounded-r-none'
            : 'rounded-lg',
      className,
    );

    const handleClear = (e: React.MouseEvent) => {
      e.preventDefault();
      const input = innerRef.current;
      if (input) {
        // Set via the native setter + dispatch an `input` event, rather than
        // calling props.onChange directly, so this works regardless of the
        // caller's onChange signature (plain useState setter, react-hook-form
        // register(), etc.) — same technique React's own testing utilities use
        // to simulate a native edit on a controlled input.
        const nativeSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value',
        )?.set;
        nativeSetter?.call(input, '');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.focus();
      }
    };

    return (
      <div className="flex w-full">
        {startSlot && <>{startSlot}</>}
        <div className="relative flex w-full items-center">
          <input
            type={type}
            className={inputClasses}
            value={value}
            ref={(node) => {
              innerRef.current = node;
              if (typeof ref === 'function') {
                ref(node);
              } else if (ref) {
                ref.current = node;
              }
            }}
            {...props}
          />
          {showClear && (
            <span
              role="button"
              tabIndex={-1}
              aria-label="Clear"
              className="absolute right-2 text-gray-400 hover:text-gray-600"
              onClick={handleClear}
            >
              <X className="h-4 w-4" />
            </span>
          )}
        </div>
        {endSlot && <>{endSlot}</>}
      </div>
    );
  },
);

Input.displayName = 'Input';

export { Input };
