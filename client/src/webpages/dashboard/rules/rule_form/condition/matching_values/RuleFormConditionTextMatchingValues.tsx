import { useState } from 'react';

import { receivesRegexInput } from '../../../../../../models/signal';
import { ConditionLocation, RuleFormLeafCondition } from '../../../types';
import RuleFormConditionMatchingBankInput, {
  MatchingBankType,
} from './RuleFormConditionMatchingBankInput';
import RuleFormConditionMatchingTokensInput, {
  MatchingTokensInputType,
} from './RuleFormConditionMatchingTokensInput';

export default function RuleFormConditionTextMatchingValues(props: {
  condition: RuleFormLeafCondition;
  location: ConditionLocation;
  onUpdateMatchingValues: (
    matchingValues: RuleFormLeafCondition['matchingValues'],
  ) => void;
}) {
  const { condition, location, onUpdateMatchingValues } = props;

  // This allows the user to switch the matchingValuesInput between a
  // TextTokenInput (which lets them input plaintext strings) and a
  // dropdown where they can select a matching bank.
  const [showBankDropdown, setShowBankDropdown] = useState(
    (condition.matchingValues?.textBankIds?.length ?? 0) > 0,
  );

  return showBankDropdown ? (
    <RuleFormConditionMatchingBankInput
      condition={condition}
      location={location}
      onUpdateMatchingValues={onUpdateMatchingValues}
      setShowBankDropdown={setShowBankDropdown}
      bankType={MatchingBankType.TEXT}
    />
  ) : (
    <RuleFormConditionMatchingTokensInput
      location={location}
      tokens={condition.matchingValues?.strings ?? []}
      updateTokens={(values: string[]) =>
        onUpdateMatchingValues({ strings: values })
      }
      setShowBankDropdown={setShowBankDropdown}
      inputType={
        condition.signal?.type && receivesRegexInput(condition.signal.type)
          ? MatchingTokensInputType.REGEXES
          : MatchingTokensInputType.STRINGS
      }
    />
  );
}
