import { type Dependencies } from '../../iocContainer/index.js';
import { makeNotFoundError } from '../../utils/errors.js';
import { type RequestHandlerWithBodies } from '../../utils/route-helpers.js';
import {
  requireId,
  requireOrgId,
  serializePolicy,
  type PolicyWrite,
} from '../configurationWrites.js';

export function createPolicy({
  ModerationConfigService,
}: Dependencies): RequestHandlerWithBodies<
  PolicyWrite,
  ReturnType<typeof serializePolicy>
> {
  return async (req, res) => {
    const orgId = requireOrgId(req);
    const policy = await ModerationConfigService.createPolicy({
      orgId,
      policy: {
        ...req.body,
        parentId: req.body.parentId ?? null,
        policyText: req.body.policyText ?? null,
        enforcementGuidelines: req.body.enforcementGuidelines ?? null,
        policyType: req.body.policyType ?? null,
      },
      actor: { type: 'organizationApiKey', orgId },
    });
    res.status(201).json(serializePolicy(policy));
  };
}

export function patchPolicy({
  ModerationConfigService,
}: Dependencies): RequestHandlerWithBodies<
  Partial<PolicyWrite>,
  ReturnType<typeof serializePolicy>
> {
  return async (req, res) => {
    const orgId = requireOrgId(req);
    const id = requireId(req.params.id, 'Policy');
    if (
      (await ModerationConfigService.getPolicy({
        orgId,
        policyId: id,
        readFromReplica: false,
      })) === undefined
    ) {
      throw makeNotFoundError('Policy not found', { shouldErrorSpan: true });
    }
    const policy = await ModerationConfigService.updatePolicy({
      orgId,
      policy: { ...req.body, id },
      actor: { type: 'organizationApiKey', orgId },
    });
    res.status(200).json(serializePolicy(policy));
  };
}
