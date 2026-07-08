import { InfoCircleOutlined } from '@ant-design/icons';
import { Input, InputNumber, Select, Switch, Tooltip } from 'antd';
import { useMemo } from 'react';

import {
  GQLActionParameterType,
  type GQLActionParameter,
} from '../graphql/generated';

const { Option } = Select;

export type ActionParameterValues = Readonly<Record<string, unknown>>;

type Props = {
  parameters: ReadonlyArray<GQLActionParameter>;
  values: ActionParameterValues;
  onChange: (next: ActionParameterValues) => void;
  /** Optional id prefix so multiple instances on a page get unique input ids. */
  idPrefix?: string;
  disabled?: boolean;
};

/**
 * Renders one input widget per `ActionParameter`, using the appropriate
 * Ant Design control for each parameter `type`. Designed as the single source
 * of truth for moderator-facing parameter entry across the dashboard
 * (ItemAction modal, BulkActioningDashboard, MRT review).
 *
 * The component is fully controlled: the parent owns the `values` map and
 * applies the supplied `onChange` callback to integrate edits.
 */
export default function ActionParameterInputs({
  parameters,
  values,
  onChange,
  idPrefix,
  disabled,
}: Props) {
  const setValue = (name: string, value: unknown) => {
    if (value === undefined) {
      // Drop the key via destructuring rather than `delete` to satisfy the
      // `no-dynamic-delete` rule, and avoid mutating the prop.
      const { [name]: _omitted, ...rest } = values;
      onChange(rest);
      return;
    }
    onChange({ ...values, [name]: value });
  };

  if (parameters.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      {parameters.map((param) => (
        <ParameterInput
          key={param.name}
          param={param}
          value={values[param.name]}
          idPrefix={idPrefix}
          disabled={disabled}
          onChange={(next) => setValue(param.name, next)}
        />
      ))}
    </div>
  );
}

function ParameterInput({
  param,
  value,
  onChange,
  idPrefix,
  disabled,
}: {
  param: GQLActionParameter;
  value: unknown;
  onChange: (next: unknown) => void;
  idPrefix?: string;
  disabled?: boolean;
}) {
  const id = `${idPrefix ?? 'param'}-${param.name}`;
  const constraints = constraintHint(param);
  const labelTooltip = [param.description, constraints]
    .filter((s): s is string => Boolean(s))
    .join(' — ');

  const label = (
    <label
      htmlFor={id}
      className="mb-1 text-sm font-medium text-gray-700 inline-flex items-center"
    >
      {param.displayName}
      {param.required && <span className="ml-1 text-coop-alert-red">*</span>}
      {labelTooltip && (
        <Tooltip title={labelTooltip}>
          <InfoCircleOutlined className="ml-1 text-gray-400" />
        </Tooltip>
      )}
    </label>
  );
  const description = param.description ? (
    <div className="mb-1 text-xs text-gray-500">{param.description}</div>
  ) : null;
  const constraintHintBelow = constraints ? (
    <div className="mt-1 text-xs text-gray-400">{constraints}</div>
  ) : null;

  const inputElement = (() => {
    switch (param.type) {
      case GQLActionParameterType.String:
        return (
          <Input
            id={id}
            disabled={disabled}
            maxLength={param.maxLength ?? undefined}
            // `showCount` adds the live "n / max" indicator when a maxLength
            // is declared so moderators see how close they are to the limit.
            showCount={param.maxLength != null}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) =>
              onChange(e.target.value === '' ? undefined : e.target.value)
            }
          />
        );
      case GQLActionParameterType.Number:
        return (
          <InputNumber
            id={id}
            disabled={disabled}
            min={param.min ?? undefined}
            max={param.max ?? undefined}
            value={typeof value === 'number' ? value : undefined}
            onChange={(next) => onChange(next ?? undefined)}
            style={{ width: '100%' }}
          />
        );
      case GQLActionParameterType.Boolean:
        // Wrap in a `self-start`/`inline-flex` span so the parent
        // `flex flex-col` doesn't stretch the Switch button to full width.
        return (
          <span className="self-start inline-flex">
            <Switch
              id={id}
              disabled={disabled}
              checked={value === true}
              onChange={(checked) => onChange(checked)}
            />
          </span>
        );
      case GQLActionParameterType.Select: {
        const options = param.options ?? [];
        return (
          <Select
            id={id}
            disabled={disabled}
            style={{ width: '100%' }}
            value={typeof value === 'string' ? value : undefined}
            onChange={(next) => onChange(next ?? undefined)}
            allowClear
          >
            {options.map((opt) => (
              <Option key={opt.value} value={opt.value}>
                {opt.label}
              </Option>
            ))}
          </Select>
        );
      }
      case GQLActionParameterType.Multiselect: {
        const options = param.options ?? [];
        return (
          <Select<string[]>
            id={id}
            disabled={disabled}
            mode="multiple"
            style={{ width: '100%' }}
            value={
              Array.isArray(value)
                ? value.filter((v): v is string => typeof v === 'string')
                : []
            }
            onChange={(next) => onChange(next.length === 0 ? undefined : next)}
            allowClear
          >
            {options.map((opt) => (
              <Option key={opt.value} value={opt.value}>
                {opt.label}
              </Option>
            ))}
          </Select>
        );
      }
      default:
        return null;
    }
  })();

  return (
    <div className="flex flex-col">
      {label}
      {description}
      {inputElement}
      {constraintHintBelow}
    </div>
  );
}

/**
 * Renders a short human-readable summary of the validation constraints on a
 * parameter, e.g. "Between 1 and 365" for a NUMBER with min/max, or
 * "Up to 500 characters" for a STRING with maxLength. Returns `undefined`
 * when there's nothing useful to surface (e.g. BOOLEAN, or unconstrained
 * STRING). Also used as the label tooltip body alongside the description.
 */
function constraintHint(param: GQLActionParameter): string | undefined {
  switch (param.type) {
    case GQLActionParameterType.String: {
      if (param.maxLength != null) {
        return `Up to ${param.maxLength} characters`;
      }
      return undefined;
    }
    case GQLActionParameterType.Number: {
      const { min, max } = param;
      if (min != null && max != null) return `Between ${min} and ${max}`;
      if (min != null) return `At least ${min}`;
      if (max != null) return `At most ${max}`;
      return undefined;
    }
    case GQLActionParameterType.Select:
      return 'Choose one';
    case GQLActionParameterType.Multiselect:
      return 'Choose one or more';
    case GQLActionParameterType.Boolean:
    default:
      return undefined;
  }
}

/**
 * Returns a list of parameter `displayName`s that are required but missing or
 * empty in `values`. Empty list means the values map is submittable. Used by
 * callers to gate the submit button and surface the missing fields in a
 * disabled-button tooltip.
 */
export function findMissingRequiredParameters(
  parameters: ReadonlyArray<GQLActionParameter>,
  values: ActionParameterValues,
): string[] {
  const missing: string[] = [];
  for (const param of parameters) {
    if (!param.required) continue;
    const present = Object.prototype.hasOwnProperty.call(values, param.name);
    const value = values[param.name];
    const isEmpty =
      !present ||
      value === undefined ||
      value === null ||
      value === '' ||
      (Array.isArray(value) && value.length === 0);
    // A `defaultValue` on the spec satisfies "required" since the server will
    // backfill on publish — keeps the UX consistent with server behavior.
    if (
      isEmpty &&
      (param.defaultValue === undefined || param.defaultValue === null)
    ) {
      missing.push(param.displayName);
    }
  }
  return missing;
}

/**
 * Memoized helper: takes a `Record<actionId, ActionParameterValues>` map and a
 * single action-id update, returns the next map with that one action's values
 * replaced. Tiny but used in three call sites.
 */
export function useUpdateActionValues(
  setMap: (next: Readonly<Record<string, ActionParameterValues>>) => void,
  map: Readonly<Record<string, ActionParameterValues>>,
) {
  return useMemo(
    () => (actionId: string, values: ActionParameterValues) => {
      // Drop the entry entirely when the values map is empty, so the GQL
      // input doesn't carry meaningless `{}` entries that confuse log
      // readers.
      if (Object.keys(values).length === 0) {
        if (!(actionId in map)) return;
        const { [actionId]: _omitted, ...rest } = map;
        setMap(rest);
        return;
      }
      setMap({ ...map, [actionId]: values });
    },
    [map, setMap],
  );
}
