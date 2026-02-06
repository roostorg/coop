import type { ItemIdentifier } from '@roostorg/types';

import CloseButton from '@/components/common/CloseButton';

import { GQLConditionOutcome } from '../../../../../../graphql/generated';
import { ConditionSetWithResult, ConditionWithResult } from '../../../types';
import { LookbackVersion } from '../RuleInsightsSamplesTable';
import RuleInsightsSampleDetailResults from './RuleInsightsSampleDetailResults';

export function coloredText(outcome: GQLConditionOutcome, text: string) {
  switch (outcome) {
    case GQLConditionOutcome.Failed:
    case GQLConditionOutcome.Errored:
      return <span className="font-bold text-teal-800">{text}</span>;
    case GQLConditionOutcome.Passed:
    default:
      return <span className="font-bold text-red-800">{text}</span>;
  }
}

export function staticValue(input: {
  text: string;
  outcome?: GQLConditionOutcome;
  score?: string | null;
  matchedValue?: string | null;
}) {
  const { text, outcome, score, matchedValue } = input;
  if ((!score && !matchedValue) || !outcome) {
    return (
      <div className="p-2 mx-2 mb-1 bg-white rounded-lg whitespace-nowrap h-fit">
       {text}
      </div>
    );
  }
  // Round to 3 decimal places if the score is a number. Otherwise just
  // display the whole score string (e.g. for Spectrum scores, which are
  // strings like "High", "Low", "Not Detected")
  const resultValue = score
    ? isNaN(Number(score))
      ? score
      : Number(score).toFixed(3)
    : matchedValue!;
  const resultText = coloredText(outcome, resultValue);
  const prefix = score ? 'Score: ' : 'Matched value: ';

  return (
    <div className="flex flex-col items-center px-2 font-bold text-center">
     {/* This is a hidden component used to ensure the component is vertically centered */}
     <span className="hidden">
       {prefix}
       {resultText}
     </span>
     <div className="p-2 mx-2 mb-1 bg-white rounded-lg whitespace-nowrap">
       {text}
     </div>
     <span className="flex px-2 font-bold text-center gap-2">
       {prefix}
       {resultText}
     </span>
    </div>
  );
}

export default function RuleInsightsSampleDetailView(props: {
  ruleId: string;
  itemIdentifier: ItemIdentifier;
  lookback: LookbackVersion;
  itemSubmissionDate?: string;
  onClose?: () => void;
}) {
  const { ruleId, itemIdentifier, lookback, onClose } = props;

  return (
    <div className="flex flex-col p-4 ml-8 mr-4 border border-solid rounded-lg border-gray-200 bg-white grow max-w-[90%]">
      <div className="flex flex-row items-start justify-between mb-3">
        <div className="flex flex-col">
          <div className="text-lg font-semibold">Details</div>
          <div className="text-base text-zinc-500">
            Inspect how each condition was evaluated to understand why this
            content was caught by the rule.
          </div>
        </div>
        {onClose && <CloseButton onClose={onClose} />}
      </div>
      <RuleInsightsSampleDetailResults
        ruleId={ruleId}
        itemIdentifier={itemIdentifier}
        lookback={lookback}
      />
    </div>
  );
}

export function isArrayOfConditionSetsWithResult(
  conditions: ConditionWithResult[],
): conditions is ConditionSetWithResult[] {
  return conditions.length > 0 && conditions.every((it) => 'conditions' in it);
}
