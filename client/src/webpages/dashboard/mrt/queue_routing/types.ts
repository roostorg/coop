import {
  GQLConditionSetFieldsFragment,
  GQLManualReviewQueueRoutingRulesQuery,
} from '../../../../graphql/generated';
import { CoreSignal } from '../../../../models/signal';
import { getTypedConditionSetFromGQL } from '../../rules/rule_form/RuleFormUtils';
import { RuleFormConditionSet } from '../../rules/types';

export type RoutingRuleItemType = NonNullable<
  GQLManualReviewQueueRoutingRulesQuery['myOrg']
>['itemTypes'][number];

export type RoutingRuleQueue = NonNullable<
  GQLManualReviewQueueRoutingRulesQuery['me']
>['reviewableQueues'][number];

export type RoutingRule = Readonly<
  NonNullable<GQLManualReviewQueueRoutingRulesQuery['myOrg']>['routingRules']
>[number];

export type EditableRoutingRule = {
  id: string;
  name?: string;
  description?: string;
  itemTypeIds: string[];
  conditionSet: RuleFormConditionSet;
  destinationQueue?: { id: string; name: string };
  sequenceNumber: number;
};

export function editableRoutingRuleFromRoutingRule(
  rule: RoutingRule,
  index: number,
  selectedItemTypeIds: string[],
  allSignals: readonly CoreSignal[],
) {
  return {
    id: rule.id,
    name: rule.name,
    destinationQueue: rule.destinationQueue,
    conditionSet: getTypedConditionSetFromGQL(
      rule.conditionSet as GQLConditionSetFieldsFragment,
      rule.itemTypes.filter((it) => selectedItemTypeIds.includes(it.id)),
      allSignals,
    ),
    description: rule.description ?? undefined,
    itemTypeIds: rule.itemTypes.map((itemType) => itemType.id),
    sequenceNumber: index,
  } satisfies EditableRoutingRule as EditableRoutingRule;
}

export function newEditableRoutingRule() {
  return {
    id: 'unsaved_' + Math.floor(Math.random() * 1000000000000000).toString(),
    itemTypeIds: [],
    conditionSet: { conditions: [{}], conjunction: 'OR' },
    sequenceNumber: 0,
  } satisfies EditableRoutingRule as EditableRoutingRule;
}
