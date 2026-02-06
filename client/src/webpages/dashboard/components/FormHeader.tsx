export default function FormHeader(props: {
  title: string;
  subtitle?: string;
  topRightComponent?: React.ReactNode;
}) {
  const { title, subtitle, topRightComponent } = props;
  return (
    <div className="flex items-center justify-between w-full mb-8 text-start">
      <div className="flex flex-col justify-start">
        <div className="mb-1 text-2xl font-bold">{title}</div>
        {subtitle && <div className="text-base text-slate-500">{subtitle}</div>}
      </div>
      {topRightComponent}
    </div>
  );
}
