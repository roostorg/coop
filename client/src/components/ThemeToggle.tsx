import { cn } from '@/lib/utils';
import { MoonStar, SunMedium } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

// Ported from the ui-redesign-wip range, rewritten against the shadcn design
// tokens this branch already ships (via Dashboard.css) instead of the redesign's
// `--app-*` token system, so it works without dragging in the broader redesign.
export default function ThemeToggle(props: {
  collapsed?: boolean;
  className?: string;
  showLabel?: boolean;
}) {
  const { collapsed = false, className, showLabel = !collapsed } = props;
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // next-themes can only resolve the theme on the client; render a stable
  // (light) state until mounted to avoid a hydration/flash mismatch.
  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted ? resolvedTheme === 'dark' : false;

  return (
    <button
      type="button"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={cn(
        'group inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card text-muted-foreground transition-all duration-150 hover:bg-accent hover:text-foreground',
        collapsed || !showLabel ? 'h-10 w-10' : 'h-10 px-3',
        className,
      )}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      <span className="relative flex h-5 w-5 items-center justify-center">
        <SunMedium
          className={cn(
            'absolute h-4 w-4 transition-all duration-200',
            isDark
              ? 'scale-75 rotate-[-20deg] opacity-0'
              : 'scale-100 rotate-0 opacity-100',
          )}
        />
        <MoonStar
          className={cn(
            'absolute h-4 w-4 transition-all duration-200',
            isDark
              ? 'scale-100 rotate-0 opacity-100'
              : 'scale-75 rotate-[20deg] opacity-0',
          )}
        />
      </span>
      {showLabel ? (
        <span className="text-sm font-medium tracking-[-0.01em]">
          {isDark ? 'Dark mode' : 'Light mode'}
        </span>
      ) : null}
    </button>
  );
}
