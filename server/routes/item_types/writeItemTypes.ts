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
  trx: Parameters<
    Dependencies['ModerationConfigService']['createContentType']
  >[2],
) {
  const { kind, hiddenFields: _hiddenFields, ...input } = body;
  const normalized = {
    ...input,
    description: input.description ?? null,
    schemaFieldRoles: roles(kind, input.schemaFieldRoles, false),
  };
  switch (kind) {
    case 'CONTENT':
      return service.createContentType(orgId, normalized, trx);
    case 'THREAD':
      return service.createThreadType(orgId, normalized, trx);
    case 'USER':
      return service.createUserType(orgId, normalized, trx);
    default:
      return assertUnreachable(kind);
  }
}

export function createItemType({
  ModerationConfigService,
  ManualReviewToolService,
}: Dependencies): RequestHandlerWithBodies<
  ItemTypeWrite,
  ReturnType<typeof serializeItemType>
> {
  return async (req, res) => {
    const orgId = requireOrgId(req);
    const body = req.body as ItemTypeWrite & {
      kind: ItemTypeKind;
      name: string;
      schema: NonNullable<ItemTypeWrite['schema']>;
      schemaFieldRoles: Record<string, string | null>;
    };
    const item = await ModerationConfigService.withItemTypeTransaction(
      orgId,
      async (trx) => {
        const created = await createForKind(
          ModerationConfigService,
          orgId,
          body,
          trx,
        );
        await ManualReviewToolService.setHiddenFieldsForItemType(
          {
            orgId,
            itemTypeId: created.id,
            hiddenFields: body.hiddenFields ?? [],
          },
          trx,
        );
        return created;
      },
    );
    res.status(201).json(serializeItemType(item));
  };
}

export function patchItemType({
  ModerationConfigService,
  ManualReviewToolService,
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
    const { schemaFieldRoles, hiddenFields, ...rest } = req.body;
    const input = {
      ...rest,
      id,
      ...(schemaFieldRoles === undefined
        ? {}
        : { schemaFieldRoles: roles(current.kind, schemaFieldRoles, true) }),
    };
    const item = await ModerationConfigService.withItemTypeTransaction(
      orgId,
      async (trx) => {
        let updated;
        switch (current.kind) {
          case 'CONTENT':
            updated = await ModerationConfigService.updateContentType(
              orgId,
              input,
              trx,
            );
            break;
          case 'THREAD':
            updated = await ModerationConfigService.updateThreadType(
              orgId,
              input,
              trx,
            );
            break;
          case 'USER':
            updated = await ModerationConfigService.updateUserType(
              orgId,
              input,
              trx,
            );
            break;
          default:
            return assertUnreachable(current);
        }
        if (hiddenFields !== undefined) {
          await ManualReviewToolService.setHiddenFieldsForItemType(
            { orgId, itemTypeId: id, hiddenFields },
            trx,
          );
        }
        return updated;
      },
    );
    res.status(200).json(serializeItemType(item));
  };
}
