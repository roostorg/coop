import { cn } from '@/lib/utils';
import * as CollapsiblePrimitive from '@radix-ui/react-collapsible';
import { ChevronDown, ChevronRight } from 'lucide-react';
import * as React from 'react';

const Collapsible = CollapsiblePrimitive.Root;

const CollapsibleContent = React.forwardRef<
  React.ElementRef<typeof CollapsiblePrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <CollapsiblePrimitive.Content
    ref={ref}
    className={cn(
      'overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up',
      className,
    )}
    {...props}
  >
    {children}
  </CollapsiblePrimitive.Content>
));
CollapsibleContent.displayName = CollapsiblePrimitive.Content.displayName;

interface CollapsibleTriggerProps extends React.ComponentPropsWithoutRef<
  typeof CollapsiblePrimitive.Trigger
> {
  /** Hide the built-in chevron, e.g. when the caller renders its own indicator. */
  hideChevron?: boolean;
}

const CollapsibleTrigger = React.forwardRef<
  React.ElementRef<typeof CollapsiblePrimitive.Trigger>,
  CollapsibleTriggerProps
>(({ className, children, hideChevron = false, ...props }, ref) => (
  <CollapsiblePrimitive.Trigger
    ref={ref}
    className={cn(
      'group flex w-full items-center justify-between gap-x-2 rounded text-left font-semibold text-gray-900 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 dark:text-white dark:hover:bg-neutral-800',
      className,
    )}
    {...props}
  >
    {children}
    {!hideChevron && (
      <span className="shrink-0 text-gray-500 dark:text-neutral-400">
        <ChevronDown className="hidden size-4 group-data-[state=open]:block" />
        <ChevronRight className="block size-4 group-data-[state=open]:hidden" />
      </span>
    )}
  </CollapsiblePrimitive.Trigger>
));
CollapsibleTrigger.displayName = CollapsiblePrimitive.Trigger.displayName;

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
