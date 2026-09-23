// Add new color variants to this list as needed. See
// https://preline.co/docs/badge.html for available variants.
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- tuple value consumed only via `typeof` for BadgeColorVariant
const BadgeColorVariants = [
  'soft-green',
  'soft-red',
  'soft-gray',
  'soft-yellow',
  'soft-blue',
] as const;
export type BadgeColorVariant = (typeof BadgeColorVariants)[number];

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- tuple value consumed only via `typeof` for BadgeShapeVariant
const BadgeShapeVariants = ['pill', 'rounded'] as const;
type BadgeShapeVariant = (typeof BadgeShapeVariants)[number];

export default function CoopBadge(props: {
  colorVariant: BadgeColorVariant;
  shapeVariant: BadgeShapeVariant;
  icon?: React.ReactNode;
  label: string;
}) {
  const { colorVariant, shapeVariant, label, icon } = props;

  const colorClasses = (() => {
    switch (colorVariant) {
      case 'soft-green':
        return 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 fill-teal-800';
      case 'soft-red':
        return 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 fill-red-800';
      case 'soft-gray':
        return 'bg-muted text-foreground dark:bg-muted dark:text-foreground fill-gray-800';
      case 'soft-yellow':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300 fill-yellow-800';
      case 'soft-blue':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 fill-blue-800';
    }
  })();

  const shapeClasses = (() => {
    switch (shapeVariant) {
      case 'pill':
        return 'rounded-full';
      case 'rounded':
        return 'rounded-md';
    }
  })();

  return (
    <span
      className={`inline-flex items-center gap-x-1.5 py-1.5 px-3 text-sm font-medium w-fit whitespace-nowrap ${colorClasses} ${shapeClasses}`}
    >
      {icon && <span className={`flex w-4 h-4 ${colorClasses}`}>{icon}</span>}
      {label}
    </span>
  );
}
