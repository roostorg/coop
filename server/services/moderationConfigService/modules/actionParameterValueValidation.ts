import { makeBadRequestError } from '../../../utils/errors.js';
import { logErrorJson } from '../../../utils/logging.js';
import { assertUnreachable } from '../../../utils/misc.js';
import {
  parseStoredParameters,
  type ActionParameter,
} from './actionParametersValidation.js';

function makeInvalidParameterValueError(detail: string) {
  return makeBadRequestError('Invalid action parameter value', {
    detail,
    shouldErrorSpan: false,
  });
}

/**
 * Validate moderator-supplied runtime values against an action's parameter
 * spec. Used at execution time on every code path that publishes an action
 * (GraphQL `bulkExecuteActions`, REST `submitAction`, MRT decision submit).
 *
 * Behavior:
 * - Required parameters must be present (or have a `defaultValue`); missing
 *   ones throw. Empty-string (STRING/SELECT) and `[]` (MULTISELECT) also
 *   count as missing for required parameters; `0` and `false` do not.
 * - Each value must match its declared `type` (and `min`/`max`/`maxLength`
 *   /`options` when applicable).
 * - Unknown keys (not declared in the spec) are rejected to avoid silently
 *   smuggling extra fields into the webhook payload.
 *
 * Returns a fresh object containing only declared keys with coerced values.
 * Defaults are applied for omitted optional parameters that have a
 * `defaultValue` set; omitted optionals without a default are dropped (not
 * sent as `undefined`).
 *
 * Accepts `unknown` for `rawValues` so untrusted REST/GraphQL bodies can be
 * passed in directly without callers pre-narrowing.
 */
export function validateActionParameterValues(
  spec: readonly ActionParameter[],
  rawValues: unknown,
): Record<string, unknown> {
  if (
    rawValues != null &&
    (typeof rawValues !== 'object' || Array.isArray(rawValues))
  ) {
    throw makeInvalidParameterValueError(
      'parameters must be a plain object keyed by parameter name',
    );
  }
  const values: Readonly<Record<string, unknown>> =
    (rawValues as Readonly<Record<string, unknown>> | null | undefined) ?? {};
  const declaredKeys = new Set(spec.map((p) => p.name));

  for (const key of Object.keys(values)) {
    if (!declaredKeys.has(key)) {
      throw makeInvalidParameterValueError(`Unknown parameter "${key}"`);
    }
  }

  const out: Record<string, unknown> = {};
  for (const param of spec) {
    const supplied = Object.prototype.hasOwnProperty.call(values, param.name)
      ? values[param.name]
      : undefined;
    const effective = supplied !== undefined ? supplied : param.defaultValue;

    if (isMissingForRequired(param, effective)) {
      if (param.required) {
        throw makeInvalidParameterValueError(
          `Parameter "${param.name}" is required`,
        );
      }
      continue;
    }

    out[param.name] = coerceValueOrThrow(param, effective);
  }
  return out;
}

/**
 * Resolve parameter values for an automated (moderator-less) path — proactive
 * rules and user-strike thresholds — where values were configured up front.
 *
 * Unlike {@link validateActionParameterValues}, this never throws: a rule
 * firing on incoming content can't surface an error to a human, and throwing
 * would abort the item's whole action-publishing. On a validation failure it
 * logs and falls back to the spec's `defaultValue`s (`{}` if those fail too).
 * Returns `undefined` when the action declares no parameters.
 */
export function resolveConfiguredActionParameterValues(opts: {
  customMrtApiParams: unknown;
  rawValues: unknown;
  actionId: string;
}): Record<string, unknown> | undefined {
  const spec = parseStoredParameters(opts.customMrtApiParams);
  if (spec.length === 0) {
    return undefined;
  }
  try {
    return validateActionParameterValues(spec, opts.rawValues);
  } catch (error) {
    // eslint-disable-next-line no-restricted-syntax
    logErrorJson({
      message: `Configured action parameter values failed validation; falling back to defaults actionId=${opts.actionId}`,
      error,
    });
    try {
      return validateActionParameterValues(spec, null);
    } catch {
      return {};
    }
  }
}

// Treats null/undefined as missing for any type. Additionally treats
// whitespace-only strings as missing for STRING/SELECT, and `[]` as missing
// for MULTISELECT — these would otherwise pass the required check while
// being semantically empty. NUMBER 0 and BOOLEAN false remain valid.
function isMissingForRequired(param: ActionParameter, value: unknown): boolean {
  if (value === undefined || value === null) return true;
  switch (param.type) {
    case 'STRING':
    case 'SELECT':
      return typeof value === 'string' && value.trim() === '';
    case 'MULTISELECT':
      return Array.isArray(value) && value.length === 0;
    case 'NUMBER':
    case 'BOOLEAN':
      return false;
    default:
      return assertUnreachable(param.type);
  }
}

function coerceValueOrThrow(param: ActionParameter, value: unknown): unknown {
  const reject = (msg: string): never => {
    throw makeInvalidParameterValueError(`Parameter "${param.name}": ${msg}`);
  };
  switch (param.type) {
    case 'STRING': {
      if (typeof value !== 'string') return reject('expected a string');
      if (param.maxLength !== undefined && value.length > param.maxLength) {
        return reject(`exceeds maxLength of ${param.maxLength}`);
      }
      return value;
    }
    case 'NUMBER': {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return reject('expected a finite number');
      }
      if (param.min !== undefined && value < param.min) {
        return reject(`below min of ${param.min}`);
      }
      if (param.max !== undefined && value > param.max) {
        return reject(`above max of ${param.max}`);
      }
      return value;
    }
    case 'BOOLEAN': {
      if (typeof value !== 'boolean') return reject('expected a boolean');
      return value;
    }
    case 'SELECT': {
      const allowed = (param.options ?? []).map((o) => o.value);
      if (typeof value !== 'string' || !allowed.includes(value)) {
        return reject('not one of the allowed option values');
      }
      return value;
    }
    case 'MULTISELECT': {
      const allowed = new Set((param.options ?? []).map((o) => o.value));
      if (
        !Array.isArray(value) ||
        !value.every((v) => typeof v === 'string' && allowed.has(v))
      ) {
        return reject('expected an array of allowed option values');
      }
      // Defensive copy; downstream consumers shouldn't share array refs with
      // the caller's request body.
      return [...value];
    }
    default:
      return assertUnreachable(param.type);
  }
}
