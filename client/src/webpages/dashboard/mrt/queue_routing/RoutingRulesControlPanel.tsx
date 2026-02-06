import { gql } from '@apollo/client';
import { notification } from 'antd';
import { useEffect, useState } from 'react';
import { DragDropContext, Draggable, Droppable } from 'react-beautiful-dnd';
import { Helmet } from 'react-helmet-async';

import FullScreenLoading from '../../../../components/common/FullScreenLoading';
import CoopButton from '../../components/CoopButton';
import CoopModal from '../../components/CoopModal';

import {
  namedOperations,
  useGQLCreateRoutingRuleMutation,
  useGQLDeleteRoutingRuleMutation,
  useGQLManualReviewQueueRoutingRulesQuery,
  useGQLReorderRoutingRulesMutation,
  useGQLUpdateRoutingRuleMutation,
} from '../../../../graphql/generated';
import {
  CONDITION_SET_FRAGMENT,
  DERIVED_FIELDS_FRAGMENT,
  ITEM_TYPE_FRAGMENT,
  SIGNALS_FRAGMENT,
} from '../../rules/rule_form/RuleForm';
import { serializeConditionSet } from '../../rules/rule_form/RuleFormUtils';
import ManualReviewQueueRoutingRule, {
  ManualReviewQueueDefaultRoutingRule,
} from './ManualReviewQueueRoutingRule';
import ManualReviewQueueRoutingSaveButtonPanel from './ManualReviewQueueRoutingSaveButtonPanel';
import {
  EditableRoutingRule,
  editableRoutingRuleFromRoutingRule,
  newEditableRoutingRule,
} from './types';

gql`
  ${ITEM_TYPE_FRAGMENT}
  ${CONDITION_SET_FRAGMENT}
  ${SIGNALS_FRAGMENT}
  ${DERIVED_FIELDS_FRAGMENT}
  query ManualReviewQueueRoutingRules {
    myOrg {
      itemTypes {
        ...ItemTypeFragment
        ... on ItemTypeBase {
          derivedFields {
            ...DerivedFieldFields
          }
        }
      }
      routingRules {
        id
        name
        description
        itemTypes {
          ...ItemTypeFragment
        }
        conditionSet {
          ...ConditionSetFields
        }
        destinationQueue {
          id
          name
        }
      }
      appealsRoutingRules {
        id
        name
        description
        itemTypes {
          ...ItemTypeFragment
        }
        conditionSet {
          ...ConditionSetFields
        }
        destinationQueue {
          id
          name
        }
      }
      signals {
        ...SignalsFragment
      }
    }
    me {
      id
      reviewableQueues {
        id
        name
        isAppealsQueue
      }
    }
  }

  mutation CreateRoutingRule($input: CreateRoutingRuleInput!) {
    createRoutingRule(input: $input) {
      ... on MutateRoutingRuleSuccessResponse {
        data {
          id
        }
      }
      ... on Error {
        title
      }
    }
  }

  mutation UpdateRoutingRule($input: UpdateRoutingRuleInput!) {
    updateRoutingRule(input: $input) {
      ... on MutateRoutingRuleSuccessResponse {
        data {
          id
        }
      }
      ... on Error {
        title
      }
    }
  }

  mutation ReorderRoutingRules($input: ReorderRoutingRulesInput!) {
    reorderRoutingRules(input: $input) {
      ... on MutateRoutingRulesOrderSuccessResponse {
        data {
          id
        }
      }
    }
  }
`;

export default function ManualReviewQueueRoutingRulesControls(props: {
  isAppeals: boolean;
}) {
  const [notificationApi, notificationContextHolder] =
    notification.useNotification();

  const [state, setState] = useState<{
    orderedRules: readonly EditableRoutingRule[];
    isReordering: boolean;
    ruleIdsBeingEdited: string[];
    deleteRuleId: string | undefined;
  }>({
    orderedRules: [],
    isReordering: false,
    ruleIdsBeingEdited: [],
    deleteRuleId: undefined,
  });

  const { isAppeals } = props;

  const { orderedRules, isReordering, ruleIdsBeingEdited, deleteRuleId } =
    state;

  const { loading, error, data } = useGQLManualReviewQueueRoutingRulesQuery();

  const [createRoutingRule, { loading: createLoading }] =
    useGQLCreateRoutingRuleMutation({
      onCompleted: ({ createRoutingRule }) => {
        if (createRoutingRule.__typename === 'RoutingRuleNameExistsError') {
          notificationApi.error({
            message:
              'There is already another rule with the same name. Please rename this rule and try saving again.',
          });
          return;
        } else if (createRoutingRule.__typename === 'QueueDoesNotExistError') {
          notificationApi.error({
            message:
              'The destination queue you selected does not exist. Please select a different queue and try again.',
          });
          return;
        }

        notificationApi.success({ message: 'Rule created successfully!' });
        setState({
          ...state,
          isReordering: false,
          orderedRules:
            routingRules?.map((it, index) =>
              editableRoutingRuleFromRoutingRule(
                it,
                index,
                it.itemTypes.map((it) => it.id),
                signals,
              ),
            ) ?? [],
          ruleIdsBeingEdited: ruleIdsBeingEdited.filter(
            (it) => it !== createRoutingRule.data.id,
          ),
        });
      },
      onError() {
        notificationApi.error({
          message: 'Rule creation failed. Please try again.',
        });
      },
    });
  const [updateRoutingRule, { loading: updateLoading }] =
    useGQLUpdateRoutingRuleMutation({
      onCompleted: ({ updateRoutingRule }) => {
        if (updateRoutingRule.__typename === 'RoutingRuleNameExistsError') {
          notificationApi.error({
            message:
              'There is already another rule with the same name. Please rename this rule and try saving again.',
          });
          return;
        } else if (updateRoutingRule.__typename === 'NotFoundError') {
          notificationApi.error({
            message: "We couldn't find a rule with this ID. Please try again.",
          });
          return;
        } else if (updateRoutingRule.__typename === 'QueueDoesNotExistError') {
          notificationApi.error({
            message:
              'The destination queue you selected does not exist. Please select a different queue and try again.',
          });
          return;
        }

        notificationApi.success({ message: 'Rule updated successfully!' });
        setState({
          ...state,
          isReordering: false,
          orderedRules:
            routingRules?.map((it, index) =>
              editableRoutingRuleFromRoutingRule(
                it,
                index,
                it.itemTypes.map((it) => it.id),
                signals,
              ),
            ) ?? [],
          ruleIdsBeingEdited: ruleIdsBeingEdited.filter(
            (it) => it !== updateRoutingRule.data.id,
          ),
        });
      },
      onError() {
        notificationApi.error({
          message: 'Rule update failed. Please try again.',
        });
      },
    });
  const [
    reorderRoutingRules,
    { loading: reorderLoading, reset: reorderReset },
  ] = useGQLReorderRoutingRulesMutation({
    onCompleted(data, clientOptions) {
      notificationApi.success({ message: 'Rules reordered successfully!' });
      reorderReset();
    },
    onError(error) {
      notificationApi.error({
        message: 'Setting rule order failed. Please try again.',
      });
      reorderReset();
      resetRules();
    },
  });
  const [deleteRule, { loading: deleteLoading, reset: deleteReset }] =
    useGQLDeleteRoutingRuleMutation({
      onCompleted(data, clientOptions) {
        notificationApi.success({ message: 'Rule deleted successfully!' });
      },
      onError(error) {
        notificationApi.error({
          message: 'Rule deletion failed. Please try again.',
        });
      },
    });

  const {
    appealsRoutingRules,
    routingRules,
    itemTypes = [],
    signals = [],
  } = data?.myOrg ?? {};
  const currentRoutingRules = isAppeals ? appealsRoutingRules : routingRules;

  const manualReviewQueues =
    data?.me?.reviewableQueues.filter((x) => x.isAppealsQueue === isAppeals) ??
    [];

  const setOrderedRules = (rules: readonly EditableRoutingRule[]) =>
    setState({
      ...state,
      orderedRules: rules,
    });
  const setIsReordering = (isReordering: boolean) =>
    setState({ ...state, isReordering });
  const setRuleEditingState = (ruleId: string, isEditing: boolean) =>
    setState((state) => ({
      ...state,
      ruleIdsBeingEdited: isEditing
        ? [...ruleIdsBeingEdited, ruleId]
        : ruleIdsBeingEdited.filter((it) => it !== ruleId),
    }));
  const setDeleteRuleId = (deleteRuleId: string | undefined) =>
    setState((state) => ({
      ...state,
      deleteRuleId,
    }));
  const resetRules = () =>
    setState((state) => ({
      ...state,
      isReordering: false,
      orderedRules:
        currentRoutingRules?.map((it, index) =>
          editableRoutingRuleFromRoutingRule(it, index, [], signals),
        ) ?? [],
    }));

  useEffect(() => {
    if (currentRoutingRules) {
      setState((state) => ({
        ...state,
        orderedRules: currentRoutingRules.map((it, index) =>
          editableRoutingRuleFromRoutingRule(
            it,
            index,
            it.itemTypes.map((it) => it.id),
            signals,
          ),
        ),
      }));
    }
  }, [currentRoutingRules, signals]);

  const isCreatingRule = ruleIdsBeingEdited.length > 0;

  const reorder = (
    list: readonly EditableRoutingRule[],
    startIndex: number,
    endIndex: number,
  ) => {
    const result = Array.from(list);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);

    return result;
  };

  const addNewRule = () => {
    const newRule = newEditableRoutingRule();
    setState((state) => ({
      ...state,
      orderedRules: [newRule, ...orderedRules],
      ruleIdsBeingEdited: [...ruleIdsBeingEdited, newRule.id],
    }));
  };

  const deleteModal = (
    <CoopModal
      title="Delete Rule"
      onClose={() => {
        deleteReset();
        setDeleteRuleId(undefined);
      }}
      visible={deleteRuleId != null}
      footer={[
        {
          title: 'Cancel',
          onClick: () => setDeleteRuleId(undefined),
          type: 'secondary',
        },
        {
          title: 'Delete',
          onClick: async () => {
            await deleteRule({
              variables: {
                input: { id: deleteRuleId!, isAppealsRule: isAppeals },
              },
              refetchQueries: [
                namedOperations.Query.ManualReviewQueueRoutingRules,
              ],
            });
            setDeleteRuleId(undefined);
          },
          disabled: deleteRuleId == null,
          type: 'primary',
        },
      ]}
    >
      {deleteLoading ? (
        <FullScreenLoading />
      ) : (
        'Are you sure you want to delete this?'
      )}
    </CoopModal>
  );

  const rulesSection = (
    <div className="flex flex-col">
      <DragDropContext
        onDragEnd={(result) => {
          if (!result.destination) {
            return;
          }

          const items = reorder(
            orderedRules,
            result.source.index,
            result.destination.index,
          );

          setOrderedRules(items);
        }}
      >
        <Droppable droppableId="list">
          {(provided) => (
            <div
              className="h-full"
              ref={provided.innerRef}
              {...provided.droppableProps}
            >
              {orderedRules.map((rule, index) =>
                deleteLoading ? (
                  <div
                    className="flex flex-col items-center justify-center"
                    key={rule.id}
                  >
                    <FullScreenLoading />
                  </div>
                ) : (
                  <Draggable
                    draggableId={rule.id}
                    key={rule.id}
                    index={index}
                    // Enable dragging only if the user is actively reordering,
                    // if it's a new rule (i.e. they hit the 'Create new routing
                    // rule' button), or it's a rule currently being edited
                    isDragDisabled={
                      !isReordering &&
                      !ruleIdsBeingEdited.includes(rule.id) &&
                      !rule.id.includes('unsaved_')
                    }
                  >
                    {(provided) => (
                      <div
                        key={`${rule.id}-container`}
                        {...provided.draggableProps}
                        ref={provided.innerRef}
                      >
                        <ManualReviewQueueRoutingRule
                          rule={rule}
                          isEditing={ruleIdsBeingEdited.includes(rule.id)}
                          setRuleEditingState={setRuleEditingState.bind(
                            null,
                            rule.id,
                          )}
                          itemTypes={itemTypes}
                          signals={signals}
                          queues={manualReviewQueues}
                          isReordering={isReordering}
                          isLoading={createLoading || updateLoading}
                          dragHandleProps={provided.dragHandleProps}
                          onClickSave={async (rule) => {
                            const rulePosition = orderedRules.findIndex(
                              (it) => it.id === rule.id,
                            );

                            if (
                              currentRoutingRules?.find(
                                (it) => it.id === rule.id,
                              )
                            ) {
                              await updateRoutingRule({
                                variables: {
                                  input: {
                                    id: rule.id,
                                    name: rule.name!,
                                    description: rule.description,
                                    conditionSet: serializeConditionSet(
                                      rule.conditionSet,
                                    ),
                                    destinationQueueId:
                                      rule.destinationQueue!.id,
                                    itemTypeIds: rule.itemTypeIds,
                                    status: 'LIVE',
                                    sequenceNumber:
                                      rulePosition !== -1 ? rulePosition : 0,
                                    isAppealsRule: isAppeals,
                                  },
                                },
                                refetchQueries: [
                                  namedOperations.Query
                                    .ManualReviewQueueRoutingRules,
                                ],
                              });
                            } else {
                              await createRoutingRule({
                                variables: {
                                  input: {
                                    name: rule.name!,
                                    description: rule.description,
                                    conditionSet: serializeConditionSet(
                                      rule.conditionSet,
                                    ),
                                    destinationQueueId:
                                      rule.destinationQueue!.id,
                                    itemTypeIds: rule.itemTypeIds,
                                    status: 'LIVE',
                                    sequenceNumber:
                                      rulePosition !== -1 ? rulePosition : 0,
                                    isAppealsRule: isAppeals,
                                  },
                                },
                                refetchQueries: [
                                  namedOperations.Query
                                    .ManualReviewQueueRoutingRules,
                                ],
                              });
                            }

                            setRuleEditingState(rule.id, false);
                          }}
                          onClickEdit={(rule) => {
                            setRuleEditingState(rule.id, true);
                          }}
                          onClickCancel={(rule) =>
                            setState({
                              ...state,
                              isReordering: false,
                              orderedRules:
                                routingRules?.map((it, index) =>
                                  editableRoutingRuleFromRoutingRule(
                                    it,
                                    index,
                                    it.itemTypes.map((it) => it.id),
                                    signals,
                                  ),
                                ) ?? [],
                              ruleIdsBeingEdited: ruleIdsBeingEdited.filter(
                                (it) => it !== rule.id,
                              ),
                            })
                          }
                          onClickDelete={async () => setDeleteRuleId(rule.id)}
                        />
                      </div>
                    )}
                  </Draggable>
                ),
              )}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
      <ManualReviewQueueDefaultRoutingRule showHandle={isReordering} />
    </div>
  );

  const reorderComponent = (() => {
    // No need to allow reordering if there's only a single rule
    if (orderedRules.length < 2) {
      return null;
    }

    if (isReordering) {
      return (
        <>
          {notificationContextHolder}
          <ManualReviewQueueRoutingSaveButtonPanel
            loading={reorderLoading}
            onClickSave={async () => {
              await reorderRoutingRules({
                variables: {
                  input: {
                    order: orderedRules.map((rule) => rule.id),
                    isAppealsRule: isAppeals,
                  },
                },
              });
              setIsReordering(false);
            }}
            onCancel={() =>
              setState({
                ...state,
                isReordering: false,
                orderedRules:
                  routingRules?.map((it, index) =>
                    editableRoutingRuleFromRoutingRule(
                      it,
                      index,
                      it.itemTypes.map((it) => it.id),
                      signals,
                    ),
                  ) ?? [],
              })
            }
            saveButtonTitle="Save Order"
          />
        </>
      );
    } else if (reorderLoading) {
      return (
        <>
          <FullScreenLoading size="small" />
          {notificationContextHolder}
        </>
      );
    }

    return (
      <CoopButton
        onClick={() => setIsReordering(true)}
        title="Reorder Rules"
        type="secondary"
      />
    );
  })();

  return (
    <div className="flex flex-col text-start">
      <Helmet>
        <title>Routing</title>
      </Helmet>
      {loading && (
        <div className="mt-24">
          <FullScreenLoading />
        </div>
      )}
      <div className="mt-3">
        {!loading && !error && !isCreatingRule ? (
          <div
            className={`flex flex-row items-end mb-4 gap-3 ${
              isReordering ? 'justify-between' : 'justify-start'
            }`}
          >
            {isReordering ? null : (
              <CoopButton
                title="Create new Routing Rule"
                onClick={addNewRule}
              />
            )}
            {reorderComponent}
          </div>
        ) : null}
        {rulesSection}
      </div>
      {deleteModal}
      {notificationContextHolder}
    </div>
  );
}
