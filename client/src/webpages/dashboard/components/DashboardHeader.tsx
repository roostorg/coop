export default function DashboardHeader(props: {
  title: string;
  subtitle?: string;
  rightComponent?: React.ReactNode;
}) {
  const { title, subtitle, rightComponent } = props;
  return (
    <div className="flex items-center justify-between pb-6">
      <div className="flex flex-col pr-16 text-start">
        <div className="mb-1 text-2xl font-bold">{title}</div>
        {subtitle && (
          <div className="text-[14px] font-normal mb-0.5 text-slate-500">
            {subtitle}
          </div>
        )}
      </div>
      <div className="flex-shrink-0">{rightComponent}</div>
    </div>
  );
}
