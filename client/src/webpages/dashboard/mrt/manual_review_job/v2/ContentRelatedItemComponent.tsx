import {
  GQLActionParameterType,
  type GQLActionParameter,
  type GQLBaseField,
} from '@/graphql/generated';
import { arrayFromArrayOrSingleItem } from '@/utils/collections';
import { ItemTypeFieldFieldData } from '@/webpages/dashboard/item_types/itemTypeUtils';
import { Select, Tooltip } from 'antd';
import { Pencil, X } from 'lucide-react';
import { JsonObject } from 'type-fest';

import CopyTextComponent from '@/components/common/CopyTextComponent';
import { selectFilterByLabelOption } from '@/webpages/dashboard/components/antDesignUtils';
import PolicyDropdown from '@/webpages/dashboard/components/PolicyDropdown';

import {
  ManualReviewJobAction,
  ManualReviewJobEnqueuedActionData,
} from '../ManualReviewJobReview';
import FieldsComponent from './ManualReviewJobFieldsComponent';

const { Option } = Select;

export type RelatedContentItem = {
  id: string;
  data: JsonObject;
  type: {
    id: string;
    name: string;
    baseFields: ReadonlyArray<
      Pick<GQLBaseField, 'name' | 'type' | 'required' | 'container'>
    >;
  };
};

type ContentAction = Pick<
  ManualReviewJobAction,
  '__typename' | 'itemTypes' | 'name' | 'id' | 'penalty'
> & {
  parameters?: ReadonlyArray<GQLActionParameter> | null;
};

type RelatedContentActionProps = {
  allActions: readonly ContentAction[];
  allPolicies: readonly { id: string; name: string }[];
  relatedActions: readonly ManualReviewJobEnqueuedActionData[];
  onEnqueueAction: (action: ManualReviewJobEnqueuedActionData) => void;
  onRemoveAction?: (action: ManualReviewJobEnqueuedActionData) => void;
  onEditParameters?: (action: ManualReviewJobEnqueuedActionData) => void;
  isActionable?: boolean;
  requirePolicySelectionToEnqueueAction: boolean;
  allowMoreThanOnePolicySelection: boolean;
};

export function contentItemIdentityKey(item: {
  id: string;
  type: { id: string };
}): string {
  return `${item.type.id}:${item.id}`;
}

function optionLabel(
  param: Pick<GQLActionParameter, 'options'>,
  value: string,
): string {
  return (
    param.options?.find((option) => option.value === value)?.label ?? value
  );
}

export function summarizeActionParameterValues(
  parameters: ReadonlyArray<
    Pick<GQLActionParameter, 'name' | 'displayName' | 'type' | 'options'>
  >,
  values: Record<string, unknown> | undefined,
): { label: string; formatted: string }[] {
  if (values == null) {
    return [];
  }
  return parameters.flatMap((param) => {
    const raw = values[param.name];
    if (raw == null || raw === '') {
      return [];
    }
    let formatted: string | null = null;
    switch (param.type) {
      case GQLActionParameterType.Boolean:
        formatted = raw === true ? 'Yes' : raw === false ? 'No' : null;
        break;
      case GQLActionParameterType.Number:
        formatted = typeof raw === 'number' ? String(raw) : null;
        break;
      case GQLActionParameterType.Select:
        formatted = optionLabel(param, String(raw));
        break;
      case GQLActionParameterType.Multiselect:
        formatted = Array.isArray(raw)
          ? raw.map((value) => optionLabel(param, String(value))).join(', ')
          : null;
        break;
      case GQLActionParameterType.String:
      default:
        formatted = String(raw);
        break;
    }
    return formatted ? [{ label: param.displayName, formatted }] : [];
  });
}

export function relatedActionForContentItem(args: {
  item: Pick<RelatedContentItem, 'id' | 'type'> & { type: { id: string } };
  displayName: string;
  action: Pick<ManualReviewJobAction, 'id' | 'name' | 'penalty' | '__typename'>;
  selectedPolicyIds: string | readonly string[];
  allPolicies: readonly { id: string; name: string }[];
  customMrtApiParamDecisionPayload?: Record<string, unknown>;
}): ManualReviewJobEnqueuedActionData {
  const {
    item,
    displayName,
    action,
    selectedPolicyIds,
    allPolicies,
    customMrtApiParamDecisionPayload,
  } = args;
  return {
    action: {
      id: action.id,
      name: action.name,
      penalty: action.penalty,
    },
    policies: allPolicies.filter((policy) =>
      arrayFromArrayOrSingleItem(selectedPolicyIds).includes(policy.id),
    ),
    target: {
      identifier: {
        itemId: item.id,
        itemTypeId: item.type.id,
      },
      displayName,
    },
    ...(customMrtApiParamDecisionPayload
      ? { customMrtApiParamDecisionPayload }
      : {}),
  };
}

export function relatedActionsTargetingContentItem(
  relatedActions: readonly ManualReviewJobEnqueuedActionData[],
  item: { id: string; type: { id: string } },
): ManualReviewJobEnqueuedActionData[] {
  return relatedActions.filter(
    (relatedAction) =>
      relatedAction.target.identifier.itemId === item.id &&
      relatedAction.target.identifier.itemTypeId === item.type.id,
  );
}

function ContentItemRelatedActionsPicker(props: {
  item: RelatedContentItem;
  displayName: string;
  applicableActions: readonly ContentAction[];
  allPolicies: readonly { id: string; name: string }[];
  relatedActions: readonly ManualReviewJobEnqueuedActionData[];
  onEnqueueAction: (action: ManualReviewJobEnqueuedActionData) => void;
  onRemoveAction?: (action: ManualReviewJobEnqueuedActionData) => void;
  onEditParameters?: (action: ManualReviewJobEnqueuedActionData) => void;
  requirePolicySelectionToEnqueueAction: boolean;
  allowMoreThanOnePolicySelection: boolean;
}) {
  const {
    item,
    displayName,
    applicableActions,
    allPolicies,
    relatedActions,
    onEnqueueAction,
    onRemoveAction,
    onEditParameters,
    requirePolicySelectionToEnqueueAction,
    allowMoreThanOnePolicySelection,
  } = props;

  const activeActions = relatedActionsTargetingContentItem(
    relatedActions,
    item,
  );
  const activeActionIds = new Set(activeActions.map((it) => it.action.id));
  const actionsAvailableToAdd = applicableActions.filter(
    (action) => !activeActionIds.has(action.id),
  );

  const enqueue = (
    action: ContentAction,
    selectedPolicyIds: string | readonly string[],
    customMrtApiParamDecisionPayload?: Record<string, unknown>,
  ) =>
    onEnqueueAction(
      relatedActionForContentItem({
        item,
        displayName,
        action,
        selectedPolicyIds,
        allPolicies,
        customMrtApiParamDecisionPayload,
      }),
    );

  if (applicableActions.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col items-start w-full gap-2">
      <div className="text-sm font-semibold text-slate-800">
        Take Action on This Item
      </div>
      {actionsAvailableToAdd.length > 0 ? (
        <Select
          className="w-full max-w-sm"
          placeholder={
            activeActions.length > 0 ? 'Add another action' : 'Select an action'
          }
          value={undefined}
          dropdownMatchSelectWidth={false}
          showSearch
          filterOption={selectFilterByLabelOption}
          onChange={(actionId: string) => {
            const action = actionsAvailableToAdd.find(
              (it) => it.id === actionId,
            );
            if (action) {
              enqueue(action, []);
            }
          }}
        >
          {actionsAvailableToAdd.map((action) => (
            <Option key={action.id} value={action.id} label={action.name}>
              {action.name}
            </Option>
          ))}
        </Select>
      ) : null}
      {activeActions.length > 0 ? (
        <div className="flex flex-row flex-wrap items-stretch gap-2 w-full">
          {activeActions.map((enqueued) => {
            const actionMeta = applicableActions.find(
              (action) => action.id === enqueued.action.id,
            );
            const selectedPolicyIds = enqueued.policies.map(
              (policy) => policy.id,
            );
            const missingRequiredPolicy =
              requirePolicySelectionToEnqueueAction &&
              selectedPolicyIds.length === 0;
            const parameters = actionMeta?.parameters ?? [];
            const parameterSummary = summarizeActionParameterValues(
              parameters,
              enqueued.customMrtApiParamDecisionPayload,
            );
            return (
              <div
                key={enqueued.action.id}
                className={`flex flex-col gap-1.5 w-60 shrink-0 px-3 py-2 border border-solid rounded-md ${
                  missingRequiredPolicy
                    ? 'bg-amber-50 border-amber-300'
                    : 'bg-sky-50 border-sky-200'
                }`}
              >
                <div className="flex flex-row items-center gap-2 min-w-0">
                  <div
                    className={`font-semibold truncate min-w-0 flex-1 ${
                      missingRequiredPolicy ? 'text-amber-800' : 'text-sky-700'
                    }`}
                  >
                    {enqueued.action.name}
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove ${enqueued.action.name}`}
                    className="flex items-center shrink-0 bg-transparent border-none p-0 cursor-pointer"
                    onClick={() => onRemoveAction?.(enqueued)}
                  >
                    <X className="w-4 h-4 p-0.5 rounded-full bg-slate-400/70 hover:bg-slate-400/50 text-slate-200" />
                  </button>
                </div>
                {actionMeta ? (
                  <PolicyDropdown
                    className="w-full"
                    policies={allPolicies}
                    selectedPolicyIds={
                      allowMoreThanOnePolicySelection
                        ? selectedPolicyIds
                        : selectedPolicyIds[0]
                    }
                    onChange={(policyIds) =>
                      enqueue(
                        actionMeta,
                        policyIds,
                        enqueued.customMrtApiParamDecisionPayload,
                      )
                    }
                    multiple={allowMoreThanOnePolicySelection}
                  />
                ) : null}
                {missingRequiredPolicy ? (
                  <div className="text-xs font-medium text-amber-800">
                    Policy required
                  </div>
                ) : null}
                {parameters.length > 0 ? (
                  <div className="flex flex-row items-start gap-2 min-w-0">
                    <div
                      className={`flex flex-col min-w-0 flex-1 text-sm ${
                        missingRequiredPolicy
                          ? 'text-amber-900/80'
                          : 'text-sky-900/80'
                      }`}
                    >
                      {parameterSummary.length > 0 ? (
                        parameterSummary.map((entry) => (
                          <div key={entry.label} className="truncate">
                            <span className="font-medium">{entry.label}:</span>{' '}
                            {entry.formatted}
                          </div>
                        ))
                      ) : (
                        <div
                          className={
                            missingRequiredPolicy
                              ? 'text-amber-800/70'
                              : 'text-sky-800/70'
                          }
                        >
                          No details yet
                        </div>
                      )}
                    </div>
                    {onEditParameters ? (
                      <Tooltip title="Edit details">
                        <button
                          type="button"
                          aria-label={`Edit details for ${enqueued.action.name}`}
                          className="flex items-center gap-1 shrink-0 text-xs font-medium text-sky-700 bg-transparent border-none p-0 cursor-pointer hover:text-sky-900"
                          onClick={() => onEditParameters(enqueued)}
                        >
                          <Pencil className="w-3 h-3" />
                          Edit
                        </button>
                      </Tooltip>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function AdditionalReportedContentItems(
  props: {
    items: readonly RelatedContentItem[];
    unblurAllMedia: boolean;
    excludeItems?: readonly { id: string; typeId: string }[];
  } & RelatedContentActionProps,
) {
  const { items, excludeItems, unblurAllMedia, ...actionProps } = props;
  const excluded = new Set(
    (excludeItems ?? []).map((item) =>
      contentItemIdentityKey({ id: item.id, type: { id: item.typeId } }),
    ),
  );
  const visibleItems = items.filter(
    (item) => !excluded.has(contentItemIdentityKey(item)),
  );
  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col w-full mt-6 text-start">
      <div className="mb-2 text-base font-semibold">
        Additional Items In This Report
      </div>
      {visibleItems.map((item) => (
        <ContentRelatedItemComponent
          key={contentItemIdentityKey(item)}
          item={item}
          itemId={item.id}
          title={item.type.name}
          unblurAllMedia={unblurAllMedia}
          {...actionProps}
        />
      ))}
    </div>
  );
}

export default function ContentRelatedItemComponent(
  props: {
    item: RelatedContentItem;
    itemId?: string;
    unblurAllMedia: boolean;
    title: string;
  } & RelatedContentActionProps,
) {
  const {
    item,
    itemId,
    unblurAllMedia,
    title,
    allActions,
    allPolicies,
    relatedActions,
    onEnqueueAction,
    onRemoveAction,
    onEditParameters,
    isActionable = false,
    requirePolicySelectionToEnqueueAction,
    allowMoreThanOnePolicySelection,
  } = props;

  const fieldData = item.type.baseFields.map(
    (
      itemTypeField, // itemTypeField comes back as a GQLBaseField, and the GQL types
    ) =>
      ({
        ...itemTypeField,
        value: item.data[itemTypeField.name],
      }) as ItemTypeFieldFieldData,
  );

  const applicableActions = allActions.filter((action) =>
    action.itemTypes.some((itemType) => itemType.id === item.type.id),
  );

  const displayName = title ? `${title} (${item.id})` : item.id;

  return (
    <div className="flex flex-col items-start justify-start w-full py-4 mt-8 space-y-2 bg-white border border-gray-200 border-solid rounded-lg">
      <div className="flex flex-col w-full px-4 gap-2">
        <div className="flex flex-wrap items-center justify-between gap-1 w-full">
          <div className="text-lg font-semibold text-start truncate min-w-0 pr-4">
            {/* TODO: make this title org-agnostic  */}
            {title}
          </div>
          {itemId ? (
            <div className="shrink-0 text-slate-400">
              <CopyTextComponent
                displayValue={
                  'ID: ' +
                  (itemId.length > 20
                    ? itemId.slice(0, 10) + '…' + itemId.slice(-10)
                    : itemId)
                }
                value={itemId}
              />
            </div>
          ) : null}
        </div>
        {isActionable ? (
          <ContentItemRelatedActionsPicker
            item={item}
            displayName={displayName}
            applicableActions={applicableActions}
            allPolicies={allPolicies}
            relatedActions={relatedActions}
            onEnqueueAction={onEnqueueAction}
            onRemoveAction={onRemoveAction}
            onEditParameters={onEditParameters}
            requirePolicySelectionToEnqueueAction={
              requirePolicySelectionToEnqueueAction
            }
            allowMoreThanOnePolicySelection={allowMoreThanOnePolicySelection}
          />
        ) : null}
      </div>

      <div className="max-w-full min-w-[50%] grow mx-4">
        <FieldsComponent
          fields={fieldData}
          itemTypeId={item.type.id}
          options={{
            unblurAllMedia,
            maxHeightImage: 300,
            maxHeightVideo: 300,
          }}
        />
      </div>
    </div>
  );
}
