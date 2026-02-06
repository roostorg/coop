import { Select } from 'antd';

import ComponentLoading from '../../../../../../components/common/ComponentLoading';
import { selectFilterByLabelOption } from '@/webpages/dashboard/components/antDesignUtils';

import {
  GQLTextBankType,
  useGQLMatchingBankIdsQuery,
} from '../../../../../../graphql/generated';
import { receivesRegexInput } from '../../../../../../models/signal';
import { titleCaseEnumString } from '../../../../../../utils/string';
import { bankTypeName } from '../../../../banks/text/TextBankForm';
import { MatchingBankType } from '../../../../rules/rule_form/condition/matching_values/RuleFormConditionMatchingBankInput';
import {
  ConditionLocation,
  RuleFormLeafCondition,
} from '../../../../rules/types';
import { ManualReviewQueueRoutingStaticTokenField } from '../../ManualReviewQueueRoutingStaticField';
import { optionWithTooltip } from '../../ManualReviewQueueRuleFormCondition';

const { Option } = Select;

export default function ManualReviewQueueRuleConditionMatchingBankInput<
  T extends MatchingBankType,
>(props: {
  condition: RuleFormLeafCondition;
  location: ConditionLocation;
  editing: boolean;
  setShowBankDropdown: (show: boolean) => void;
  bankType: T;
  onUpdateSelectedBankIds(selectedBankIds: readonly string[]): void;
}) {
  const {
    condition,
    location,
    editing,
    setShowBankDropdown,
    bankType,
    onUpdateSelectedBankIds,
  } = props;
  const { conditionIndex, conditionSetIndex } = location;
  const isRegexSignal =
    condition.signal?.type && receivesRegexInput(condition.signal.type);

  const { textBankIds, locationBankIds, imageBankIds } = condition.matchingValues ?? {};
  const bankIds = textBankIds ?? locationBankIds ?? imageBankIds ?? [];

  const { loading, error, data } = useGQLMatchingBankIdsQuery();
  const { textBanks, locationBanks, hashBanks } = data?.myOrg?.banks ?? {};
  const allBanks = [textBanks ?? [], locationBanks ?? [], hashBanks ?? []].flat();

  if (loading) {
    return <ComponentLoading />;
  }
  if (error) {
    return <div />;
  }

  return (
    <div
      key={`matching-bank-wrapper_set_index_${conditionSetIndex}_index_${conditionIndex}`}
      className="flex flex-col items-start pl-4 mb-0 align-middle"
    >
      <div className="pb-1 text-sm font-bold whitespace-nowrap">
        {titleCaseEnumString(bankType)} Banks to Match
      </div>
      {editing ? (
        <Select
          className="w-full"
          mode="multiple"
          key={`matching-bank-select_set_index_${conditionSetIndex}_index_${conditionIndex}`}
          placeholder={`Select ${bankType.toLowerCase()} bank(s)`}
          defaultValue={bankIds}
          value={bankIds}
          onChange={(selectedBankIds) =>
            onUpdateSelectedBankIds(selectedBankIds)
          }
          allowClear
          showSearch
          filterOption={selectFilterByLabelOption}
          dropdownMatchSelectWidth={false}
        >
          {allBanks?.map((bank, index) => {
            const bankIsTextBank = bank.__typename === 'TextBank';
            const isRegexTextBank =
              bankIsTextBank && bank.type === GQLTextBankType.Regex;

            if (bankIsTextBank && isRegexSignal !== isRegexTextBank) {
              const reason = `This is a ${bankTypeName(
                bank.type,
                false,
              )} bank, which cannot be used for the signal you selected.`;
              return optionWithTooltip({
                title: bank.name,
                value: bank.id,
                disabled: true, // disabled
                description: reason,
                key: bank.id,
                index,
                isInOptionGroup: false,
              });
            }
            return (
              <Option key={bank.id} value={bank.id} label={bank.name}>
                {bank.name}
              </Option>
            );
          })}
        </Select>
      ) : (
        <ManualReviewQueueRoutingStaticTokenField
          tokens={bankIds.map((it) => allBanks.find((i) => i.id === it)!.name)}
        />
      )}
      <div
        className="h-auto p-0 pt-1 m-0 text-sm border-none shadow-none cursor-pointer bg-none text-coop-purple hover:text-coop-purple-hover"
        onClick={() => setShowBankDropdown(false)}
      >
        Click to switch to plaintext strings
      </div>
    </div>
  );
}
