import {
  GQLConditionOutcome,
  GQLLookbackVersion,
  GQLScalarType,
  GQLSignalType,
  useGQLGetFullResultForRuleLazyQuery,
  useGQLItemTypesQuery,
  type GQLBaseField,
  type GQLConditionInputField,
} from '@/graphql/generated';
import { titleCaseEnumString } from '@/utils/string';
import {
  CheckCircleFilled,
  FlagFilled,
  MinusCircleFilled,
} from '@ant-design/icons';
import type { ItemIdentifier } from '@roostorg/types';
import { useEffect, useState } from 'react';

import ComponentLoading from '@/components/common/ComponentLoading';
import CoopBadge from '@/webpages/dashboard/components/CoopBadge';

import { getConditionInputScalarType } from '../../../rule_form/RuleFormUtils';
import type {
  ConditionSetWithResult,
  LeafConditionWithResult,
} from '../../../types';
import { LookbackVersion } from '../RuleInsightsSamplesTable';
import RuleInsightsSampleDetailMatchingValues from './RuleInsightsSampleDetailMatchingValues';
import {
  isArrayOfConditionSetsWithResult,
  staticValue,
} from './RuleInsightsSampleDetailView';

const gqlLookbackFromLookback = (lookback: LookbackVersion) => {
  switch (lookback) {
    case LookbackVersion.LATEST:
      return GQLLookbackVersion.Latest;
    case LookbackVersion.PRIOR:
      return GQLLookbackVersion.Prior;
  }
};

export function getDisplayName(outcome?: GQLConditionOutcome) {
  switch (outcome) {
    case GQLConditionOutcome.Passed:
      return 'Matched';
    case GQLConditionOutcome.Failed:
      return 'Did Not Match';
    case GQLConditionOutcome.Errored:
      return 'Errored';
    case GQLConditionOutcome.Inapplicable:
    case undefined:
      return 'Skipped';
  }
}

export function outcomeString(outcome?: GQLConditionOutcome, prefix?: string) {
  const className = ((outcome?: GQLConditionOutcome) => {
    switch (outcome) {
      case GQLConditionOutcome.Passed:
        return 'ml-3 font-bold text-base text-red-800';
      case GQLConditionOutcome.Failed:
      case GQLConditionOutcome.Errored:
        return 'ml-3 font-bold text-base text-teal-800';
      case GQLConditionOutcome.Inapplicable:
      case undefined:
        return 'ml-3 font-bold text-base text-zinc-500';
    }
  })(outcome);
  return (
    <div className={className}>
      {`${prefix ? prefix + ' ' : ''}${getDisplayName(outcome)}`}
    </div>
  );
}

export function outcomeIcon(outcome?: GQLConditionOutcome) {
  switch (outcome) {
    case GQLConditionOutcome.Passed:
      return <FlagFilled className="text-base !text-red-800" />;
    case GQLConditionOutcome.Failed:
      return <CheckCircleFilled className="text-base !text-teal-800" />;
    case GQLConditionOutcome.Inapplicable:
    case GQLConditionOutcome.Errored:
    case undefined:
      return <MinusCircleFilled className="text-base !text-zinc-500" />;
  }
}

export default function RuleInsightsSampleDetailResults(props: {
  ruleId: string;
  itemIdentifier: ItemIdentifier;
  lookback: LookbackVersion;
  itemSubmissionDate?: string;
}) {
  const { ruleId, itemIdentifier, lookback, itemSubmissionDate } = props;

  const [conditionSetWithResult, setConditionSetWithResult] = useState<
    ConditionSetWithResult | undefined
  >(undefined);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(
    undefined,
  );
  const [fetchFullResult, { loading: fullResultLoading }] =
    useGQLGetFullResultForRuleLazyQuery();

  useEffect(() => {
    setErrorMessage(undefined);

    fetchFullResult({
      variables: {
        input: {
          ruleId,
          item: itemIdentifier,
          date: itemSubmissionDate,
          lookback: gqlLookbackFromLookback(lookback),
        },
      },
      onCompleted: (data) => {
        if (
          data.getFullRuleResultForItem.__typename === 'RuleExecutionResult'
        ) {
          return setConditionSetWithResult(
            data.getFullRuleResultForItem
              ?.result as unknown as ConditionSetWithResult,
          );
        } else {
          setErrorMessage('No item found for the selected row.');
        }
      },
      onError: (e) => {
        setErrorMessage(`Error: ${e.message}`);
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.ruleId, itemIdentifier, fetchFullResult]);

  const { data: contentTypesQueryData } = useGQLItemTypesQuery();
  const itemTypes = contentTypesQueryData?.myOrg?.itemTypes;

  if (fullResultLoading) {
    return <ComponentLoading />;
  }
  if (errorMessage || !conditionSetWithResult) {
    return (
      <div className="m-2 text-red-500">
        {errorMessage ?? 'Error fetching rule results'}
      </div>
    );
  }

  return (
    <RuleInsightsSampleDetailResultsImpl
      itemTypes={itemTypes ?? []}
      conditionSetWithResult={conditionSetWithResult}
      loading={fullResultLoading}
    />
  );
}

export function RuleInsightsSampleDetailResultsImpl(props: {
  itemTypes: readonly {
    id: string;
    name: string;
    baseFields: readonly GQLBaseField[];
  }[];
  conditionSetWithResult: ConditionSetWithResult;
  loading: boolean;
}) {
  const { itemTypes, conditionSetWithResult, loading } = props;

  const renderOutcome = () => {
    const outcome = conditionSetWithResult.result?.outcome;
    return (
      <div className="flex items-center gap-1">
        <div className="mr-4 font-bold">Outcome:</div>
        <CoopBadge
          colorVariant={
            outcome === GQLConditionOutcome.Passed
              ? 'soft-red'
              : outcome === GQLConditionOutcome.Failed
              ? 'soft-green'
              : 'soft-gray'
          }
          shapeVariant="rounded"
          label={getDisplayName(outcome)}
          icon={outcomeIcon(outcome)}
        />
      </div>
    );
  };

  const renderLegend = () => {
    return (
      <div className="flex items-center self-start justify-center min-w-max">
        <div className="mr-4 font-bold">Legend:</div>
        <div className="flex self-start justify-center gap-2">
          <CoopBadge
            colorVariant={'soft-red'}
            shapeVariant="rounded"
            label={getDisplayName(GQLConditionOutcome.Passed)}
            icon={outcomeIcon(GQLConditionOutcome.Passed)}
          />
          <CoopBadge
            colorVariant={'soft-green'}
            shapeVariant="rounded"
            label={getDisplayName(GQLConditionOutcome.Failed)}
            icon={outcomeIcon(GQLConditionOutcome.Failed)}
          />
          <CoopBadge
            colorVariant={'soft-gray'}
            shapeVariant="rounded"
            label={getDisplayName()}
            icon={outcomeIcon()}
          />
        </div>
      </div>
    );
  };

  const renderConditionSetConjunction = (conjunction: string) => {
    return (
      <div className="flex items-center justify-center m-4">
        <div className="px-4 py-1 border border-solid rounded-lg border-zinc-500 text-zinc-500">
          {conjunction}
        </div>
      </div>
    );
  };

  const renderConditionOutcome = (outcome: GQLConditionOutcome | undefined) => {
    return <div className="flex py-3 mr-3">{outcomeIcon(outcome)}</div>;
  };

  const renderPrefix = (conjunction: string, conditionIndex: number) => {
    return (
      <div className="py-2">
        {conditionIndex === 0 ? 'If' : conjunction.toLowerCase()}
      </div>
    );
  };

  const renderInput = (condition: LeafConditionWithResult) => {
    const input = condition.input!;
    const inputName = (() => {
      switch (input.type) {
        case 'USER_ID':
          return 'User ID';
        case 'FULL_ITEM':
          return input.contentTypeIds && itemTypes
            ? itemTypes
                .filter((it) => input.contentTypeIds!.includes(it.id))
                .map((it) => it.name)
                .join(' or ')
            : 'Content';
        case 'CONTENT_FIELD':
        case 'CONTENT_COOP_INPUT':
          return input.name;
        case 'CONTENT_DERIVED_FIELD':
          // Condition inputs for derived fields that were sent to us by the
          // server will always have a backend-provided name.
          return (input as GQLConditionInputField).name!;
      }
    })();
    return staticValue({ text: inputName });
  };

  const renderSignal = (condition: LeafConditionWithResult) => {
    if (condition.signal?.type === GQLSignalType.GeoContainedWithin) {
      return staticValue({
        text: 'Is location in',
        outcome: condition.result?.outcome,
      });
    }
    if (!condition.signal) {
      return null;
    }
    return staticValue({
      text: condition.signal.name,
      outcome: condition.result?.outcome,
      score: condition.result?.score,
    });
  };

  const renderSignalSubcategory = (condition: LeafConditionWithResult) => {
    // TODO -- update Condition type to allow for subcategory field
    if (!condition.signal?.subcategory) {
      return null;
    }
    return staticValue({ text: condition.signal.subcategory });
  };

  const renderComparator = (condition: LeafConditionWithResult) => {
    if (!condition.comparator) {
      return null;
    }
    return staticValue({
      text: titleCaseEnumString(condition.comparator),
    });
  };

  const renderThreshold = (condition: LeafConditionWithResult) => {
    if (!condition.threshold || !condition.input || !itemTypes) {
      return null;
    }
    const inputScalarType = getConditionInputScalarType(
      itemTypes,
      condition.input,
    );

    const threshold = String(condition.threshold);

    if (inputScalarType === GQLScalarType.Geohash) {
      return staticValue({ text: threshold === '0' ? 'false' : 'true' });
    }
    return staticValue({ text: threshold });
  };

  const renderConditionSet = (conditionSet: ConditionSetWithResult) => {
    if (isArrayOfConditionSetsWithResult(conditionSet.conditions)) {
      return conditionSet.conditions.map((nestedSet, index) => (
        <div key={index}>
          {index !== 0 &&
            renderConditionSetConjunction(conditionSet.conjunction)}
          {renderConditionSet(nestedSet as ConditionSetWithResult)}
        </div>
      ));
    }

    return (
      <div className="flex flex-col grow">
        <div
          className={`px-4 pt-2 pb-4 my-2 rounded-xl bg-slate-50 grow ${
            conditionSet.result?.outcome === GQLConditionOutcome.Passed
              ? 'border border-solid border-red-800'
              : conditionSet.result?.outcome === GQLConditionOutcome.Failed
              ? 'border border-solid border-teal-800'
              : 'border-none'
          }`}
        >
          {conditionSet.conditions.map((condition, conditionIndex) => {
            condition = condition as LeafConditionWithResult;
            return (
              <div key={conditionIndex} className="flex items-start py-3">
                {renderConditionOutcome(condition.result?.outcome)}
                {renderPrefix(conditionSet.conjunction, conditionIndex)}
                {renderInput(condition)}
                {renderSignal(condition)}
                {renderSignalSubcategory(condition)}
                <RuleInsightsSampleDetailMatchingValues condition={condition} />
                {renderComparator(condition)}
                {renderThreshold(condition)}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between mt-2 mb-8 gap-8">
        {renderOutcome()}
        {renderLegend()}
      </div>
      {loading ? (
        <div className="self-start mx-8 mt-4 justify-self-start">
          <ComponentLoading />
        </div>
      ) : conditionSetWithResult ? (
        renderConditionSet(conditionSetWithResult)
      ) : null}
    </div>
  );
}
