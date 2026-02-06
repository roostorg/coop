import { gql } from '@apollo/client';
import { Input, Select } from 'antd';
import orderBy from 'lodash/orderBy';
import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate } from 'react-router-dom';

import FullScreenLoading from '../../../components/common/FullScreenLoading';
import { selectFilterByLabelOption } from '../components/antDesignUtils';
import CoopButton from '../components/CoopButton';
import CoopModal from '../components/CoopModal';
import DashboardHeader from '../components/DashboardHeader';
import FormSectionHeader from '../components/FormSectionHeader';
import PolicyDropdown from '../components/PolicyDropdown';

import {
  GQLExecuteActionResponse,
  GQLUserPermission,
  useGQLBulkActionExecutionMutation,
  useGQLBulkActionsFormDataQuery,
} from '../../../graphql/generated';
import { stripTypename } from '../../../graphql/inputHelpers';
import { userHasPermissions } from '../../../routing/permissions';
import { splitByWhitespaceAndCommas } from '../../../utils/string';

const { TextArea } = Input;
const { Option } = Select;

gql`
  query BulkActionsFormData {
    myOrg {
      id
      itemTypes {
        ... on ItemTypeBase {
          id
          name
        }
      }
      actions {
        ... on ActionBase {
          id
          name
        }
        ... on CustomAction {
          itemTypes {
            ... on ItemTypeBase {
              id
            }
          }
        }
        ... on EnqueueToMrtAction {
          itemTypes {
            ... on ItemTypeBase {
              id
            }
          }
        }
        ... on EnqueueToNcmecAction {
          itemTypes {
            ... on ItemTypeBase {
              id
            }
          }
        }
        ... on EnqueueAuthorToMrtAction {
          itemTypes {
            ... on ItemTypeBase {
              id
            }
          }
        }
      }
      policies {
        id
        name
        parentId
      }
      allowMultiplePoliciesPerAction
    }
    me {
      permissions
    }
  }

  mutation BulkActionExecution($input: ExecuteBulkActionInput!) {
    bulkExecuteActions(input: $input) {
      results {
        itemId
        actionId
        success
      }
    }
  }
`;

export default function BulkActioningDashboard() {
  const requiredPermissions = [GQLUserPermission.ManuallyActionContent];

  const [selectedItemTypeId, setSelectedItemTypeId] = useState<
    string | undefined
  >(undefined);
  const [inputIds, setInputIds] = useState<string[]>([]);
  const [selectedActionIds, setSelectedActionIds] = useState<string[]>([]);
  const [selectedPolicyIds, setSelectedPolicyIds] = useState<string[]>([]);
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);

  const { data: queryData, loading: queryLoading } =
    useGQLBulkActionsFormDataQuery();

  const [
    bulkAction,
    {
      loading: bulkActionLoading,
      error: bulkActionError,
      data: bulkActionData,
      reset: bulkActionMutationReset,
    },
  ] = useGQLBulkActionExecutionMutation({
    onCompleted: () => setShowSubmissionModal(true),
    onError: () => setShowSubmissionModal(true),
  });

  const resetPage = () => {
    setSelectedItemTypeId(undefined);
    setInputIds([]);
    setSelectedActionIds([]);
    setSelectedPolicyIds([]);
    bulkActionMutationReset();
  };

  const policies = queryData?.myOrg?.policies;
  const navigate = useNavigate();
  const permissions = queryData?.me?.permissions;
  if (!queryLoading && !userHasPermissions(permissions, requiredPermissions)) {
    navigate('/settings');
  }

  const onExecuteBulkAction = async () => {
    if (inputIds.length > 1000) {
      setShowSubmissionModal(true);
      return;
    }

    bulkAction({
      variables: {
        input: {
          itemTypeId: selectedItemTypeId!,
          actionIds: selectedActionIds,
          itemIds: inputIds,
          policyIds: selectedPolicyIds ?? [],
        },
      },
    });
  };

  if (queryLoading) {
    return <FullScreenLoading />;
  }

  const allItemTypes = queryData?.myOrg?.itemTypes;
  const allActions = queryData?.myOrg?.actions;

  const itemTypeSelector = (
    <div className="flex flex-col w-56 pb-4">
      <Select
        placeholder="Select Item Type"
        dropdownMatchSelectWidth={false}
        allowClear
        showSearch
        filterOption={selectFilterByLabelOption}
        onSelect={(itemTypeId: string) => setSelectedItemTypeId(itemTypeId)}
      >
        {orderBy(allItemTypes, ['name']).map((itemType) => (
          <Option key={itemType.id} value={itemType.id} label={itemType.name}>
            {itemType.name}
          </Option>
        ))}
      </Select>
    </div>
  );

  const idInput = (
    <div className="w-3/4">
      <div className="mb-2 font-semibold">Input IDs</div>
      <TextArea
        className="pt-1 pb-2 rounded-lg"
        rows={10}
        placeholder="Enter comma-separated or newline-separated Item IDs here."
        autoSize={{ minRows: 5, maxRows: 20 }}
        onChange={(event) =>
          setInputIds(splitByWhitespaceAndCommas(event.target.value))
        }
      />
    </div>
  );

  const selectedItemType = allItemTypes?.find(
    (itemType) => itemType.id === selectedItemTypeId,
  );
  const actions =
    selectedItemTypeId && selectedItemType && allActions
      ? allActions.filter((action) =>
          action.itemTypes.some(
            (itemType) => itemType.id === selectedItemTypeId,
          ),
        )
      : [];

  const actionSelector = (
    <Select<string[]>
      className="w-56"
      mode="multiple"
      placeholder="Select action"
      dropdownMatchSelectWidth={false}
      onChange={(actionIds) => setSelectedActionIds(actionIds)}
      filterOption={selectFilterByLabelOption}
      dropdownRender={(menu) => {
        if (!selectedItemTypeId) {
          return (
            <div className="p-2">
              <div className="text-coop-alert-red">
                Please select at least one Item Type first
              </div>
              {menu}
            </div>
          );
        }

        if (actions.length === 0) {
          return (
            <div className="p-2">
              <div className="text-coop-alert-red">
                No actions available for{' '}
                {selectedItemType?.name ?? 'this Item Type'}. Add one in the{' '}
                <Link to="/dashboard/actions">Actions Dashboard</Link>!
              </div>
              {menu}
            </div>
          );
        }
        return menu;
      }}
    >
      {orderBy(actions, ['name']).map((action) => (
        <Option key={action.id} value={action.id} label={action.name}>
          {action.name}
        </Option>
      ))}
    </Select>
  );

  const policySelector = (
    <PolicyDropdown
      className="w-56"
      policies={policies ? policies.map((p) => stripTypename(p)) : []}
      onChange={(policyIds) => {
        if (Array.isArray(policyIds)) {
          setSelectedPolicyIds(policyIds.map((id) => id.toString()));
        } else {
          // NB: This cast is required because of a longstanding typescript
          // issue. See https://github.com/microsoft/TypeScript/issues/17002 for
          // more details.
          const policyId = policyIds satisfies
            | string
            | readonly string[] as string;
          setSelectedPolicyIds([policyId]);
        }
      }}
      selectedPolicyIds={selectedPolicyIds}
      multiple={queryData?.myOrg?.allowMultiplePoliciesPerAction ?? false}
    />
  );

  const getFailedResults = (results: readonly GQLExecuteActionResponse[]) => {
    const failedResults = results.filter((result) => result.success === false);
    if (failedResults.length === 0) {
      return undefined;
    }

    return {
      numResults: results.length,
      failedIds: failedResults.map((r) => r.itemId),
    };
  };

  const getSubmissionModalData = () => {
    if (inputIds.length > 1000) {
      return {
        title: 'Too Many Item IDs',
        body: 'Please enter fewer than 1000 Item IDs',
        success: false,
      };
    }

    if (bulkActionError != null) {
      return {
        title: 'Error',
        body: bulkActionError.message,
        success: false,
      };
    }

    const responseData = (
      failedResults:
        | {
            failedIds: string[];
            numResults: number;
          }
        | undefined,
    ) => {
      if (failedResults && failedResults?.failedIds.length > 0) {
        return {
          title: 'Error',
          body: (
            <div>
              {failedResults.failedIds.length} out of {failedResults.numResults}{' '}
              requests failed. Actions on the following IDs were not run:
              <div className="pt-3">
                {failedResults.failedIds.map((id, i) => (
                  <div key={i}>{id}</div>
                ))}
              </div>
            </div>
          ),
          success: false,
        };
      } else {
        return {
          title: 'Actions Complete',
          body: 'Your actions have finished running.',
          success: true,
        };
      }
    };
    if (bulkActionData != null) {
      return responseData(
        getFailedResults(bulkActionData.bulkExecuteActions.results),
      );
    }

    return { title: undefined, body: undefined, success: false };
  };

  const { title, body, success } = getSubmissionModalData();
  const onHideSubmissionModal = () => {
    if (success) {
      resetPage();
      setSelectedItemTypeId(undefined);
      setInputIds([]);
      setSelectedActionIds([]);
      setSelectedPolicyIds([]);
    }

    setShowSubmissionModal(false);
  };
  const submissionModal = (
    <CoopModal
      title={title}
      visible={showSubmissionModal}
      onClose={onHideSubmissionModal}
      footer={[
        {
          title: 'OK',
          onClick: onHideSubmissionModal,
        },
      ]}
    >
      {body}
    </CoopModal>
  );

  return (
    <div className="flex flex-col justify-start text-start">
      <Helmet>
        <title>Bulk Actioning</title>
      </Helmet>
      <div className="w-5/6">
        <DashboardHeader
          title="Bulk Actioning"
          subtitle="Run actions on a list of Item IDs without checking against any rules. If you know you want to apply a certain actions on a set of items, you can do so here."
          rightComponent={
            <CoopButton
              title="Execute Bulk Action"
              loading={bulkActionLoading}
              onClick={onExecuteBulkAction}
              disabled={
                !inputIds.length ||
                !selectedItemTypeId ||
                !selectedActionIds.length
              }
            />
          }
        />
      </div>
      <FormSectionHeader
        title="Items"
        subtitle="Select an Item Type and input a list of up to 1000 Item IDs separated by commas or new lines."
      />
      {itemTypeSelector}
      {idInput}
      <div className="flex mt-6" />
      <FormSectionHeader
        title="Actions"
        subtitle={
          <span>
            Select the actions you would like to apply to all the Item IDs you
            listed above.
            <br />
            Note: the actions will take effect immediately on all submitted
            items, regardless of what the Item contains. In other words, your
            rules will be bypassed and we will not scan Item at all.
          </span>
        }
      />
      {actionSelector}
      <div className="flex h-px mt-12 bg-slate-200 mb-9" />
      <FormSectionHeader
        title="Policy"
        subtitle="Select the policies you would like to apply to this bulk actioning job."
      />
      {policySelector}
      {submissionModal}
    </div>
  );
}
