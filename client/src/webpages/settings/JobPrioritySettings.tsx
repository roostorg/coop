import { Button } from '@/coop-ui/Button';
import { Label } from '@/coop-ui/Label';
import { Slider } from '@/coop-ui/Slider';
import { toast } from '@/coop-ui/Toast';
import { Heading, Text } from '@/coop-ui/Typography';
import {
  GQLJobPriorityProperty,
  GQLUserPermission,
  useGQLJobPriorityWeightsQuery,
  useGQLSetJobPriorityWeightsMutation,
} from '@/graphql/generated';
import { userHasPermissions } from '@/routing/permissions';
import { gql } from '@apollo/client';
import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Navigate } from 'react-router-dom';

import FullScreenLoading from '@/components/common/FullScreenLoading';

gql`
  query JobPriorityWeights {
    me {
      permissions
    }
    myOrg {
      jobPriorityWeights {
        property
        weight
      }
    }
  }

  mutation SetJobPriorityWeights($input: SetJobPriorityWeightsInput!) {
    setJobPriorityWeights(input: $input) {
      ... on SetJobPriorityWeightsSuccessResponse {
        _
      }
    }
  }
`;

// Human-readable labels + per-property help text + a live preview
// sentence that updates with the current slider value.
const PROPERTY_LABELS: ReadonlyArray<{
  property: GQLJobPriorityProperty;
  label: string;
  help: string;
  example: (weight: number) => string;
}> = [
  {
    property: GQLJobPriorityProperty.NumReports,
    label: '# of User Reports',
    help: 'Items with more user reports are reviewed sooner. Higher weight = bigger boost per report. Set to 0 to ignore.',
    example: (w) =>
      w === 0
        ? "Currently disabled: report counts won't affect queue order."
        : `Example: an item with 5 reports gets a boost of ${w * 5}.`,
  },
  {
    property: GQLJobPriorityProperty.UserScore,
    label: 'User Score',
    help: "Items from users with a history of policy violations are reviewed sooner. Coop assigns each user a moderation score from 1 to 5 based on the ratio of penalties they've received to total submissions. 1 means many penalties (likely a repeat offender), 5 is the default for new or clean users. Set to 0 to ignore user history.",
    example: (w) =>
      w === 0
        ? "Currently disabled: user history won't affect queue order."
        : `Example: an item from a user with the lowest score (1) gets a boost of ${w * 4}; from a clean user (5), no boost.`,
  },
];

type WeightMap = Map<GQLJobPriorityProperty, number>;

function rowsToMap(
  rows: ReadonlyArray<{ property: GQLJobPriorityProperty; weight: number }>,
): WeightMap {
  return new Map(rows.map((r) => [r.property, r.weight]));
}

export default function JobPrioritySettings() {
  const { loading, error, data } = useGQLJobPriorityWeightsQuery();

  const [weights, setWeights] = useState<WeightMap>(new Map());

  // Hydrate form state from the server response. Empty map until loaded.
  useEffect(() => {
    if (data?.myOrg?.jobPriorityWeights) {
      setWeights(rowsToMap(data.myOrg.jobPriorityWeights));
    }
  }, [data?.myOrg?.jobPriorityWeights]);

  const [saveWeights, { loading: isSaving }] =
    useGQLSetJobPriorityWeightsMutation({
      onCompleted: () => toast.success('Job priority weights saved.'),
      onError: (err) =>
        toast.error(
          `Failed to save weights: ${err.message}. Please try again.`,
        ),
      refetchQueries: ['JobPriorityWeights'],
    });

  if (loading) {
    return <FullScreenLoading />;
  }

  const permissions = data?.me?.permissions;
  if (
    !permissions ||
    !userHasPermissions(permissions, [GQLUserPermission.ManageOrg])
  ) {
    return <Navigate to="/dashboard/settings" replace />;
  }

  if (error) {
    throw error;
  }

  const handleSave = () => {
    // Build the input: one entry per property the admin set a value for.
    // Properties left blank/zero are still persisted so the admin's intent
    // (explicitly disable a property) survives.
    const input = {
      weights: PROPERTY_LABELS.map(({ property }) => ({
        property,
        weight: weights.get(property) ?? 0,
      })),
    };
    saveWeights({ variables: { input } });
  };

  const updateWeight = (property: GQLJobPriorityProperty, value: string) => {
    // Accept empty string as "no contribution" (0). Reject non-numeric.
    const parsed = value === '' ? 0 : Number(value);
    if (Number.isNaN(parsed) || parsed < 0) return;
    setWeights((prev) => {
      const next = new Map(prev);
      next.set(property, parsed);
      return next;
    });
  };

  return (
    <div className="w-full max-w-2xl p-8">
      <Helmet>
        <title>Job Priority Weights</title>
      </Helmet>

      <Heading size="LG">Job Priority Weights</Heading>
      <Text className="mt-2 mb-6 text-slate-500">
        Tune how Coop ranks jobs in queues set to{' '}
        <strong>Custom (weighted)</strong> sort mode. Each property's value is
        multiplied by its weight; the sum determines the job's review order. Set
        a weight to <strong>0</strong> to disable a property for your org.
      </Text>

      <div className="flex flex-col gap-6">
        {PROPERTY_LABELS.map(({ property, label, help, example }) => {
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
                max={100}
                step={1}
                value={[weight]}
                onValueChange={(values) =>
                  updateWeight(property, String(values[0]))
                }
              />
              <Text className="text-sm text-slate-400">{help}</Text>
              <Text className="text-sm italic text-slate-500">
                {example(weight)}
              </Text>
            </div>
          );
        })}
      </div>

      <div className="mt-8">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
