import { PlusOutlined } from '@ant-design/icons';
import { Button, Select } from 'antd';
import cloneDeep from 'lodash/cloneDeep';

import { selectFilterByLabelOption } from '../../components/antDesignUtils';

import { GQLConditionConjunction } from '../../../../graphql/generated';
import { CoreSignal } from '../../../../models/signal';
import {
  hasNestedConditionSets,
  removeConditionSet,
} from '../../rules/rule_form/RuleFormUtils';
import { RuleFormConditionSet, RuleFormLeafCondition } from '../../rules/types';
import {
  ManualReviewQueueRoutingStaticTextField,
  ManualReviewQueueRoutingStaticTokenField,
} from './ManualReviewQueueRoutingStaticField';
import ManualReviewQueueRuleFormCondition from './ManualReviewQueueRuleFormCondition';
import {
  EditableRoutingRule,
  RoutingRuleItemType,
  RoutingRuleQueue,
} from './types';
import {
  addCondition,
  addConditionSet,
  getNewEligibleInputs,
  updateTopLevelConjunction,
} from './utils';

const { Option } = Select;

export default function ManualReviewQueueRoutingRuleForm(props: {
  rule: EditableRoutingRule;
  itemTypes: readonly RoutingRuleItemType[];
  signals: readonly CoreSignal[];
  queues: readonly RoutingRuleQueue[];
  editing: boolean;
  addSelectedItemTypeId: (itemTypeId: string) => void;
  removeSelectedItemTypeId: (itemTypeId: string) => void;
  setSelectedQueue: (queue: { id: string; name: string }) => void;
  setTopLevelConditionSet: (conditionSet: RuleFormConditionSet) => void;
}) {
  const {
    rule,
    itemTypes,
    signals,
    queues,
    editing,
    addSelectedItemTypeId,
    removeSelectedItemTypeId,
    setSelectedQueue,
    setTopLevelConditionSet,
  } = props;
  if (!editing && !rule) {
    throw Error('Rule must be present if the user is not currently editing');
  }

  const itemTypeSection = (
    <div className="flex flex-col items-start gap-3">
      <div className="flex flex-col gap-1">
        <div className="text-base font-semibold">Item Types</div>
        <div className="text-slate-500">
          This rule will run if any of the following items is reported:
        </div>
      </div>
      {editing ? (
        <Select
          className="min-w-[160px]"
          mode="multiple"
          placeholder="Select item types"
          allowClear
          showSearch
          filterOption={selectFilterByLabelOption}
          dropdownMatchSelectWidth={false}
          onSelect={(value) => addSelectedItemTypeId(value)}
          onDeselect={(value) => removeSelectedItemTypeId(value)}
          value={rule.itemTypeIds}
        >
          {[...itemTypes]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((contentType) => (
              <Option
                key={contentType.id}
                value={contentType.id}
                label={contentType.name}
              >
                {contentType.name}
              </Option>
            ))}
        </Select>
      ) : (
        <ManualReviewQueueRoutingStaticTokenField
          tokens={
            rule.itemTypeIds.map(
              (id) => itemTypes.find((it) => it.id === id)?.name ?? '',
            ) ?? []
          }
        />
      )}
    </div>
  );

  const updateConditionSetWithNoChildren = (
    newConditionSetWithNoChildren: RuleFormConditionSet,
    conditionSetIndex: number,
  ) => {
    // This callback needs to reset the rule's entire `conditionSet` prop.
    // However, the param that's passed in is just the condition set that
    // has been changed.
    // There are two scenarios to consider:
    //  1. The rule only has one condition set, so `rule.conditionSet` is shaped like:
    //     {
    //       conditions: LeafCondition[];
    //       conjunction: Conjunction;
    //     }
    //  2. The rule has multiple condition sets, so `rule.conditionSet` is shaped like:
    //     {
    //       conditions: ConditionSet[];
    //       conjunction: Conjunction;
    //     }
    //
    //     which is recursive (see the ConditionSet[] array).
    //
    // In scenario (1), the `newConditionSetWithNoChildren` param in this callback will
    // just be equal to the rule's overall condition set (i.e. `rule.conditionSet`).
    // In that case, we can just call `setTopLevelConditionSet(newConditionSetWithNoChildren)`,
    // and we're done.
    // In scenario (2), the `newConditionSetWithNoChildren` param in this callback will
    // _not_ be equal to the rule's overall condition set. It'll just be one of the
    // many condition sets in the rule. So `newConditionSetWithNoChildren !== rule.conditionSet`.
    // That means if we call `setTopLevelConditionSet(newConditionSetWithNoChildren)`, we'd
    // be throwing out all the rest of the condition sets. What we want to do instead is
    // replace the old condition set that needs to be updated with newConditionSetWithNoChildren,
    // which requires finding the location of the old condition set and splicing this new one
    // in, without affecting the rest of the condition sets.
    if (hasNestedConditionSets(rule.conditionSet)) {
      // In this case, we're in scenario (2), so we have to splice the new condition set into
      // the right place where its older version is.
      const mutableTopLevelConditionSet = cloneDeep(rule.conditionSet);
      mutableTopLevelConditionSet.conditions.splice(conditionSetIndex, 1, {
        ...newConditionSetWithNoChildren,
      });
      setTopLevelConditionSet(mutableTopLevelConditionSet);
    } else {
      // In this case, we're in scenario (1), so we just overwrite the rule's entire
      // top-level condition set
      setTopLevelConditionSet(newConditionSetWithNoChildren);
    }
  };

  const renderConditionSet = (opts: {
    conditionSet: RuleFormConditionSet;
    conditionSetIndex: number;
    signals: readonly CoreSignal[];
    parentConditionSet?: RuleFormConditionSet;
  }) => {
    const { conditionSet, conditionSetIndex, signals, parentConditionSet } = opts;

    if (hasNestedConditionSets(conditionSet)) {
      const conditions = conditionSet.conditions;
      return conditions.map((nestedConditionSet, index) => (
        <div key={index}>
          {renderConditionSet({
            conditionSet: nestedConditionSet,
            conditionSetIndex: index,
            signals,
            parentConditionSet: conditionSet,
          })}
          {index === conditions.length - 1
            ? null
            : renderTopLevelConjunction(conditionSet.conjunction)}
        </div>
      ));
    }

    // Determine if we can delete this condition set
    const canDeleteConditionSet =
      parentConditionSet &&
      hasNestedConditionSets(parentConditionSet) &&
      parentConditionSet.conditions.length > 1;

    const selectedItemTypes = itemTypes.filter((it) =>
      rule.itemTypeIds.includes(it.id),
    );
    return (
      <div
        className="p-4 rounded-lg bg-slate-50 relative"
        key={`set_${conditionSetIndex}`}
      >
        {conditionSet.conditions.map((condition, conditionIndex) => (
          <ManualReviewQueueRuleFormCondition
            key={`condition_${conditionSetIndex}_${conditionIndex}`}
            condition={condition as RuleFormLeafCondition}
            location={{ conditionIndex, conditionSetIndex }}
            parentConditionSet={conditionSet}
            eligibleInputs={getNewEligibleInputs(selectedItemTypes, signals)}
            selectedItemTypes={selectedItemTypes}
            allSignals={signals}
            onUpdateConditionSet={(newConditionSetWithNoChildren) =>
              updateConditionSetWithNoChildren(
                newConditionSetWithNoChildren,
                conditionSetIndex,
              )
            }
            editing={editing}
          />
        ))}
        {editing && (
          <div className="flex flex-row mt-4 items-center gap-4">
            <Button
              className="hover:bg-coop-lightblue"
              shape="circle"
              type="default"
              icon={<PlusOutlined />}
              onClick={() => {
                const newConditionSet = addCondition(
                  conditionSet,
                  conditionSetIndex,
                );
                updateConditionSetWithNoChildren(
                  newConditionSet,
                  conditionSetIndex,
                );
              }}
            />
            {canDeleteConditionSet && (
              <Button
                type="default"
                danger
                onClick={() => {
                  const newConditionSet = removeConditionSet(
                    rule.conditionSet,
                    conditionSetIndex,
                  );
                  setTopLevelConditionSet(newConditionSet);
                }}
              >
                Delete Condition Set
              </Button>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderTopLevelConjunction = (conjunction: GQLConditionConjunction) => {
    return (
      <div className="flex flex-row items-center">
        <div className="flex flex-col items-center w-10 py-2 pl-16">
          <div className="w-px h-4 m-1 bg-black" />
          {editing ? (
            <Select
              className="py-2"
              defaultValue={conjunction}
              value={conjunction}
              dropdownMatchSelectWidth={false}
              onSelect={(value) =>
                setTopLevelConditionSet(
                  updateTopLevelConjunction(rule.conditionSet, value),
                )
              }
            >
              <Option
                key={GQLConditionConjunction.Or}
                value={GQLConditionConjunction.Or}
              >
                OR
              </Option>
              <Option
                key={GQLConditionConjunction.And}
                value={GQLConditionConjunction.And}
              >
                AND
              </Option>
            </Select>
          ) : (
            <ManualReviewQueueRoutingStaticTextField text={conjunction} />
          )}
          <div className="w-px h-4 m-1 bg-black" />
        </div>
      </div>
    );
  };

  const conditionsSection = (
    <div className="flex flex-col">
      <div className="pb-1 text-base font-semibold">Conditions</div>
      <div className="pb-2 text-slate-500">
        If all these conditions are met, then your report will end up in the
        queue below.
      </div>
      <div className="flex flex-col mt-2">
        {renderConditionSet({
          conditionSet: rule.conditionSet,
          conditionSetIndex: 0,
          signals,
        })}
      </div>
      {editing && (
        <div
          className="flex flex-row self-start p-3 my-4 text-sm font-semibold border border-solid rounded-lg cursor-pointer text-slate-500 hover:text-coop-blue hover:border-coop-blue focus:shadow-coop-light-blue focus:shadow-sm hover:bg-coop-lightblue border-slate-300"
          onClick={() =>
            setTopLevelConditionSet(addConditionSet(rule.conditionSet))
          }
        >
          <PlusOutlined className="mr-2 mt-0.5" />
          Add Condition Set
        </div>
      )}
    </div>
  );

  const queueSelectionSection = (
    <div className="flex flex-col items-start gap-3">
      <div className="text-base font-semibold">Then send report to Queue: </div>
      {editing ? (
        <Select
          className="self-start min-w-[160px]"
          placeholder="Select Queue"
          dropdownMatchSelectWidth={false}
          allowClear
          showSearch
          filterOption={selectFilterByLabelOption}
          onSelect={(value) =>
            setSelectedQueue({
              id: value,
              name: queues.find((q) => q.id === value)?.name ?? '',
            })
          }
          value={rule?.destinationQueue?.id}
        >
          {[...queues]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((contentType) => (
              <Option
                key={contentType.id}
                value={contentType.id}
                label={contentType.name}
              >
                {contentType.name}
              </Option>
            ))}
        </Select>
      ) : (
        <ManualReviewQueueRoutingStaticTextField
          text={rule?.destinationQueue?.name ?? ''}
        />
      )}
    </div>
  );

  return (
    <div className="flex flex-col">
      <div className="my-6 divider" />
      {itemTypeSection}
      <div className="my-6 divider" />
      {conditionsSection}
      <div className="my-6 divider" />
      {queueSelectionSection}
    </div>
  );
}
