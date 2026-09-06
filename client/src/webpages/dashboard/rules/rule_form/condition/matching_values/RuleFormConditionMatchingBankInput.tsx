import { MultiCombobox } from '@/coop-ui/Combobox';

import ComponentLoading from '../../../../../../components/common/ComponentLoading';

import {
  GQLTextBankType,
  useGQLMatchingBankIdsQuery,
} from '../../../../../../graphql/generated';
import { receivesRegexInput } from '../../../../../../models/signal';
import { titleCaseEnumString } from '../../../../../../utils/string';
import { bankTypeName } from '../../../../banks/text/TextBankForm';
import { ConditionLocation, RuleFormLeafCondition } from '../../../types';

export enum MatchingBankType {
  LOCATION = 'LOCATION',
  MEDIA = 'MEDIA',
  TEXT = 'TEXT',
}

export default function RuleFormConditionMatchingBankInput(props: {
  condition: RuleFormLeafCondition;
  location: ConditionLocation;
  onUpdateMatchingValues: (
    matchingValues: RuleFormLeafCondition['matchingValues'],
  ) => void;
  setShowBankDropdown: (show: boolean) => void;
  bankType: MatchingBankType;
}) {
  const {
    condition,
    location,
    onUpdateMatchingValues,
    setShowBankDropdown,
    bankType,
  } = props;
  const { conditionIndex, conditionSetIndex } = location;
  const isRegexSignal =
    condition.signal?.type && receivesRegexInput(condition.signal.type);

  const { textBankIds, locationBankIds, imageBankIds } =
    condition.matchingValues ?? {};
  const bankIds = textBankIds ?? locationBankIds ?? imageBankIds ?? [];

  const { loading, error, data } = useGQLMatchingBankIdsQuery();
  const { textBanks, locationBanks } = data?.myOrg?.banks ?? {};
  const allBanks = [textBanks ?? [], locationBanks ?? []].flat();

  if (loading) {
    return <ComponentLoading />;
  }
  if (error) {
    return <div />;
  }

  return (
    <div
      key={`matching-bank-form-item_set_index_ ${conditionSetIndex}_index_${conditionIndex}`}
      className="!mb-0 !pl-4 !align-middle"
    >
      {/* Needs to be wrapped in a div for the state to work properly */}
      <div
        key={`matching-bank-wrapper_set_index_${conditionSetIndex}_index_${conditionIndex}`}
        className="flex flex-col items-start"
      >
        <div className="pb-1 text-xs font-bold">
          {titleCaseEnumString(bankType)} Banks to Match
        </div>
        <MultiCombobox
          key={`matching-bank-select_set_index_${conditionSetIndex}_index_${conditionIndex}`}
          placeholder={`Select ${bankType.toLowerCase()} bank(s)`}
          value={[...bankIds]}
          onValueChange={(selectedBankIds) =>
            onUpdateMatchingValues(
              // Below, we're casting to tell TS only that we're dealing with text banks when bankType is Text
              // and location banks otherwise. The intersection with SelectedBank will narrow the SelectedBank
              // type down to the proper case, without adding fields to it that really don't exist at runtime.
              bankType === MatchingBankType.TEXT
                ? {
                    textBankIds: selectedBankIds,
                  }
                : bankType === MatchingBankType.LOCATION
                  ? {
                      locationBankIds: selectedBankIds,
                    }
                  : {
                      imageBankIds: selectedBankIds,
                    },
            )
          }
          allowClear
          options={allBanks.map((bank) => {
            const bankIsTextBank = bank.__typename === 'TextBank';
            const isRegexTextBank =
              bankIsTextBank && bank.type === GQLTextBankType.Regex;

            if (bankIsTextBank && isRegexSignal !== isRegexTextBank) {
              return {
                value: bank.id,
                label: `${bank.name} — ${bankTypeName(
                  bank.type,
                  false,
                )} bank, cannot be used for the signal you selected`,
                disabled: true,
              };
            }
            return { value: bank.id, label: bank.name };
          })}
        />
        <div
          className="p-0 pt-1 m-0 text-xs cursor-pointer text-primary hover:text-primary/70"
          onClick={() => setShowBankDropdown(false)}
        >
          Click to switch to plaintext strings
        </div>
      </div>
    </div>
  );
}
