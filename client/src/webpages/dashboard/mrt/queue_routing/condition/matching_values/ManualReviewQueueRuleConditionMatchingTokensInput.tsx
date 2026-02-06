import { titleCaseEnumString } from '../../../../../../utils/string';
import TextTokenInput from '../../../../rules/TextTokenInput';
import { ConditionLocation } from '../../../../rules/types';
import { ManualReviewQueueRoutingStaticTokenField } from '../../ManualReviewQueueRoutingStaticField';

export enum MatchingTokensInputType {
  STRINGS = 'STRINGS',
  REGEXES = 'REGEXES',
}

export default function ManualReviewQueueRuleConditionMatchingTokensInput(props: {
  location: ConditionLocation;
  tokens: readonly string[];
  editing: boolean;
  updateTokens: (values: string[]) => void;
  setShowBankDropdown: (show: boolean) => void;
  inputType: MatchingTokensInputType;
}) {
  const {
    location,
    tokens,
    editing,
    updateTokens,
    setShowBankDropdown,
    inputType,
  } = props;
  const { conditionIndex, conditionSetIndex } = location;
  const formattedInput = titleCaseEnumString(inputType);
  return (
    <div
      key={
        'matching-strings_wrapper_set_index_' +
        conditionSetIndex +
        '_index_' +
        conditionIndex
      }
      className="flex flex-col items-start pl-4 mb-0 align-middle"
    >
      <div className="pb-1 text-sm font-bold whitespace-nowrap">
        {`${formattedInput} to Match`}
      </div>
      {editing ? (
        <>
          <TextTokenInput
            key={`text-token-input_set_index_${conditionSetIndex}_index_${conditionIndex}`}
            uniqueKey={`matching-strings_set_index_${conditionSetIndex}_index_${conditionIndex}`}
            placeholder={`Input ${formattedInput}`}
            updateTokenValues={updateTokens}
            initialValues={tokens}
          />
          <div
            className="p-0 pt-1 m-0 text-xs cursor-pointer text-primary hover:text-primary/70"
            onClick={() => setShowBankDropdown(true)}
          >
            Click to switch to text bank
          </div>
        </>
      ) : (
        <>
          <ManualReviewQueueRoutingStaticTokenField
            tokens={tokens}
            reducePadding={true}
          />
          <div className="invisible pt-1 text-sm font-bold">
            {`${formattedInput} to Match`}
          </div>
        </>
      )}
    </div>
  );
}
