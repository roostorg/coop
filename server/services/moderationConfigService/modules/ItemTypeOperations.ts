/* eslint-disable max-lines */
import { type ReadonlyDeep } from 'type-fest';
import { uid } from 'uid';

import { type ConsumerDirectives } from '../../../lib/cache/index.js';
import {
  isPrismaTransaction,
  Prisma,
  type PrismaPgQueryable,
} from '../../../storage/prisma/index.js';
import { cached, type Cached } from '../../../utils/caching.js';
import {
  CoopError,
  ErrorType,
  isCoopErrorOfType,
  makeNotFoundError,
} from '../../../utils/errors.js';
import {
  getPgErrorDetails,
  isUniqueViolationError,
} from '../../../utils/kysely.js';
import {
  __throw,
  assertUnreachable,
  removeUndefinedKeys,
} from '../../../utils/misc.js';
import { replaceEmptyStringWithNull } from '../../../utils/string.js';
import { type CollapseCases } from '../../../utils/typescript-types.js';
import { makeItemTypeNameAlreadyExistsError } from '../errors.js';
import {
  type ContentItemType,
  type ItemType,
  type ItemTypeIdentifier,
  type ItemTypeKind,
  type ItemTypeSchemaVariant,
  type ThreadItemType,
  type UserItemType,
} from '../index.js';
import { runInPrismaTransaction } from '../prismaTransaction.js';
import {
  getPartialSchemaFromOriginal,
  type ItemSchema,
  type ItemTypeSelector,
} from '../types/itemTypes.js';
import {
  assertValidItemSchema,
  assertValidItemTypeFieldRoles,
  mergeItemTypeRoleColumns,
  type ItemTypeRoleColumns,
} from './itemTypeSchemaValidation.js';

const itemTypeVersionsSelection = Prisma.sql`
  id,
  name,
  description,
  kind::text AS kind,
  fields,
  to_char(timezone('UTC'::text, version), 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'::text) AS version,
  display_name_field AS "displayNameField",
  creator_id_field AS "creatorIdField",
  thread_id_field AS "threadIdField",
  parent_id_field AS "parentIdField",
  created_at_field AS "createdAtField",
  is_deleted_field AS "isDeletedField",
  profile_icon_field AS "profileIconField",
  background_image_field AS "backgroundImageField",
  ip_address_field AS "ipAddressField",
  email_field AS "emailField",
  org_id AS "orgId",
  is_default_user AS "isDefaultUserType"`;

type ItemTypeDbResult = {
  id: string;
  name: string;
  description: string | null;
  kind: ItemTypeKind;
  fields: ItemSchema;
  version: string;
  displayNameField: string | null;
  creatorIdField: string | null;
  threadIdField: string | null;
  parentIdField: string | null;
  createdAtField: string | null;
  isDeletedField: string | null;
  profileIconField: string | null;
  backgroundImageField: string | null;
  ipAddressField: string | null;
  emailField: string | null;
  orgId: string;
  isDefaultUserType: boolean;
};

const itemTypeRoleColumnNames = [
  'display_name_field',
  'creator_id_field',
  'thread_id_field',
  'parent_id_field',
  'created_at_field',
  'profile_icon_field',
  'background_image_field',
  'is_deleted_field',
  'ip_address_field',
  'email_field',
] as const;

type ItemTypeForUpdateRow = {
  id: string;
  fields: ItemSchema;
} & Required<ItemTypeRoleColumns>;

export default class ItemTypeOperations {
  private readonly itemTypeVersionsCache: Cached<
    (it: {
      orgId: string;
      itemTypeIdentifier: Pick<ItemTypeIdentifier, 'id' | 'version'>;
    }) => Promise<ItemType>
  >;
  private readonly latestItemTypesCache: Cached<
    (orgId: string) => Promise<ItemType[]>
  >;

  constructor(
    private readonly pgQuery: PrismaPgQueryable,
    private readonly pgQueryReplica: PrismaPgQueryable,
  ) {
    // Cache of ItemTypeIdentifier -> ItemTypeVersion (which is immutable and
    // the same version/incarnation will always be returned for the same identifier)
    this.itemTypeVersionsCache = cached({
      async producer(opts) {
        const { orgId } = opts;
        const { version, id } = opts.itemTypeIdentifier;
        const itemType = (
          await queryItemTypeVersions({
            orgId,
            currentVersionsOnly: false,
            pgQuery,
            where: Prisma.sql`id = ${id} AND version = ${version}::timestamptz`,
          })
        ).at(0);

        return itemType !== undefined
          ? dbResultToItemType(itemType, 'original')
          : // NB: we throw here so that the cache doesn't indefinitely store
            // undefined as the result, as a matching item type could be created later.
            __throw(
              makeNotFoundError('Item type not found with version', {
                shouldErrorSpan: true,
              }),
            );
      },
      // Cache forever because this is immutable.
      directives: { freshUntilAge: Infinity },
    });

    this.latestItemTypesCache = cached({
      async producer(orgId) {
        const itemTypes = await queryItemTypeVersions({
          orgId,
          currentVersionsOnly: true,
          pgQuery,
        });

        return itemTypes.map((it) => dbResultToItemType(it, 'original'));
      },
      directives: { freshUntilAge: 10, maxStale: [0, 2, 2] },
    });
  }

  /** Drop cached latest item types for this org after a DB write (MV + in-memory cache can disagree). */
  async invalidateLatestItemTypesCache(orgId: string): Promise<void> {
    // `cached()` always attaches invalidate; the type keeps it optional for other producers.
    await this.latestItemTypesCache.invalidate!(orgId);
  }

  async getItemTypes(opts: {
    orgId: string;
    directives?: ConsumerDirectives;
  }): Promise<readonly ReadonlyDeep<ItemType>[]> {
    const { orgId, directives } = opts;
    return this.latestItemTypesCache(orgId, directives);
  }

  async getItemType(opts: {
    orgId: string;
    itemTypeSelector: ItemTypeSelector;
    directives?: ConsumerDirectives;
  }) {
    const { orgId, itemTypeSelector, directives } = opts;
    const { id, version, schemaVariant } = itemTypeSelector;

    /**
     * This is a little confusing, so let's break down what's going on here:
     * 1. First, we check if the user is requesting a specific version of the item
     * type.
     *    a. If they aren't, then we can just hit the latest types cache and get
     * the latest version of the item type.
     *    b. If they are, we hit the items version cache to get the specifically
     *    requested version of the item type. NB: In this case, we don't need to
     *    throw on a NotFoundError, and we'd rather just return undefined to the
     *    caller in this case. However, we don't want to swallow other errors,
     *    so we let them throw.
     * 2. Once we've gotten the item type, we check if the user is requesting a
     *    partial item type or not.
     *    a. If they aren't, we can just return the item type we got from the
     *    cache
     *    b. If they are, we need to synthetically create the partial item type
     *    by making all the schema fields optional.
     *    NB: Note that step 2 isn't at all dependent on step 1. We don't care
     *    which cache the item came from when we're deciding whether to make it
     *    a partial item type or not
     */
    const itemTypeVersionWithOriginalSchema = version
      ? await this.itemTypeVersionsCache({
          orgId,
          itemTypeIdentifier: { id, version },
        }).catch((e: unknown) =>
          isCoopErrorOfType(e, 'NotFoundError') ? undefined : __throw(e),
        )
      : (await this.latestItemTypesCache(orgId, directives)).find(
          (it) => it.id === id,
        );

    return schemaVariant === 'partial' && itemTypeVersionWithOriginalSchema
      ? {
          ...itemTypeVersionWithOriginalSchema,
          schema: getPartialSchemaFromOriginal(
            itemTypeVersionWithOriginalSchema.schema,
          ),
        }
      : itemTypeVersionWithOriginalSchema;
  }

  async getItemTypesByKind<T extends ItemTypeKind>(opts: {
    orgId: string;
    kind: T;
    directives?: ConsumerDirectives;
  }): Promise<readonly ReadonlyDeep<ItemType & { kind: T }>[]> {
    const { orgId, kind, directives } = opts;
    const itemTypes = await this.latestItemTypesCache(orgId, directives);
    return itemTypes.filter(
      (it): it is ReadonlyDeep<ItemType & { kind: T }> => it.kind === kind,
    );
  }

  async getDefaultUserType(opts: {
    orgId: string;
    directives?: ConsumerDirectives;
  }): Promise<ReadonlyDeep<UserItemType>> {
    const { orgId, directives } = opts;
    const itemTypes = await this.latestItemTypesCache(orgId, directives);

    const defaultUserType = itemTypes.find(
      (it): it is ReadonlyDeep<UserItemType> =>
        it.kind === 'USER' && it.isDefaultUserType,
    );
    if (defaultUserType === undefined) {
      throw new Error(
        'No Item Type found when trying to get default user type',
      );
    }

    return defaultUserType;
  }

  async createDefaultUserType(orgId: string) {
    const { id: userItemTypeId } = await this.pgQuery.item_types.create({
      data: {
        id: uid(),
        name: 'User',
        description: 'This is the default user for the org.',
        org_id: orgId,
        kind: 'USER',
        fields: [
          {
            name: 'name',
            type: 'STRING',
            required: false,
            container: null,
          },
        ],
        profile_icon_field: null,
        created_at_field: null,
        display_name_field: null,
        background_image_field: null,
        is_deleted_field: null,
        is_default_user: true,
      },
      select: { id: true },
    });

    await this.invalidateLatestItemTypesCache(orgId);
    return (await this.latestItemTypesCache(orgId, { maxAge: 0 })).find(
      (it): it is ReadonlyDeep<UserItemType> =>
        it.kind === 'USER' && it.id === userItemTypeId,
    )!;
  }

  async createContentType(
    orgId: string,
    input: {
      name: string;
      schema: ItemSchema;
      description?: string | null;
      schemaFieldRoles: {
        creatorId?: string | null;
        threadId?: string | null;
        parentId?: string | null;
        createdAt?: string | null;
        displayName?: string | null;
        isDeleted?: string | null;
        ipAddress?: string | null;
      };
    },
  ) {
    return this.createItemType<ContentItemType>(orgId, 'CONTENT', input, {
      creator_id_field: input.schemaFieldRoles.creatorId,
      thread_id_field: input.schemaFieldRoles.threadId,
      parent_id_field: input.schemaFieldRoles.parentId,
      created_at_field: input.schemaFieldRoles.createdAt,
      display_name_field: input.schemaFieldRoles.displayName,
      is_deleted_field: input.schemaFieldRoles.isDeleted,
      ip_address_field: input.schemaFieldRoles.ipAddress,
    });
  }

  async updateContentType(
    orgId: string,
    input: {
      id: string;
      name?: string;
      schema?: ItemSchema;
      description?: string | null;
      schemaFieldRoles?: {
        creatorId?: string | null;
        threadId?: string | null;
        parentId?: string | null;
        createdAt?: string | null;
        displayName?: string | null;
        isDeleted?: string | null;
        ipAddress?: string | null;
      };
    },
  ) {
    return this.updateItemType<ContentItemType>(
      orgId,
      'CONTENT',
      input,
      input.schemaFieldRoles === undefined
        ? {}
        : {
            creator_id_field: replaceEmptyStringWithNull(
              input.schemaFieldRoles.creatorId,
            ),
            thread_id_field: replaceEmptyStringWithNull(
              input.schemaFieldRoles.threadId,
            ),
            parent_id_field: replaceEmptyStringWithNull(
              input.schemaFieldRoles.parentId,
            ),
            created_at_field: replaceEmptyStringWithNull(
              input.schemaFieldRoles.createdAt,
            ),
            display_name_field: replaceEmptyStringWithNull(
              input.schemaFieldRoles.displayName,
            ),
            is_deleted_field: replaceEmptyStringWithNull(
              input.schemaFieldRoles.isDeleted,
            ),
            ip_address_field: replaceEmptyStringWithNull(
              input.schemaFieldRoles.ipAddress,
            ),
          },
    );
  }

  async createThreadType(
    orgId: string,
    input: {
      name: string;
      schema: ItemSchema;
      description?: string | null;
      schemaFieldRoles: {
        createdAt?: string | null;
        displayName?: string | null;
        creatorId?: string | null;
        isDeleted?: string | null;
        ipAddress?: string | null;
      };
    },
  ): Promise<ThreadItemType> {
    return this.createItemType<ThreadItemType>(orgId, 'THREAD', input, {
      created_at_field: input.schemaFieldRoles.createdAt,
      display_name_field: input.schemaFieldRoles.displayName,
      creator_id_field: input.schemaFieldRoles.creatorId,
      is_deleted_field: input.schemaFieldRoles.isDeleted,
      ip_address_field: input.schemaFieldRoles.ipAddress,
    });
  }

  async updateThreadType(
    orgId: string,
    input: {
      id: string;
      name?: string;
      schema?: ItemSchema;
      description?: string | null;
      schemaFieldRoles?: {
        createdAt?: string | null;
        displayName?: string | null;
        creatorId?: string | null;
        isDeleted?: string | null;
        ipAddress?: string | null;
      };
    },
  ) {
    return this.updateItemType<ThreadItemType>(
      orgId,
      'THREAD',
      input,
      input.schemaFieldRoles === undefined
        ? {}
        : {
            created_at_field: replaceEmptyStringWithNull(
              input.schemaFieldRoles.createdAt,
            ),
            display_name_field: replaceEmptyStringWithNull(
              input.schemaFieldRoles.displayName,
            ),
            creator_id_field: replaceEmptyStringWithNull(
              input.schemaFieldRoles.creatorId,
            ),
            is_deleted_field: replaceEmptyStringWithNull(
              input.schemaFieldRoles.isDeleted,
            ),
            ip_address_field: replaceEmptyStringWithNull(
              input.schemaFieldRoles.ipAddress,
            ),
          },
    );
  }

  async createUserType(
    orgId: string,
    input: {
      name: string;
      schema: ItemSchema;
      description?: string | null;
      schemaFieldRoles: {
        profileIcon?: string | null;
        backgroundImage?: string | null;
        createdAt?: string | null;
        displayName?: string | null;
        isDeleted?: string | null;
        ipAddress?: string | null;
        email?: string | null;
      };
    },
  ) {
    return this.createItemType<UserItemType>(orgId, 'USER', input, {
      profile_icon_field: input.schemaFieldRoles.profileIcon,
      background_image_field: input.schemaFieldRoles.backgroundImage,
      created_at_field: input.schemaFieldRoles.createdAt,
      display_name_field: input.schemaFieldRoles.displayName,
      is_deleted_field: input.schemaFieldRoles.isDeleted,
      ip_address_field: input.schemaFieldRoles.ipAddress,
      email_field: input.schemaFieldRoles.email,
    });
  }

  async updateUserType(
    orgId: string,
    input: {
      id: string;
      name?: string;
      schema?: ItemSchema;
      description?: string | null;
      schemaFieldRoles?: {
        profileIcon?: string | null;
        backgroundImage?: string | null;
        createdAt?: string | null;
        displayName?: string | null;
        isDeleted?: string | null;
        ipAddress?: string | null;
        email?: string | null;
      };
    },
  ): Promise<UserItemType> {
    return this.updateItemType<UserItemType>(
      orgId,
      'USER',
      input,
      input.schemaFieldRoles === undefined
        ? {}
        : {
            profile_icon_field: replaceEmptyStringWithNull(
              input.schemaFieldRoles.profileIcon,
            ),
            background_image_field: replaceEmptyStringWithNull(
              input.schemaFieldRoles.backgroundImage,
            ),
            created_at_field: replaceEmptyStringWithNull(
              input.schemaFieldRoles.createdAt,
            ),
            display_name_field: replaceEmptyStringWithNull(
              input.schemaFieldRoles.displayName,
            ),
            is_deleted_field: replaceEmptyStringWithNull(
              input.schemaFieldRoles.isDeleted,
            ),
            ip_address_field: replaceEmptyStringWithNull(
              input.schemaFieldRoles.ipAddress,
            ),
            email_field: replaceEmptyStringWithNull(
              input.schemaFieldRoles.email,
            ),
          },
    );
  }

  private async createItemType<T extends ItemType>(
    orgId: string,
    kind: ItemTypeKind,
    input: {
      name: string;
      schema: ItemSchema;
      description?: string | null;
    },
    roleColumns: ItemTypeRoleColumns,
  ): Promise<T> {
    const itemTypeId = uid();
    const normalizedRoleColumns = Object.fromEntries(
      Object.entries(roleColumns).map(([column, value]) => [
        column,
        replaceEmptyStringWithNull(value),
      ]),
    ) as ItemTypeRoleColumns;
    const create = async (query: PrismaPgQueryable) => {
      assertValidItemSchema(input.schema);
      assertValidItemTypeFieldRoles(input.schema, kind, normalizedRoleColumns);
      await query.item_types.create({
        data: {
          id: itemTypeId,
          name: input.name,
          description: input.description,
          org_id: orgId,
          kind,
          fields: input.schema as unknown as Prisma.InputJsonValue[],
          ...normalizedRoleColumns,
        },
        select: { id: true },
      });
      const row = await queryCurrentItemTypeVersionOrThrow({
        orgId,
        pgQuery: query,
        id: itemTypeId,
        kind,
      });
      return dbResultToItemType(row, 'original') as T;
    };
    try {
      const result = await runInPrismaTransaction(this.pgQuery, {}, create);
      await this.invalidateLatestItemTypesCache(orgId);
      if (!isPrismaTransaction(this.pgQuery)) {
        await this.latestItemTypesCache(orgId, { maxAge: 0 });
      }
      return result;
    } catch (error) {
      this.rethrowItemTypeNameConflict(error);
    }
  }

  private async updateItemType<T extends ItemType>(
    orgId: string,
    kind: ItemTypeKind,
    input: {
      id: string;
      name?: string;
      schema?: ItemSchema;
      description?: string | null;
    },
    roleColumns: ItemTypeRoleColumns,
  ): Promise<T> {
    const update = async (query: PrismaPgQueryable) => {
      // prisma-raw: FOR UPDATE
      const current = (
        await query.$queryRaw<ItemTypeForUpdateRow[]>`
        SELECT id, fields, ${Prisma.raw(itemTypeRoleColumnNames.join(', '))}
        FROM public.item_types
        WHERE id = ${input.id}
          AND org_id = ${orgId}
          AND kind = ${kind}::item_type_kind
        FOR UPDATE`
      ).at(0);
      if (current === undefined) {
        throw makeNotFoundError('Item type not found', {
          shouldErrorSpan: false,
        });
      }
      const proposedSchema = input.schema ?? current.fields;
      assertValidItemSchema(proposedSchema);
      const proposedRoleColumns = mergeItemTypeRoleColumns(
        current,
        roleColumns,
      );
      assertValidItemTypeFieldRoles(proposedSchema, kind, proposedRoleColumns);
      const updated = await query.item_types.update({
        where: { id: current.id, org_id: orgId, kind },
        data: removeUndefinedKeys({
          name: input.name,
          description: replaceEmptyStringWithNull(input.description),
          fields: proposedSchema as unknown as Prisma.InputJsonValue[],
          ...roleColumns,
        }),
        select: { id: true },
      });
      const row = await queryCurrentItemTypeVersionOrThrow({
        orgId,
        pgQuery: query,
        id: updated.id,
        kind,
      });
      return dbResultToItemType(row, 'original') as T;
    };
    try {
      const result = await runInPrismaTransaction(this.pgQuery, {}, update);
      await this.invalidateLatestItemTypesCache(orgId);
      if (!isPrismaTransaction(this.pgQuery)) {
        await this.latestItemTypesCache(orgId, { maxAge: 0 });
      }
      return result;
    } catch (error) {
      this.rethrowItemTypeNameConflict(error);
    }
  }

  private rethrowItemTypeNameConflict(error: unknown): never {
    // Prisma's error names the constraint (and sometimes the table) but not
    // the schema; index names are unique per schema, and
    // `public.org_id_name_key` is item_types' (org_id, name) key.
    const pgError = getPgErrorDetails(error);
    if (
      isUniqueViolationError(error) &&
      pgError?.constraint === 'org_id_name_key' &&
      (pgError.table === undefined ||
        pgError.table === 'item_types' ||
        pgError.table === 'public.item_types')
    ) {
      throw makeItemTypeNameAlreadyExistsError({ shouldErrorSpan: false });
    }
    throw error;
  }

  /**
   * @param opts
   * @returns true if the item type existed and was deleted; false if the item
   *   type already didn't exist. Throws if the item type could not be deleted.
   */
  async deleteItemType(opts: { orgId: string; itemTypeId: string }) {
    const { orgId, itemTypeId } = opts;
    const deleteItemType = async (query: PrismaPgQueryable) => {
      const isDefaultUserType = await query.item_types.findFirst({
        where: { id: itemTypeId, is_default_user: true, org_id: orgId },
        select: { id: true },
      });

      // We should also check if there are any outstanding jobs in MRT that
      // contain this itemType they'll get stuck because when the UI tries to
      // look up the actions that are available for the job, it'll find no
      // actions associated with the job item's item type (because actions
      // point to their item types, and the item type is deleted), but for now
      // we'll just restore the ItemType in case that happens.
      if (isDefaultUserType) {
        throw new CoopError({
          status: 409,
          name: 'AttemptingToDeleteDefaultUserType',
          type: [ErrorType.AttemptingToDeleteDefaultUserType],
          title: `Attempting to delete default user for an org`,
          detail: `User Type ID: ${itemTypeId}.`,
          shouldErrorSpan: true,
        });
      }

      return query.item_types.deleteMany({
        where: { id: itemTypeId, org_id: orgId },
      });
    };
    const res = await runInPrismaTransaction(
      this.pgQuery,
      { isolationLevel: 'RepeatableRead' },
      deleteItemType,
    );

    if (!isPrismaTransaction(this.pgQuery)) {
      await this.invalidateLatestItemTypesCache(orgId);
      await this.latestItemTypesCache(orgId, { maxAge: 0 });
    }

    return res.count === 1;
  }

  async getActionItemTypeIds(opts: { orgId: string }) {
    // prisma-raw: join with non-FK ON condition (= ANY(array)) + array_agg
    const rows = await this.pgQuery.$queryRaw<
      { actionId: string; itemTypeIds: string[] }[]
    >`
      SELECT a.id AS "actionId", array_agg(it.id ORDER BY it.id) AS "itemTypeIds"
      FROM public.actions AS a
      INNER JOIN public.item_type_versions AS it
        ON it.org_id = a.org_id
        AND it.is_current = true
        AND (
          it.kind = ANY(a.applies_to_all_items_of_kind)
          OR (
            cardinality(a.applies_to_all_items_of_kind) = 0
            AND EXISTS (
              SELECT 1 FROM public.actions_and_item_types AS ait
              WHERE ait.action_id = a.id AND ait.item_type_id = it.id
            )
          )
        )
      WHERE a.org_id = ${opts.orgId}
      GROUP BY a.id`;

    return new Map(rows.map((row) => [row.actionId, row.itemTypeIds]));
  }

  async getItemTypesForAction(opts: {
    orgId: string;
    actionId: string;
    directives?: ConsumerDirectives;
  }): Promise<ItemType[]> {
    const { orgId, actionId, directives } = opts;
    const pgQuery = this.#getPgQuery(
      // if no directives or no maxAge, read from replica;
      // else, read from replica conditionally based on just how up-to-date
      // the caller needs the data to be
      directives?.maxAge == null ? true : directives.maxAge > 4,
    );

    const results = await runInPrismaTransaction(
      pgQuery,
      { isolationLevel: 'RepeatableRead' },
      async (trx) => {
        const action = await trx.actions.findUnique({
          where: { id: actionId },
          select: { applies_to_all_items_of_kind: true },
        });

        if (action === null) {
          return [];
        }

        // Reads use `trx` so they share the `repeatable read` snapshot.
        const appliesToAllItemsOfKind: ItemTypeKind[] =
          action.applies_to_all_items_of_kind;
        return queryItemTypeVersions({
          orgId,
          currentVersionsOnly: true,
          pgQuery: trx,
          where:
            appliesToAllItemsOfKind.length > 0
              ? Prisma.sql`kind::text = ANY(${appliesToAllItemsOfKind}::text[])`
              : Prisma.sql`id IN (
                  SELECT item_type_id FROM public.actions_and_item_types
                  WHERE action_id = ${actionId}
                )`,
        });
      },
    );

    return results.map((it) => dbResultToItemType(it));
  }

  async getItemTypesForRule(opts: {
    orgId: string;
    ruleId: string;
    readFromReplica?: boolean;
  }): Promise<ItemType[]> {
    const { orgId, ruleId, readFromReplica } = opts;
    const itemTypes = await queryItemTypeVersions({
      orgId,
      currentVersionsOnly: true,
      pgQuery: this.#getPgQuery(readFromReplica),
      where: Prisma.sql`id IN (
        SELECT item_type_id FROM public.rules_and_item_types
        WHERE rule_id = ${ruleId}
      )`,
    });
    return itemTypes.map((itemType) => dbResultToItemType(itemType));
  }

  #getPgQuery(readFromReplica: boolean = false) {
    return readFromReplica ? this.pgQueryReplica : this.pgQuery;
  }

  async close() {
    await Promise.all([
      this.itemTypeVersionsCache.close(),
      this.latestItemTypesCache.close(),
    ]);
  }
}

async function queryItemTypeVersions(opts: {
  orgId: string;
  currentVersionsOnly: boolean;
  pgQuery: PrismaPgQueryable;
  where?: Prisma.Sql;
}) {
  const { orgId, currentVersionsOnly, pgQuery, where } = opts;
  // prisma-raw: µs-precision version string via to_char
  return pgQuery.$queryRaw<ItemTypeDbResult[]>`
    SELECT ${itemTypeVersionsSelection}
    FROM public.item_type_versions
    WHERE org_id = ${orgId}
    ${currentVersionsOnly ? Prisma.sql`AND is_current = true` : Prisma.empty}
    ${where ? Prisma.sql`AND ${where}` : Prisma.empty}`;
}

async function queryCurrentItemTypeVersionOrThrow(opts: {
  orgId: string;
  pgQuery: PrismaPgQueryable;
  id: string;
  kind: ItemTypeKind;
}) {
  const row = (
    await queryItemTypeVersions({
      orgId: opts.orgId,
      currentVersionsOnly: true,
      pgQuery: opts.pgQuery,
      where: Prisma.sql`id = ${opts.id} AND kind = ${opts.kind}::item_type_kind`,
    })
  ).at(0);
  if (row === undefined) {
    throw new Error('no result');
  }
  return row;
}

function dbResultToItemType<T extends ItemTypeKind>(
  input: ItemTypeDbResult & { kind: T },
  schemaVariant: ItemTypeSchemaVariant = 'original',
) {
  const schema = (() => {
    switch (schemaVariant) {
      case 'original':
        return input.fields;
      case 'partial':
        return getPartialSchemaFromOriginal(input.fields);
      default:
        assertUnreachable(schemaVariant);
    }
  })();
  return {
    id: input.id,
    orgId: input.orgId,
    name: input.name,
    description: input.description,
    schema,
    kind: input.kind,
    schemaVariant,
    version: input.version,
    ...(input.kind === 'USER'
      ? { isDefaultUserType: input.isDefaultUserType }
      : {}),
    schemaFieldRoles: (() => {
      switch (input.kind) {
        case 'CONTENT':
          return {
            displayName: input.displayNameField ?? undefined,
            creatorId: input.creatorIdField ?? undefined,
            createdAt: input.createdAtField ?? undefined,
            parentId: input.parentIdField ?? undefined,
            threadId: input.threadIdField ?? undefined,
            isDeleted: input.isDeletedField ?? undefined,
            ipAddress: input.ipAddressField ?? undefined,
            // We collapse the cases here because otherwise this satisfies
            // check fails, but the correlation is checked by the DB
            // constraints
          } satisfies CollapseCases<ContentItemType['schemaFieldRoles']>;
        case 'THREAD':
          return {
            displayName: input.displayNameField ?? undefined,
            createdAt: input.createdAtField ?? undefined,
            creatorId: input.creatorIdField ?? undefined,
            isDeleted: input.isDeletedField ?? undefined,
            ipAddress: input.ipAddressField ?? undefined,
          } satisfies ThreadItemType['schemaFieldRoles'];
        case 'USER':
          return {
            displayName: input.displayNameField ?? undefined,
            backgroundImage: input.backgroundImageField ?? undefined,
            createdAt: input.createdAtField ?? undefined,
            profileIcon: input.profileIconField ?? undefined,
            isDeleted: input.isDeletedField ?? undefined,
            ipAddress: input.ipAddressField ?? undefined,
            email: input.emailField ?? undefined,
          } satisfies UserItemType['schemaFieldRoles'];
        default:
          assertUnreachable(input.kind);
      }
    })(),
  } satisfies Omit<ItemType, 'schemaFieldRoles'> & {
    schemaFieldRoles: ItemType['schemaFieldRoles'];
  } as ItemType & { kind: T };
}
