export default function RuleInsightsEmptyCard(props: {
  icon: React.ReactElement;
  title: string;
  subtitle: string;
}) {
  const { icon, title, subtitle } = props;
  return (
    <div className="flex flex-col items-center justify-center p-12 grow">
      <div className="text-gray-400 pb-3 [&>svg]:w-[90px] [&>svg]:h-[90px]">
        {icon}
      </div>
      <div className="text-gray-500 text-2xl max-w-[400px] pb-2">{title}</div>
      <div className="text-gray-500 text-base pt-2 pb-10 max-w-[400px]">
        {subtitle}
      </div>
    </div>
  );
}
