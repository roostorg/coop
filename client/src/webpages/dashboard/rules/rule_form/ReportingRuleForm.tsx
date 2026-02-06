import { ReactComponent as CopyAlt } from '@/icons/lni/Web and Technology/copy-alt.svg';
import { ReactComponent as TrashCan } from '@/icons/lni/Web and Technology/trash-can.svg';
import { PlusOutlined } from '@ant-design/icons';
import { gql } from '@apollo/client';
import { Button, Form, Radio, Select, Tooltip } from 'antd';
import { useForm } from 'antd/lib/form/Form';
import { useMemo, useReducer } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useParams } from 'react-router-dom';

import FullScreenLoading from '../../../../components/common/FullScreenLoading';
import { selectFilterByLabelOption } from '../../components/antDesignUtils';
import CoopButton from '../../components/CoopButton';
import CoopModal from '../../components/CoopModal';
import { CoopModalFooterButtonProps } from '../../components/CoopModalFooter';
import FormHeader from '../../components/FormHeader';
import FormSectionHeader from '../../components/FormSectionHeader';
import NameDescriptionInput from '../../components/NameDescriptionInput';
import PolicyDropdown from '../../components/PolicyDropdown';
import SubmitButton from '../../components/SubmitButton';

import {
  GQLAction,
  GQLConditionConjunction,
  GQLReportingRuleStatus,
  GQLUserPermission,
  useGQLCreateReportingRuleMutation,
  useGQLDeleteReportingRuleMutation,
  useGQLReportingRuleFormOrgDataQuery,
  useGQLReportingRuleQuery,
  useGQLUpdateReportingRuleMutation,
} from '../../../../graphql/generated';
import { CoreSignal } from '../../../../models/signal';
import { userHasPermissions } from '../../../../routing/permissions';
import useRouteQueryParams from '../../../../routing/useRouteQueryParams';
import { ModalInfo } from '../../types/ModalInfo';
import { REPORTING_RULES_QUERY } from '../dashboard/ReportingRulesDashboard';
import {
  ConditionInput,
  RuleFormConditionSet,
  RuleFormLeafCondition,
} from '../types';
import {
  reducer,
  ReportingRuleFormOrgDataResponse,
  ReportingRuleFormReducerActionType,
} from './ReportingRuleFormReducers';
import {
  ACTION_FRAGMENT,
  CONDITION_SET_FRAGMENT,
  DERIVED_FIELDS_FRAGMENT,
  ITEM_TYPE_FRAGMENT,
  SIGNALS_FRAGMENT,
  VisibleSections,
} from './RuleForm';
import RuleFormCondition from './RuleFormCondition';
import {
  containsInvalidThreshold,
  getInvalidRegexesInCondition,
  hasNestedConditionSets,
  isConditionComplete,
  ruleHasValidConditions,
  serializeConditionSet,
} from './RuleFormUtils';

const { Option } = Select;

const REPORTING_RULE_FIELD_FRAGMENT = gql`
  fragment ReportingRuleFormRuleFieldsFragment on ReportingRule {
    __typename
    id
    name
    description
    status
    policies {
      id
    }
    conditionSet {
      ...ConditionSetFields
    }
    actions {
      ... on CustomAction {
        id
        name
        description
        itemTypes {
          ... on ItemTypeBase {
            id
            name
          }
        }
      }
      ... on EnqueueToMrtAction {
        id
        name
        description
        itemTypes {
          ... on ItemTypeBase {
            id
            name
          }
        }
      }
      ... on EnqueueToNcmecAction {
        id
        name
        description
        itemTypes {
          ... on ItemTypeBase {
            id
            name
          }
        }
      }
      ... on EnqueueAuthorToMrtAction {
        id
        name
        description
        itemTypes {
          ... on ItemTypeBase {
            id
            name
          }
        }
      }
    }
  }
`;

const REPORTING_RULE_QUERY = gql`
  ${CONDITION_SET_FRAGMENT}
  ${DERIVED_FIELDS_FRAGMENT}
  ${REPORTING_RULE_FIELD_FRAGMENT}
  ${ITEM_TYPE_FRAGMENT}
  query ReportingRule($id: ID!) {
    reportingRule(id: $id) {
      ...ReportingRuleFormRuleFieldsFragment
      itemTypes {
        ... on ItemTypeBase {
          ...ItemTypeFragment
        }
      }
    }
  }
`;

gql`
  ${DERIVED_FIELDS_FRAGMENT}
  ${SIGNALS_FRAGMENT}
  ${ITEM_TYPE_FRAGMENT}
  ${ACTION_FRAGMENT}
  query ReportingRuleFormOrgData {
    myOrg {
      policies {
        id
        name
        parentId
      }
      itemTypes {
        ... on ItemTypeBase {
          ...ItemTypeFragment
        }
      }
      signals {
        ...SignalsFragment
      }
      actions {
        ...ActionFragment
      }
    }
    me {
      permissions
    }
  }
`;

export const initialState = {
  ruleName: '',
  ruleDescription: '',
  selectedItemTypes: [] as ReportingRuleFormOrgDataResponse['itemTypes'],
  // This is a map that allows us to group inputs by type
  // when we display them in the dropdown. It contains
  // all inputs that are selectable in the Input dropdown
  // based on the selected item types
  eligibleInputs: new Map<string, ConditionInput[]>(),
  // This contains all actions that are selectable in the
  // Actions dropdown based on the selected item types
  eligibleActions: [] as Pick<GQLAction, 'id' | 'name'>[],
  conditionSet: {
    conjunction: GQLConditionConjunction.Or,
    conditions: [{}],
  } as RuleFormConditionSet,
  policyIds: [] as string[],
  modalInfo: {
    visible: false,
    title: '',
    body: '',
    okText: 'OK',
    onOk: () => {},
    okIsDangerButton: false,
    cancelVisible: false,
  } as ModalInfo,
  submitButtonLoading: false,
  statusModalVisible: false,
  ruleMutationError: false,
  lastVisibleSection: VisibleSections.BASIC_INFO,
};
export type ReportingRuleFormState = typeof initialState;

export default function RuleForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const queryParams = useRouteQueryParams();

  const duplicateId = queryParams.get('duplicate_id');

  const {
    data: ruleQueryData,
    loading: ruleQueryLoading,
    error: ruleQueryError,
  } = useGQLReportingRuleQuery({
    // cast below safe because of the skip
    variables: { id: (id ?? duplicateId) as string },
    skip: !(id ?? duplicateId),
  });
  const rule = ruleQueryData?.reportingRule;

  const {
    loading: reportingRuleFormOrgDataQueryLoading,
    error: reportingRuleFormOrgDataQueryError,
    data: reportingRuleFormOrgDataQueryData,
  } = useGQLReportingRuleFormOrgDataQuery();

  const allItemTypes = useMemo(
    () => reportingRuleFormOrgDataQueryData?.myOrg?.itemTypes ?? [],
    [reportingRuleFormOrgDataQueryData],
  );

  const permissions = reportingRuleFormOrgDataQueryData?.me?.permissions;
  const allActions = useMemo(
    () => reportingRuleFormOrgDataQueryData?.myOrg?.actions ?? [],
    [reportingRuleFormOrgDataQueryData],
  );
  const allSignals = useMemo(
    () => reportingRuleFormOrgDataQueryData?.myOrg?.signals ?? [],
    [reportingRuleFormOrgDataQueryData],
  );
  const policies = reportingRuleFormOrgDataQueryData?.myOrg?.policies;

  const onHideModal = () =>
    dispatch({ type: ReportingRuleFormReducerActionType.HideModal });

  const [deleteRule] = useGQLDeleteReportingRuleMutation({
    onError: () => {},
    onCompleted: () => {
      onHideModal();
      navigate('/dashboard/rules/report');
    },
  });

  const [state, dispatch] = useReducer(reducer, initialState);

  const [form] = useForm();

  const onDeleteRule = (id: string) => {
    deleteRule({
      variables: { id },
      refetchQueries: [{ query: REPORTING_RULES_QUERY }],
    });
  };

  /**
   * If the user is editing an existing rule, then once the
   * RULE_QUERY has finished, we need to update the overall state
   * so that each input field is populated with the right content
   */
  useMemo(() => {
    if (rule != null && allItemTypes.length > 0 && allSignals) {
      dispatch({
        type: ReportingRuleFormReducerActionType.RuleQueryCompleted,
        payload: {
          selectedItemTypes: rule.itemTypes,
          allActions,
          conditionSet: rule.conditionSet,
          allSignals: allSignals satisfies readonly CoreSignal[],
          policyIds: rule.policies.map((it) => it.id),
        },
      });
    }
  }, [rule, allItemTypes.length, allSignals, allActions]);

  const showRuleMutationError = (isUpdate: boolean) => {
    dispatch({
      type: ReportingRuleFormReducerActionType.ShowModal,
      payload: {
        modalInfo: {
          ...state.modalInfo,
          title: isUpdate ? 'Error Updating Rule' : 'Error Creating Rule',
          body: 'We encountered an error trying to create your Rule. Please try again.',
          okText: 'OK',
          onOk: onHideModal,
          okIsDangerButton: false,
          cancelVisible: false,
        },
      },
    });
  };

  const showMutationSuccessModal = (
    isUpdate: boolean,
    dataReturned: boolean,
  ) => {
    const modalInfo = {
      ...state.modalInfo,
      title: isUpdate ? 'Rule Updated' : 'Rule Created',
      body: isUpdate
        ? 'Your rule was successfully updated!'
        : 'Your rule was successfully created!',
      okText: 'OK',
      onOk: () => {
        onHideModal();
        if (dataReturned) {
          navigate('/dashboard/rules/report');
        }
      },
      okIsDangerButton: false,
      cancelVisible: false,
    };
    dispatch({
      type: ReportingRuleFormReducerActionType.ShowModal,
      payload: {
        modalInfo,
      },
    });
  };

  const showUpdateRuleCaughtErrorModal = (
    isUpdate: boolean,
    errorName: 'NotFoundError' | 'ReportingRuleNameExistsError',
  ) => {
    dispatch({
      type: ReportingRuleFormReducerActionType.ShowModal,
      payload: {
        modalInfo: {
          ...state.modalInfo,
          title: isUpdate ? 'Error Creating Rule' : 'Error Updating Rule',
          body: (() => {
            switch (errorName) {
              case 'ReportingRuleNameExistsError': {
                return 'A Report Rule already exists with this name.';
              }
              case 'NotFoundError': {
                return 'We encountered an error trying to update your rule. Please try again.';
              }
            }
          })(),
          okText: 'OK',
          onOk: onHideModal,
          okIsDangerButton: false,
          cancelVisible: false,
        },
      },
    });
  };

  const [createRule] = useGQLCreateReportingRuleMutation({
    onError: (error) => {
      showRuleMutationError(false);
    },
    onCompleted: (result) => {
      switch (result.createReportingRule.__typename) {
        case 'MutateReportingRuleSuccessResponse': {
          const { data } = result.createReportingRule;
          showMutationSuccessModal(false, data != null);
          break;
        }
        case 'ReportingRuleNameExistsError': {
          showUpdateRuleCaughtErrorModal(
            false,
            result.createReportingRule.__typename,
          );
          break;
        }
      }
    },
  });

  const [updateRule] = useGQLUpdateReportingRuleMutation({
    onError: (error) => {
      showRuleMutationError(true);
    },
    onCompleted: (result) => {
      switch (result.updateReportingRule.__typename) {
        case 'MutateReportingRuleSuccessResponse': {
          const { data } = result.updateReportingRule;
          showMutationSuccessModal(true, data != null);
          break;
        }
        case 'ReportingRuleNameExistsError':
        case 'NotFoundError': {
          showUpdateRuleCaughtErrorModal(
            true,
            result.updateReportingRule.__typename,
          );
          break;
        }
      }
    },
  });

  if (reportingRuleFormOrgDataQueryError || ruleQueryError) {
    throw reportingRuleFormOrgDataQueryError ?? ruleQueryError!;
  }
  if (reportingRuleFormOrgDataQueryLoading || ruleQueryLoading) {
    return <FullScreenLoading />;
  }

  const canEditLiveRules = userHasPermissions(permissions, [
    GQLUserPermission.MutateLiveRules,
  ]);
  const canEditNonLiveRules = userHasPermissions(permissions, [
    GQLUserPermission.MutateNonLiveRules,
  ]);

  const onCreateRule = async (values: any) => {
    dispatch({ type: ReportingRuleFormReducerActionType.DisableSubmitButton });
    createRule({
      variables: {
        input: {
          name: state.ruleName,
          description: state.ruleDescription,
          status: values.status,
          itemTypeIds: values.itemTypes,
          conditionSet: serializeConditionSet(state.conditionSet),
          actionIds: values.actions,
          policyIds: state.policyIds,
        },
      },
      refetchQueries: [{ query: REPORTING_RULES_QUERY }],
    });
  };

  const onUpdateRule = async (values: any) => {
    dispatch({ type: ReportingRuleFormReducerActionType.DisableSubmitButton });
    updateRule({
      variables: {
        input: {
          // Okay to assert since to update a rule there needs to be
          // a current rule ID in the first place
          id: id!,
          name: state.ruleName,
          description: state.ruleDescription,
          status: values.status,
          itemTypeIds: values.itemTypes,
          conditionSet: serializeConditionSet(state.conditionSet),
          actionIds: values.actions,
          policyIds: state.policyIds,
        },
      },
      refetchQueries: [
        { query: REPORTING_RULES_QUERY },
        { query: REPORTING_RULE_QUERY, variables: { id } },
      ],
    });
  };

  const onUpdateItemTypes = (typeIDsMixed: string | string[]) => {
    // Explicitly convert to array because JS typechecker isn't great
    let selectedTypeIDs: string[] = [];
    if (!Array.isArray(typeIDsMixed)) {
      selectedTypeIDs = [typeIDsMixed];
    } else {
      selectedTypeIDs = typeIDsMixed;
    }

    dispatch({
      type: ReportingRuleFormReducerActionType.UpdateItemTypes,
      payload: {
        selectedItemTypes: selectedTypeIDs.map(
          (id) => allItemTypes.find((itemType) => itemType.id === id)!,
        ),
        allActions,
        allSignals: allSignals satisfies readonly CoreSignal[],
        form,
      },
    });
  };

  const itemTypeSection = (
    <div className="flex flex-col justify-start">
      <FormSectionHeader
        title="Item Types"
        subtitle="Select the item types that your Reporting Rule will run on when those items are reported"
      />
      <Form.Item
        label=""
        name="itemTypes"
        style={{ width: '25%' }}
        initialValue={rule?.itemTypes?.map((itemType) => itemType.id)}
        rules={[
          {
            required: true,
            message: 'Please select at least one Item Type',
          },
        ]}
      >
        <Select
          mode="multiple"
          placeholder="Select item types"
          allowClear
          showSearch
          filterOption={selectFilterByLabelOption}
          dropdownMatchSelectWidth={false}
          onChange={onUpdateItemTypes}
        >
          {[...allItemTypes]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((itemType) => (
              <Option
                key={itemType.id}
                value={itemType.id}
                label={itemType.name}
              >
                {itemType.name}
              </Option>
            ))}
        </Select>
      </Form.Item>
    </div>
  );

  const renderConditionSet = (
    conditionSet: RuleFormConditionSet,
    conditionSetIndex: number,
    parentConditionSet?: RuleFormConditionSet,
  ) => {
    if (hasNestedConditionSets(conditionSet)) {
      const conditions = conditionSet.conditions;
      return conditions.map((nestedConditionSet, index) => (
        <div key={index}>
          {renderConditionSet(nestedConditionSet, index, conditionSet)}
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

    return (
      <div
        className="p-4 bg-white border border-gray-200 border-solid rounded-lg relative"
        key={`set_${conditionSetIndex}`}
      >
        {conditionSet.conditions.map((condition, conditionIndex) => (
          <RuleFormCondition
            key={`condition_${conditionSetIndex}_${conditionIndex}`}
            condition={condition as RuleFormLeafCondition}
            location={{ conditionIndex, conditionSetIndex }}
            parentConditionSet={conditionSet}
            eligibleInputs={state.eligibleInputs}
            selectedItemTypes={state.selectedItemTypes}
            allSignals={allSignals}
            onUpdateInput={(input, signals) =>
              dispatch({
                type: ReportingRuleFormReducerActionType.UpdateInput,
                payload: {
                  location: { conditionIndex, conditionSetIndex },
                  input,
                  allSignals: signals,
                },
              })
            }
            onUpdateSignal={(signal) =>
              dispatch({
                type: ReportingRuleFormReducerActionType.UpdateSignal,
                payload: {
                  location: { conditionIndex, conditionSetIndex },
                  signal,
                },
              })
            }
            onUpdateSignalArgs={(args) =>
              dispatch({
                type: ReportingRuleFormReducerActionType.UpdateSignalArgs,
                payload: {
                  location: { conditionIndex, conditionSetIndex },
                  args,
                },
              })
            }
            onUpdateSignalSubcategory={(subcategory) =>
              dispatch({
                type: ReportingRuleFormReducerActionType.UpdateSignalSubcategory,
                payload: {
                  location: { conditionIndex, conditionSetIndex },
                  subcategory,
                },
              })
            }
            onUpdateMatchingValues={(matchingValues) =>
              dispatch({
                type: ReportingRuleFormReducerActionType.UpdateMatchingValues,
                payload: {
                  location: { conditionIndex, conditionSetIndex },
                  matchingValues,
                },
              })
            }
            onUpdateConditionComparator={(comparator) =>
              dispatch({
                type: ReportingRuleFormReducerActionType.UpdateComparator,
                payload: {
                  location: { conditionIndex, conditionSetIndex },
                  comparator,
                },
              })
            }
            onUpdateThreshold={(threshold) =>
              dispatch({
                type: ReportingRuleFormReducerActionType.UpdateThreshold,
                payload: {
                  location: { conditionIndex, conditionSetIndex },
                  threshold,
                },
              })
            }
            onDeleteCondition={() =>
              dispatch({
                type: ReportingRuleFormReducerActionType.DeleteCondition,
                payload: {
                  location: { conditionIndex, conditionSetIndex },
                },
              })
            }
            onUpdateNestedConditionSetConjunction={(conjunction) =>
              dispatch({
                type: ReportingRuleFormReducerActionType.UpdateNestedConditionSetConjunction,
                payload: {
                  conjunction,
                },
              })
            }
          />
        ))}
        <div className="flex mt-4 items-center gap-4">
          <Button
            shape="circle"
            type="default"
            icon={<PlusOutlined />}
            onClick={() =>
              dispatch({
                type: ReportingRuleFormReducerActionType.AddCondition,
                payload: {
                  conditionSetIndex,
                },
              })
            }
          />
          {canDeleteConditionSet && (
            <Button
              type="default"
              danger
              onClick={() =>
                dispatch({
                  type: ReportingRuleFormReducerActionType.DeleteConditionSet,
                  payload: {
                    conditionSetIndex,
                  },
                })
              }
            >
              Delete Condition Set
            </Button>
          )}
        </div>
      </div>
    );
  };

  const renderTopLevelConjunction = (conjunction: GQLConditionConjunction) => {
    return (
      <div className="flex items-center">
        <div className="flex flex-col items-center w-10 py-2 pl-16">
          <div className="w-px h-4 m-1 bg-black" />
          <Select
            style={{ paddingTop: 8, paddingBottom: 8 }}
            defaultValue={conjunction}
            value={conjunction}
            dropdownMatchSelectWidth={false}
            onSelect={(value: GQLConditionConjunction) =>
              dispatch({
                type: ReportingRuleFormReducerActionType.UpdateTopLevelConjunction,
                payload: {
                  conjunction: value,
                },
              })
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
          <div className="w-px h-4 m-1 bg-black" />
        </div>
      </div>
    );
  };

  const divider = <div className="mt-5 divider mb-9" />;

  const nextSectionButton = (
    <Form.Item shouldUpdate>
      {() => {
        const nextButtonEnabled = (() => {
          switch (state.lastVisibleSection) {
            case VisibleSections.BASIC_INFO: {
              return (
                state.selectedItemTypes.length > 0 && state.ruleName.length > 0
              );
            }
            case VisibleSections.CONDITIONS: {
              return state.conditionSet.conditions.every(isConditionComplete);
            }
            case VisibleSections.ACTIONS_AND_METADATA: {
              // This button should never be used at this point,
              // since we have the submit button instead
              return false;
            }
          }
        })();

        return (
          <div className="flex flex-col items-end justify-end">
            {nextButtonEnabled && (
              <div className="mb-4 text-base font-medium text-primary">
                {state.lastVisibleSection === VisibleSections.BASIC_INFO
                  ? "Next, configure your Rule's conditions"
                  : 'Finally, select which Action(s) your Rule should trigger'}
              </div>
            )}
            <CoopButton
              title="Continue"
              size="large"
              disabled={!nextButtonEnabled}
              onClick={() =>
                dispatch({
                  type: ReportingRuleFormReducerActionType.ShowNextVisibleSection,
                })
              }
            />
          </div>
        );
      }}
    </Form.Item>
  );

  const basicInfoSection = (
    <div className="flex flex-col gap-4">
      <NameDescriptionInput
        nameInitialValue={
          duplicateId != null && rule != null
            ? `COPY: ${rule?.name}`
            : rule?.name
        }
        descriptionInitialValue={rule?.description ?? undefined}
        onChangeName={(name) =>
          dispatch({
            type: ReportingRuleFormReducerActionType.UpdateRuleName,
            payload: { name },
          })
        }
        onChangeDescription={(description) =>
          dispatch({
            type: ReportingRuleFormReducerActionType.UpdateRuleDescription,
            payload: { description },
          })
        }
      />
      {itemTypeSection}
      {state.lastVisibleSection === VisibleSections.BASIC_INFO
        ? nextSectionButton
        : divider}
    </div>
  );

  const conditionsSection = (
    <div>
      <div className="flex flex-col">
        <FormSectionHeader
          title="Conditions"
          subtitle="Define your Rule's conditions. If all these conditions are met, then your Action(s) that you select below will be executed."
        />
        <div className="flex flex-col mt-2">
          {renderConditionSet(state.conditionSet, 0)}
        </div>
        <div>
          <Button
            type="default"
            className="block mt-4 mb-6 text-base font-medium rounded-lg text-slate-500"
            onClick={() =>
              dispatch({
                type: ReportingRuleFormReducerActionType.AddConditionSet,
              })
            }
            icon={<PlusOutlined className="mt-1" />}
          >
            Add Condition Set
          </Button>
        </div>
      </div>
      {state.lastVisibleSection === VisibleSections.CONDITIONS
        ? nextSectionButton
        : divider}
    </div>
  );

  const actionsSection = (
    <div className="flex flex-col justify-start">
      <FormSectionHeader
        title="Actions"
        subtitle="Select the actions that will get executed if all the conditions above are met."
      />
      <Form.Item
        label=""
        name="actions"
        style={{ width: '25%' }}
        initialValue={rule?.actions?.map((action) => action.id) ?? []}
        rules={[
          { required: true, message: 'Please select at least one Action' },
        ]}
      >
        <Select
          mode="multiple"
          placeholder="Select actions"
          allowClear
          showSearch
          filterOption={selectFilterByLabelOption}
          dropdownMatchSelectWidth={false}
          onSelect={() => {
            dispatch({
              type: ReportingRuleFormReducerActionType.HideRuleMutationError,
            });
          }}
          dropdownRender={(menu) => {
            if (state.selectedItemTypes.length > 0) {
              return menu;
            }
            return (
              <div className="p-2">
                <div className="text-coop-alert-red">
                  Please select at least one item type first
                </div>
                {menu}
              </div>
            );
          }}
        >
          {[...(state.eligibleActions ?? [])]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((action) => (
              <Option key={action.id} value={action.id} label={action.name}>
                {action.name}
              </Option>
            ))}
        </Select>
      </Form.Item>
    </div>
  );

  const policiesSection = (
    <div className="flex flex-col justify-start">
      <FormSectionHeader
        title="Policies"
        subtitle="Assign this rule to the policy (or policies) to which it corresponds. This is useful for measuring how well you're enforcing each policy."
      />
      <Form.Item
        label=""
        name="policies"
        style={{ width: '25%' }}
        initialValue={state.policyIds}
      >
        <PolicyDropdown
          policies={policies ?? []}
          placeholder="Select policies"
          onChange={(values) =>
            dispatch({
              type: ReportingRuleFormReducerActionType.UpdatePolicies,
              payload: {
                policyIds: values,
              },
            })
          }
          selectedPolicyIds={state.policyIds}
          multiple={true}
        />
      </Form.Item>
    </div>
  );

  const statusSection = (
    <div className="flex flex-col justify-start">
      <FormSectionHeader
        title="Status"
        subtitle={
          <span className="mb-4 text-zinc-900">
            Select the status of your Rule. See details about what each status
            means{' '}
            <Button
              className="!p-0 !font-medium"
              type="link"
              onClick={() =>
                dispatch({
                  type: ReportingRuleFormReducerActionType.ShowStatusModal,
                })
              }
            >
              here
            </Button>
            .
          </span>
        }
      />
      <Form.Item
        className="w-3/5"
        label=""
        name="status"
        initialValue={rule?.status ?? GQLReportingRuleStatus.Draft}
      >
        <Radio.Group className="w-full" onChange={() => {}} value={null}>
          <div className="flex flex-col items-start w-full pl-2 gap-1">
            <Radio
              className="font-medium text-slate-900"
              value={GQLReportingRuleStatus.Draft}
            >
              Draft
            </Radio>
            <Radio
              className="font-medium text-slate-900"
              value={GQLReportingRuleStatus.Background}
            >
              Background
            </Radio>
            {canEditLiveRules ? (
              <Radio
                className="font-medium text-slate-900"
                value={GQLReportingRuleStatus.Live}
              >
                Live
              </Radio>
            ) : (
              <Tooltip title="To edit Live rules, ask your organization's admin to upgrade your role to Rules Manager or Admin.">
                <Radio
                  className="font-medium text-slate-900"
                  value={GQLReportingRuleStatus.Live}
                  disabled={true}
                >
                  Live
                </Radio>
              </Tooltip>
            )}
            {id ? (
              <Radio
                className="font-medium text-slate-900"
                value={GQLReportingRuleStatus.Archived}
              >
                Archived
              </Radio>
            ) : null}
          </div>
        </Radio.Group>
      </Form.Item>
    </div>
  );

  const statusModal = (
    <CoopModal
      visible={state.statusModalVisible}
      onClose={() =>
        dispatch({ type: ReportingRuleFormReducerActionType.HideStatusModal })
      }
    >
      <div className="gap-3 max-w-96">
        <FormSectionHeader
          title="Draft"
          subtitle="Draft rules are rules that are not fully configured or ready to be run on content."
        />
        <FormSectionHeader
          title="Background"
          subtitle="Background rules are deployed and running on all reported content sent to Coop, but they don't actually apply any Actions. Instead, we just log the Actions we would have applied if the rule was Live so that you can analyze those logs later."
        />
        <FormSectionHeader
          title="Live"
          subtitle="Live rules are fully deployed and running on all reported content sent to Coop."
        />
      </div>
    </CoopModal>
  );

  const createButton = (
    <Form.Item shouldUpdate>
      {() => {
        const actionsSelected = Boolean(form.getFieldValue('actions')?.length);

        const hasInvalidThreshold = containsInvalidThreshold(
          state.conditionSet,
        );

        // NB: We don't want to allow users to create content rules that only contain
        // conditions based on user signals, because those should be user-only rules
        // rather than content rules. This is important because user-only rules are
        // run at set time intervals, whereas content rules are run for every piece
        // of ingested content, and it's massively inefficient to run rules based solely
        // on user signals for every piece of content.
        const conditionsValid = ruleHasValidConditions(state.conditionSet);

        return (
          <div className="flex justify-end">
            <SubmitButton
              title={id == null ? 'Create Rule' : 'Save Changes'}
              disabled={
                !canEditNonLiveRules ||
                state.ruleMutationError ||
                (rule?.status === GQLReportingRuleStatus.Live &&
                  !canEditLiveRules) ||
                !actionsSelected ||
                hasInvalidThreshold ||
                !conditionsValid
              }
              loading={state.submitButtonLoading}
              submitsForm={true}
              error={state.ruleMutationError}
              showDisabledTooltip={
                !canEditNonLiveRules ||
                (rule?.status === GQLReportingRuleStatus.Live &&
                  !canEditLiveRules) ||
                !actionsSelected ||
                hasInvalidThreshold ||
                !conditionsValid
              }
              disabledTooltipTitle={
                !canEditLiveRules
                  ? "To edit Live rules, ask your organization's admin to upgrade your role to Rules Manager or Admin."
                  : !canEditNonLiveRules
                    ? "To edit rules, ask your organization's admin to upgrade your role to Rules Manager or Admin."
                    : !actionsSelected
                      ? 'Please select at least one action.'
                      : hasInvalidThreshold
                        ? 'At least one threshold has an invalid input.'
                        : !conditionsValid
                          ? 'This rule only has user-based conditions, but rules must contain at least one content-based condition.'
                          : undefined
              }
              disabledTooltipPlacement="bottomLeft"
            />
          </div>
        );
      }}
    </Form.Item>
  );

  const modalFooter: CoopModalFooterButtonProps[] = [
    {
      title: state.modalInfo.okText,
      type: state.modalInfo.okIsDangerButton ? 'danger' : 'primary',
      onClick: state.modalInfo.onOk,
    },
  ];
  if (state.modalInfo.cancelVisible) {
    modalFooter.unshift({
      title: 'Cancel',
      onClick: onHideModal,
      type: state.modalInfo.okIsDangerButton ? 'primary' : 'secondary',
    });
  }

  const modal = (
    <CoopModal
      title={state.modalInfo.title}
      visible={state.modalInfo.visible}
      onClose={onHideModal}
      footer={modalFooter}
    >
      {state.modalInfo.body}
    </CoopModal>
  );

  const actionsAndMetadataSection = (
    <div>
      {actionsSection}
      {divider}
      {policiesSection}
      {divider}
      {statusSection}
      {divider}
      {createButton}
    </div>
  );

  return (
    <div className="flex flex-col test-start">
      <Helmet>
        <title>
          {id == null ? 'Create Report Rule' : 'Update Report Rule'}
        </title>
      </Helmet>
      <div className="flex justify-between">
        <div className="flex flex-col justify-between w-full">
          <FormHeader
            title={(() => {
              return id == null ? 'Create Report Rule' : 'Update Report Rule';
            })()}
            // topRightButton={ruleTypeSelector}
          />
          {id == null ||
          canEditLiveRules ||
          rule?.status !== GQLReportingRuleStatus.Live ? null : (
            <div className="text-base italic">
              Note: You do not have permission to edit this rule because it is
              Live. To edit Live rules, ask your organization's administrator to
              grant you permission by upgrading your role to Rules Manager or
              Admin.
            </div>
          )}
        </div>
        {id == null ? null : (
          <div className="flex items-start gap-2">
            <CoopButton
              title="See Insights"
              destination={`/dashboard/rules/report/info/${id}`}
              size="small"
            />
            <CoopButton
              icon={CopyAlt}
              onClick={() => {
                navigate(`/dashboard/rules/report/form?duplicate_id=${id}`);
                // See https://github.com/roostorg/coop/pull/3803#discussion_r1643632962
                navigate(0);
              }}
              size="small"
              type="secondary"
              tooltipTitle="Duplicate Rule"
            />
            <CoopButton
              icon={TrashCan}
              onClick={() =>
                dispatch({
                  type: ReportingRuleFormReducerActionType.ShowModal,
                  payload: {
                    modalInfo: {
                      ...state.modalInfo,
                      title: rule
                        ? `Delete ${rule.name}`
                        : 'Delete Report Rule',
                      body: "Are you sure you want to delete this report rule? You can't undo this action.",
                      onOk: () => {
                        onDeleteRule(id);
                        onHideModal();
                      },
                      okText: 'Delete',
                      okIsDangerButton: true,
                      cancelVisible: true,
                    },
                  },
                })
              }
              size="small"
              type="danger"
              tooltipTitle="Delete Rule"
            />
          </div>
        )}
      </div>
      <Form
        form={form}
        initialValues={{ remember: true }}
        layout="vertical"
        name="rule_form"
        requiredMark={false}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
          }
        }}
        onFinish={(values) => {
          const invalidRegexes = getInvalidRegexesInCondition(
            state.conditionSet,
          );
          if (invalidRegexes.length > 0) {
            dispatch({
              type: ReportingRuleFormReducerActionType.ShowModal,
              payload: {
                modalInfo: {
                  ...state.modalInfo,
                  title: 'Rule Validation Failed',
                  body:
                    invalidRegexes.length > 0
                      ? `"${invalidRegexes.join(
                          ', ',
                        )}" are not valid regular expressions. Please check the syntax.`
                      : `"${invalidRegexes[0]}" is not a valid regular expression. Please check the syntax.`,
                  onOk: onHideModal,
                  okText: 'OK',
                  okIsDangerButton: false,
                  cancelVisible: false,
                },
              },
            });
            return;
          }

          if (id == null) {
            onCreateRule(values);
          } else {
            onUpdateRule(values);
          }
        }}
        onFinishFailed={(_errorInfo) => {
          dispatch({
            type: ReportingRuleFormReducerActionType.ShowRuleMutationError,
          });
        }}
      >
        {basicInfoSection}
        {state.lastVisibleSection >= VisibleSections.CONDITIONS &&
          conditionsSection}
        {state.lastVisibleSection >= VisibleSections.ACTIONS_AND_METADATA &&
          actionsAndMetadataSection}
        {statusModal}
      </Form>
      {modal}
    </div>
  );
}
