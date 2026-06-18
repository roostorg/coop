import type { GQLSignal } from '@/graphql/generated';

import type { ConditionLocation, RuleFormLeafCondition } from '../../../types';

export default function RuleFormConditionSignalArgs(_props: {
  condition: RuleFormLeafCondition;
  location: ConditionLocation;
  onUpdateSignalArgs: (args: GQLSignal['args']) => void;
}) {
  // This component was used for GPT4O_MINI signal args, which have been removed.
  // The AGGREGATED signal will need signal args in the future, but they'll be
  // handled through a completely different UI.
  return null;
}
