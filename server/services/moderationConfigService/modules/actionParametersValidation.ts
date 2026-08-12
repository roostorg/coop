import _Ajv, { type ErrorObject } from 'ajv-draft-04';
import { type JsonValue } from 'type-fest';

import { makeBadRequestError } from '../../../utils/errors.js';
import { assertUnreachable } from '../../../utils/misc.js';

// `ajv-draft-04` is CJS.
const Ajv = _Ajv as unknown as typeof _Ajv.default;

export const ACTION_PARAMETER_TYPES = [
  'STRING',
  'NUMBER',
  'BOOLEAN',
  'SELECT',
  'MULTISELECT',
] as const;
export type ActionParameterType = (typeof ACTION_PARAMETER_TYPES)[number];

export type ActionParameterOption = {
  value: string;
  label: string;
};

export type ActionParameter = {
  name: string;
  displayName: string;
  description?: string;
  type: ActionParameterType;
  required: boolean;
  options?: readonly ActionParameterOption[];
  min?: number;
  max?: number;
  maxLength?: number;
  defaultValue?: unknown;
};

/**
 * Pre-validation shape — what GraphQL/REST callers hand us before AJV runs.
 * Looser than `ActionParameter` (any string-keyed object); we use this in
 * service-layer signatures so the type makes the "needs validation" boundary
 * obvious without forcing callers to pre-narrow null vs undefined.
 */
export type RawActionParameterInput = Readonly<Record<string, unknown>>;

// Names become keys in the webhook payload's `body.custom`. We allow letters,
// digits, `_`, `-`, and `.` so consumers can use snake_case, kebab-case, or
// dotted namespacing; whitespace, quotes, and brackets are rejected because
// they break dotted access in most languages and need escaping in URLs/logs.
const PARAMETER_NAME_PATTERN = '^[a-zA-Z0-9_.\\-]+$';

const optionSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['value', 'label'],
  properties: {
    value: { type: 'string', minLength: 1, maxLength: 200 },
    label: { type: 'string', minLength: 1, maxLength: 200 },
  },
} as const;

// Structural shape only. Per-type rules (options required for SELECT, default
// matches type, min<=max) live in `validatePerTypeRules` because expressing
// them in JSON Schema draft-04 is verbose and harder to read.
const parameterSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'displayName', 'type', 'required'],
  properties: {
    name: {
      type: 'string',
      minLength: 1,
      maxLength: 64,
      pattern: PARAMETER_NAME_PATTERN,
    },
    displayName: { type: 'string', minLength: 1, maxLength: 200 },
    description: { type: 'string', maxLength: 2000 },
    type: { enum: [...ACTION_PARAMETER_TYPES] },
    required: { type: 'boolean' },
    options: { type: 'array', items: optionSchema, minItems: 1, maxItems: 100 },
    min: { type: 'number' },
    max: { type: 'number' },
    maxLength: { type: 'integer', minimum: 1, maximum: 100000 },
    defaultValue: {},
  },
} as const;

const parameterListSchema = {
  type: 'array',
  items: parameterSchema,
  maxItems: 50,
} as const;

const ajv = new Ajv({ allErrors: true, strictSchema: true });
const validateStructure = ajv.compile(parameterListSchema);

/**
 * Throw a `CoopError` if `parameters` is not a valid action parameter list.
 * Narrows `unknown` to `ActionParameter[]` on success.
 */
export function validateActionParameters(
  parameters: unknown,
): readonly ActionParameter[] {
  if (parameters == null) {
    return [];
  }

  if (!validateStructure(parameters)) {
    throw makeInvalidParameterError(formatAjvErrors(validateStructure.errors));
  }

  const list = parameters as ActionParameter[];

  const seenNames = new Set<string>();
  for (const [index, param] of list.entries()) {
    if (seenNames.has(param.name)) {
      throw makeInvalidParameterError(
        `parameters[${index}].name "${param.name}" is duplicated`,
      );
    }
    seenNames.add(param.name);

    validatePerTypeRules(param, index);
  }

  return list;
}

function validatePerTypeRules(param: ActionParameter, index: number): void {
  switch (param.type) {
    case 'STRING':
      validateStringRules(param, index);
      return;
    case 'NUMBER':
      validateNumberRules(param, index);
      return;
    case 'BOOLEAN':
      validateBooleanRules(param, index);
      return;
    case 'SELECT':
    case 'MULTISELECT':
      validateSelectRules(param, index);
      return;
    default:
      // AJV's `enum` keyword has already rejected unknown `type` values; this
      // branch only exists to satisfy the exhaustiveness check.
      assertUnreachable(param.type);
  }
}

const at = (index: number, suffix: string) => `parameters[${index}].${suffix}`;

function validateStringRules(param: ActionParameter, index: number): void {
  if (param.options !== undefined) {
    throw makeInvalidParameterError(
      `${at(index, 'options')} is not allowed for STRING parameters`,
    );
  }
  if (param.min !== undefined || param.max !== undefined) {
    throw makeInvalidParameterError(
      `${at(index, 'min/max')} is not allowed for STRING (use maxLength)`,
    );
  }
  if (
    param.defaultValue !== undefined &&
    typeof param.defaultValue !== 'string'
  ) {
    throw makeInvalidParameterError(
      `${at(index, 'defaultValue')} must be a string for STRING parameters`,
    );
  }
  if (
    param.maxLength !== undefined &&
    typeof param.defaultValue === 'string' &&
    param.defaultValue.length > param.maxLength
  ) {
    throw makeInvalidParameterError(
      `${at(index, 'defaultValue')} exceeds maxLength`,
    );
  }
  // An empty default on a required field would silently pass the runtime
  // required-check. Reject at authoring time so the spec is internally
  // consistent.
  if (
    param.required &&
    typeof param.defaultValue === 'string' &&
    param.defaultValue.trim() === ''
  ) {
    throw makeInvalidParameterError(
      `${at(index, 'defaultValue')} cannot be empty when the parameter is required`,
    );
  }
}

function validateNumberRules(param: ActionParameter, index: number): void {
  if (param.options !== undefined) {
    throw makeInvalidParameterError(
      `${at(index, 'options')} is not allowed for NUMBER parameters`,
    );
  }
  if (param.maxLength !== undefined) {
    throw makeInvalidParameterError(
      `${at(index, 'maxLength')} is not allowed for NUMBER parameters`,
    );
  }
  if (
    param.min !== undefined &&
    param.max !== undefined &&
    param.min > param.max
  ) {
    throw makeInvalidParameterError(`${at(index, 'min')} must be <= max`);
  }
  if (param.defaultValue === undefined) return;
  if (
    typeof param.defaultValue !== 'number' ||
    Number.isNaN(param.defaultValue)
  ) {
    throw makeInvalidParameterError(
      `${at(index, 'defaultValue')} must be a number for NUMBER parameters`,
    );
  }
  if (param.min !== undefined && param.defaultValue < param.min) {
    throw makeInvalidParameterError(
      `${at(index, 'defaultValue')} is below min`,
    );
  }
  if (param.max !== undefined && param.defaultValue > param.max) {
    throw makeInvalidParameterError(
      `${at(index, 'defaultValue')} is above max`,
    );
  }
}

function validateBooleanRules(param: ActionParameter, index: number): void {
  if (
    param.options !== undefined ||
    param.min !== undefined ||
    param.max !== undefined ||
    param.maxLength !== undefined
  ) {
    throw makeInvalidParameterError(
      `${at(index, '')} only "defaultValue" is allowed alongside type=BOOLEAN`,
    );
  }
  if (
    param.defaultValue !== undefined &&
    typeof param.defaultValue !== 'boolean'
  ) {
    throw makeInvalidParameterError(
      `${at(index, 'defaultValue')} must be a boolean for BOOLEAN parameters`,
    );
  }
}

function validateSelectRules(param: ActionParameter, index: number): void {
  if (param.options === undefined || param.options.length === 0) {
    throw makeInvalidParameterError(
      `${at(index, 'options')} is required for ${param.type} parameters`,
    );
  }
  if (
    param.min !== undefined ||
    param.max !== undefined ||
    param.maxLength !== undefined
  ) {
    throw makeInvalidParameterError(
      `${at(index, '')} min/max/maxLength are not allowed for ${param.type} parameters`,
    );
  }
  const optionValues = new Set<string>();
  for (const [i, option] of param.options.entries()) {
    if (optionValues.has(option.value)) {
      throw makeInvalidParameterError(
        `${at(index, `options[${i}].value`)} "${option.value}" is duplicated`,
      );
    }
    optionValues.add(option.value);
  }
  if (param.defaultValue === undefined) return;
  const ok =
    param.type === 'SELECT'
      ? typeof param.defaultValue === 'string' &&
        optionValues.has(param.defaultValue)
      : Array.isArray(param.defaultValue) &&
        param.defaultValue.every(
          (v) => typeof v === 'string' && optionValues.has(v),
        );
  if (!ok) {
    throw makeInvalidParameterError(
      param.type === 'SELECT'
        ? `${at(index, 'defaultValue')} must be one of the option values`
        : `${at(index, 'defaultValue')} must be an array of option values`,
    );
  }
  // An empty MULTISELECT default on a required field would silently pass the
  // runtime required-check. SELECT defaults of `''` are already rejected by
  // the `optionValues.has` check above (option values must be minLength 1).
  if (
    param.required &&
    param.type === 'MULTISELECT' &&
    Array.isArray(param.defaultValue) &&
    param.defaultValue.length === 0
  ) {
    throw makeInvalidParameterError(
      `${at(index, 'defaultValue')} cannot be empty when the parameter is required`,
    );
  }
}

function formatAjvErrors(
  errors: readonly ErrorObject[] | null | undefined,
): string {
  if (!errors || errors.length === 0) return 'invalid action parameters';
  return errors
    .map(
      (err) => `${err.instancePath || '/'}: ${err.message ?? 'invalid value'}`,
    )
    .join('; ');
}

/**
 * Recover a typed parameter list from the loose `JsonValue | null` stored in
 * `actions.custom_mrt_api_params`. Designed to be defensive: silently drops
 * any entry that doesn't validate so legacy rows written before the AJV-
 * validated authoring path (PR 1) don't crash readers/executors.
 *
 * Use this anywhere you need to act on an action's parameter spec at
 * execution time — distinct from `validateActionParameters`, which is the
 * write-side AJV validator.
 */
export function parseStoredParameters(value: unknown): ActionParameter[] {
  if (!Array.isArray(value)) return [];
  const allowedTypes = ACTION_PARAMETER_TYPES as readonly string[];
  const out: ActionParameter[] = [];
  for (const raw of value) {
    if (typeof raw !== 'object' || raw === null) continue;
    const obj = raw as Record<string, unknown>;
    const name = typeof obj.name === 'string' ? obj.name : null;
    const displayName =
      typeof obj.displayName === 'string' ? obj.displayName : null;
    const typeRaw = typeof obj.type === 'string' ? obj.type : null;
    if (name === null || displayName === null || typeRaw === null) continue;
    if (!allowedTypes.includes(typeRaw)) continue;
    const parsed: ActionParameter = {
      name,
      displayName,
      type: typeRaw as ActionParameterType,
      required: obj.required === true,
    };
    if (typeof obj.description === 'string')
      parsed.description = obj.description;
    if (Array.isArray(obj.options)) {
      const options: ActionParameterOption[] = [];
      for (const opt of obj.options) {
        if (typeof opt !== 'object' || opt === null) continue;
        const o = opt as Record<string, unknown>;
        if (typeof o.value === 'string' && typeof o.label === 'string') {
          options.push({ value: o.value, label: o.label });
        }
      }
      if (options.length > 0) parsed.options = options;
    }
    if (typeof obj.min === 'number') parsed.min = obj.min;
    if (typeof obj.max === 'number') parsed.max = obj.max;
    if (typeof obj.maxLength === 'number') parsed.maxLength = obj.maxLength;
    if ('defaultValue' in obj) parsed.defaultValue = obj.defaultValue;
    out.push(parsed);
  }
  return out;
}

function makeInvalidParameterError(detail: string) {
  return makeBadRequestError('Invalid action parameters', {
    detail,
    shouldErrorSpan: false,
  });
}

/**
 * Serialize a validated parameter list to the shape the DB driver expects for
 * `actions.custom_mrt_api_params jsonb[]`. Returns `[]` (the column default)
 * when the caller passed an empty list, so writes stay deterministic.
 */
export function serializeParameters(
  parameters: readonly ActionParameter[],
): JsonValue[] {
  return parameters.map((param) => {
    const out: Record<string, JsonValue> = {
      name: param.name,
      displayName: param.displayName,
      type: param.type,
      required: param.required,
    };
    if (param.description !== undefined) out.description = param.description;
    if (param.options !== undefined) {
      out.options = param.options.map((o) => ({
        value: o.value,
        label: o.label,
      }));
    }
    if (param.min !== undefined) out.min = param.min;
    if (param.max !== undefined) out.max = param.max;
    if (param.maxLength !== undefined) out.maxLength = param.maxLength;
    if (param.defaultValue !== undefined)
      out.defaultValue = param.defaultValue as JsonValue;
    return out;
  });
}
