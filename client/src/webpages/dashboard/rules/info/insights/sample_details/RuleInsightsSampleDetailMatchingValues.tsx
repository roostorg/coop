import { gql } from '@apollo/client';

import ComponentLoading from '../../../../../../components/common/ComponentLoading';

import {
  GQLConditionOutcome,
  useGQLMatchingBankNamesQuery,
} from '../../../../../../graphql/generated';
import { getLocationDisplayName } from '../../../../../../models/locationBank';
import { receivesRegexInput } from '../../../../../../models/signal';
import {
  getMatchingValuesType,
  LeafConditionWithResult,
  MatchingValueType,
} from '../../../types';
import RuleInsightsSampleDisabledTextTokenInput from '../RuleInsightsSampleDisabledTextTokenInput';
import { coloredText, staticValue } from './RuleInsightsSampleDetailView';

export default function RuleInsightsSampleDetailMatchingValues(props: {
  condition: LeafConditionWithResult;
}) {
  const { condition } = props;
  const { matchingValues, result } = condition;
  const type = matchingValues
    ? getMatchingValuesType(matchingValues)
    : undefined;

  gql`
    query MatchingBankNames {
      myOrg {
        banks {
          textBanks {
            id
            name
          }
          locationBanks {
            id
            name
          }
          hashBanks {
            id
            name
          }
        }
      }
    }
  `;

  const { loading, error, data } = useGQLMatchingBankNamesQuery({
    skip:
      !type ||
      ![MatchingValueType.TEXT_BANK, MatchingValueType.LOCATION_BANK, MatchingValueType.IMAGE_BANK].includes(
        type,
      ),
  });
  const { textBanks, locationBanks, hashBanks } = data?.myOrg?.banks ?? {};

  if (!matchingValues || !type || error) {
    return null;
  }
  if (loading) {
    return <ComponentLoading />;
  }

  const renderMatchingValuesStringsInput = (
    strings: readonly string[],
    outcome: GQLConditionOutcome | undefined,
    matchedString: string | undefined,
    isRegexCondition: boolean,
  ) => {
    if (!outcome || !matchedString) {
      return (
        <RuleInsightsSampleDisabledTextTokenInput
          uniqueKey={strings.join('_')}
          tokens={strings}
        />
      );
    }
    const matchedStringText = coloredText(outcome, matchedString);
    return (
      <div className="flex flex-col justify-start">
        {/* This is a hidden component used to ensure the component is vertically centered */}
        <div className="hidden">
          Matched {isRegexCondition ? 'regex' : 'string'}: {matchedStringText}
        </div>
        <RuleInsightsSampleDisabledTextTokenInput
          uniqueKey={strings.join('_')}
          tokens={strings}
        />
        <div className="mx-2 font-bold text-center">
          Matched {isRegexCondition ? 'regex' : 'string'}: {matchedStringText}
        </div>
      </div>
    );
  };

  switch (type) {
    case MatchingValueType.STRING:
      return renderMatchingValuesStringsInput(
        matchingValues.strings!,
        result?.outcome,
        result?.matchedValue ?? undefined,
        (condition.signal?.type && receivesRegexInput(condition.signal.type)) ??
          false,
      );
    case MatchingValueType.LOCATION:
      return renderMatchingValuesStringsInput(
        matchingValues.locations!.map(getLocationDisplayName),
        result?.outcome,
        result?.matchedValue ?? undefined,
        false,
      );
    case MatchingValueType.TEXT_BANK:
      return staticValue({
        text: matchingValues
          .textBankIds!.map((id) => textBanks?.find((it) => it.id === id)?.name)
          .join(', '),
        outcome: condition.result?.outcome,
        matchedValue: condition.result?.matchedValue,
      });
    case MatchingValueType.LOCATION_BANK:
      return staticValue({
        text: matchingValues
          .locationBankIds!.map(
            (id) => locationBanks?.find((it) => it.id === id)?.name,
          )
          .join(', '),
        outcome: condition.result?.outcome,
        matchedValue: condition.result?.matchedValue,
      });
    case MatchingValueType.IMAGE_BANK:
      return staticValue({
        text: matchingValues
          .imageBankIds!.map((id) => hashBanks?.find((it) => it.id === id)?.name)
          .join(', '),
        outcome: condition.result?.outcome,
        matchedValue: condition.result?.matchedValue,
      });
  }
}
