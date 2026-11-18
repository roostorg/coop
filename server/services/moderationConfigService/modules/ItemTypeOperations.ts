/* eslint-disable max-lines */
import { and, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { type ReadonlyDeep } from 'type-fest';
import { uid } from 'uid';

import { type ConsumerDirectives } from '../../../lib/cache/index.js';
import { schema, type CoopDbOrTx } from '../../../storage/postgres/drizzle.js';
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
import { isTransaction, runInTransaction } from './drizzleTx.js';
import {
  assertValidItemSchema,
  assertValidItemTypeFieldRoles,
  mergeItemTypeRoleColumns,
  type ItemTypeRoleColumns,
} from './itemTypeSchemaValidation.js';

const itemTypes = schema.itemTypes;
const itv = schema.itemTypeVersions;

const itemTypeDbSelection = {
  id: itv.id,
  name: itv.name,
  description: itv.description,
  kind: itv.kind,
  fields: itv.fields,
  version: sql<string>`to_char(timezone('UTC'::text, ${itv.version}), 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'::text)`,
  displayNameField: itv.displayNameField,
  creatorIdField: itv.creatorIdField,
  threadIdField: itv.threadIdField,
  parentIdField: itv.parentIdField,
  createdAtField: itv.createdAtField,
  isDeletedField: itv.isDeletedField,
  profileIconField: itv.profileIconField,
  backgroundImageField: itv.backgroundImageField,
  ipAddressField: itv.ipAddressField,
  emailField: itv.emailField,
  orgId: itv.orgId,
  isDefaultUserType: itv.isDefaultUser,
};

// The materialized view's columns are all nullable in the model (Postgres
// doesn't track nullability for views), but the underlying table's aren't.
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

// The role-column validation helpers work on snake_case column names.
const itemTypeRoleColumns = {
  display_name_field: itemTypes.displayNameField,
  creator_id_field: itemTypes.creatorIdField,
  thread_id_field: itemTypes.threadIdField,
  parent_id_field: itemTypes.parentIdField,
  created_at_field: itemTypes.createdAtField,
  profile_icon_field: itemTypes.profileIconField,
  background_image_field: itemTypes.backgroundImageField,
  is_deleted_field: itemTypes.isDeletedField,
  ip_address_field: itemTypes.ipAddressField,
  email_field: itemTypes.emailField,
} as const;

function roleColumnsToModel(roleColumns: ItemTypeRoleColumns) {
  return {
    displayNameField: roleColumns.display_name_field,
    creatorIdField: roleColumns.creator_id_field,
    threadIdField: roleColumns.thread_id_field,
    parentIdField: roleColumns.parent_id_field,
    createdAtField: roleColumns.created_at_field,
    profileIconField: roleColumns.profile_icon_field,
    backgroundImageField: roleColumns.background_image_field,
    isDeletedField: roleColumns.is_deleted_field,
    ipAddressField: roleColumns.ip_address_field,
    emailField: roleColumns.email_field,
  };
}

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
    private readonly pgQuery: CoopDbOrTx,
    private readonly pgQueryReplica: CoopDbOrTx,
  ) {
    // Cache of ItemTypeIdentifier -> ItemTypeVersion (which is immutable and
    // the same version/incarnation will always be returned for the same identifier)
    this.itemTypeVersionsCache = cached({
      async producer(opts) {
        const { orgId } = opts;
        const { version, id } = opts.itemTypeIdentifier;
        const [itemType] = await getItemTypeVersions({
          orgId,
          currentVersionsOnly: false,
          pgQuery,
          where: and(
            eq(itv.id, id),
            // Bind the version string untyped so Postgres parses it as a
            // timestamptz (as Kysely's where did); eq() would encode it with
            // the Date column's encoder.
            sql`${itv.version} = ${version}`,
          ),
        });

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
        const rows = await getItemTypeVersions({
          orgId,
          currentVersionsOnly: true,
          pgQuery,
        });

        return rows.map((it) => dbResultToItemType(it, 'original'));
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
    const [{ id: userItemTypeId }] = await this.pgQuery
      .insert(itemTypes)
      .values({
        id: uid(),
        name: 'User',
        description: 'This is the default user for the org.',
        orgId,
        kind: 'USER',
        fields: [
          {
            name: 'name',
            type: 'STRING',
            required: false,
            container: null,
          },
        ],
        profileIconField: null,
        createdAtField: null,
        displayNameField: null,
        backgroundImageField: null,
        isDeletedField: null,
        isDefaultUser: true,
      })
      .returning({ id: itemTypes.id });

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
    const create = async (query: CoopDbOrTx) => {
      assertValidItemSchema(input.schema);
      assertValidItemTypeFieldRoles(input.schema, kind, normalizedRoleColumns);
      await query.insert(itemTypes).values({
        id: itemTypeId,
        name: input.name,
        description: input.description,
        orgId,
        kind,
        fields: [...input.schema],
        ...removeUndefinedKeys(roleColumnsToModel(normalizedRoleColumns)),
      });
      const [row] = await getItemTypeVersions({
        orgId,
        currentVersionsOnly: true,
        pgQuery: query,
        where: and(eq(itv.id, itemTypeId), eq(itv.kind, kind)),
      });
      return dbResultToItemType(row ?? throwNoResult(), 'original') as T;
    };
    try {
      const result = isTransaction(this.pgQuery)
        ? await create(this.pgQuery)
        : await runInTransaction(this.pgQuery, create);
      await this.invalidateLatestItemTypesCache(orgId);
      if (!isTransaction(this.pgQuery)) {
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
    const update = async (query: CoopDbOrTx) => {
      const [current] = await query
        .select({
          id: itemTypes.id,
          fields: itemTypes.fields,
          ...itemTypeRoleColumns,
        })
        .from(itemTypes)
        .where(
          and(
            eq(itemTypes.id, input.id),
            eq(itemTypes.orgId, orgId),
            eq(itemTypes.kind, kind),
          ),
        )
        .limit(1)
        .for('update');
      if (current === undefined) {
        throw makeNotFoundError('Item type not found', {
          shouldErrorSpan: false,
        });
      }
      const proposedSchema =
        input.schema ?? (current.fields as unknown as ItemSchema);
      assertValidItemSchema(proposedSchema);
      const proposedRoleColumns = mergeItemTypeRoleColumns(
        current,
        roleColumns,
      );
      assertValidItemTypeFieldRoles(proposedSchema, kind, proposedRoleColumns);
      const [updated] = await query
        .update(itemTypes)
        .set(
          removeUndefinedKeys({
            name: input.name,
            description: replaceEmptyStringWithNull(input.description),
            fields: [...proposedSchema],
            ...roleColumnsToModel(roleColumns),
          }),
        )
        .where(
          and(
            eq(itemTypes.id, current.id),
            eq(itemTypes.orgId, orgId),
            eq(itemTypes.kind, kind),
          ),
        )
        .returning({ id: itemTypes.id });
      const [row] = await getItemTypeVersions({
        orgId,
        currentVersionsOnly: true,
        pgQuery: query,
        where: and(
          eq(itv.id, (updated ?? throwNoResult()).id),
          eq(itv.kind, kind),
        ),
      });
      return dbResultToItemType(row ?? throwNoResult(), 'original') as T;
    };
    try {
      const result = isTransaction(this.pgQuery)
        ? await update(this.pgQuery)
        : await runInTransaction(this.pgQuery, update);
      await this.invalidateLatestItemTypesCache(orgId);
      if (!isTransaction(this.pgQuery)) {
        await this.latestItemTypesCache(orgId, { maxAge: 0 });
      }
      return result;
    } catch (error) {
      this.rethrowItemTypeNameConflict(error);
    }
  }

  private rethrowItemTypeNameConflict(error: unknown): never {
    // Drizzle wraps the pg error in a DrizzleQueryError; the pg error (which
    // carries constraint/table/schema) is its `cause`.
    type PgErrorFields = {
      constraint?: string;
      table?: string;
      schema?: string;
      cause?: unknown;
    };
    const pgError = ((error as PgErrorFields | undefined)?.cause ??
      error) as PgErrorFields;
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
    const deleteItemType = async (query: CoopDbOrTx) => {
      const [isDefaultUserType] = await query
        .select({ id: itemTypes.id })
        .from(itemTypes)
        .where(
          and(
            eq(itemTypes.id, itemTypeId),
            eq(itemTypes.isDefaultUser, true),
            eq(itemTypes.orgId, orgId),
          ),
        )
        .limit(1);

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

      return query
        .delete(itemTypes)
        .where(and(eq(itemTypes.id, itemTypeId), eq(itemTypes.orgId, orgId)));
    };
    const res = isTransaction(this.pgQuery)
      ? await deleteItemType(this.pgQuery)
      : await runInTransaction(this.pgQuery, deleteItemType, {
          isolationLevel: 'repeatable read',
        });

    if (!isTransaction(this.pgQuery)) {
      await this.invalidateLatestItemTypesCache(orgId);
      await this.latestItemTypesCache(orgId, { maxAge: 0 });
    }

    return res.rowCount === 1;
  }

  async getActionItemTypeIds(opts: { orgId: string }) {
    const actions = schema.actions;
    const ait = schema.actionsAndItemTypes;
    const rows = await this.pgQuery
      .select({
        actionId: actions.id,
        itemTypeIds: sql<string[]>`array_agg(${itv.id} ORDER BY ${itv.id})`,
      })
      .from(actions)
      .innerJoin(
        itv,
        and(
          eq(itv.orgId, actions.orgId),
          eq(itv.isCurrent, true),
          sql`(
            ${itv.kind} = ANY(${actions.appliesToAllItemsOfKind})
            OR (
              cardinality(${actions.appliesToAllItemsOfKind}) = 0
              AND EXISTS (
                SELECT 1 FROM ${ait}
                WHERE ${ait.actionId} = ${actions.id} AND ${ait.itemTypeId} = ${itv.id}
              )
            )
          )`,
        ),
      )
      .where(eq(actions.orgId, opts.orgId))
      .groupBy(actions.id);

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

    const results = await runInTransaction(
      pgQuery,
      async (trx) => {
        const [action] = await trx
          .select({
            appliesToAllItemsOfKind: schema.actions.appliesToAllItemsOfKind,
          })
          .from(schema.actions)
          .where(eq(schema.actions.id, actionId))
          .limit(1);

        if (action === undefined) {
          return [];
        }

        // Reads use `trx` so they share the `repeatable read` snapshot.
        return action.appliesToAllItemsOfKind.length > 0
          ? getItemTypeVersions({
              orgId,
              currentVersionsOnly: true,
              pgQuery: trx,
              where: inArray(itv.kind, action.appliesToAllItemsOfKind),
            })
          : getItemTypeVersions({
              orgId,
              currentVersionsOnly: true,
              pgQuery: trx,
              where: inArray(
                itv.id,
                trx
                  .select({ id: schema.actionsAndItemTypes.itemTypeId })
                  .from(schema.actionsAndItemTypes)
                  .where(eq(schema.actionsAndItemTypes.actionId, actionId)),
              ),
            });
      },
      { isolationLevel: 'repeatable read' },
    );

    return results.map((it) => dbResultToItemType(it));
  }

  async getItemTypesForRule(opts: {
    orgId: string;
    ruleId: string;
    readFromReplica?: boolean;
  }): Promise<ItemType[]> {
    const { orgId, ruleId, readFromReplica } = opts;
    const pgQuery = this.#getPgQuery(readFromReplica);
    const itemTypes = await getItemTypeVersions({
      orgId,
      currentVersionsOnly: true,
      pgQuery,
      where: inArray(
        itv.id,
        pgQuery
          .select({ id: schema.rulesAndItemTypes.itemTypeId })
          .from(schema.rulesAndItemTypes)
          .where(eq(schema.rulesAndItemTypes.ruleId, ruleId)),
      ),
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

async function getItemTypeVersions(opts: {
  orgId: string;
  currentVersionsOnly: boolean;
  pgQuery: CoopDbOrTx;
  where?: SQL;
}): Promise<ItemTypeDbResult[]> {
  const { orgId, currentVersionsOnly, pgQuery, where } = opts;
  const rows = await pgQuery
    .select(itemTypeDbSelection)
    .from(itv)
    .where(
      and(
        eq(itv.orgId, orgId),
        currentVersionsOnly ? eq(itv.isCurrent, true) : undefined,
        where,
      ),
    );
  return rows as unknown as ItemTypeDbResult[];
}

// Stands in for Kysely's executeTakeFirstOrThrow on a row that the same
// transaction just wrote.
function throwNoResult(): never {
  throw new Error('no result');
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
