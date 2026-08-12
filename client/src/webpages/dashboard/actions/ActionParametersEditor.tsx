import { Button } from '@/coop-ui/Button';
import { Checkbox } from '@/coop-ui/Checkbox';
import { Input } from '@/coop-ui/Input';
import { Label } from '@/coop-ui/Label';
import { Popover, PopoverContent, PopoverTrigger } from '@/coop-ui/Popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/coop-ui/Select';
import { Switch } from '@/coop-ui/Switch';
import { cn } from '@/lib/utils';
import { ChevronsUpDown, Plus, Trash2 } from 'lucide-react';
import { useId, useMemo } from 'react';

import {
  GQLActionParameterType,
  type GQLActionParameterInput,
  type GQLActionParameterOptionInput,
} from '../../../graphql/generated';

// Mirror of the server-side pattern in `actionParametersValidation.ts`. Allows
// snake_case, kebab-case, and dotted namespacing; rejects whitespace, quotes,
// and brackets that would break webhook-payload key access.
const PARAMETER_NAME_PATTERN = /^[a-zA-Z0-9_.\-]+$/;

// Radix `SelectItem` rejects `value=""`, so we use a sentinel string for the
// "no default" option in BOOLEAN / SELECT default-value pickers. The sentinel
// is never serialized — it's mapped back to `undefined` in the change handler.
const NO_DEFAULT = '__no_default__';

export type ActionParameterDraft = {
  name: string;
  displayName: string;
  description?: string;
  type: GQLActionParameterType;
  required: boolean;
  options?: GQLActionParameterOptionInput[];
  min?: number;
  max?: number;
  maxLength?: number;
  // Stored in the parameter's native shape (string / number / boolean /
  // string[]); each `type` renders the matching input widget so we never
  // need to coerce strings on submit.
  defaultValue?: unknown;
};

/**
 * Repeating editor for an action's runtime parameters. Each row defines one
 * parameter spec; the moderator will be prompted for a value at execution
 * time. The serialized value (via `toMutationInput`) feeds
 * `CreateActionInput.parameters` / `UpdateActionInput.parameters`.
 */
export default function ActionParametersEditor({
  value,
  onChange,
  disabled,
}: {
  value: ActionParameterDraft[];
  onChange: (next: ActionParameterDraft[]) => void;
  disabled?: boolean;
}) {
  const updateAt = (index: number, patch: Partial<ActionParameterDraft>) => {
    const next = value.slice();
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  const removeAt = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const addParameter = () => {
    onChange([
      ...value,
      {
        name: '',
        displayName: '',
        type: GQLActionParameterType.String,
        required: false,
      },
    ]);
  };

  return (
    <div className="flex flex-col gap-4">
      {value.map((param, index) => (
        <ParameterRow
          key={index}
          param={param}
          disabled={disabled}
          onChange={(patch) => updateAt(index, patch)}
          onRemove={() => removeAt(index)}
        />
      ))}
      <Button
        type="button"
        variant="outline"
        color="gray"
        size="sm"
        startIcon={Plus}
        disabled={disabled}
        onClick={addParameter}
        className="self-start"
      >
        Add parameter
      </Button>
    </div>
  );
}

function ParameterRow({
  param,
  disabled,
  onChange,
  onRemove,
}: {
  param: ActionParameterDraft;
  disabled?: boolean;
  onChange: (patch: Partial<ActionParameterDraft>) => void;
  onRemove: () => void;
}) {
  const id = useId();
  const isSelectLike =
    param.type === GQLActionParameterType.Select ||
    param.type === GQLActionParameterType.Multiselect;
  const isNumber = param.type === GQLActionParameterType.Number;
  const isString = param.type === GQLActionParameterType.String;
  const hasConstraints = isString || isNumber;

  return (
    <div className="rounded-xl border border-gray-200 p-4">
      <div className="grid grid-cols-1 gap-x-3 gap-y-3 md:grid-cols-12">
        <Field
          label="Name (key)"
          htmlFor={`${id}-name`}
          className="md:col-span-4"
        >
          <Input
            id={`${id}-name`}
            value={param.name}
            placeholder="my-param-key"
            disabled={disabled}
            onChange={(e) => onChange({ name: e.target.value })}
          />
        </Field>
        <Field
          label="Display name"
          htmlFor={`${id}-display`}
          className="md:col-span-5"
        >
          <Input
            id={`${id}-display`}
            value={param.displayName}
            placeholder="Display name on form"
            disabled={disabled}
            onChange={(e) => onChange({ displayName: e.target.value })}
          />
        </Field>
        <Field label="Type" htmlFor={`${id}-type`} className="md:col-span-2">
          <Select
            value={param.type}
            disabled={disabled}
            onValueChange={(next) =>
              onChange({
                type: next as GQLActionParameterType,
                // Reset type-specific fields on type change so we never carry
                // STRING-only `maxLength` into a NUMBER, etc.
                options: undefined,
                min: undefined,
                max: undefined,
                maxLength: undefined,
                defaultValue: undefined,
              })
            }
          >
            <SelectTrigger id={`${id}-type`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(GQLActionParameterType).map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field
          label="Required"
          htmlFor={`${id}-required`}
          className="md:col-span-1"
          align="start"
        >
          <Switch
            id={`${id}-required`}
            checked={param.required}
            disabled={disabled}
            onCheckedChange={(required) => onChange({ required })}
          />
        </Field>

        <Field
          label="Description (optional)"
          htmlFor={`${id}-desc`}
          className="md:col-span-6"
        >
          <Input
            id={`${id}-desc`}
            value={param.description ?? ''}
            disabled={disabled}
            onChange={(e) =>
              onChange({
                description: e.target.value === '' ? undefined : e.target.value,
              })
            }
          />
        </Field>
        {hasConstraints ? (
          <ConstraintsRow
            id={id}
            param={param}
            isString={isString}
            isNumber={isNumber}
            disabled={disabled}
            onChange={onChange}
          />
        ) : (
          // Keep the second row balanced when no constraints exist for the type.
          <div className="hidden md:col-span-6 md:block" />
        )}

        <Field
          label="Default value (optional)"
          htmlFor={`${id}-default`}
          className="md:col-span-12"
        >
          <DefaultValueInput
            id={`${id}-default`}
            param={param}
            disabled={disabled}
            onChange={(defaultValue) => onChange({ defaultValue })}
          />
        </Field>

        {isSelectLike && (
          <Field label="Options" className="md:col-span-12">
            <OptionsEditor
              options={param.options ?? []}
              disabled={disabled}
              onChange={(options) => onChange({ options })}
            />
          </Field>
        )}
      </div>

      <div className="mt-4 flex justify-end">
        <Button
          type="button"
          variant="outline"
          color="red"
          size="sm"
          startIcon={Trash2}
          disabled={disabled}
          onClick={onRemove}
        >
          Remove parameter
        </Button>
      </div>
    </div>
  );
}

function ConstraintsRow({
  id,
  param,
  isString,
  isNumber,
  disabled,
  onChange,
}: {
  id: string;
  param: ActionParameterDraft;
  isString: boolean;
  isNumber: boolean;
  disabled?: boolean;
  onChange: (patch: Partial<ActionParameterDraft>) => void;
}) {
  if (isString) {
    return (
      <Field
        label="Max length (optional)"
        htmlFor={`${id}-maxlen`}
        className="md:col-span-6"
      >
        <NumberInput
          id={`${id}-maxlen`}
          value={param.maxLength}
          min={1}
          max={100000}
          disabled={disabled}
          onChange={(maxLength) => onChange({ maxLength })}
        />
      </Field>
    );
  }
  if (isNumber) {
    return (
      <>
        <Field
          label="Min (optional)"
          htmlFor={`${id}-min`}
          className="md:col-span-3"
        >
          <NumberInput
            id={`${id}-min`}
            value={param.min}
            disabled={disabled}
            onChange={(min) => onChange({ min })}
          />
        </Field>
        <Field
          label="Max (optional)"
          htmlFor={`${id}-max`}
          className="md:col-span-3"
        >
          <NumberInput
            id={`${id}-max`}
            value={param.max}
            disabled={disabled}
            onChange={(max) => onChange({ max })}
          />
        </Field>
      </>
    );
  }
  return null;
}

function DefaultValueInput({
  id,
  param,
  disabled,
  onChange,
}: {
  id: string;
  param: ActionParameterDraft;
  disabled?: boolean;
  onChange: (next: unknown) => void;
}) {
  switch (param.type) {
    case GQLActionParameterType.String: {
      const value =
        typeof param.defaultValue === 'string' ? param.defaultValue : '';
      return (
        <Input
          id={id}
          value={value}
          disabled={disabled}
          onChange={(e) =>
            onChange(e.target.value === '' ? undefined : e.target.value)
          }
        />
      );
    }
    case GQLActionParameterType.Number: {
      const value =
        typeof param.defaultValue === 'number' ? param.defaultValue : undefined;
      return (
        <NumberInput
          id={id}
          value={value}
          min={param.min}
          max={param.max}
          disabled={disabled}
          onChange={(next) => onChange(next)}
        />
      );
    }
    case GQLActionParameterType.Boolean: {
      const dv = param.defaultValue;
      const value = dv === true ? 'true' : dv === false ? 'false' : NO_DEFAULT;
      return (
        <Select
          value={value}
          disabled={disabled}
          onValueChange={(next) =>
            onChange(
              next === 'true' ? true : next === 'false' ? false : undefined,
            )
          }
        >
          <SelectTrigger id={id}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_DEFAULT}>No default</SelectItem>
            <SelectItem value="true">true</SelectItem>
            <SelectItem value="false">false</SelectItem>
          </SelectContent>
        </Select>
      );
    }
    case GQLActionParameterType.Select: {
      // Skip half-typed option rows: Radix `SelectItem` rejects `value=""`,
      // and an unlabelled item isn't pickable anyway.
      const options = (param.options ?? []).filter((opt) => opt.value !== '');
      if (options.length === 0) {
        return <EmptyOptionsHint />;
      }
      const dv = param.defaultValue;
      const value = typeof dv === 'string' ? dv : NO_DEFAULT;
      return (
        <Select
          value={value}
          disabled={disabled}
          onValueChange={(next) =>
            onChange(next === NO_DEFAULT ? undefined : next)
          }
        >
          <SelectTrigger id={id}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_DEFAULT}>No default</SelectItem>
            {options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label !== '' ? opt.label : opt.value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    case GQLActionParameterType.Multiselect: {
      // Same filter as SELECT: half-typed option rows aren't pickable and
      // would collide on `key={opt.value}`.
      const options = (param.options ?? []).filter((opt) => opt.value !== '');
      if (options.length === 0) {
        return <EmptyOptionsHint />;
      }
      const selected = new Set<string>(
        Array.isArray(param.defaultValue)
          ? param.defaultValue.filter((v): v is string => typeof v === 'string')
          : [],
      );
      return (
        <MultiSelectDropdown
          id={id}
          options={options}
          selected={selected}
          disabled={disabled}
          onChange={onChange}
        />
      );
    }
    default:
      return null;
  }
}

function EmptyOptionsHint() {
  return (
    <p className="text-sm text-gray-500">
      Add options below before picking a default.
    </p>
  );
}

/**
 * Dropdown for picking multiple option values. coop-ui's `Select` is
 * single-value (Radix), so we mimic the `SelectTrigger` chrome with a button
 * that opens a `Popover` containing a checkbox list. Visually consistent with
 * the SELECT default-value picker.
 */
function MultiSelectDropdown({
  id,
  options,
  selected,
  disabled,
  onChange,
}: {
  id?: string;
  options: readonly GQLActionParameterOptionInput[];
  selected: ReadonlySet<string>;
  disabled?: boolean;
  onChange: (next: string[] | undefined) => void;
}) {
  const labelFor = (opt: GQLActionParameterOptionInput) =>
    opt.label !== '' ? opt.label : opt.value;
  const selectedLabels = options
    .filter((opt) => selected.has(opt.value))
    .map(labelFor);
  const summary =
    selectedLabels.length === 0
      ? 'No default'
      : selectedLabels.length <= 2
        ? selectedLabels.join(', ')
        : `${selectedLabels.slice(0, 2).join(', ')}, +${selectedLabels.length - 2} more`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          className={cn(
            'flex w-full items-center justify-between whitespace-nowrap rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-normal transition-colors',
            'hover:border-gray-300',
            'focus:z-10 focus:border-indigo-500 focus:shadow-focus-indigo focus:outline-none',
            'disabled:cursor-not-allowed disabled:opacity-50',
            selectedLabels.length === 0 && 'text-gray-400',
          )}
        >
          <span className="truncate">{summary}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="p-1"
        style={{ width: 'var(--radix-popover-trigger-width)' }}
      >
        <div className="flex max-h-72 flex-col overflow-y-auto">
          {options.map((opt) => {
            const checkboxId = `${id}-${opt.value}`;
            const isChecked = selected.has(opt.value);
            return (
              <Label
                key={opt.value}
                htmlFor={checkboxId}
                className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm font-normal text-gray-700 hover:bg-gray-100"
              >
                <Checkbox
                  id={checkboxId}
                  checked={isChecked}
                  onCheckedChange={(checked) => {
                    const next = new Set(selected);
                    if (checked) next.add(opt.value);
                    else next.delete(opt.value);
                    onChange(next.size === 0 ? undefined : Array.from(next));
                  }}
                />
                <span>{labelFor(opt)}</span>
              </Label>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function NumberInput({
  id,
  value,
  min,
  max,
  disabled,
  onChange,
}: {
  id?: string;
  value: number | undefined;
  min?: number;
  max?: number;
  disabled?: boolean;
  onChange: (next: number | undefined) => void;
}) {
  return (
    <Input
      id={id}
      type="number"
      value={value ?? ''}
      min={min}
      max={max}
      disabled={disabled}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === '') {
          onChange(undefined);
          return;
        }
        const parsed = Number(raw);
        if (!Number.isFinite(parsed)) {
          onChange(undefined);
          return;
        }
        // `<input type="number" min/max>` only constrains the spinner UI;
        // direct typing can still produce out-of-range values. Clamp here so
        // the parent state never sees e.g. a negative `maxLength`.
        let clamped = parsed;
        if (min !== undefined && clamped < min) clamped = min;
        if (max !== undefined && clamped > max) clamped = max;
        onChange(clamped);
      }}
    />
  );
}

function Field({
  label,
  htmlFor,
  children,
  className,
  align,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
  // `start` keeps the child at its natural width (e.g. for a `Switch` that
  // would otherwise be stretched to the cell width by the parent flex column).
  align?: 'start';
}) {
  const alignment = align === 'start' ? 'items-start' : '';
  return (
    <div className={`flex flex-col gap-1.5 ${alignment} ${className ?? ''}`}>
      <Label htmlFor={htmlFor} className="text-gray-700">
        {label}
      </Label>
      {children}
    </div>
  );
}

function OptionsEditor({
  options,
  onChange,
  disabled,
}: {
  options: GQLActionParameterOptionInput[];
  onChange: (next: GQLActionParameterOptionInput[]) => void;
  disabled?: boolean;
}) {
  const updateAt = (
    index: number,
    patch: Partial<GQLActionParameterOptionInput>,
  ) => {
    const next = options.slice();
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };
  return (
    <div className="flex flex-col gap-2">
      {options.map((opt, index) => (
        <div key={index} className="flex items-center gap-2">
          <Input
            placeholder="value"
            value={opt.value}
            disabled={disabled}
            onChange={(e) => updateAt(index, { value: e.target.value })}
          />
          <Input
            placeholder="label"
            value={opt.label}
            disabled={disabled}
            onChange={(e) => updateAt(index, { label: e.target.value })}
          />
          <Button
            type="button"
            variant="ghost"
            color="red"
            size="icon"
            disabled={disabled}
            onClick={() =>
              onChange(
                options.filter((_, optionIndex) => optionIndex !== index),
              )
            }
            aria-label="Remove option"
          >
            <Trash2 />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        color="gray"
        size="sm"
        startIcon={Plus}
        disabled={disabled}
        onClick={() => onChange([...options, { value: '', label: '' }])}
        className="self-start"
      >
        Add option
      </Button>
    </div>
  );
}

/**
 * Convert a draft list to the GraphQL input shape. `defaultValue` is already
 * stored in its native type (the editor uses typed widgets), so no coercion
 * is needed.
 */
export function toMutationInput(
  drafts: readonly ActionParameterDraft[],
): GQLActionParameterInput[] {
  return drafts.map((draft) => ({
    name: draft.name,
    displayName: draft.displayName,
    description: draft.description,
    type: draft.type,
    required: draft.required,
    options: draft.options,
    min: draft.min,
    max: draft.max,
    maxLength: draft.maxLength,
    // The editor only ever stores string / number / boolean / string[] in
    // `defaultValue`; all are valid `JsonValue`s for the GQL `JSON` scalar.
    defaultValue: draft.defaultValue as GQLActionParameterInput['defaultValue'],
  }));
}

/**
 * Validate the in-progress drafts. Returns `null` when the list is submittable,
 * or a human-readable message identifying the first problem so the form can
 * surface it via the disabled-button tooltip.
 *
 * Server still re-validates via AJV on write; this is purely for UX.
 */
export function validateDrafts(
  drafts: readonly ActionParameterDraft[],
): string | null {
  const seenNames = new Set<string>();
  for (const [index, draft] of drafts.entries()) {
    const at = `Parameter #${index + 1}`;
    if (!draft.name) return `${at}: name is required.`;
    if (!PARAMETER_NAME_PATTERN.test(draft.name)) {
      return `${at}: name may only contain letters, digits, _, -, or .`;
    }
    if (seenNames.has(draft.name)) {
      return `${at}: duplicate name "${draft.name}".`;
    }
    seenNames.add(draft.name);
    if (!draft.displayName) return `${at}: display name is required.`;

    if (
      draft.type === GQLActionParameterType.Select ||
      draft.type === GQLActionParameterType.Multiselect
    ) {
      if (!draft.options || draft.options.length === 0) {
        return `${at}: at least one option is required for ${draft.type}.`;
      }
      const optionValues = new Set<string>();
      for (const opt of draft.options) {
        if (!opt.value || !opt.label) {
          return `${at}: each option needs a value and a label.`;
        }
        if (optionValues.has(opt.value)) {
          return `${at}: duplicate option value "${opt.value}".`;
        }
        optionValues.add(opt.value);
      }
    }
    if (
      draft.type === GQLActionParameterType.Number &&
      draft.min !== undefined &&
      draft.max !== undefined &&
      draft.min > draft.max
    ) {
      return `${at}: min must be <= max.`;
    }

    // Default-value bounds checks. Type-shape is enforced by the typed
    // widgets in `DefaultValueInput`, so only range/membership can drift.
    const dv = draft.defaultValue;
    if (dv !== undefined) {
      if (
        draft.type === GQLActionParameterType.Number &&
        typeof dv === 'number'
      ) {
        if (draft.min !== undefined && dv < draft.min) {
          return `${at}: default below min.`;
        }
        if (draft.max !== undefined && dv > draft.max) {
          return `${at}: default above max.`;
        }
      }
      if (
        draft.type === GQLActionParameterType.String &&
        typeof dv === 'string' &&
        draft.maxLength !== undefined &&
        dv.length > draft.maxLength
      ) {
        return `${at}: default exceeds maxLength.`;
      }
    }
  }
  return null;
}

/**
 * Project an existing parameter (read from the API) into the draft shape used
 * by this editor.
 */
export function fromGraphQLParameters(
  parameters: ReadonlyArray<{
    readonly name: string;
    readonly displayName: string;
    readonly description?: string | null;
    readonly type: GQLActionParameterType;
    readonly required: boolean;
    readonly options?: ReadonlyArray<{
      readonly value: string;
      readonly label: string;
    }> | null;
    readonly min?: number | null;
    readonly max?: number | null;
    readonly maxLength?: number | null;
    readonly defaultValue?: unknown;
  }>,
): ActionParameterDraft[] {
  return parameters.map((p) => ({
    name: p.name,
    displayName: p.displayName,
    description: p.description ?? undefined,
    type: p.type,
    required: p.required,
    options: p.options
      ? p.options.map((o) => ({ value: o.value, label: o.label }))
      : undefined,
    min: p.min ?? undefined,
    max: p.max ?? undefined,
    maxLength: p.maxLength ?? undefined,
    defaultValue: p.defaultValue ?? undefined,
  }));
}

/**
 * Memoize a draft list keyed by the GraphQL response array reference. Avoids
 * blowing away in-progress local edits when the action query refetches.
 */
export function useParameterDraftsFromAction<
  T extends Parameters<typeof fromGraphQLParameters>[0],
>(parameters: T | undefined): ActionParameterDraft[] | undefined {
  return useMemo(
    () =>
      parameters === undefined ? undefined : fromGraphQLParameters(parameters),
    [parameters],
  );
}
