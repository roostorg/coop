import { type Dependencies } from '../../iocContainer/index.js';
import { type RequestHandlerWithBodies } from '../../utils/route-helpers.js';
import {
  requireId,
  requireOrgId,
  serializeAction,
  type ActionWrite,
} from '../configurationWrites.js';

async function responseItemTypes(
  service: Dependencies['ModerationConfigService'],
  orgId: string,
  id: string,
) {
  return (await service.getActionItemTypeIds({ orgId })).get(id) ?? [];
}

export function createCustomAction({
  ModerationConfigService,
}: Dependencies): RequestHandlerWithBodies<
  ActionWrite,
  ReturnType<typeof serializeAction>
> {
  return async (req, res) => {
    const orgId = requireOrgId(req);
    const body = req.body as ActionWrite & {
      name: string;
      callbackUrl: string;
    };
    const input = {
      ...body,
      description: body.description ?? null,
      itemTypeIds: body.itemTypeIds ?? [],
      callbackUrlHeaders: body.callbackUrlHeaders ?? null,
      callbackUrlBody: body.callbackUrlBody ?? null,
      applyUserStrikes: body.applyUserStrikes ?? false,
      parameters: body.parameters ?? [],
      type: 'CUSTOM_ACTION' as const,
    };
    const action = await ModerationConfigService.createAction(orgId, input);
    res.status(201).json(serializeAction(action, input.itemTypeIds));
  };
}

export function patchCustomAction({
  ModerationConfigService,
}: Dependencies): RequestHandlerWithBodies<
  ActionWrite,
  ReturnType<typeof serializeAction>
> {
  return async (req, res) => {
    const orgId = requireOrgId(req);
    const actionId = requireId(req.params.id, 'Action');
    const { itemTypeIds, ...patch } = req.body;
    const action = await ModerationConfigService.updateCustomAction(orgId, {
      actionId,
      patch,
      ...(itemTypeIds === undefined ? {} : { itemTypeIds }),
    });
    res
      .status(200)
      .json(
        serializeAction(
          action,
          await responseItemTypes(ModerationConfigService, orgId, actionId),
        ),
      );
  };
}
