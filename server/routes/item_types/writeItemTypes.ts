import { type Dependencies } from '../../iocContainer/index.js';
import { type ItemTypeKind } from '../../services/moderationConfigService/index.js';
import { makeBadRequestError, makeNotFoundError } from '../../utils/errors.js';
import { assertUnreachable } from '../../utils/misc.js';
import { type RequestHandlerWithBodies } from '../../utils/route-helpers.js';
import {
  requireId,
  requireOrgId,
  serializeItemType,
  type ItemTypeWrite,
} from '../configurationWrites.js';

function roles(
  kind: ItemTypeKind,
  supplied: Record<string, string | null>,
  complete: boolean,
) {
  const valid = {
    CONTENT: [
      'displayName',
      'createdAt',
      'creatorId',
      'isDeleted',
      'ipAddress',
      'parentId',
      'threadId',
    ],
    THREAD: ['displayName', 'createdAt', 'creatorId', 'isDeleted', 'ipAddress'],
    USER: [
      'displayName',
      'profileIcon',
      'backgroundImage',
      'createdAt',
      'isDeleted',
      'ipAddress',
      'email',
    ],
  }[kind];
  if (Object.keys(supplied).some((role) => !valid.includes(role))) {
    throw makeBadRequestError(
      `Invalid schema field role for ${kind} item type`,
      { shouldErrorSpan: true },
    );
  }
  return complete
    ? Object.fromEntries(valid.map((role) => [role, supplied[role] ?? null]))
    : supplied;
}

async function createForKind(
  service: Dependencies['ModerationConfigService'],
  orgId: string,
  body: ItemTypeWrite & {
    kind: ItemTypeKind;
    name: string;
    schema: NonNullable<ItemTypeWrite['schema']>;
    schemaFieldRoles: Record<string, string | null>;
  },
) {
  const { kind, ...input } = body;
  const normalized = {
    ...input,
    description: input.description ?? null,
    hiddenFields: input.hiddenFields ?? [],
    schemaFieldRoles: roles(kind, input.schemaFieldRoles, false),
  };
  switch (kind) {
    case 'CONTENT':
      return service.createContentType(orgId, normalized);
    case 'THREAD':
      return service.createThreadType(orgId, normalized);
    case 'USER':
      return service.createUserType(orgId, normalized);
    default:
      return assertUnreachable(kind);
  }
}

export function createItemType({
  ModerationConfigService,
}: Dependencies): RequestHandlerWithBodies<
  ItemTypeWrite,
  ReturnType<typeof serializeItemType>
> {
  return async (req, res) => {
    const item = await createForKind(
      ModerationConfigService,
      requireOrgId(req),
      req.body as ItemTypeWrite & {
        kind: ItemTypeKind;
        name: string;
        schema: NonNullable<ItemTypeWrite['schema']>;
        schemaFieldRoles: Record<string, string | null>;
      },
    );
    res.status(201).json(serializeItemType(item));
  };
}

export function patchItemType({
  ModerationConfigService,
}: Dependencies): RequestHandlerWithBodies<
  ItemTypeWrite,
  ReturnType<typeof serializeItemType>
> {
  return async (req, res) => {
    const orgId = requireOrgId(req);
    const id = requireId(req.params.id, 'Item type');
    const current = await ModerationConfigService.getItemType({
      orgId,
      itemTypeSelector: { id, schemaVariant: 'original' },
      directives: { maxAge: 0 },
    });
    if (current === undefined)
      throw makeNotFoundError('Item type not found', { shouldErrorSpan: true });
    const { schemaFieldRoles, ...rest } = req.body;
    const input = {
      ...rest,
      id,
      ...(schemaFieldRoles === undefined
        ? {}
        : { schemaFieldRoles: roles(current.kind, schemaFieldRoles, true) }),
    };
    let item;
    switch (current.kind) {
      case 'CONTENT':
        item = await ModerationConfigService.updateContentType(orgId, input);
        break;
      case 'THREAD':
        item = await ModerationConfigService.updateThreadType(orgId, input);
        break;
      case 'USER':
        item = await ModerationConfigService.updateUserType(orgId, input);
        break;
      default:
        return assertUnreachable(current);
    }
    res.status(200).json(serializeItemType(item));
  };
}
