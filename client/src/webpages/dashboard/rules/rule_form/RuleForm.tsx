import { Label } from '@/coop-ui/Label';
import { Switch } from '@/coop-ui/Switch';
import { ReactComponent as CopyAlt } from '@/icons/lni/Web and Technology/copy-alt.svg';
import { ReactComponent as TrashCan } from '@/icons/lni/Web and Technology/trash-can.svg';
import { DownOutlined, PlusOutlined, UpOutlined } from '@ant-design/icons';
import { gql } from '@apollo/client';
import { Button, DatePicker, Form, Input, Radio, Select, Tooltip } from 'antd';
import { useForm } from 'antd/lib/form/Form';
import moment, { Moment } from 'moment';
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
  GQLRuleStatus,
  GQLUserPermission,
  useGQLContentRuleFormConfigQuery,
  useGQLCreateContentRuleMutation,
  useGQLCreateUserRuleMutation,
  useGQLDeleteRuleMutation,
  useGQLMatchingBankIdsQuery,
  useGQLRuleQuery,
  useGQLUpdateContentRuleMutation,
  useGQLUpdateUserRuleMutation,
} from '../../../../graphql/generated';
import { CoreSignal } from '../../../../models/signal';
import { userHasPermissions } from '../../../../routing/permissions';
import useRouteQueryParams from '../../../../routing/useRouteQueryParams';
import { DAY, HOUR, MONTH, WEEK } from '../../../../utils/time';
import { ModalInfo } from '../../types/ModalInfo';
import { RULES_QUERY } from '../dashboard/RulesDashboard';
import TextTokenInput from '../TextTokenInput';
import {
  ConditionInput,
  RuleFormConditionSet,
  RuleFormLeafCondition,
} from '../types';
import RuleFormCondition from './RuleFormCondition';
import {
  reducer,
  RuleFormConfigResponse,
  RuleFormReducerActionType,
} from './RuleFormReducers';
import {
  containsInvalidThreshold,
  getInvalidRegexesInCondition,
  hasNestedConditionSets,
  isConditionComplete,
  ruleHasValidConditions,
  serializeConditionSet,
} from './RuleFormUtils';

const { Option } = Select;

export enum VisibleSections {
  BASIC_INFO = 0,
  CONDITIONS = 1,
  ACTIONS_AND_METADATA = 2,
}

export enum RuleType {
  CONTENT = 'Content',
  USER = 'User',
}

export const initialState = {
  ruleName: '',
  ruleDescription: '',
  selectedItemTypes: [] as RuleFormConfigResponse['itemTypes'],
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
  tags: [] as string[],
  advancedSettingsVisible: false,
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
  maxDailyActions: null as number | null,
  unlimitedDailyActionsChecked: false,
  ruleMutationError: false,
  expirationEnabled: false,
  expirationTime: null as Moment | null,
  lastVisibleSection: VisibleSections.BASIC_INFO,
  ruleType: RuleType.CONTENT,
};
export type RuleFormState = typeof initialState;

export const DERIVED_FIELDS_FRAGMENT = gql`
  fragment DerivedFieldFields on DerivedField {
    type
    name
    container {
      containerType
      keyScalarType
      valueScalarType
    }
    spec {
      derivationType
      source {
        ... on DerivedFieldFieldSource {
          name
          contentTypeId
        }
        ... on DerivedFieldFullItemSource {
          _
        }
        ... on DerivedFieldCoopInputSource {
          coopInput: name
        }
      }
    }
  }
`;

export const ITEM_TYPE_FRAGMENT = gql`
  ${DERIVED_FIELDS_FRAGMENT}
  fragment ItemTypeFragment on ItemTypeBase {
    id
    name
    description
    version
    schemaVariant
    hiddenFields
    baseFields {
      name
      required
      type
      container {
        containerType
        keyScalarType
        valueScalarType
      }
    }
    derivedFields {
      ...DerivedFieldFields
    }
    ... on UserItemType {
      schemaFieldRoles {
        displayName
        createdAt
        profileIcon
        backgroundImage
        isDeleted
      }
    }
    ... on ContentItemType {
      schemaFieldRoles {
        displayName
        parentId
        threadId
        createdAt
        creatorId
        isDeleted
      }
    }
    ... on ThreadItemType {
      schemaFieldRoles {
        displayName
        createdAt
        creatorId
        isDeleted
      }
    }
  }
`;

export const SIGNALS_FRAGMENT = gql`
  fragment SignalsFragment on Signal {
    id
    type
    name
    integration
    docsUrl
    recommendedThresholds {
      highPrecisionThreshold
      highRecallThreshold
    }
    supportedLanguages {
      ... on AllLanguages {
        _
      }
      ... on Languages {
        languages
      }
    }
    pricingStructure {
      type
    }
    disabledInfo {
      disabled
      disabledMessage
    }
    description
    eligibleInputs
    outputType {
      ... on ScalarSignalOutputType {
        scalarType
      }
      ... on EnumSignalOutputType {
        scalarType
        enum
        ordered
      }
    }
    shouldPromptForMatchingValues
    eligibleSubcategories {
      id
      label
      description
      childrenIds
    }
  }
`;

const LEAF_CONDITION_FIELDS = gql`
  fragment LeafConditionFields on LeafCondition {
    input {
      type
      name
      contentTypeId
      contentTypeIds
      spec {
        source {
          ... on DerivedFieldFieldSource {
            name
            contentTypeId
          }
          ... on DerivedFieldFullItemSource {
            _
          }
          ... on DerivedFieldCoopInputSource {
            coopInput: name
          }
        }
        derivationType
      }
    }
    signal {
      id
      type
      name
      subcategory
      args {
        __typename
      }
    }
    matchingValues {
      strings
      textBankIds
      locationBankIds
      imageBankIds
      locations {
        id
        name
        geometry {
          center {
            lat
            lng
          }
          radius
        }
        bounds {
          northeastCorner {
            lat
            lng
          }
          southwestCorner {
            lat
            lng
          }
        }
      }
    }
    comparator
    threshold
  }
`;

/**
 * GraphQL fragments cannot spread themselves. In other words,
 * we can't make a fragment like:
 *
 * fragment SomeFragment on X {
 *    someField {
 *        ...SomeFragment
 *    }
 * }
 *
 * This is what we'd like to do:
 *
 * fragment ConditionFields on Condition {
 *   ... on ConditionSet {
 *     conjunction
 *     conditions {
 *       ...ConditionFields
 *     }
 *   }
 *   ... on LeafCondition {
 *     ...LeafConditionFields
 *   }
 * }
 *
 * But since we can't spread ConditionFields, we have to enumerate
 * all the levels down which we want to traverse. For now, the condition tree
 * can only have two levels max (i.e. a Condition could just be one LeafCondition,
 * or it could be a ConditionSet that contains LeafConditions - but not
 * subsequent ConditionSet children). So we only traverse two levels.
 */
export const CONDITION_SET_FRAGMENT = gql`
  ${LEAF_CONDITION_FIELDS}
  fragment ConditionSetFields on ConditionSet {
    conjunction
    conditions {
      ... on ConditionSet {
        conjunction
        conditions {
          ... on LeafCondition {
            ...LeafConditionFields
          }
        }
      }
      ... on LeafCondition {
        ...LeafConditionFields
      }
    }
  }
`;

const RULE_FIELD_FRAGMENT = gql`
  fragment RuleFormRuleFieldsFragment on Rule {
    __typename
    id
    name
    description
    status
    policies {
      id
    }
    tags
    maxDailyActions
    expirationTime
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

const RULE_QUERY = gql`
  ${CONDITION_SET_FRAGMENT}
  ${DERIVED_FIELDS_FRAGMENT}
  ${RULE_FIELD_FRAGMENT}
  ${ITEM_TYPE_FRAGMENT}
  query Rule($id: ID!) {
    rule(id: $id) {
      ... on ContentRule {
        ...RuleFormRuleFieldsFragment
        itemTypes {
          ...ItemTypeFragment
        }
      }
      ... on UserRule {
        ...RuleFormRuleFieldsFragment
      }
    }
  }
`;

export const ACTION_FRAGMENT = gql`
  fragment ActionFragment on ActionBase {
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
`;

gql`
  ${DERIVED_FIELDS_FRAGMENT}
  ${SIGNALS_FRAGMENT}
  ${ACTION_FRAGMENT}
  query ContentRuleFormConfig {
    myOrg {
      policies {
        id
        name
        parentId
      }
      itemTypes {
        ...ItemTypeFragment
      }
      actions {
        ...ActionFragment
      }
      signals {
        ...SignalsFragment
      }
    }
    me {
      permissions
    }
  }

  mutation CreateContentRule($input: CreateContentRuleInput!) {
    createContentRule(input: $input) {
      ... on MutateContentRuleSuccessResponse {
        data {
          id
        }
      }
      ... on Error {
        title
      }
    }
  }

  mutation UpdateContentRule($input: UpdateContentRuleInput!) {
    updateContentRule(input: $input) {
      ... on MutateContentRuleSuccessResponse {
        data {
          id
        }
      }
      ... on Error {
        title
      }
    }
  }

  mutation CreateUserRule($input: CreateUserRuleInput!) {
    createUserRule(input: $input) {
      ... on MutateUserRuleSuccessResponse {
        data {
          id
        }
      }
      ... on Error {
        title
      }
    }
  }

  mutation UpdateUserRule($input: UpdateUserRuleInput!) {
    updateUserRule(input: $input) {
      ... on MutateUserRuleSuccessResponse {
        data {
          id
        }
      }
      ... on Error {
        title
      }
    }
  }
`;

/**
 * Rule Form -- Form used to create and update rules
 */
export default function RuleForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const queryParams = useRouteQueryParams();

  const duplicateId = queryParams.get('duplicate_id');

  const {
    data: ruleQueryData,
    loading: ruleQueryLoading,
    error: ruleQueryError,
  } = useGQLRuleQuery({
    // cast below safe because of the skip
    variables: { id: (id ?? duplicateId) as string },
    skip: !(id ?? duplicateId),
  });
  const rule = ruleQueryData?.rule;

  const {
    loading: contentRuleFormConfigQueryLoading,
    error: contentRuleFormConfigQueryError,
    data: contentRuleFormConfigQueryData,
  } = useGQLContentRuleFormConfigQuery();

  const allItemTypes = useMemo(
    () => contentRuleFormConfigQueryData?.myOrg?.itemTypes ?? [],
    [contentRuleFormConfigQueryData],
  );

  const permissions = contentRuleFormConfigQueryData?.me?.permissions;
  const allActions = useMemo(
    () => contentRuleFormConfigQueryData?.myOrg?.actions ?? [],
    [contentRuleFormConfigQueryData],
  );
  const allSignals = useMemo(
    () => contentRuleFormConfigQueryData?.myOrg?.signals ?? [],
    [contentRuleFormConfigQueryData],
  );
  const policies = contentRuleFormConfigQueryData?.myOrg?.policies;

  const {
    loading: matchingBanksQueryLoading,
    error: matchingBanksQueryError,
    data: matchingBanksQueryData,
  } = useGQLMatchingBankIdsQuery();
  const banks = matchingBanksQueryData?.myOrg?.banks;
  const { textBanks, locationBanks } = banks ?? {};

  const onHideModal = () =>
    dispatch({ type: RuleFormReducerActionType.HideModal });

  const [deleteRule] = useGQLDeleteRuleMutation({
    onError: () => {},
    onCompleted: () => {
      onHideModal();
      navigate('/dashboard/rules/proactive');
    },
  });

  const [state, dispatch] = useReducer(reducer, initialState);

  const [form] = useForm();

  const onDeleteRule = (id: string) => {
    deleteRule({
      variables: { id },
      refetchQueries: [{ query: RULES_QUERY }],
    });
  };

  /**
   * If the user is editing an existing rule, then once the
   * RULE_QUERY has finished, we need to update the overall state
   * so that each input field is populated with the right content
   */
  useMemo(() => {
    if (
      rule != null &&
      allItemTypes.length > 0 &&
      allSignals &&
      textBanks &&
      locationBanks &&
      policies
    ) {
      dispatch({
        type: RuleFormReducerActionType.RuleQueryCompleted,
        payload: {
          name:
            duplicateId != null && rule != null
              ? `COPY: ${rule?.name}`
              : rule?.name,
          description: rule.description ?? '',
          selectedItemTypes:
            rule.__typename === 'ContentRule' ? rule.itemTypes : [],
          conditionSet: rule.conditionSet,
          allActions,
          allSignals: allSignals satisfies readonly CoreSignal[],
          policyIds: rule.policies.map((it) => it.id),
          tags: (rule.tags ?? []).filter((tag) => tag) as string[],
          maxDailyActions: rule.maxDailyActions ?? null,
          unlimitedDailyActionsChecked: rule.maxDailyActions == null,
          expirationEnabled: rule.expirationTime != null,
          expirationTime:
            rule.expirationTime != null
              ? // moment.unix expects unixtime in seconds, not milliseconds
                moment.unix(Number(rule.expirationTime) / 1000)
              : null,
          ruleType:
            rule.__typename === 'ContentRule'
              ? RuleType.CONTENT
              : RuleType.USER,
        },
      });
    }
  }, [
    rule,
    allItemTypes.length,
    allSignals,
    textBanks,
    locationBanks,
    policies,
    duplicateId,
    allActions,
  ]);

  const showRuleMutationError = (isUpdate: boolean) => {
    dispatch({
      type: RuleFormReducerActionType.ShowModal,
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
          navigate('/dashboard/rules/proactive');
        }
      },
      okIsDangerButton: false,
      cancelVisible: false,
    };
    dispatch({
      type: RuleFormReducerActionType.ShowModal,
      payload: {
        modalInfo,
      },
    });
  };

  const showUpdateRuleCaughtErrorModal = (
    isUpdate: boolean,
    errorName:
      | 'NotFoundError'
      | 'RuleNameExistsError'
      | 'RuleHasRunningBacktestsError',
  ) => {
    dispatch({
      type: RuleFormReducerActionType.ShowModal,
      payload: {
        modalInfo: {
          ...state.modalInfo,
          title: isUpdate ? 'Error Creating Rule' : 'Error Updating Rule',
          body: (() => {
            switch (errorName) {
              case 'RuleNameExistsError': {
                return 'A rule already exists with this name.';
              }
              case 'NotFoundError': {
                return 'We encountered an error trying to update your Rule. Please try again.';
              }
              case 'RuleHasRunningBacktestsError': {
                return 'A backtest is currently running using this rule. Please wait for it to complete and try again';
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

  const [createContentRule] = useGQLCreateContentRuleMutation({
    onError: (error) => {
      showRuleMutationError(false);
    },
    onCompleted: (result) => {
      switch (result.createContentRule.__typename) {
        case 'MutateContentRuleSuccessResponse': {
          const { data } = result.createContentRule;
          showMutationSuccessModal(false, data != null);
          break;
        }
        case 'RuleNameExistsError': {
          showUpdateRuleCaughtErrorModal(
            false,
            result.createContentRule.__typename,
          );
          break;
        }
      }
    },
  });

  const [updateContentRule] = useGQLUpdateContentRuleMutation({
    onError: (error) => {
      showRuleMutationError(true);
    },
    onCompleted: (result) => {
      switch (result.updateContentRule.__typename) {
        case 'MutateContentRuleSuccessResponse': {
          const { data } = result.updateContentRule;
          showMutationSuccessModal(true, data != null);
          break;
        }
        case 'RuleNameExistsError':
        case 'NotFoundError':
        case 'RuleHasRunningBacktestsError': {
          showUpdateRuleCaughtErrorModal(
            true,
            result.updateContentRule.__typename,
          );
          break;
        }
      }
    },
  });

  const [createUserRule] = useGQLCreateUserRuleMutation({
    onError: (error) => {
      showRuleMutationError(false);
    },
    onCompleted: (result) => {
      switch (result.createUserRule.__typename) {
        case 'MutateUserRuleSuccessResponse': {
          const { data } = result.createUserRule;
          showMutationSuccessModal(false, data != null);
          break;
        }
        case 'RuleNameExistsError': {
          showUpdateRuleCaughtErrorModal(
            false,
            result.createUserRule.__typename,
          );
          break;
        }
      }
    },
  });

  const [updateUserRule] = useGQLUpdateUserRuleMutation({
    onError: (error) => {
      showRuleMutationError(true);
    },
    onCompleted: (result) => {
      switch (result.updateUserRule.__typename) {
        case 'MutateUserRuleSuccessResponse': {
          const { data } = result.updateUserRule;
          showMutationSuccessModal(true, data != null);
          break;
        }
        case 'RuleNameExistsError':
        case 'NotFoundError':
        case 'RuleHasRunningBacktestsError': {
          showUpdateRuleCaughtErrorModal(
            true,
            result.updateUserRule.__typename,
          );
          break;
        }
      }
    },
  });

  if (
    contentRuleFormConfigQueryError ||
    ruleQueryError ||
    matchingBanksQueryError
  ) {
    throw (
      contentRuleFormConfigQueryError ??
      ruleQueryError ??
      matchingBanksQueryError!
    );
  }
  if (
    contentRuleFormConfigQueryLoading ||
    ruleQueryLoading ||
    matchingBanksQueryLoading
  ) {
    return <FullScreenLoading />;
  }

  const canEditLiveRules = userHasPermissions(permissions, [
    GQLUserPermission.MutateLiveRules,
  ]);
  const canEditNonLiveRules = userHasPermissions(permissions, [
    GQLUserPermission.MutateNonLiveRules,
  ]);
  const isUserRule = state.ruleType === RuleType.USER;

  const onCreateContentRule = async (values: any) => {
    dispatch({ type: RuleFormReducerActionType.DisableSubmitButton });
    createContentRule({
      variables: {
        input: {
          name: state.ruleName,
          description: state.ruleDescription,
          status: values.status,
          contentTypeIds: values.itemTypes,
          conditionSet: serializeConditionSet(state.conditionSet),
          actionIds: values.actions,
          policyIds: state.policyIds,
          tags: state.tags,
          maxDailyActions: state.maxDailyActions,
          expirationTime: state.expirationTime?.format('YYYY-MM-DD hh:mm'),
        },
      },
      refetchQueries: [{ query: RULES_QUERY }],
    });
  };

  const onUpdateContentRule = async (values: any) => {
    dispatch({ type: RuleFormReducerActionType.DisableSubmitButton });
    updateContentRule({
      variables: {
        input: {
          // Okay to assert since to update a rule there needs to be
          // a current rule ID in the first place
          id: id!,
          name: state.ruleName,
          description: state.ruleDescription,
          status: values.status,
          contentTypeIds: values.itemTypes,
          conditionSet: serializeConditionSet(state.conditionSet),
          actionIds: values.actions,
          policyIds: state.policyIds,
          tags: state.tags,
          maxDailyActions: state.maxDailyActions,
          expirationTime: state.expirationTime?.format('YYYY-MM-DD hh:mm'),
        },
      },
      refetchQueries: [
        { query: RULES_QUERY },
        { query: RULE_QUERY, variables: { id } },
      ],
    });
  };

  const onCreateUserRule = async (values: any) => {
    dispatch({ type: RuleFormReducerActionType.DisableSubmitButton });
    createUserRule({
      variables: {
        input: {
          name: values.name,
          description: values.description,
          status: values.status,
          conditionSet: serializeConditionSet(state.conditionSet),
          actionIds: values.actions,
          policyIds: state.policyIds,
          tags: state.tags,
          maxDailyActions: state.maxDailyActions,
          expirationTime: state.expirationTime?.format('YYYY-MM-DD hh:mm'),
        },
      },
      refetchQueries: [{ query: RULES_QUERY }],
    });
  };

  const onUpdateUserRule = async (values: any) => {
    dispatch({ type: RuleFormReducerActionType.DisableSubmitButton });
    updateUserRule({
      variables: {
        input: {
          // Okay to assert since to update a rule there needs to be
          // a current rule ID in the first place
          id: id!,
          name: values.name,
          description: values.description,
          status: values.status,
          conditionSet: serializeConditionSet(state.conditionSet),
          actionIds: values.actions,
          policyIds: state.policyIds,
          tags: state.tags,
          maxDailyActions: state.maxDailyActions,
          expirationTime: state.expirationTime?.format('YYYY-MM-DD hh:mm'),
        },
      },
      refetchQueries: [
        { query: RULES_QUERY },
        { query: RULE_QUERY, variables: { id } },
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
      type: RuleFormReducerActionType.UpdateItemTypes,
      payload: {
        selectedItemTypes: selectedTypeIDs.map(
          (id: string) => allItemTypes.find((itemType) => itemType.id === id)!,
        ),
        allActions,
        allSignals: allSignals satisfies readonly CoreSignal[],
        form,
      },
    });
  };

  const itemTypeSection =
    rule?.__typename === 'UserRule' || isUserRule ? null : (
      <div className="flex flex-col justify-start">
        <FormSectionHeader
          title="Item Types"
          subtitle="Select the item types that your Rule will run on"
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
                type: RuleFormReducerActionType.UpdateInput,
                payload: {
                  location: { conditionIndex, conditionSetIndex },
                  input,
                  allSignals: signals,
                },
              })
            }
            onUpdateSignal={(signal) =>
              dispatch({
                type: RuleFormReducerActionType.UpdateSignal,
                payload: {
                  location: { conditionIndex, conditionSetIndex },
                  signal,
                },
              })
            }
            onUpdateSignalArgs={(args) =>
              dispatch({
                type: RuleFormReducerActionType.UpdateSignalArgs,
                payload: {
                  location: { conditionIndex, conditionSetIndex },
                  args,
                },
              })
            }
            onUpdateSignalSubcategory={(subcategory) =>
              dispatch({
                type: RuleFormReducerActionType.UpdateSignalSubcategory,
                payload: {
                  location: { conditionIndex, conditionSetIndex },
                  subcategory,
                },
              })
            }
            onUpdateMatchingValues={(matchingValues) =>
              dispatch({
                type: RuleFormReducerActionType.UpdateMatchingValues,
                payload: {
                  location: { conditionIndex, conditionSetIndex },
                  matchingValues,
                },
              })
            }
            onUpdateConditionComparator={(comparator) =>
              dispatch({
                type: RuleFormReducerActionType.UpdateComparator,
                payload: {
                  location: { conditionIndex, conditionSetIndex },
                  comparator,
                },
              })
            }
            onUpdateThreshold={(threshold) =>
              dispatch({
                type: RuleFormReducerActionType.UpdateThreshold,
                payload: {
                  location: { conditionIndex, conditionSetIndex },
                  threshold,
                },
              })
            }
            onDeleteCondition={() =>
              dispatch({
                type: RuleFormReducerActionType.DeleteCondition,
                payload: {
                  location: { conditionIndex, conditionSetIndex },
                },
              })
            }
            onUpdateNestedConditionSetConjunction={(conjunction) =>
              dispatch({
                type: RuleFormReducerActionType.UpdateNestedConditionSetConjunction,
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
                type: RuleFormReducerActionType.AddCondition,
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
                  type: RuleFormReducerActionType.DeleteConditionSet,
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
                type: RuleFormReducerActionType.UpdateTopLevelConjunction,
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
                (isUserRule || state.selectedItemTypes.length > 0) &&
                state.ruleName.length > 0
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
              disabled={!nextButtonEnabled}
              onClick={() =>
                dispatch({
                  type: RuleFormReducerActionType.ShowNextVisibleSection,
                })
              }
            />
          </div>
        );
      }}
    </Form.Item>
  );

  const basicInfoSection = (
    <div className="flex flex-col gap-6">
      <NameDescriptionInput
        nameInitialValue={state.ruleName}
        descriptionInitialValue={state.ruleDescription}
        onChangeName={(name) =>
          dispatch({
            type: RuleFormReducerActionType.UpdateRuleName,
            payload: { name },
          })
        }
        onChangeDescription={(description) =>
          dispatch({
            type: RuleFormReducerActionType.UpdateRuleDescription,
            payload: { description },
          })
        }
      />
      {isUserRule ?? divider}
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
              dispatch({ type: RuleFormReducerActionType.AddConditionSet })
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

  const maxDailyActionsSection = (
    <div className="flex flex-col justify-start">
      <FormSectionHeader
        title="Daily Action Limit"
        subtitle={
          'Limit the amount of actions this rule can apply each day. Set this value to a low number to slowly roll out your rule and ensure it works before fully deploying it. Select "Unlimited" to remove the daily action limit.'
        }
      />
      <div className="flex items-center">
        <Form.Item name="maxDailyActions" initialValue={state.maxDailyActions}>
          <Input
            disabled={state.unlimitedDailyActionsChecked}
            placeholder={state.unlimitedDailyActionsChecked ? '' : 'ex: 1000'}
            onChange={(event) =>
              dispatch({
                type: RuleFormReducerActionType.UpdateMaxDailyActions,
                payload: {
                  value: event.currentTarget.value,
                },
              })
            }
            style={{ borderRadius: '8px' }}
          />
        </Form.Item>
        <div className="flex items-center mb-6 ml-6 gap-1.5">
          <div className="flex items-center space-x-2">
            <Switch
              id="unlimited-daily-actions"
              checked={state.unlimitedDailyActionsChecked}
              onCheckedChange={() =>
                dispatch({
                  type: RuleFormReducerActionType.ToggleUnlimitedDailyActionsCheckbox,
                })
              }
            />
            <Label htmlFor="unlimited-daily-actions">Unlimited</Label>
          </div>
        </div>
      </div>
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
            dispatch({ type: RuleFormReducerActionType.HideRuleMutationError });
          }}
          dropdownRender={(menu) => {
            if (state.selectedItemTypes.length > 0 || isUserRule) {
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
              type: RuleFormReducerActionType.UpdatePolicies,
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

  const tagsSection = (
    <div className="flex flex-col justify-start mt-4">
      <FormSectionHeader
        title="Tags"
        subtitle="Optionally add tags to this rule to group them together with other similar rules."
      />
      <Form.Item style={{ width: '25%' }}>
        <TextTokenInput
          key="text-token-input-tags"
          uniqueKey="tags"
          placeholder="Input tags"
          updateTokenValues={(values: string[]) =>
            dispatch({
              type: RuleFormReducerActionType.UpdateTags,
              payload: {
                tags: values,
              },
            })
          }
          initialValues={state.tags}
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
                dispatch({ type: RuleFormReducerActionType.ShowStatusModal })
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
        initialValue={rule?.status ?? GQLRuleStatus.Draft}
      >
        <Radio.Group className="w-full" onChange={() => {}} value={null}>
          <div className="flex flex-col items-start w-full pl-2 gap-1">
            <Radio
              className="font-medium text-slate-900"
              value={GQLRuleStatus.Draft}
            >
              Draft
            </Radio>
            <Radio
              className="font-medium text-slate-900"
              value={GQLRuleStatus.Background}
            >
              Background
            </Radio>
            {canEditLiveRules ? (
              <Radio
                className="font-medium text-slate-900"
                value={GQLRuleStatus.Live}
              >
                Live
              </Radio>
            ) : (
              <Tooltip title="To edit Live rules, ask your organization's admin to upgrade your role to Rules Manager or Admin.">
                <Radio
                  className="font-medium text-slate-900"
                  value={GQLRuleStatus.Live}
                  disabled={true}
                >
                  Live
                </Radio>
              </Tooltip>
            )}
            {id ? (
              <Radio
                className="font-medium text-slate-900"
                value={GQLRuleStatus.Archived}
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
        dispatch({ type: RuleFormReducerActionType.HideStatusModal })
      }
    >
      <div className="max-w-96">
        <FormSectionHeader
          title="Draft"
          subtitle="Draft rules are rules that are not fully configured or ready to be run on content."
        />
        <div style={{ height: '12px' }} />
        <FormSectionHeader
          title="Background"
          subtitle="Background rules are deployed and running on all content sent to Coop, but they don't actually apply any Actions. Instead, we just log the Actions we would have applied if the rule was Live so that you can analyze those logs later."
        />
        <div style={{ height: '12px' }} />
        <FormSectionHeader
          title="Live"
          subtitle="Live rules are fully deployed and running on all content sent to Coop."
        />
      </div>
    </CoopModal>
  );

  const expirationTimeButton = (timeString: string, unixtime: number) => {
    return (
      <Button
        key={timeString}
        className="px-2 mx-1 text-base font-medium rounded-lg text-slate-500 hover:border-coop-dark-purple-hover hover:text-coop-dark-purple-hover focus:border-coop-dark-purple focus:text-coop-dark-purple hover:bg-coop-lightpurple"
        size="small"
        onClick={() =>
          dispatch({
            type: RuleFormReducerActionType.UpdateExpirationTime,
            payload: {
              time: moment.unix(unixtime / 1000),
            },
          })
        }
      >
        {timeString}
      </Button>
    );
  };

  const expirationSection = (
    <div className="flex flex-col justify-start">
      <FormSectionHeader
        title="Expiration Time"
        subtitle={
          <div className="flex items-center mb-2 gap-2">
            <Switch
              id="expiration-enabled"
              checked={state.expirationEnabled}
              onCheckedChange={() => {
                dispatch({
                  type: RuleFormReducerActionType.ToggleExpirationEnabledCheckbox,
                });
              }}
            />
            <Label htmlFor="expiration-enabled">
              Would you like this rule to expire at a certain time?
            </Label>
          </div>
        }
      />
      {/* Added extra padding when the Form.Item isn't rendered because Form.Item
      has its own bottom padding */}
      {!state.expirationEnabled && <div style={{ height: '12px' }} />}
      {state.expirationEnabled && (
        <Form.Item
          className="flex mt-2"
          name="expiration"
          initialValue={state.expirationTime}
          style={{ width: '80%' }}
        >
          <DatePicker
            value={state.expirationTime}
            className="mr-4 rounded-lg"
            showTime={{ format: 'HH:mm' }}
            format="YYYY-MM-DD HH:mm"
            onOk={(value) =>
              dispatch({
                type: RuleFormReducerActionType.UpdateExpirationTime,
                payload: {
                  time: value,
                },
              })
            }
          />
          {expirationTimeButton('1 hour', Date.now() + HOUR)}
          {expirationTimeButton('3 hours', Date.now() + 3 * HOUR)}
          {expirationTimeButton('12 hours', Date.now() + 12 * HOUR)}
          {expirationTimeButton('1 day', Date.now() + DAY)}
          {expirationTimeButton('1 week', Date.now() + WEEK)}
          {expirationTimeButton('2 weeks', Date.now() + 2 * WEEK)}
          {expirationTimeButton('1 month', Date.now() + MONTH)}
        </Form.Item>
      )}
    </div>
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
                (rule?.status === GQLRuleStatus.Live && !canEditLiveRules) ||
                !actionsSelected ||
                hasInvalidThreshold ||
                !conditionsValid
              }
              loading={state.submitButtonLoading}
              submitsForm={true}
              error={state.ruleMutationError}
              showDisabledTooltip={
                !canEditNonLiveRules ||
                (rule?.status === GQLRuleStatus.Live && !canEditLiveRules) ||
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

  const onAdvancedSettingsClick = () =>
    dispatch({
      type: state.advancedSettingsVisible
        ? RuleFormReducerActionType.HideAdvancedSettings
        : RuleFormReducerActionType.ShowAdvancedSettings,
    });

  const advancedSettingsToggle = (
    <div
      className="flex items-center text-base font-medium cursor-pointer text-slate-500"
      onClick={onAdvancedSettingsClick}
    >
      Advanced Settings{' '}
      {state.advancedSettingsVisible ? (
        <UpOutlined className="ml-2" />
      ) : (
        <DownOutlined className="ml-2" />
      )}
    </div>
  );

  const advancedSettingsSection = (
    <div className="flex flex-col p-4 mb-8 bg-white border border-gray-200 border-solid rounded-lg shadow">
      {advancedSettingsToggle}
      {state.advancedSettingsVisible && (
        <div className="p-3">
          {tagsSection}
          {divider}
          {maxDailyActionsSection}
          {divider}
          {expirationSection}
        </div>
      )}
    </div>
  );

  const actionsAndMetadataSection = (
    <div>
      {actionsSection}
      {divider}
      {policiesSection}
      {divider}
      {statusSection}
      {divider}
      {advancedSettingsSection}
      {createButton}
    </div>
  );

  /* Disabling user rules
  const ruleTypeSelector =
    FeatureFlagClient.getFlag(FeatureFlagNames.ShowUserRuleFormOption) &&
    // Don't show the rule type radio buttons if the user is editing a rule
    rule?.id == null ? (
      <Radio.Group
        onChange={(event) => {
          const switchRuleType = () => {
            dispatch({
              type: RuleFormReducerActionType.SwitchRuleType,
              payload: { ruleType: event.target.value },
            });
          };

          // Technically not fully exhaustive, since it's not including the
          // advanced section, but this should be comprehensive enough for
          // this particular purpose
          const formHasBeenEdited =
            form.getFieldValue('name') ||
            state.selectedContentTypes.length !== 0 ||
            state.conditionSet.conditions.some((c) =>
              conditionHasUserInput(c)
            ) ||
            form.getFieldValue('actions') ||
            form.getFieldValue('policies');

          // If the form has been edited, show a warning letting the user
          // know that they'll use their work if they switch the rule type.
          // If they haven't, then there's no need to show the warning and
          // switch directly.
          if (formHasBeenEdited) {
            dispatch({
              type: RuleFormReducerActionType.ShowModal,
              payload: {
                modalInfo: {
                  ...state.modalInfo,
                  title: 'Warning',
                  body: 'Switching the rule type will clear the rule form, and you will lose any unsaved work. Do you want to continue?',
                  onOk: () => {
                    form.resetFields();
                    switchRuleType();
                    onHideModal();
                  },
                  okText: 'Ok',
                  okIsDangerButton: false,
                  cancelVisible: true,
                },
              },
            });
          } else {
            switchRuleType();
          }
        }}
        value={state.ruleType}
      >
        <Radio value={RuleType.CONTENT}>Content Rule</Radio>
        <Radio value={RuleType.USER}>User Rule</Radio>
      </Radio.Group>
    ) : null;
  */

  return (
    <div className="flex flex-col test-start">
      <Helmet>
        <title>{id == null ? 'Create Rule' : 'Update Rule'}</title>
      </Helmet>
      <div className="flex justify-between">
        <div className="flex flex-col justify-between w-full">
          <FormHeader
            title={(() => {
              return id == null
                ? isUserRule
                  ? 'Create User Rule'
                  : 'Create Rule'
                : isUserRule
                ? 'Update User Rule'
                : 'Update Rule';
            })()}
            // topRightButton={ruleTypeSelector}
          />
          {id == null ||
          canEditLiveRules ||
          rule?.status !== GQLRuleStatus.Live ? null : (
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
              destination={`/dashboard/rules/proactive/info/${id}`}
              size="small"
            />
            <CoopButton
              icon={CopyAlt}
              onClick={() => {
                navigate(`/dashboard/rules/proactive/form?duplicate_id=${id}`);
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
                  type: RuleFormReducerActionType.ShowModal,
                  payload: {
                    modalInfo: {
                      ...state.modalInfo,
                      title: rule ? `Delete ${rule.name}` : 'Delete Rule',
                      body: "Are you sure you want to delete this rule? You can't undo this action.",
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
              type: RuleFormReducerActionType.ShowModal,
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

          switch (state.ruleType) {
            case RuleType.CONTENT: {
              if (id == null) {
                onCreateContentRule(values);
              } else {
                onUpdateContentRule(values);
              }
              break;
            }
            case RuleType.USER: {
              if (id == null) {
                onCreateUserRule(values);
              } else {
                onUpdateUserRule(values);
              }
              break;
            }
          }
        }}
        onFinishFailed={() => {
          dispatch({
            type: RuleFormReducerActionType.ShowRuleMutationError,
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
