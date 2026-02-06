import {
  DeleteOutlined,
  DownOutlined,
  EditOutlined,
  HolderOutlined,
  UpOutlined,
} from '@ant-design/icons';
import { gql } from '@apollo/client';
import { Input, Tooltip } from 'antd';
import React, { useState } from 'react';
import { DraggableProvidedDragHandleProps } from 'react-beautiful-dnd';

import { CoreSignal } from '../../../../models/signal';
import {
  getInvalidRegexesInCondition,
  isConditionComplete,
} from '../../rules/rule_form/RuleFormUtils';
import ManualReviewQueueRoutingRuleForm from './ManualReviewQueueRoutingRuleForm';
import ManualReviewQueueRoutingSaveButtonPanel from './ManualReviewQueueRoutingSaveButtonPanel';
import {
  EditableRoutingRule,
  newEditableRoutingRule,
  RoutingRuleItemType,
  RoutingRuleQueue,
} from './types';

gql`
  mutation DeleteRoutingRule($input: DeleteRoutingRuleInput!) {
    deleteRoutingRule(input: $input)
  }
`;

const IconButton = (props: {
  icon: JSX.Element;
  disabled?: boolean;
  onClick?: () => void;
}) => {
  return (
    <div
      className={`flex items-center justify-center w-8 h-8 p-1 border border-solid rounded-full border border-slate-200 ${
        props.disabled
          ? 'cursor-not-allowed bg-slate-200 text-slate-400 border-slate-300'
          : 'cursor-pointer hover:bg-slate-200'
      }`}
      onClick={props.onClick}
    >
      {props.icon}
    </div>
  );
};

export function ManualReviewQueueDefaultRoutingRule(props: {
  showHandle: boolean;
}) {
  const { showHandle } = props;
  const buttonPanel = (
    <>
      <IconButton icon={<EditOutlined />} disabled />
      <IconButton icon={<DeleteOutlined />} disabled />
    </>
  );

  return (
    <div className="py-4">
      <div className="flex flex-row items-center bg-white border border-solid rounded-md border-slate-200">
        {showHandle && (
          <>
            <Tooltip
              className="bg-white cursor-not-allowed"
              placement="right"
              title="This rule must be the last rule in your routing rules, so it cannot be moved, edited, or deleted."
            >
              <div className="flex items-center self-stretch justify-center pr-4 max-w-fit rounded-tl-md rounded-bl-md text-slate-300 bg-slate-100">
                <HolderOutlined className="pl-4 text-2xl" />
              </div>
            </Tooltip>

            <div className="self-stretch w-px mr-4 bg-slate-200" />
          </>
        )}
        <div className="flex flex-col p-6 grow">
          <div className="flex flex-row items-center justify-between mb-4">
            <div className="text-lg font-semibold">
              Send remaining reports to Default Queue
            </div>
            <div className="flex flex-row space-x-4">{buttonPanel}</div>
          </div>
          <div className="text-slate-500">
            This rule is always last, and it will send all reports that reach it
            to your default queue.
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ManualReviewQueueRoutingRule(props: {
  rule: EditableRoutingRule;
  isEditing: boolean;
  setRuleEditingState: (isEditing: boolean) => void;
  itemTypes: readonly RoutingRuleItemType[];
  signals: readonly CoreSignal[];
  queues: readonly RoutingRuleQueue[];
  isReordering: boolean;
  isLoading: boolean;
  dragHandleProps: DraggableProvidedDragHandleProps | null | undefined;
  onClickSave: (rule: EditableRoutingRule) => void;
  onClickEdit: (rule: EditableRoutingRule) => void;
  onClickCancel: (rule: EditableRoutingRule) => void;
  onClickDelete: (rule: EditableRoutingRule) => void;
}) {
  const {
    rule,
    isEditing,
    setRuleEditingState,
    itemTypes,
    signals,
    queues,
    isReordering,
    isLoading,
    dragHandleProps,
    onClickSave,
    onClickEdit,
    onClickCancel,
    onClickDelete,
  } = props;

  const [state, setState] = useState<{
    expanded: boolean;
    editableRule: EditableRoutingRule;
  }>({
    expanded: rule.id.includes('unsaved_'),
    editableRule: rule ?? newEditableRoutingRule(),
  });

  const { expanded, editableRule } = state;
  const onEdit = () => {
    onClickEdit(editableRule);
    setState({ ...state, expanded: true });
    setRuleEditingState(true);
  };
  const onCancel = () => {
    onClickCancel(editableRule);
    setState({ expanded: false, editableRule: rule });
    setRuleEditingState(false);
  };

  const ruleValidationErrorMessage = (rule: EditableRoutingRule) => {
    const errors: { errorMessage: string }[] = [];
    if (!rule.name) {
      errors.push({
        errorMessage: 'Rule name is required.',
      });
    }

    if (rule.itemTypeIds.length === 0) {
      errors.push({
        errorMessage: 'Rules must have at least one item type selected.',
      });
    }

    if (!rule.conditionSet.conditions.every(isConditionComplete)) {
      errors.push({ errorMessage: 'All conditions must be completed.' });
    }

    const invalidRegexes = getInvalidRegexesInCondition(rule.conditionSet);
    if (invalidRegexes.length > 0) {
      errors.push({
        errorMessage: `Invalid Regex(es): ${invalidRegexes.join(', ')}`,
      });
    }

    if (!rule.destinationQueue) {
      errors.push({
        errorMessage: 'Destination queue is required',
      });
    }

    return errors.length > 0 ? (
      <div>
        Please correct the following errors:
        <ul>
          {errors.map((it) => (
            <React.Fragment key={it.errorMessage}>
              <li> {it.errorMessage}</li>
            </React.Fragment>
          ))}
        </ul>
      </div>
    ) : undefined;
  };

  const ruleValidationErrorMessageText =
    ruleValidationErrorMessage(editableRule);
  const ruleBasicInfo = isEditing ? (
    <>
      <div className="flex flex-row items-center justify-between mb-4">
        <div className="text-lg font-semibold">
          {rule && rule.id ? 'Editing Routing Rule' : 'Create Routing Rule'}
        </div>
        <ManualReviewQueueRoutingSaveButtonPanel
          disabledInfo={{
            disabledTooltip: ruleValidationErrorMessageText,
            saveDisabled: ruleValidationErrorMessageText != null,
          }}
          onClickSave={() => onClickSave(editableRule)}
          loading={isLoading}
          onCancel={onCancel}
        />
      </div>
      <div className="flex flex-row w-full mb-2 space-x-4">
        <div className="flex flex-col">
          <div className="mb-1 font-semibold">Name</div>
          <Input
            placeholder="Rule Name"
            value={editableRule.name}
            onChange={(e) =>
              setState((state) => ({
                ...state,
                editableRule: { ...state.editableRule, name: e.target.value },
              }))
            }
          />
        </div>
        <div className="flex flex-col grow">
          <div className="mb-1 font-semibold">Description (Optional)</div>
          <Input
            className="rounded-md"
            placeholder="Description"
            value={editableRule.description}
            onChange={(e) =>
              setState((state) => ({
                ...state,
                editableRule: {
                  ...state.editableRule,
                  description: e.target.value,
                },
              }))
            }
          />
        </div>
      </div>
    </>
  ) : (
    <>
      <div className="flex flex-row items-center justify-between mb-4">
        <div className="flex flex-row items-center space-x-6">
          <div className="text-lg font-semibold">{editableRule.name}</div>
          {editableRule.destinationQueue ? (
            <div className="px-2 py-1 text-xs rounded-md bg-primary/20">
              {`Destination: ${editableRule?.destinationQueue?.name}`}
            </div>
          ) : null}
        </div>
        <div className="flex flex-row space-x-4">
          <IconButton
            icon={<EditOutlined />}
            onClick={onEdit}
            disabled={isReordering}
          />
          <IconButton
            icon={<DeleteOutlined />}
            onClick={() => onClickDelete(editableRule)}
            disabled={isReordering}
          />
        </div>
      </div>
      <div className="text-slate-500">
        {editableRule.description ?? 'No description provided'}
      </div>
      <div
        className="flex flex-row items-center self-end cursor-pointer space-x-2 text-slate-500"
        onClick={() => setState({ ...state, expanded: !state.expanded })}
      >
        <span className="font-semibold text-slate-500">
          {expanded ? 'Collapse' : 'Expand Rule'}
        </span>
        {expanded ? <UpOutlined /> : <DownOutlined />}
      </div>
    </>
  );

  return (
    <div className="py-4">
      <div className="flex flex-row items-center bg-white border border-solid rounded-md border-slate-200">
        {dragHandleProps && (
          <>
            <div
              {...dragHandleProps}
              className="flex items-center self-stretch justify-center pr-4 max-w-fit text-slate-500 rounded-tl-md rounded-bl-md cursor-grab active:cursor-grabbing focus:cursor-grabbing"
            >
              <HolderOutlined className="pl-4 text-2xl" />
            </div>
            <div className="self-stretch w-px mr-4 bg-slate-200" />
          </>
        )}
        <div className="flex flex-col p-6 overflow-hidden grow">
          {ruleBasicInfo}
          {expanded && (
            <ManualReviewQueueRoutingRuleForm
              rule={editableRule}
              itemTypes={itemTypes}
              signals={signals}
              queues={queues}
              editing={isEditing}
              addSelectedItemTypeId={(itemTypeId) =>
                setState((state) => ({
                  ...state,
                  editableRule: {
                    ...state.editableRule,
                    itemTypeIds: [
                      ...state.editableRule.itemTypeIds,
                      itemTypeId,
                    ],
                  },
                }))
              }
              removeSelectedItemTypeId={(itemTypeId) =>
                setState((state) => ({
                  ...state,
                  editableRule: {
                    ...state.editableRule,
                    itemTypeIds: state.editableRule.itemTypeIds.filter(
                      (it) => it !== itemTypeId,
                    ),
                  },
                }))
              }
              setSelectedQueue={(destinationQueue) =>
                setState((state) => ({
                  ...state,
                  editableRule: {
                    ...state.editableRule,
                    destinationQueue,
                  },
                }))
              }
              setTopLevelConditionSet={(conditionSet) =>
                setState((state) => ({
                  ...state,
                  editableRule: { ...state.editableRule, conditionSet },
                }))
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}
