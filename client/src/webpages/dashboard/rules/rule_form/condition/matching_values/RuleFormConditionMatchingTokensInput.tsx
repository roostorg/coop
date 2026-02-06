import { titleCaseEnumString } from '../../../../../../utils/string';
import TextTokenInput from '../../../TextTokenInput';
import { ConditionLocation } from '../../../types';

export enum MatchingTokensInputType {
  STRINGS = 'STRINGS',
  REGEXES = 'REGEXES',
}

export default function RuleFormConditionMatchingTokensInput(props: {
  location: ConditionLocation;
  tokens: readonly string[];
  updateTokens: (values: string[]) => void;
  setShowBankDropdown: (show: boolean) => void;
  inputType: MatchingTokensInputType;
}) {
  const { location, tokens, updateTokens, setShowBankDropdown, inputType } =
    props;
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
      className="!mb-0 !pl-4 !align-middle flex flex-col items-start"
    >
      <div className="pb-1 text-xs font-bold">
        {`${formattedInput} to Match`}
      </div>
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
    </div>
  );
}
