import { type Dependencies } from '../../iocContainer/index.js';
import { type ItemTypeKind } from '../../services/moderationConfigService/index.js';
import { makeBadRequestError, makeNotFoundError } from '../../utils/errors.js';
import { makeKyselyTransactionWithRetry } from '../../utils/kyselyTransactionWithRetry.js';
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
  const { kind, hiddenFields: _hiddenFields, ...input } = body;
  const normalized = {
    ...input,
    description: input.description ?? null,
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
  KyselyPg,
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
    const item = await makeKyselyTransactionWithRetry(KyselyPg)(async (trx) => {
      const config = ModerationConfigService.forTransaction(trx);
      const review = ManualReviewToolService.forTransaction(trx);
      const created = await createForKind(config, orgId, body);
      await review.setHiddenFieldsForItemType({
        orgId,
        itemTypeId: created.id,
        hiddenFields: body.hiddenFields ?? [],
      });
      return created;
    });
    await ModerationConfigService.invalidateLatestItemTypesCache(orgId);
    res.status(201).json(serializeItemType(item));
  };
}

export function patchItemType({
  KyselyPg,
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
    const item = await makeKyselyTransactionWithRetry(KyselyPg)(async (trx) => {
      const config = ModerationConfigService.forTransaction(trx);
      const review = ManualReviewToolService.forTransaction(trx);
      let updated;
      switch (current.kind) {
        case 'CONTENT':
          updated = await config.updateContentType(orgId, input);
          break;
        case 'THREAD':
          updated = await config.updateThreadType(orgId, input);
          break;
        case 'USER':
          updated = await config.updateUserType(orgId, input);
          break;
        default:
          return assertUnreachable(current);
      }
      if (hiddenFields !== undefined) {
        await review.setHiddenFieldsForItemType({
          orgId,
          itemTypeId: id,
          hiddenFields,
        });
      }
      return updated;
    });
    await ModerationConfigService.invalidateLatestItemTypesCache(orgId);
    res.status(200).json(serializeItemType(item));
  };
}
