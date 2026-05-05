import ActionParameterInputs, {
  type ActionParameterValues,
  findMissingRequiredParameters,
} from '@/components/ActionParameterInputs';
import { type JsonObject } from 'type-fest';
import {
  namedOperations,
  useGQLBulkActionExecutionMutation,
  useGQLBulkActionsFormDataQuery,
} from '@/graphql/generated';
import { stripTypename } from '@/graphql/inputHelpers';
import { ItemIdentifier } from '@roostorg/types';
import { Input, Select } from 'antd';
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
  const { itemIdentifier, title = 'Take action on this item' } = props;

  const { data: queryData } = useGQLBulkActionsFormDataQuery();
  const [bulkAction, { loading }] = useGQLBulkActionExecutionMutation({
    refetchQueries: [
      namedOperations.Query.ItemActionHistory,
      namedOperations.Query.GetRecentDecisions,
    ],
    onCompleted: (data) => {
      const results = data?.bulkExecuteActions?.results ?? [];
      const anyFailed = results.some((r) => r.success === false);
      if (anyFailed) {
        setModalBody(
          'One or more actions failed. The callback URL may have returned an error. If your org requires a policy for decisions, select a policy and try again.',
        );
      } else {
        setModalBody('Actions submitted successfully.');
      }
      setShowModal(true);
    },
    onError: () => {
      setModalBody('Error submitting actions. Please try again.');
      setShowModal(true);
    },
  });

  const [selectedPolicyIds, setSelectedPolicyIds] = useState<string[]>([]);
  const [selectedActionIds, setSelectedActionIds] = useState<string[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [modalBody, setModalBody] = useState<string>('');
  const [parametersByActionId, setParametersByActionId] = useState<
    Record<string, ActionParameterValues>
  >({});
  const [moderatorNote, setModeratorNote] = useState<string>('');

  const eligibleActions = (queryData?.myOrg?.actions ?? []).filter((it) =>
    it.itemTypes.map((it) => it.id).includes(itemIdentifier.typeId),
  );

  const selectedActionsWithParams = useMemo(
    () =>
      eligibleActions.filter(
        (action) =>
          selectedActionIds.includes(action.id) &&
          action.parameters.length > 0,
      ),
    [eligibleActions, selectedActionIds],
  );

  // Aggregate missing-required-parameter labels across all selected actions
  // so the disabled-button tooltip can name them. Server still re-validates
  // on publish.
  const missingRequiredLabels = useMemo(() => {
    const out: string[] = [];
    for (const action of selectedActionsWithParams) {
      const missing = findMissingRequiredParameters(
        action.parameters,
        parametersByActionId[action.id] ?? {},
      );
      out.push(...missing.map((label) => `"${action.name}" → ${label}`));
    }
    return out;
  }, [selectedActionsWithParams, parametersByActionId]);

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
            // Drop empty per-action entries so the input doesn't carry
            // meaningless `{}` payloads. Server validates the rest.
            // GQL `JSONObject` constrains values to `JsonValue`. Our per-
            // action map's inner values are `unknown` because each parameter
            // type produces a different concrete value; they're all
            // JSON-serializable in practice (string, number, boolean,
            // string[]) and the server re-validates. Cast through unknown to
            // satisfy the input type.
            parameters:
              Object.keys(parametersByActionId).length > 0
                ? (parametersByActionId as unknown as JsonObject)
                : undefined,
            note: moderatorNote.trim() === '' ? undefined : moderatorNote.trim(),
          },
        },
      }),
    [
      bulkAction,
      itemIdentifier.id,
      itemIdentifier.typeId,
      selectedActionIds,
      selectedPolicyIds,
      parametersByActionId,
      moderatorNote,
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
          disabled={
            selectedActionIds.length === 0 || missingRequiredLabels.length > 0
          }
          disabledTooltipTitle={
            missingRequiredLabels.length > 0
              ? `Fill in required details: ${missingRequiredLabels.join(', ')}`
              : undefined
          }
        />
      </div>
      {selectedActionsWithParams.length > 0 && (
        <div className="mt-4 flex flex-col gap-4">
          {selectedActionsWithParams.map((action) => (
            <div
              key={action.id}
              className="rounded-xl border border-gray-200 p-3"
            >
              <div className="mb-2 text-sm font-semibold">
                "{action.name}" details
              </div>
              <ActionParameterInputs
                parameters={action.parameters}
                values={parametersByActionId[action.id] ?? {}}
                onChange={(next) =>
                  setParametersByActionId((prev) => ({
                    ...prev,
                    [action.id]: next,
                  }))
                }
                idPrefix={`item-action-${action.id}`}
              />
            </div>
          ))}
        </div>
      )}
      {selectedActionIds.length > 0 && (
        <div className="mt-4 flex flex-col">
          <label
            htmlFor="item-action-moderator-note"
            className="mb-1 text-sm font-medium text-gray-700"
          >
            Note (optional)
          </label>
          <Input.TextArea
            id="item-action-moderator-note"
            placeholder="Why are you taking this action? Sent to the action's webhook as `actorNote`."
            rows={2}
            maxLength={5000}
            value={moderatorNote}
            onChange={(e) => setModeratorNote(e.target.value)}
          />
        </div>
      )}
      <CoopModal visible={showModal} onClose={modalOnClose}>
        {modalBody}
      </CoopModal>
    </div>
  );
}
