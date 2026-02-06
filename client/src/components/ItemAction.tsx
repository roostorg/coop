import {
  useGQLBulkActionExecutionMutation,
  useGQLBulkActionsFormDataQuery,
} from '@/graphql/generated';
import { stripTypename } from '@/graphql/inputHelpers';
import { ItemIdentifier } from '@roostorg/types';
import { Select } from 'antd';
import orderBy from 'lodash/orderBy';
import { useCallback, useMemo, useState } from 'react';

import { selectFilterByLabelOption } from '@/webpages/dashboard/components/antDesignUtils';
import CoopButton from '@/webpages/dashboard/components/CoopButton';
import CoopModal from '@/webpages/dashboard/components/CoopModal';
import PolicyDropdown from '@/webpages/dashboard/components/PolicyDropdown';

const { Option } = Select;

export default function ItemAction(props: {
  itemIdentifier: ItemIdentifier;
  title?: string;
}) {
  const { itemIdentifier, title = 'Action on this Item' } = props;

  const { data: queryData } = useGQLBulkActionsFormDataQuery();
  const [bulkAction, { loading }] = useGQLBulkActionExecutionMutation({
    onCompleted: () => () => {
      setModalBody('Actions submitted successfully');
      setShowModal(true);
    },
    onError: () => () => {
      setModalBody('Error submitting actions. Please try again.');
      setShowModal(true);
    },
  });

  const [selectedPolicyIds, setSelectedPolicyIds] = useState<string[]>([]);
  const [selectedActionIds, setSelectedActionIds] = useState<string[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [modalBody, setModalBody] = useState<string>('');

  const eligibleActions = (queryData?.myOrg?.actions ?? []).filter((it) =>
    it.itemTypes.map((it) => it.id).includes(itemIdentifier.typeId),
  );

  const selectOnChange = useCallback(
    (actionIds: string[]) => setSelectedActionIds(actionIds),
    [],
  );

  const selectDropdownRender = useCallback(
    (menu: React.ReactElement) => {
      if (eligibleActions.length === 0) {
        return (
          <div>
            <div className="text-coop-alert-red">No actions available</div>
            {menu}
          </div>
        );
      }
      return menu;
    },
    [eligibleActions.length],
  );

  const policies = queryData?.myOrg?.policies;
  const policiesMemo = useMemo(
    () => (policies ? policies.map((p) => stripTypename(p)) : []),
    [policies],
  );

  const policiesDropdownOnChange = useCallback(
    (policyIds: string | readonly string[]) => {
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
    },
    [],
  );

  const buttonOnClick = useCallback(
    async () =>
      bulkAction({
        variables: {
          input: {
            itemTypeId: itemIdentifier.typeId,
            actionIds: selectedActionIds,
            itemIds: [itemIdentifier.id],
            policyIds: selectedPolicyIds,
          },
        },
      }),
    [
      bulkAction,
      itemIdentifier.id,
      itemIdentifier.typeId,
      selectedActionIds,
      selectedPolicyIds,
    ],
  );

  const modalOnClose = useCallback(() => setShowModal(false), []);

  if (eligibleActions.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col">
      <div className="flex flex-col items-start mb-2">
        <div className="text-base font-semibold">{title}</div>
      </div>
      <div className="flex flex-row gap-4">
        <div className="flex flex-col items-start">
          <div>
            <Select
              className="w-80"
              mode="multiple"
              maxTagCount={1}
              placeholder="Select action"
              dropdownMatchSelectWidth={false}
              filterOption={selectFilterByLabelOption}
              onChange={selectOnChange}
              dropdownRender={selectDropdownRender}
            >
              {orderBy(eligibleActions, ['name']).map((action) => (
                <Option key={action.id} value={action.id} label={action.name}>
                  {action.name}
                </Option>
              ))}
            </Select>
          </div>
        </div>
        <div className="flex flex-col items-start">
          <div>
            <PolicyDropdown
              className="w-80"
              policies={policiesMemo}
              maxTagCount={1}
              onChange={policiesDropdownOnChange}
              selectedPolicyIds={selectedPolicyIds}
              multiple={
                queryData?.myOrg?.allowMultiplePoliciesPerAction ?? false
              }
            />
          </div>
        </div>
        <CoopButton
          title="Submit Actions"
          size="small"
          onClick={buttonOnClick}
          loading={loading}
        />
      </div>
      <CoopModal visible={showModal} onClose={modalOnClose}>
        {modalBody}
      </CoopModal>
    </div>
  );
}
