import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

export function Link(props: {
  href?: string;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  target?: string;
}) {
  const { href, children, className, onClick, target } = props;

  return (
    <a
      target={target}
      onClick={onClick}
      href={href}
      className={cn(
        'cursor-pointer text-indigo-500 underline underline-offset-4 hover:text-indigo-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2',
        className,
      )}
    >
      {children}
    </a>
  );
}
