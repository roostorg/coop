import { cn } from '@/lib/utils';
import * as SwitchPrimitives from '@radix-ui/react-switch';
import { Check, X } from 'lucide-react';
import * as React from 'react';

interface SwitchProps
  extends React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> {
  size?: 'small'; //| 'medium' | 'large';
}

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  SwitchProps
>(({ className, size = 'small', ...props }, ref) => {
  const sizeClasses = {
    small: {
      root: 'h-6 w-11',
      thumb: 'h-5 w-5',
      icon: 'h-3 w-3',
      left: 'left-1',
      right: 'right-1',
    },
  };

  const currentSize = sizeClasses[size];

  return (
    <SwitchPrimitives.Root
      className={cn(
        'relative group inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'data-[state=checked]:bg-primary data-[state=unchecked]:bg-gray-200',
        currentSize.root,
        className,
      )}
      {...props}
      ref={ref}
    >
      <span
        className={cn(
          'absolute flex items-center justify-center',
          currentSize.left,
        )}
      >
        <X
          className={cn(
            currentSize.icon,
            'text-gray-500',
            'group-data-[state=checked]:text-white',
            'z-20 group-data-[state=checked]:z-0',
          )}
        />
      </span>
      <span
        className={cn(
          'absolute flex items-center justify-center',
          currentSize.right,
        )}
      >
        <Check
          className={cn(
            currentSize.icon,
            'text-gray-500',
            'group-data-[state=checked]:text-indigo-500',
            'z-0 group-data-[state=checked]:z-20',
          )}
        />
      </span>
      <SwitchPrimitives.Thumb
        className={cn(
          'pointer-events-none z-10 block rounded-full bg-background shadow-lg ring-0 transition-transform',
          currentSize.thumb,
          'data-[state=checked]:translate-x-full data-[state=unchecked]:translate-x-0',
        )}
      />
    </SwitchPrimitives.Root>
  );
});

Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
