import { cn } from '@/lib/utils';
import * as React from 'react';

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  startSlot?: React.ReactNode;
  endSlot?: React.ReactNode;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, startSlot, endSlot, ...props }, ref) => {
    const textareaClasses = cn(
      'py-3 px-4 w-full text-sm font-medium transition-colors placeholder:text-gray-400 disabled:cursor-not-allowed disabled:opacity-50 disabled:pointer-events-none',
      'border border-gray-200 bg-white',
      'hover:border-gray-300',
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
        <textarea className={textareaClasses} ref={ref} {...props} />
        {endSlot && <>{endSlot}</>}
      </div>
    );
  },
);

Textarea.displayName = 'Textarea';

export { Textarea };
