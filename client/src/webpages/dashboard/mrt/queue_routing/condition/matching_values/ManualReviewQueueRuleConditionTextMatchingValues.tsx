import { useState } from 'react';

import { receivesRegexInput } from '../../../../../../models/signal';
import { MatchingBankType } from '../../../../rules/rule_form/condition/matching_values/RuleFormConditionMatchingBankInput';
import {
  ConditionLocation,
  RuleFormLeafCondition,
} from '../../../../rules/types';
import ManualReviewQueueRuleConditionMatchingBankInput from './ManualReviewQueueRuleConditionMatchingBankInput';
import ManualReviewQueueRuleConditionMatchingTokensInput, {
  MatchingTokensInputType,
} from './ManualReviewQueueRuleConditionMatchingTokensInput';

export default function ManualReviewQueueRuleConditionTextMatchingValues(props: {
  condition: RuleFormLeafCondition;
  location: ConditionLocation;
  editing: boolean;
  onUpdateTextMatchingValues: (strings: readonly string[]) => void;
  onUpdateSelectedBankIds: (bankIds: readonly string[]) => void;
}) {
  const {
    condition,
    location,
    editing,
    onUpdateTextMatchingValues,
    onUpdateSelectedBankIds,
  } = props;

  // This allows the user to switch the matchingValuesInput between a
  // TextTokenInput (which lets them input plaintext strings) and a
  // dropdown where they can select a matching bank.
  const [showBankDropdown, setShowBankDropdown] = useState(
    (condition.matchingValues?.textBankIds?.length ?? 0) > 0,
  );

  return showBankDropdown ? (
    <ManualReviewQueueRuleConditionMatchingBankInput
      condition={condition}
      location={location}
      editing={editing}
      setShowBankDropdown={setShowBankDropdown}
      bankType={MatchingBankType.TEXT}
      onUpdateSelectedBankIds={(bankIds) => onUpdateSelectedBankIds(bankIds)}
    />
  ) : (
    <ManualReviewQueueRuleConditionMatchingTokensInput
      location={location}
      tokens={condition.matchingValues?.strings ?? []}
      editing={editing}
      updateTokens={(values) => onUpdateTextMatchingValues(values)}
      setShowBankDropdown={setShowBankDropdown}
      inputType={
        condition.signal?.type && receivesRegexInput(condition.signal.type)
          ? MatchingTokensInputType.REGEXES
          : MatchingTokensInputType.STRINGS
      }
    />
  );
}
