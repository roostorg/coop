import { ContainerTypes, ScalarTypes } from '@roostorg/coop-types';
import { type JsonObject, type JsonValue } from 'type-fest';
import * as v from 'valibot';

import {
  ItemTypeKind,
  itemTypeRoleNames,
  parameterListSchema,
  parseStoredParameters,
  PolicyType,
  serializeParameters,
  type Action,
  type ItemType,
  type Policy,
} from '../services/moderationConfigService/index.js';
import { hasOrgId } from '../utils/apiKeyMiddleware.js';
import { makeBadRequestError, makeNotFoundError } from '../utils/errors.js';

const nullableString = v.nullable(v.string());
const stringArray = v.array(v.string());
const scalarField = v.strictObject({
  name: v.string(),
  type: v.enum(ScalarTypes),
  required: v.boolean(),
  container: v.null(),
});
const arrayField = v.strictObject({
  name: v.string(),
  type: v.literal(ContainerTypes.ARRAY),
  required: v.boolean(),
  container: v.strictObject({
    containerType: v.literal(ContainerTypes.ARRAY),
    keyScalarType: v.null(),
    valueScalarType: v.enum(ScalarTypes),
  }),
});
const mapField = v.strictObject({
  name: v.string(),
  type: v.literal(ContainerTypes.MAP),
  required: v.boolean(),
  container: v.strictObject({
    containerType: v.literal(ContainerTypes.MAP),
    keyScalarType: v.enum(ScalarTypes),
    valueScalarType: v.enum(ScalarTypes),
  }),
});
const fieldSchema = v.union([scalarField, arrayField, mapField]);
const schema = v.tupleWithRest([fieldSchema], fieldSchema);
const roleNames = [...new Set(Object.values(itemTypeRoleNames).flat())];
type RoleName =
  (typeof itemTypeRoleNames)[keyof typeof itemTypeRoleNames][number];
const schemaFieldRoles = v.strictObject(
  Object.fromEntries(
    roleNames.map((role) => [role, v.optional(nullableString)]),
  ) as Record<RoleName, v.OptionalSchema<typeof nullableString, undefined>>,
);
const policyProperties = {
  name: v.string(),
  parentId: nullableString,
  policyText: nullableString,
  enforcementGuidelines: nullableString,
  policyType: v.nullable(v.enum(PolicyType)),
  userStrikeCount: v.pipe(v.number(), v.integer(), v.minValue(0)),
  applyUserStrikeCountConfigToChildren: v.boolean(),
};
const itemProperties = {
  kind: v.enum(ItemTypeKind),
  name: v.string(),
  description: nullableString,
  schema,
  schemaFieldRoles,
  hiddenFields: stringArray,
};
const { kind: _kind, ...itemPatchProperties } = itemProperties;
const permissiveObject = v.custom<JsonObject>(
  (value) =>
    typeof value === 'object' && value !== null && !Array.isArray(value),
);
type JsonActionParameter = Omit<
  v.InferInput<typeof parameterListSchema>[number],
  'defaultValue'
> & { defaultValue?: JsonValue };
const actionParameterListSchema = v.pipe(
  v.custom<JsonActionParameter[]>(Array.isArray),
  v.transform((value): v.InferInput<typeof parameterListSchema> => value),
  parameterListSchema,
);
const actionProperties = {
  name: v.string(),
  description: nullableString,
  itemTypeIds: stringArray,
  callbackUrl: v.string(),
  callbackUrlHeaders: v.nullable(permissiveObject),
  callbackUrlBody: v.nullable(permissiveObject),
  applyUserStrikes: v.boolean(),
  parameters: actionParameterListSchema,
};
const nonemptyPatch = <TEntries extends v.ObjectEntries>(entries: TEntries) =>
  v.pipe(
    v.partial(v.strictObject(entries)),
    v.check((value) => Object.keys(value).length > 0),
  );

export const createPolicySchema = v.strictObject({
  name: policyProperties.name,
  parentId: v.optional(policyProperties.parentId),
  policyText: v.optional(policyProperties.policyText),
  enforcementGuidelines: v.optional(policyProperties.enforcementGuidelines),
  policyType: v.optional(policyProperties.policyType),
  userStrikeCount: v.optional(policyProperties.userStrikeCount),
  applyUserStrikeCountConfigToChildren: v.optional(
    policyProperties.applyUserStrikeCountConfigToChildren,
  ),
});
export const patchPolicySchema = nonemptyPatch(policyProperties);
export type PolicyWrite = v.InferOutput<typeof createPolicySchema>;
export type PolicyPatch = v.InferOutput<typeof patchPolicySchema>;

export const createItemTypeSchema = v.strictObject({
  kind: itemProperties.kind,
  name: itemProperties.name,
  description: v.optional(itemProperties.description),
  schema: itemProperties.schema,
  schemaFieldRoles: itemProperties.schemaFieldRoles,
  hiddenFields: v.optional(itemProperties.hiddenFields),
});
export const patchItemTypeSchema = nonemptyPatch(itemPatchProperties);
export type CreateItemTypeWrite = v.InferOutput<typeof createItemTypeSchema>;
export type ItemTypeWrite = v.InferOutput<typeof patchItemTypeSchema>;

export const createActionSchema = v.strictObject({
  name: actionProperties.name,
  description: v.optional(actionProperties.description),
  itemTypeIds: v.optional(actionProperties.itemTypeIds),
  callbackUrl: actionProperties.callbackUrl,
  callbackUrlHeaders: v.optional(actionProperties.callbackUrlHeaders),
  callbackUrlBody: v.optional(actionProperties.callbackUrlBody),
  applyUserStrikes: v.optional(actionProperties.applyUserStrikes),
  parameters: v.optional(actionProperties.parameters),
});
export const patchActionSchema = nonemptyPatch(actionProperties);
export type CreateActionWrite = v.InferInput<typeof createActionSchema>;
export type ActionWrite = v.InferInput<typeof patchActionSchema>;

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
