import { DeleteOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { Button, Select, Tooltip } from 'antd';

import { GQLConditionConjunction } from '../../../../graphql/generated';
import { CoreSignal } from '../../../../models/signal';
import {
  hasNestedConditionSets,
  removeCondition,
} from '../../rules/rule_form/RuleFormUtils';
import {
  ConditionInput,
  ConditionLocation,
  RuleFormConditionSet,
  RuleFormLeafCondition,
  isConditionSet,
} from '../../rules/types';
import ManualReviewQueueRuleConditionComparator from './condition/comparator/ManualReviewQueueRuleConditionComparator';
import ManualReviewQueueRuleConditionInput from './condition/input/ManualReviewQueueRuleConditionInput';
import ManualReviewQueueRuleConditionMatchingValues from './condition/matching_values/ManualReviewQueueRuleConditionMatchingValues';
import ManualReviewQueueRuleConditionSignal from './condition/signal/ManualReviewQueueRuleConditionSignal';
import ManualReviewQueueRuleConditionThreshold from './condition/threshold/ManualReviewQueueRuleConditionThreshold';
import { RoutingRuleItemType } from './types';
import {
  getInputScalarType,
  updateConditionComponent,
  updateConditionInput,
} from './utils';

const { Option } = Select;

export type RuleFormConditionParams = {
  condition: RuleFormLeafCondition;
  location: ConditionLocation;
};

export function optionWithTooltip(opts: {
  title: string;
  value: string;
  disabled: boolean;
  description: string | undefined;
  key: string; // custom key for the <div> tag - should be unique
  index: number;
  isInOptionGroup?: boolean;
}) {
  const {
    title,
    value,
    disabled,
    description,
    key,
    index,
    isInOptionGroup = true,
  } = opts;

  return (
    <Option
      className={isInOptionGroup ? 'pl-6' : 'pl-3'}
      key={key + index}
      value={value}
      disabled={disabled}
      label={title}
    >
      <div className="flex flex-row items-center justify-between">
        <div className="pr-6">{title}</div>
        {description && (
          <Tooltip className="bg-white" placement="right" title={description}>
            <InfoCircleOutlined className="bg-transparent text-slate-500" />
          </Tooltip>
        )}
      </div>
    </Option>
  );
}

/**
 * Condition Options:
 *
 * exact matching selected --> matching values input
 * similarity score selected --> matching values input, comparator, threshold
 * other (later) selected --> comparator, threshold
 *
 * Use signals fetched from GraphQL to determine what to render. Those
 * already store this mapping
 */
export default function ManualReviewQueueRuleFormCondition(props: {
  condition: RuleFormLeafCondition;
  location: ConditionLocation;
  parentConditionSet: RuleFormConditionSet;
  eligibleInputs: Map<string, ConditionInput[]>;
  selectedItemTypes: RoutingRuleItemType[];
  allSignals: readonly CoreSignal[];
  editing: boolean;
  onUpdateConditionSet: (conditionSet: RuleFormConditionSet) => void;
}) {
  const {
    condition,
    location,
    parentConditionSet,
    eligibleInputs,
    selectedItemTypes,
    allSignals,
    editing,
    onUpdateConditionSet,
  } = props;
  const { conditionIndex, conditionSetIndex } = location;

  const prefix = (
    <div
      className={`mb-0 align-middle text-start whitespace-nowrap ${
        parentConditionSet.conditions.length === 1 || !editing
          ? 'w-8'
          : 'w-[70px]'
      }`}
      key={`condition_${conditionSetIndex}_${conditionIndex}`}
    >
      {conditionIndex === 0 ? (
        <div className={editing ? 'pl-3' : 'pl-1'}>If</div>
      ) : editing ? (
        <Select
          defaultValue={parentConditionSet.conjunction}
          dropdownMatchSelectWidth={false}
          value={parentConditionSet.conjunction}
          onSelect={(value) => {
            const newConditionSet = hasNestedConditionSets(parentConditionSet)
              ? {
                  ...parentConditionSet,
                  conditions: parentConditionSet.conditions.map((it) => ({
                    ...it,
                    conjunction: value,
                  })),
                }
              : { ...parentConditionSet, conjunction: value };
            onUpdateConditionSet(newConditionSet);
          }}
        >
          <Option
            key={GQLConditionConjunction.Or}
            value={GQLConditionConjunction.Or}
          >
            or
          </Option>
          <Option
            key={GQLConditionConjunction.And}
            value={GQLConditionConjunction.And}
          >
            and
          </Option>
        </Select>
      ) : (
        <div className={editing ? 'pl-3' : 'pl-1'}>
          {parentConditionSet.conjunction.toLocaleLowerCase()}
        </div>
      )}
    </div>
  );

  const inputScalarType = getInputScalarType(
    selectedItemTypes,
    condition.input,
  );

  return (
    <div className="flex items-center py-3 mr-4">
      {prefix}
      <ManualReviewQueueRuleConditionInput
        condition={condition}
        location={location}
        eligibleInputs={eligibleInputs}
        selectedItemTypes={selectedItemTypes}
        editing={editing}
        onUpdateConditionInput={(input) => {
          const newConditionSet = updateConditionInput({
            currentConditionSet: parentConditionSet,
            location,
            input,
            selectedItemTypes,
            allSignals,
          });
          onUpdateConditionSet(newConditionSet);
        }}
      />
      <ManualReviewQueueRuleConditionSignal
        condition={condition}
        location={location}
        editing={editing}
        onUpdateSignal={(signal: CoreSignal, subcategory?: string) => {
          // Do this manually instead of having a helper function to avoid
          // setting the state multiple times in the case of the signal having a subcategory
          let newConditionSet = updateConditionComponent(
            parentConditionSet,
            location,
            signal,
            (condition, value) => ({
              ...condition,
              signal: value,
              threshold: undefined,
            }),
          );

          if (subcategory) {
            newConditionSet = updateConditionComponent(
              newConditionSet,
              location,
              subcategory,
              (condition, value) => ({
                ...condition,
                signal: { ...condition.signal!, subcategory: value },
              }),
            );
          }

          onUpdateConditionSet(newConditionSet);
        }}
      />
      <ManualReviewQueueRuleConditionMatchingValues
        condition={condition}
        location={location}
        inputScalarType={inputScalarType}
        editing={editing}
        onUpdateMatchingValues={(matchingValues) =>
          onUpdateConditionSet(
            updateConditionComponent(
              parentConditionSet,
              location,
              matchingValues,
              (condition, value) => ({ ...condition, matchingValues: value }),
            ),
          )
        }
        allConditions={parentConditionSet.conditions.filter((c): c is RuleFormLeafCondition => !isConditionSet(c))}
      />
      <ManualReviewQueueRuleConditionComparator
        condition={condition}
        location={location}
        inputScalarType={inputScalarType}
        editing={editing}
        onUpdateComparator={(comparator) =>
          onUpdateConditionSet(
            updateConditionComponent(
              parentConditionSet,
              location,
              comparator,
              (condition, value) => ({ ...condition, comparator: value }),
            ),
          )
        }
      />
      <ManualReviewQueueRuleConditionThreshold
        condition={condition}
        location={location}
        selectedItemTypes={selectedItemTypes}
        editing={editing}
        onUpdateThreshold={(threshold) =>
          onUpdateConditionSet(
            updateConditionComponent(
              parentConditionSet,
              location,
              threshold,
              (condition, value) => ({ ...condition, threshold: value }),
            ),
          )
        }
      />
      {editing && (
        <Button
          className="ml-4"
          key={`RuleFormCondition-delete_set_index_${conditionSetIndex}_index_${conditionIndex}`}
          shape="circle"
          icon={<DeleteOutlined />}
          onClick={() =>
            onUpdateConditionSet(removeCondition(parentConditionSet, location))
          }
        />
      )}
    </div>
  );
}
