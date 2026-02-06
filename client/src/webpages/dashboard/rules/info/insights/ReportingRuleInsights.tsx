import ReportingRuleInsightsActionsChart from './ReportingRuleInsightsActionsChart';
import ReportingRuleInsightsSamplesTable from './ReportingRuleInsightsSamplesTable';

export default function ReportingRuleInsights(props: { ruleId: string }) {
  const { ruleId } = props;

  return (
    <div className="relative flex flex-col w-full h-full overflow-x-scroll">
      <div className="flex items-center justify-between mb-8">
        <div className="flex flex-col items-start pt-4 text-start">
          <div className="flex flex-col">
            <div className="flex text-xl font-semibold">Actions</div>
            <div className="flex text-sm text-slate-500">
              See how many actions the Rule has applied over time.
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-col p-0.5">
        <div className="flex grow">
          <ReportingRuleInsightsActionsChart ruleId={ruleId} />
        </div>
        <div className="flex h-px my-9 bg-slate-200" />
        <div className="flex grow">
          <ReportingRuleInsightsSamplesTable ruleId={ruleId} />
        </div>
      </div>
    </div>
  );
}
