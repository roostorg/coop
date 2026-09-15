import { ContainerTypes, ScalarTypes } from '@roostorg/coop-types';
import { type JsonObject } from 'type-fest';

import {
  ItemTypeKind,
  parameterListSchema,
  parseStoredParameters,
  PolicyType,
  serializeParameters,
  type Action,
  type ItemSchema,
  type ItemType,
  type ItemTypeKind as ItemTypeKindValue,
  type Policy,
  type RawActionParameterInput,
} from '../services/moderationConfigService/index.js';
import { hasOrgId } from '../utils/apiKeyMiddleware.js';
import { makeBadRequestError, makeNotFoundError } from '../utils/errors.js';

export type PolicyWrite = {
  name: string;
  parentId?: string | null;
  policyText?: string | null;
  enforcementGuidelines?: string | null;
  policyType?: keyof typeof PolicyType | null;
  userStrikeCount?: number;
  applyUserStrikeCountConfigToChildren?: boolean;
};
export type ItemTypeWrite = {
  kind?: ItemTypeKindValue;
  name?: string;
  description?: string | null;
  schema?: ItemSchema;
  schemaFieldRoles?: Record<string, string | null>;
  hiddenFields?: string[];
};
export type ActionWrite = JsonObject & {
  name?: string;
  description?: string | null;
  itemTypeIds?: string[];
  callbackUrl?: string;
  callbackUrlHeaders?: JsonObject | null;
  callbackUrlBody?: JsonObject | null;
  applyUserStrikes?: boolean;
  parameters?: RawActionParameterInput[];
};

const nullableString = { type: ['string', 'null'] } as const;
const stringArray = { type: 'array', items: { type: 'string' } } as const;
const scalarValues = Object.keys(ScalarTypes);
const scalarField = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'type', 'required', 'container'],
  properties: {
    name: { type: 'string' },
    type: { enum: scalarValues },
    required: { type: 'boolean' },
    container: { type: 'null' },
  },
} as const;
const containerField = (type: 'ARRAY' | 'MAP') =>
  ({
    type: 'object',
    additionalProperties: false,
    required: ['name', 'type', 'required', 'container'],
    properties: {
      name: { type: 'string' },
      type: { enum: [type] },
      required: { type: 'boolean' },
      container: {
        type: 'object',
        additionalProperties: false,
        required: ['containerType', 'keyScalarType', 'valueScalarType'],
        properties: {
          containerType: { enum: [type] },
          keyScalarType:
            type === ContainerTypes.ARRAY
              ? { type: 'null' }
              : { enum: scalarValues },
          valueScalarType: { enum: scalarValues },
        },
      },
    },
  }) as const;
const schema = {
  type: 'array',
  minItems: 1,
  items: {
    oneOf: [scalarField, containerField('ARRAY'), containerField('MAP')],
  },
} as const;
const roleNames = [
  'displayName',
  'profileIcon',
  'backgroundImage',
  'createdAt',
  'isDeleted',
  'ipAddress',
  'email',
  'creatorId',
  'parentId',
  'threadId',
];
const schemaFieldRoles = {
  type: 'object',
  additionalProperties: false,
  properties: Object.fromEntries(
    roleNames.map((role) => [role, nullableString]),
  ),
} as const;
const policyProperties = {
  name: { type: 'string' },
  parentId: nullableString,
  policyText: nullableString,
  enforcementGuidelines: nullableString,
  policyType: { enum: [...Object.keys(PolicyType), null] },
  userStrikeCount: { type: 'integer', minimum: 0 },
  applyUserStrikeCountConfigToChildren: { type: 'boolean' },
};
const itemProperties = {
  kind: { enum: Object.keys(ItemTypeKind) },
  name: { type: 'string' },
  description: nullableString,
  schema,
  schemaFieldRoles,
  hiddenFields: stringArray,
};
const { kind: _kind, ...itemPatchProperties } = itemProperties;
const actionProperties = {
  name: { type: 'string' },
  description: nullableString,
  itemTypeIds: stringArray,
  callbackUrl: { type: 'string' },
  callbackUrlHeaders: { type: ['object', 'null'], additionalProperties: {} },
  callbackUrlBody: { type: ['object', 'null'], additionalProperties: {} },
  applyUserStrikes: { type: 'boolean' },
  parameters: parameterListSchema,
};
const objectSchema = (
  properties: object,
  required?: string[],
  patch = false,
) => ({
  $schema: 'http://json-schema.org/draft-04/schema#',
  type: 'object',
  additionalProperties: false,
  properties,
  ...(required ? { required } : {}),
  ...(patch ? { minProperties: 1 } : {}),
});
export const createPolicySchema = objectSchema(policyProperties, ['name']);
export const patchPolicySchema = objectSchema(
  policyProperties,
  undefined,
  true,
);
export const createItemTypeSchema = objectSchema(itemProperties, [
  'kind',
  'name',
  'schema',
  'schemaFieldRoles',
]);
export const patchItemTypeSchema = objectSchema(
  itemPatchProperties,
  undefined,
  true,
);
export const createActionSchema = objectSchema(actionProperties, [
  'name',
  'callbackUrl',
]);
export const patchActionSchema = objectSchema(
  actionProperties,
  undefined,
  true,
);

export function requireOrgId(req: unknown): string {
  if (!hasOrgId(req))
    throw makeBadRequestError('Invalid API Key', { shouldErrorSpan: true });
  return req.orgId;
}
export function requireId(
  value: string | string[] | undefined,
  resource: string,
): string {
  if (typeof value !== 'string')
    throw makeNotFoundError(`${resource} not found`, { shouldErrorSpan: true });
  return value;
}
export function serializePolicy(policy: Policy) {
  const {
    id,
    name,
    parentId,
    policyText,
    enforcementGuidelines,
    policyType,
    semanticVersion,
    userStrikeCount,
    applyUserStrikeCountConfigToChildren,
    penalty,
  } = policy;
  return {
    id,
    name,
    parentId: parentId ?? null,
    policyText,
    enforcementGuidelines,
    policyType,
    semanticVersion,
    userStrikeCount,
    applyUserStrikeCountConfigToChildren,
    penalty,
  };
}
export function serializeItemType(itemType: ItemType) {
  const { orgId: _orgId, ...publicItemType } = itemType;
  return publicItemType as JsonObject;
}
export function serializeAction(
  action: Action,
  itemTypeIds: string[],
): JsonObject {
  return {
    id: action.id,
    name: action.name,
    description: action.description,
    actionType: action.actionType,
    applyUserStrikes: action.applyUserStrikes,
    penalty: action.penalty,
    itemTypeIds,
    parameters: serializeParameters(
      parseStoredParameters(
        action.actionType === 'CUSTOM_ACTION'
          ? action.customMrtApiParams
          : null,
      ),
    ),
  };
}
