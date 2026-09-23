import { cn } from '@/lib/utils';
import * as React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  startSlot?: React.ReactNode;
  endSlot?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, startSlot, endSlot, ...props }, ref) => {
    const inputClasses = cn(
      'py-3 px-4 w-full text-sm font-medium transition-colors placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 disabled:pointer-events-none',
      'border border-border bg-card dark:bg-background dark:border-border dark:placeholder:text-neutral-500',
      'hover:border-border dark:hover:border-muted-foreground/40',
      'focus:z-10 focus:outline-none focus:border-indigo-500 focus:shadow-focus-indigo',
      startSlot && endSlot
        ? 'rounded-none'
        : startSlot
          ? 'rounded-r-lg rounded-l-none'
          : endSlot
            ? 'rounded-l-lg rounded-r-none'
            : 'rounded-lg',
      className,
    );

    return (
      <div className="flex w-full">
        {startSlot && <>{startSlot}</>}
        <input type={type} className={inputClasses} ref={ref} {...props} />
        {endSlot && <>{endSlot}</>}
      </div>
    );
  },
);

Input.displayName = 'Input';

export { Input };
