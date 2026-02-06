import { ReactNode } from 'react';

type RulesDashboardInsightsStat = {
  value: string;
  title: string;
  icon: ReactNode;
};

export default function RulesDashboardInsightsStats(props: {
  stats: RulesDashboardInsightsStat[];
}) {
  const { stats } = props;

  return (
    <div className="flex flex-col text-start">
      {stats.map((stat, i) => {
        const { value, title, icon } = stat;
        return (
          <div className="flex items-center justify-between mb-6" key={i}>
            <div className="flex flex-col mr-4">
              <div className="text-2xl font-extrabold text-primary">
                {value}
              </div>
              <div className="text-sm">{title}</div>
            </div>
            <div>{icon}</div>
          </div>
        );
      })}
    </div>
  );
}
