import { cn } from '@/lib/utils';
import { cva, VariantProps } from 'class-variance-authority';
import React from 'react';

type TextSize =
  | 'XXS'
  | 'XS'
  | 'SM'
  | 'base'
  | 'LG'
  | 'XL'
  | '2XL'
  | '3XL'
  | '4XL'
  | '5XL';

type TextWeight = 'regular' | 'medium' | 'semibold' | 'bold';

const textVariants = cva('font-manrope text-gray-800', {
  variants: {
    size: {
      XXS: 'text-xxs',
      XS: 'text-xs',
      SM: 'text-sm',
      base: 'text-base',
      LG: 'text-lg',
      XL: 'text-xl',
      '2XL': 'text-2xl',
      '3XL': 'text-3xl',
      '4XL': 'text-4xl',
      '5XL': 'text-5xl',
    },
    weight: {
      light: 'font-light',
      regular: 'font-normal',
      medium: 'font-medium',
      semibold: 'font-semibold',
      bold: 'font-bold',
    },
  },
  defaultVariants: {
    size: 'base',
    weight: 'regular',
  },
});

interface TextProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof textVariants> {
  as?: 'span' | 'div' | 'label' | 'p';
  size?: TextSize;
  weight?: TextWeight;
}

const Text: React.FC<TextProps> = ({
  as: Component = 'p',
  size,
  weight,
  className,
  ...props
}) => (
  <Component
    className={cn(textVariants({ size, weight }), className)}
    {...props}
  />
);

interface HeadingProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof textVariants> {
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  size?: TextSize;
  weight?: TextWeight;
}

const Heading: React.FC<HeadingProps> = ({
  as: Component = 'h2',
  size = 'base',
  weight = 'bold',
  className,
  ...props
}) => (
  <Component
    className={cn(textVariants({ size, weight }), className)}
    {...props}
  />
);

export { Text, Heading };
