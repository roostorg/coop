import { cn } from '@/lib/utils';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { LoaderCircle } from 'lucide-react';
import * as React from 'react';

const buttonVariants = cva(
  'py-3 px-4 inline-flex items-center gap-x-2 text-sm font-semibold rounded-lg disabled:opacity-50 disabled:pointer-events-none focus:outline-none',
  {
    variants: {
      variant: {
        default: 'border border-transparent',
        outline: 'border',
        ghost: 'border border-transparent',
        soft: 'border border-transparent',
        white:
          'border border-border bg-card hover:bg-gray-50 focus:bg-gray-50 dark:bg-card dark:border-border dark:hover:bg-accent dark:focus:bg-accent',
        link: 'border border-transparent hover:underline',
      },
      color: {
        gray: '',
        indigo: '',
        red: '',
        yellow: '',
        teal: '',
      },
      size: {
        default: 'py-3 px-4',
        sm: 'py-2 px-3 text-sm',
        lg: 'py-4 px-5 text-base',
        icon: 'p-2',
      },
    },
    compoundVariants: [
      // Default variant compounds
      {
        variant: 'default',
        color: 'gray',
        class:
          'bg-gray-800 text-white hover:bg-gray-900 focus:bg-gray-900 dark:bg-white dark:text-neutral-800',
      },
      {
        variant: 'default',
        color: 'indigo',
        class:
          'bg-indigo-500 text-white hover:bg-indigo-700 focus:bg-indigo-700',
      },
      {
        variant: 'default',
        color: 'red',
        class: 'bg-red-600 text-white hover:bg-red-700 focus:bg-red-700',
      },
      {
        variant: 'default',
        color: 'yellow',
        class:
          'bg-yellow-500 text-white hover:bg-yellow-700 focus:bg-yellow-700',
      },
      {
        variant: 'default',
        color: 'teal',
        class: 'bg-teal-500 text-white hover:bg-teal-700 focus:bg-teal-700',
      },

      // Outline variant compounds
      {
        variant: 'outline',
        color: 'gray',
        class:
          'border-gray-600 text-muted-foreground hover:bg-gray-50 hover:border-gray-800 hover:text-foreground focus:border-gray-800 focus:text-foreground dark:border-border dark:text-muted-foreground dark:hover:border-muted-foreground dark:hover:text-foreground dark:focus:border-muted-foreground dark:focus:text-foreground',
      },
      {
        variant: 'outline',
        color: 'indigo',
        class:
          'border-indigo-600 text-indigo-600 hover:bg-sidebar-active hover:border-indigo-800 hover:text-indigo-800 focus:border-indigo-800 focus:text-indigo-800 dark:border-indigo-500 dark:text-indigo-500 dark:hover:border-indigo-700 dark:hover:text-indigo-700 dark:focus:border-indigo-700 dark:focus:text-indigo-700',
      },
      {
        variant: 'outline',
        color: 'red',
        class:
          'border-red-600 text-red-600 hover:bg-red-50 hover:border-red-800 hover:text-red-800 focus:border-red-800 focus:text-red-800 dark:border-red-500 dark:text-red-500 dark:hover:border-red-700 dark:hover:text-red-700 dark:focus:border-red-700 dark:focus:text-red-700',
      },
      {
        variant: 'outline',
        color: 'yellow',
        class:
          'border-yellow-600 text-yellow-600 hover:bg-yellow-50 hover:border-yellow-800 hover:text-yellow-800 focus:border-yellow-800 focus:text-yellow-800 dark:border-yellow-500 dark:text-yellow-500 dark:hover:border-yellow-700 dark:hover:text-yellow-700 dark:focus:border-yellow-700 dark:focus:text-yellow-700',
      },
      {
        variant: 'outline',
        color: 'teal',
        class:
          'border-teal-600 text-teal-600 hover:bg-teal-50 hover:border-teal-800 hover:text-teal-800 focus:border-teal-800 focus:text-teal-800 dark:border-teal-500 dark:text-teal-500 dark:hover:border-teal-700 dark:hover:text-teal-700 dark:focus:border-teal-700 dark:focus:text-teal-700',
      },

      // Ghost variant compounds
      {
        variant: 'ghost',
        color: 'gray',
        class:
          'text-muted-foreground hover:bg-muted hover:text-foreground focus:bg-muted focus:text-foreground dark:text-muted-foreground dark:hover:bg-accent dark:hover:text-foreground dark:focus:bg-accent dark:focus:text-foreground',
      },
      {
        variant: 'ghost',
        color: 'indigo',
        class:
          'text-indigo-600 hover:bg-indigo-100 hover:text-indigo-800 focus:bg-indigo-100 focus:text-indigo-800 dark:text-indigo-500 dark:hover:bg-indigo-800/30 dark:hover:text-indigo-400 dark:focus:bg-indigo-800/30 dark:focus:text-indigo-400',
      },
      {
        variant: 'ghost',
        color: 'red',
        class:
          'text-red-600 hover:bg-red-100 hover:text-red-800 focus:bg-red-100 focus:text-red-800 dark:text-red-500 dark:hover:bg-red-800/30 dark:hover:text-red-400 dark:focus:bg-red-800/30 dark:focus:text-red-400',
      },
      {
        variant: 'ghost',
        color: 'yellow',
        class:
          'text-yellow-600 hover:bg-yellow-100 hover:text-yellow-800 focus:bg-yellow-100 focus:text-yellow-800 dark:text-yellow-500 dark:hover:bg-yellow-800/30 dark:hover:text-yellow-400 dark:focus:bg-yellow-800/30 dark:focus:text-yellow-400',
      },
      {
        variant: 'ghost',
        color: 'teal',
        class:
          'text-teal-600 hover:bg-teal-100 hover:text-teal-800 focus:bg-teal-100 focus:text-teal-800 dark:text-teal-500 dark:hover:bg-teal-800/30 dark:hover:text-teal-400 dark:focus:bg-teal-800/30 dark:focus:text-teal-400',
      },

      // Soft variant compounds
      {
        variant: 'soft',
        color: 'gray',
        class:
          'bg-muted text-foreground hover:bg-muted focus:bg-muted dark:text-foreground dark:hover:bg-accent dark:focus:bg-accent',
      },
      {
        variant: 'soft',
        color: 'indigo',
        class:
          'bg-indigo-100 text-indigo-900 hover:bg-indigo-200 focus:bg-indigo-200 dark:text-indigo-400 dark:hover:bg-indigo-900 dark:focus:bg-indigo-900',
      },
      {
        variant: 'soft',
        color: 'red',
        class:
          'bg-red-100 text-red-900 hover:bg-red-200 focus:bg-red-200 dark:text-red-400 dark:hover:bg-red-900 dark:focus:bg-red-900',
      },
      {
        variant: 'soft',
        color: 'yellow',
        class:
          'bg-yellow-100 text-yellow-900 hover:bg-yellow-200 focus:bg-yellow-200 dark:text-yellow-400 dark:hover:bg-yellow-900 dark:focus:bg-yellow-900',
      },
      {
        variant: 'soft',
        color: 'teal',
        class:
          'bg-teal-100 text-teal-900 hover:bg-teal-200 focus:bg-teal-200 dark:text-teal-400 dark:hover:bg-teal-900 dark:focus:bg-teal-900',
      },

      // White variant compounds
      {
        variant: 'white',
        color: 'gray',
        class: 'text-foreground dark:text-white',
      },
      {
        variant: 'white',
        color: 'indigo',
        class: 'text-indigo-600 dark:text-indigo-500',
      },
      {
        variant: 'white',
        color: 'red',
        class: 'text-red-600 dark:text-red-500',
      },
      {
        variant: 'white',
        color: 'yellow',
        class: 'text-yellow-600 dark:text-yellow-500',
      },
      {
        variant: 'white',
        color: 'teal',
        class: 'text-teal-600 dark:text-teal-500',
      },

      // Link variant compounds
      {
        variant: 'link',
        color: 'gray',
        class:
          'text-muted-foreground hover:text-foreground focus:text-foreground dark:text-muted-foreground dark:hover:text-foreground dark:focus:text-foreground',
      },
      {
        variant: 'link',
        color: 'indigo',
        class:
          'text-indigo-600 hover:text-indigo-800 focus:text-indigo-800 dark:text-indigo-500 dark:hover:text-indigo-400 dark:focus:text-indigo-400',
      },
      {
        variant: 'link',
        color: 'red',
        class:
          'text-red-600 hover:text-red-800 focus:text-red-800 dark:text-red-500 dark:hover:text-red-400 dark:focus:text-red-400',
      },
      {
        variant: 'link',
        color: 'yellow',
        class:
          'text-yellow-600 hover:text-yellow-800 focus:text-yellow-800 dark:text-yellow-500 dark:hover:text-yellow-400 dark:focus:text-yellow-400',
      },
      {
        variant: 'link',
        color: 'teal',
        class:
          'text-teal-600 hover:text-teal-800 focus:text-teal-800 dark:text-teal-500 dark:hover:text-teal-400 dark:focus:text-teal-400',
      },
    ],
    defaultVariants: {
      variant: 'default',
      color: 'indigo',
      size: 'default',
    },
  },
);

export type ButtonVariant = VariantProps<typeof buttonVariants>['variant'];
export type ButtonColor = VariantProps<typeof buttonVariants>['color'];
export type ButtonSize = VariantProps<typeof buttonVariants>['size'];

export interface ButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'color'
> {
  variant?: ButtonVariant;
  color?: ButtonColor;
  size?: ButtonSize;
  asChild?: boolean;
  loading?: boolean;
  startIcon?: React.JSXElementConstructor<React.SVGProps<SVGSVGElement>>;
  endIcon?: React.JSXElementConstructor<React.SVGProps<SVGSVGElement>>;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      color,
      size,
      asChild = false,
      loading = false,
      startIcon: StartIcon,
      endIcon: EndIcon,
      children,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'button';

    const finalColor =
      variant === 'white' && !color ? 'gray' : (color ?? 'indigo');

    const content = (
      <>
        {loading && (
          <LoaderCircle
            data-testid="loading-spinner"
            className="h-4 w-4 animate-spin"
          />
        )}

        {!loading && StartIcon && (
          <span
            data-testid="start-icon"
            className="flex items-center justify-center mr-1"
          >
            {<StartIcon className="w-4 h-4" />}
          </span>
        )}

        {size === 'icon' &&
          React.isValidElement<{ className?: string }>(children) &&
          React.cloneElement(children, {
            className: cn(children.props.className, 'size-4'),
          })}

        {size !== 'icon' && children}

        {!loading && EndIcon && (
          <span className="ml-1" data-testid="end-icon">
            {<EndIcon className="w-4 h-4" />}
          </span>
        )}
      </>
    );

    return (
      <Comp
        className={cn(
          buttonVariants({ variant, size, color: finalColor }),
          className,
          loading && 'pointer-events-none',
        )}
        ref={ref}
        disabled={loading || props.disabled}
        {...props}
      >
        {content}
      </Comp>
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
