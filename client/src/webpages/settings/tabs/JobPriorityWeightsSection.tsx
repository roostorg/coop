import { Label } from '@/coop-ui/Label';
import { Slider } from '@/coop-ui/Slider';
import { Heading, Text } from '@/coop-ui/Typography';
import { GQLJobPriorityProperty } from '@/graphql/generated';
import {
  JOB_PRIORITY_PROPERTY_LABELS,
  JobPriorityWeightMap,
} from '@/webpages/settings/jobPriorityWeights';
import { summarizeWeighting } from '@/webpages/settings/jobPriorityWeightSummary';

// Controlled section rendered inside the Review Console settings tab. State,
// hydration and saving are owned by the parent tab so this shares the tab's
// single "Save Changes" button.
export default function JobPriorityWeightsSection({
  weights,
  onChange,
}: {
  weights: JobPriorityWeightMap;
  onChange: (property: GQLJobPriorityProperty, value: number) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="border-b border-gray-200 py-2">
        <Heading size="2XL" weight="semibold">
          Job Priority Weights
        </Heading>
      </div>
      <Text className="text-gray-500 text-[0.8125rem]">
        Tune how Coop ranks jobs in queues set to{' '}
        <strong>Custom (weighted)</strong> sort mode. Give more weight to the
        signals you want to prioritize when ordering the queue. Set a weight to{' '}
        <strong>0</strong> to disable a property for your org.
      </Text>

      <div className="flex flex-col gap-6">
        {JOB_PRIORITY_PROPERTY_LABELS.map(
          ({ property, label, help, example }) => {
            const weight = weights.get(property) ?? 0;
            return (
              <div key={property} className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor={`weight-${property}`}>{label}</Label>
                  <span className="text-sm tabular-nums text-slate-700">
                    {weight}
                  </span>
                </div>
                <Slider
                  id={`weight-${property}`}
                  min={0}
                  max={10}
                  step={1}
                  value={[weight]}
                  onValueChange={(values) => onChange(property, values[0])}
                />
                <Text className="text-sm text-slate-400">{help}</Text>
                {example(weight) ? (
                  <Text className="text-sm italic text-slate-500">
                    {example(weight)}
                  </Text>
                ) : null}
              </div>
            );
          },
        )}
      </div>

      <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
        <Text className="text-sm text-slate-600">
          {summarizeWeighting(
            JOB_PRIORITY_PROPERTY_LABELS.map(({ property, label }) => ({
              label,
              weight: weights.get(property) ?? 0,
            })),
          )}
        </Text>
      </div>
    </div>
  );
}
