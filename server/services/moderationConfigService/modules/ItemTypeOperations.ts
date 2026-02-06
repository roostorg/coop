/* eslint-disable max-lines */
import { type ConsumerDirectives } from '../../../lib/cache/index.js';
import { sql, type Kysely, type Selection } from 'kysely';
import { type ReadonlyDeep } from 'type-fest';
import { uid } from 'uid';

import { cached, type Cached } from '../../../utils/caching.js';
import {
  CoopError,
  ErrorType,
  isCoopErrorOfType,
  makeNotFoundError,
} from '../../../utils/errors.js';
import {
  __throw,
  assertUnreachable,
  removeUndefinedKeys,
} from '../../../utils/misc.js';
import { replaceEmptyStringWithNull } from '../../../utils/string.js';
import { type CollapseCases } from '../../../utils/typescript-types.js';
import { type ModerationConfigServicePg } from '../dbTypes.js';
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

const versionTextExpression = sql<string>`to_char(timezone('UTC'::text, version), 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'::text)`;
const itemTypeDbSelection = [
  'id',
  'name',
  'description',
  'kind',
  'fields',
  versionTextExpression.as('version'),
  'display_name_field as displayNameField',
  'creator_id_field as creatorIdField',
  'thread_id_field as threadIdField',
  'parent_id_field as parentIdField',
  'created_at_field as createdAtField',
  'is_deleted_field as isDeletedField',
  'profile_icon_field as profileIconField',
  'background_image_field as backgroundImageField',
  'org_id as orgId',
  'is_default_user as isDefaultUserType',
] as const;

type ItemTypeDbResult = Selection<
  ModerationConfigServicePg,
  'public.item_type_versions',
  (typeof itemTypeDbSelection)[number]
>;

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
    private readonly pgQuery: Kysely<ModerationConfigServicePg>,
    private readonly pgQueryReplica: Kysely<ModerationConfigServicePg>,
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
          pgQuery,
        })
          .where('id', '=', id)
          .where('version', '=', version)
          .executeTakeFirst();

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
        const itemTypes = await pgQuery
          .selectFrom('public.item_type_versions')
          .select(itemTypeDbSelection)
          .where('org_id', '=', orgId)
          .where('is_current', '=', true)
          .execute();

        return itemTypes.map((it) => dbResultToItemType(it, 'original'));
      },
      directives: { freshUntilAge: 10, maxStale: [0, 2, 2] },
    });
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
    const { id: userItemTypeId } = await this.pgQuery
      .insertInto('public.item_types')
      .values({
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
      })
      .returning('id')
      .executeTakeFirstOrThrow();

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
      };
    },
  ) {
    const { id: contentItemTypeId } = await this.pgQuery
      .insertInto('public.item_types')
      .values({
        id: uid(),
        name: input.name,
        description: input.description,
        org_id: orgId,
        kind: 'CONTENT',
        fields: input.schema,
        creator_id_field: input.schemaFieldRoles.creatorId,
        thread_id_field: input.schemaFieldRoles.threadId,
        parent_id_field: input.schemaFieldRoles.parentId,
        created_at_field: input.schemaFieldRoles.createdAt,
        display_name_field: input.schemaFieldRoles.displayName,
        is_deleted_field: input.schemaFieldRoles.isDeleted,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    return (await this.latestItemTypesCache(orgId, { maxAge: 0 })).find(
      (it): it is ReadonlyDeep<ContentItemType> =>
        it.kind === 'CONTENT' && it.id === contentItemTypeId,
    )!;
  }

  async updateContentType(
    orgId: string,
    input: {
      id: string;
      name?: string;
      schema?: ItemSchema;
      description?: string | null;
      schemaFieldRoles: {
        creatorId?: string | null;
        threadId?: string | null;
        parentId?: string | null;
        createdAt?: string | null;
        displayName?: string | null;
        isDeleted?: string | null;
      };
    },
  ) {
    const { id: contentItemTypeId } = await this.pgQuery
      .updateTable('public.item_types')
      .set(
        removeUndefinedKeys({
          name: input.name,
          description: replaceEmptyStringWithNull(input.description),
          fields: input.schema,
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
        }),
      )
      .where('id', '=', input.id)
      .where('org_id', '=', orgId)
      .returning('id')
      .executeTakeFirstOrThrow();

    return (await this.latestItemTypesCache(orgId, { maxAge: 0 })).find(
      (it): it is ReadonlyDeep<ContentItemType> =>
        it.kind === 'CONTENT' && it.id === contentItemTypeId,
    )!;
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
      };
    },
  ): Promise<ThreadItemType> {
    const { id: threadItemTypeId } = await this.pgQuery
      .insertInto('public.item_types')
      .values({
        id: uid(),
        name: input.name,
        description: input.description,
        org_id: orgId,
        kind: 'THREAD',
        fields: input.schema,
        created_at_field: input.schemaFieldRoles.createdAt,
        display_name_field: input.schemaFieldRoles.displayName,
        creator_id_field: input.schemaFieldRoles.creatorId,
        is_deleted_field: input.schemaFieldRoles.isDeleted,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    return (await this.latestItemTypesCache(orgId, { maxAge: 0 })).find(
      (it): it is ReadonlyDeep<ThreadItemType> =>
        it.kind === 'THREAD' && it.id === threadItemTypeId,
    )!;
  }

  async updateThreadType(
    orgId: string,
    input: {
      id: string;
      name?: string;
      schema?: ItemSchema;
      description?: string | null;
      schemaFieldRoles: {
        createdAt?: string | null;
        displayName?: string | null;
        creatorId?: string | null;
        isDeleted?: string | null;
      };
    },
  ) {
    const { id: threadItemTypeId } = await this.pgQuery
      .updateTable('public.item_types')
      .set(
        removeUndefinedKeys({
          name: input.name,
          description: replaceEmptyStringWithNull(input.description),
          fields: input.schema,
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
        }),
      )
      .where('id', '=', input.id)
      .where('org_id', '=', orgId)
      .returning('id')
      .executeTakeFirstOrThrow();

    return (await this.latestItemTypesCache(orgId, { maxAge: 0 })).find(
      (it): it is ReadonlyDeep<ThreadItemType> =>
        it.kind === 'THREAD' && it.id === threadItemTypeId,
    )!;
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
      };
    },
  ) {
    const { id: userItemTypeId } = await this.pgQuery
      .insertInto('public.item_types')
      .values({
        id: uid(),
        name: input.name,
        description: input.description,
        org_id: orgId,
        kind: 'USER',
        fields: input.schema,
        profile_icon_field: input.schemaFieldRoles.profileIcon,
        background_image_field: input.schemaFieldRoles.backgroundImage,
        created_at_field: input.schemaFieldRoles.createdAt,
        display_name_field: input.schemaFieldRoles.displayName,
        is_deleted_field: input.schemaFieldRoles.isDeleted,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    return (await this.latestItemTypesCache(orgId, { maxAge: 0 })).find(
      (it): it is ReadonlyDeep<UserItemType> =>
        it.kind === 'USER' && it.id === userItemTypeId,
    )!;
  }

  async updateUserType(
    orgId: string,
    input: {
      id: string;
      name?: string;
      schema?: ItemSchema;
      description?: string | null;
      schemaFieldRoles: {
        profileIcon?: string | null;
        backgroundImage?: string | null;
        createdAt?: string | null;
        displayName?: string | null;
        isDeleted?: string | null;
      };
    },
  ): Promise<UserItemType> {
    const { id: userItemTypeId } = await this.pgQuery
      .updateTable('public.item_types')
      .set(
        removeUndefinedKeys({
          name: input.name,
          description: replaceEmptyStringWithNull(input.description),
          fields: input.schema,
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
        }),
      )
      .where('id', '=', input.id)
      .where('org_id', '=', orgId)
      .returning('id')
      .executeTakeFirstOrThrow();

    return (await this.latestItemTypesCache(orgId, { maxAge: 0 })).find(
      (it): it is ReadonlyDeep<UserItemType> =>
        it.kind === 'USER' && it.id === userItemTypeId,
    )!;
  }

  /**
   * @param opts
   * @returns true if the item type existed and was deleted; false if the item
   *   type already didn't exist. Throws if the item type could not be deleted.
   */
  async deleteItemType(opts: { orgId: string; itemTypeId: string }) {
    const { orgId, itemTypeId } = opts;
    const res = await this.pgQuery
      .transaction()
      .setIsolationLevel('repeatable read')
      .execute(async (trx) => {
        const isDefaultUserType = await trx
          .selectFrom('public.item_types')
          .where('id', '=', itemTypeId)
          .where('is_default_user', '=', true)
          .where('org_id', '=', orgId)
          .executeTakeFirst();

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

        return trx
          .deleteFrom('public.item_types')
          .where('id', '=', itemTypeId)
          .where('org_id', '=', orgId)
          .executeTakeFirst();
      });

    // Refetch item types to evict deleted item from the cache
    await this.latestItemTypesCache(orgId, { maxAge: 0 });

    return res.numDeletedRows === 1n;
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

    const results = await pgQuery
      .transaction()
      .setIsolationLevel('repeatable read')
      .execute(async (trx) => {
        const action = await trx
          .selectFrom('public.actions')
          // We have to select this as a text array in order for the postgres
          // driver to properly convert it into a javascript array
          .select((eb) =>
            sql<('CONTENT' | 'THREAD' | 'USER')[]>`${eb.ref(
              'applies_to_all_items_of_kind',
            )}::text[]`.as('appliesToAllItemsOfKind'),
          )
          .where('id', '=', actionId)
          .executeTakeFirst();

        if (action === undefined) {
          return [];
        }

        return action.appliesToAllItemsOfKind.length > 0
          ? getItemTypeVersionsBaseQuery({
              orgId,
              currentVersionsOnly: true,
              pgQuery,
            })
              .where('kind', 'in', action.appliesToAllItemsOfKind)
              .execute()
          : getItemTypeVersionsBaseQuery({
              orgId,
              currentVersionsOnly: true,
              pgQuery,
            })
              .where(
                'id',
                'in',
                pgQuery
                  .selectFrom('public.actions_and_item_types')
                  .select('item_type_id')
                  .where('action_id', '=', actionId),
              )
              .execute();
      });

    return results.map((it) => dbResultToItemType(it));
  }

  async getItemTypesForRule(opts: {
    orgId: string;
    ruleId: string;
    readFromReplica?: boolean;
  }): Promise<ItemType[]> {
    const { orgId, ruleId, readFromReplica } = opts;
    const itemTypes = await getItemTypeVersionsBaseQuery({
      orgId,
      currentVersionsOnly: true,
      pgQuery: this.#getPgQuery(readFromReplica),
    })
      .where(
        'id',
        'in',
        this.pgQuery
          .selectFrom('public.rules_and_item_types')
          .select('item_type_id')
          .where('rule_id', '=', ruleId),
      )
      .execute();
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
  pgQuery: Kysely<ModerationConfigServicePg>;
}) {
  const { orgId, currentVersionsOnly, pgQuery } = opts;
  return pgQuery
    .selectFrom('public.item_type_versions')
    .select(itemTypeDbSelection)
    .where('org_id', '=', orgId)
    .$if(currentVersionsOnly, (qb) => qb.where('is_current', '=', true));
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
          } satisfies ThreadItemType['schemaFieldRoles'];
        case 'USER':
          return {
            displayName: input.displayNameField ?? undefined,
            backgroundImage: input.backgroundImageField ?? undefined,
            createdAt: input.createdAtField ?? undefined,
            profileIcon: input.profileIconField ?? undefined,
            isDeleted: input.isDeletedField ?? undefined,
          } satisfies UserItemType['schemaFieldRoles'];
        default:
          assertUnreachable(input.kind);
      }
    })(),
  } satisfies Omit<ItemType, 'schemaFieldRoles'> & {
    schemaFieldRoles: ItemType['schemaFieldRoles'];
  } as ItemType & { kind: T };
}
