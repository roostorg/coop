import { type Dependencies } from '../../iocContainer/index.js';
import { type RequestHandlerWithBodies } from '../../utils/route-helpers.js';
import {
  requireId,
  requireOrgId,
  serializePolicy,
  type PolicyPatch,
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
      invokedBy: { type: 'organizationApiKey', orgId },
    });
    res.status(201).json(serializePolicy(policy));
  };
}

export function patchPolicy({
  ModerationConfigService,
}: Dependencies): RequestHandlerWithBodies<
  PolicyPatch,
  ReturnType<typeof serializePolicy>
> {
  return async (req, res) => {
    const orgId = requireOrgId(req);
    const id = requireId(req.params.id, 'Policy');
    const policy = await ModerationConfigService.updatePolicy({
      orgId,
      policy: { ...req.body, id },
      invokedBy: { type: 'organizationApiKey', orgId },
    });
    res.status(200).json(serializePolicy(policy));
  };
}
