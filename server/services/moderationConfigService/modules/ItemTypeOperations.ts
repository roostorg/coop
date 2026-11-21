/* eslint-disable max-lines */
import { type ReadonlyDeep } from 'type-fest';
import { type EntityManager, type SelectQueryBuilder } from 'typeorm';
import { uid } from 'uid';

import { type ConsumerDirectives } from '../../../lib/cache/index.js';
import {
  isInTransaction,
  managerOf,
  transactionWithRetry,
  type TypeormDb,
} from '../../../storage/typeorm/db.js';
import {
  Actions,
  ActionsAndItemTypes,
  ItemTypes,
  ItemTypeVersionsView,
  RulesAndItemTypes,
} from '../../../storage/typeorm/entities/index.js';
import { cached, type Cached } from '../../../utils/caching.js';
import {
  CoopError,
  ErrorType,
  isCoopErrorOfType,
  makeNotFoundError,
} from '../../../utils/errors.js';
import { isUniqueViolationError } from '../../../utils/kysely.js';
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

const versionTextExpression = `to_char(timezone('UTC'::text, itv.version), 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'::text)`;
// [SQL expression, result alias]. TypeORM's raw results are untyped, so the
// row type below is written by hand and must be kept in sync.
const itemTypeDbSelection = [
  ['itv.id', 'id'],
  ['itv.name', 'name'],
  ['itv.description', 'description'],
  ['itv.kind', 'kind'],
  ['itv.fields', 'fields'],
  [versionTextExpression, 'version'],
  ['itv.display_name_field', 'displayNameField'],
  ['itv.creator_id_field', 'creatorIdField'],
  ['itv.thread_id_field', 'threadIdField'],
  ['itv.parent_id_field', 'parentIdField'],
  ['itv.created_at_field', 'createdAtField'],
  ['itv.is_deleted_field', 'isDeletedField'],
  ['itv.profile_icon_field', 'profileIconField'],
  ['itv.background_image_field', 'backgroundImageField'],
  ['itv.ip_address_field', 'ipAddressField'],
  ['itv.email_field', 'emailField'],
  ['itv.org_id', 'orgId'],
  ['itv.is_default_user', 'isDefaultUserType'],
] as const;

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
    private readonly pgQuery: TypeormDb,
    private readonly pgQueryReplica: TypeormDb,
  ) {
    // Cache of ItemTypeIdentifier -> ItemTypeVersion (which is immutable and
    // the same version/incarnation will always be returned for the same identifier)
    this.itemTypeVersionsCache = cached({
      async producer(opts) {
        const { orgId } = opts;
        const { version, id } = opts.itemTypeIdentifier;
        const itemType = await getItemTypeVersionsBaseQuery({
          orgId,
          currentVersionsOnly: false,
          manager: await managerOf(pgQuery),
        })
          .andWhere('itv.id = :id AND itv.version = :version', { id, version })
          .getRawOne<ItemTypeDbResult>();

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
        const itemTypes = await getItemTypeVersionsBaseQuery({
          orgId,
          currentVersionsOnly: true,
          manager: await managerOf(pgQuery),
        }).getRawMany<ItemTypeDbResult>();

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
    const userItemTypeId = uid();
    await insertItemType(await managerOf(this.pgQuery), {
      id: userItemTypeId,
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
    const create = async (manager: EntityManager) => {
      assertValidItemSchema(input.schema);
      assertValidItemTypeFieldRoles(input.schema, kind, normalizedRoleColumns);
      await insertItemType(manager, {
        id: itemTypeId,
        name: input.name,
        description: input.description,
        org_id: orgId,
        kind,
        fields: input.schema,
        ...normalizedRoleColumns,
      });
      const row = await getCurrentItemTypeOrThrow(
        manager,
        orgId,
        itemTypeId,
        kind,
      );
      return dbResultToItemType(row, 'original') as T;
    };
    try {
      const result = await transactionWithRetry(this.pgQuery, {}, create);
      await this.invalidateLatestItemTypesCache(orgId);
      if (!isInTransaction(this.pgQuery)) {
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
    const update = async (manager: EntityManager) => {
      const current = await manager.findOne(ItemTypes, {
        select: Object.fromEntries(
          ['id', 'fields', ...itemTypeRoleColumnNames].map((c) => [c, true]),
        ),
        where: { id: input.id, org_id: orgId, kind },
        lock: { mode: 'pessimistic_write' },
      });
      if (current == null) {
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
      await manager
        .createQueryBuilder()
        .update(ItemTypes)
        .set(
          removeUndefinedKeys({
            name: input.name,
            description: replaceEmptyStringWithNull(input.description),
            fields: jsonbArrayParam('fields'),
            ...roleColumns,
          }),
        )
        .setParameter('fields', proposedSchema)
        .where('id = :id AND org_id = :orgId AND kind = :kind', {
          id: current.id,
          orgId,
          kind,
        })
        .execute();
      const row = await getCurrentItemTypeOrThrow(
        manager,
        orgId,
        current.id,
        kind,
      );
      return dbResultToItemType(row, 'original') as T;
    };
    try {
      const result = await transactionWithRetry(this.pgQuery, {}, update);
      await this.invalidateLatestItemTypesCache(orgId);
      if (!isInTransaction(this.pgQuery)) {
        await this.latestItemTypesCache(orgId, { maxAge: 0 });
      }
      return result;
    } catch (error) {
      this.rethrowItemTypeNameConflict(error);
    }
  }

  private rethrowItemTypeNameConflict(error: unknown): never {
    const pgError = error as {
      constraint?: string;
      table?: string;
      schema?: string;
    };
    if (
      isUniqueViolationError(error) &&
      pgError.constraint === 'org_id_name_key' &&
      pgError.table === 'item_types' &&
      pgError.schema === 'public'
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
    const inTransaction = isInTransaction(this.pgQuery);
    const deleteItemType = async (manager: EntityManager) => {
      const isDefaultUserType = await manager.exists(ItemTypes, {
        where: { id: itemTypeId, is_default_user: true, org_id: orgId },
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

      return manager.delete(ItemTypes, { id: itemTypeId, org_id: orgId });
    };
    const res = await transactionWithRetry(
      this.pgQuery,
      { isolationLevel: 'REPEATABLE READ' },
      deleteItemType,
    );

    if (!inTransaction) {
      await this.invalidateLatestItemTypesCache(orgId);
      await this.latestItemTypesCache(orgId, { maxAge: 0 });
    }

    return res.affected === 1;
  }

  async getActionItemTypeIds(opts: { orgId: string }) {
    const manager = await managerOf(this.pgQuery);
    // The join condition uses array operators (`= ANY`, `cardinality`) and a
    // correlated EXISTS, which TypeORM only accepts as raw SQL strings.
    const rows = await manager
      .createQueryBuilder(Actions, 'a')
      .innerJoin(
        ItemTypeVersionsView,
        'it',
        `it.org_id = a.org_id AND it.is_current = true AND (
          it.kind = ANY(a.applies_to_all_items_of_kind)
          OR (
            cardinality(a.applies_to_all_items_of_kind) = 0
            AND EXISTS (
              SELECT 1 FROM public.actions_and_item_types AS ait
              WHERE ait.action_id = a.id AND ait.item_type_id = it.id
            )
          )
        )`,
      )
      .select('a.id', 'actionId')
      .addSelect('array_agg(it.id ORDER BY it.id)', 'itemTypeIds')
      .where('a.org_id = :orgId', { orgId: opts.orgId })
      .groupBy('a.id')
      .getRawMany<{ actionId: string; itemTypeIds: string[] }>();

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

    const results = await transactionWithRetry(
      pgQuery,
      { isolationLevel: 'REPEATABLE READ' },
      async (manager) => {
        // The column is an enum array; cast to text[] so the pg driver parses
        // it into a JS array.
        const action = await manager
          .createQueryBuilder(Actions, 'a')
          .select(
            'a.applies_to_all_items_of_kind::text[]',
            'appliesToAllItemsOfKind',
          )
          .where('a.id = :actionId', { actionId })
          .getRawOne<{ appliesToAllItemsOfKind: ItemTypeKind[] }>();

        if (action === undefined) {
          return [];
        }

        // Reads use `manager` so they share the `repeatable read` snapshot.
        const base = getItemTypeVersionsBaseQuery({
          orgId,
          currentVersionsOnly: true,
          manager,
        });
        return action.appliesToAllItemsOfKind.length > 0
          ? base
              .andWhere('itv.kind IN (:...kinds)', {
                kinds: action.appliesToAllItemsOfKind,
              })
              .getRawMany<ItemTypeDbResult>()
          : base
              .andWhere(
                `itv.id IN ${base
                  .subQuery()
                  .select('ait.item_type_id')
                  .from(ActionsAndItemTypes, 'ait')
                  .where('ait.action_id = :actionId')
                  .getQuery()}`,
                { actionId },
              )
              .getRawMany<ItemTypeDbResult>();
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
    const base = getItemTypeVersionsBaseQuery({
      orgId,
      currentVersionsOnly: true,
      manager: await managerOf(this.#getPgQuery(readFromReplica)),
    });
    const itemTypes = await base
      .andWhere(
        `itv.id IN ${base
          .subQuery()
          .select('rit.item_type_id')
          .from(RulesAndItemTypes, 'rit')
          .where('rit.rule_id = :ruleId')
          .getQuery()}`,
        { ruleId },
      )
      .getRawMany<ItemTypeDbResult>();
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

function getItemTypeVersionsBaseQuery(opts: {
  orgId: string;
  currentVersionsOnly: boolean;
  manager: EntityManager;
}): SelectQueryBuilder<ItemTypeVersionsView> {
  const { orgId, currentVersionsOnly, manager } = opts;
  const [[firstExpr, firstAlias], ...rest] = itemTypeDbSelection;
  let qb = manager
    .createQueryBuilder(ItemTypeVersionsView, 'itv')
    .select(firstExpr, firstAlias);
  for (const [expr, alias] of rest) {
    qb = qb.addSelect(expr, alias);
  }
  qb = qb.where('itv.org_id = :orgId', { orgId });
  return currentVersionsOnly ? qb.andWhere('itv.is_current = true') : qb;
}

async function getCurrentItemTypeOrThrow(
  manager: EntityManager,
  orgId: string,
  id: string,
  kind: ItemTypeKind,
) {
  const row = await getItemTypeVersionsBaseQuery({
    orgId,
    currentVersionsOnly: true,
    manager,
  })
    .andWhere('itv.id = :id AND itv.kind = :kind', { id, kind })
    .getRawOne<ItemTypeDbResult>();
  if (row === undefined) {
    throw new Error(`Item type ${id} not found after write`);
  }
  return row;
}

// `fields` is a jsonb[] column. TypeORM serializes any json/jsonb value with
// JSON.stringify, even when `array: true`, which Postgres rejects as a
// malformed array literal. Passing the value as a raw parameter lets the pg
// driver build the array literal itself.
const jsonbArrayParam = (name: string) => () => `CAST(:${name} AS jsonb[])`;

async function insertItemType(
  manager: EntityManager,
  { fields, ...values }: Partial<ItemTypes> & { fields: ItemSchema },
) {
  await manager
    .createQueryBuilder()
    .insert()
    .into(ItemTypes)
    .values({ ...values, fields: jsonbArrayParam('fields') })
    .setParameter('fields', fields)
    .updateEntity(false)
    .execute();
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
