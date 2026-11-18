/* eslint-disable max-lines */

import { type ItemIdentifier } from '@roostorg/coop-types';
import { Queue, Worker, type Job } from 'bullmq';
import { and, eq, gte, inArray, notInArray, or, sql } from 'drizzle-orm';
import { type Cluster } from 'ioredis';
import type IORedis from 'ioredis';
import pLimit from 'p-limit';
import { type Opaque, type ReadonlyDeep } from 'type-fest';
import { v1 as uuidv1 } from 'uuid';

import { type Dependencies } from '../../../iocContainer/index.js';
import {
  schema,
  transactionWithRetry,
  type CoopDb,
  type CoopDbOrTx,
  type CoopTx,
} from '../../../storage/postgres/drizzle.js';
import { cached, type Cached } from '../../../utils/caching.js';
import { filterNullOrUndefined } from '../../../utils/collections.js';
import {
  b64UrlDecode,
  b64UrlEncode,
  jsonStringify,
  type B64UrlOf,
} from '../../../utils/encoding.js';
import {
  CoopError,
  ErrorType,
  makeUnauthorizedError,
  type ErrorInstanceData,
} from '../../../utils/errors.js';
import {
  isForeignKeyViolationError,
  isUniqueViolationError,
} from '../../../utils/kysely.js';
import { removeUndefinedKeys, safeGet, safePick } from '../../../utils/misc.js';
import { replaceEmptyStringWithNull } from '../../../utils/string.js';
import { WEEK_MS } from '../../../utils/time.js';
import {
  instantiateOpaqueType,
  type Bind1,
} from '../../../utils/typescript-types.js';
import {
  getFieldValueForRole,
  makeSubmissionId,
} from '../../itemProcessingService/index.js';
import { type ItemSubmissionWithTypeIdentifier } from '../../itemProcessingService/makeItemSubmissionWithTypeIdentifier.js';
import {
  UserPermission,
  type Invoker,
} from '../../userManagementService/index.js';
import {
  type ClearReportsDisposition,
  type ClearReportsScope,
} from '../dbTypes.js';
import {
  type AppealEnqueueSourceInfo,
  type JobId,
  type LegacyItemWithTypeIdentifier,
  type ManualReviewAppealJob,
  type ManualReviewAppealJobPayload,
  type ManualReviewJob,
  type ManualReviewJobEnqueueSourceInfo,
  type ManualReviewJobPayload,
  type OriginJobInfo,
  type StoredManualReviewJob,
} from '../manualReviewToolService.js';
import {
  userIdentifierFromItem,
  type JobSortType,
  type UserIdentifier,
} from './JobPriority.js';
import PendingJobIndex from './PendingJobIndex.js';

export type ManualReviewQueue = {
  id: string;
  name: string;
  description: string | null;
  orgId: string;
  createdAt: Date;
  isDefaultQueue: boolean;
  isAppealsQueue: boolean;
  autoCloseJobs: boolean;
  jobSortType: JobSortType;
  // Null disposition disables "clear other reports for this user" (issue #650).
  clearReportsDisposition: ClearReportsDisposition | null;
  clearReportsScope: ClearReportsScope;
};

const OLDEST_JOB_PRIORITIZED_SCAN_LIMIT = 10_000;

const MAX_RECOMPUTE_SNAPSHOT_PASSES = 10;

// Bounds the BullMQ lookups one oldest-job read can spend confirming index
// entries. Past it the read reports "unknown" rather than an unconfirmed age.
const OLDEST_JOB_MAX_CANDIDATES = 50;
const OLDEST_JOB_CANDIDATE_BATCH_SIZE = 10;

const PENDING_JOB_INDEX_BACKFILL_BATCH_SIZE = 1_000;

const PENDING_JOB_STATES = new Set(['waiting', 'prioritized', 'delayed']);

const {
  manualReviewQueues: queuesTable,
  usersAndAccessibleQueues,
  rolesAndAccessibleQueues,
  usersAndFavoriteMrtQueues,
  routingRules,
  appealsRoutingRules,
  jobCreations,
  manualReviewDecisions,
  queuesAndHiddenActions,
  queuesAndClearReportsTriggerActions,
} = schema;

const PgQueueSelection = {
  id: queuesTable.id,
  orgId: queuesTable.orgId,
  name: queuesTable.name,
  description: queuesTable.description,
  isDefaultQueue: queuesTable.isDefaultQueue,
  createdAt: queuesTable.createdAt,
  isAppealsQueue: queuesTable.isAppealsQueue,
  // The column is nullable in the DB but always written; ManualReviewQueue
  // types it as boolean.
  autoCloseJobs: sql<boolean>`${queuesTable.autoCloseJobs}`,
  jobSortType: queuesTable.jobSortType,
  clearReportsDisposition: queuesTable.clearReportsDisposition,
  clearReportsScope: queuesTable.clearReportsScope,
};

// BullJobId represents the ID we give a job within Bull. It's only unique among
// the pending jobs within a single queue. Over time, multiple jobs will end up
// with the same BullJobId if the same item is enqueued multiple times (with the
// second enqueue happening in a different queue or after the first job has been
// processed and is no longer saved in Bull). However, if one attempts to
// enqueue a new job with the same BullJobId while another job with that id is
// still in the queue, Bull will ignore the second enqueue, because it dedupes
// on the basis of this id, which is exactly what we want.
type BullJobId = Opaque<string, 'BullJobId'>;

// TODO: use this.
export type ManualReviewQueueErrorType = 'ManualReviewQueueNameExistsError';
export type QueueOperationsErrorType =
  | 'DeleteAllJobsUnauthorizedError'
  | 'QueueDoesNotExistError'
  | 'UnableToDeleteDefaultQueueError'
  | 'AccessibleQueueNotInOrgError'
  | 'QueueHasDependentRoutingRulesError';

// Compound identifier for a queue. orgId is needed for security, but also
// because queues are/will be actually sharded across redis instances for
// scaling by orgId, so you need the orgId to find the queue.
type QueueKey = { orgId: string; queueId: string };

const MANUAL_REVIEW_LOCK_DURATION_MS = 600_000;

/**
 * This class handles everything that MRT does directly with queues: CRUDing
 * them, enqueuing and dequeueing jobs on a given queue, looking up jobs within
 * a given queue, etc. It does not deal with routing jobs to queues or forming
 * the job payloads that should be enqueued.
 *
 * The state for queues is split between BullMQ and Postgres, and this class
 * coordinates those two backends where needed to present a single, logical API
 * (see, e.g., the use of {@link #checkQueueExists} inside
 * {@link #getBullQueue}, and the logic in {@link deleteManualReviewQueue}).
 *
 * This class also implements (and hides the implementation details of)
 * MRT-specific logic for ignoring an enqueue when a job already exists for the
 * same item.
 *
 * Finally, it handles the mismatch between how Bull is normally used (i.e.,
 * with a small number of long-running workers that automatically dequeue and
 * process jobs, and a few long-lived queue object references that are used to
 * push jobs to those workers) and how we use it in MRT, where users -- not an
 * automatic worker -- manually dequeue jobs and mark them complete, and where
 * there are many, many queues (not all of which we want to keep references to
 * in memory or connected to Redis at all times).
 *
 * As part of handling that mismatch, this class exposes an API that solely
 * accepts and returns plain data values, as opposed to the stateful
 * Queue/Worker/Job objects that Bull usually deals with. While this
 * occasionally adds some overhead, that overhead is minimized by smart caching
 * internally, and this sort of API also makes the class much easier to mock.
 */
export default class QueueOperations {
  private readonly getOrCreateBullQueue: Cached<
    Bind1<typeof getOrCreateBullQueue<StoredManualReviewJob>>
  >;
  private readonly getBullWorker: Cached<
    Bind1<typeof getBullWorker<StoredManualReviewJob>>
  >;

  private readonly getOrCreateBullAppealQueue: Cached<
    Bind1<typeof getOrCreateBullQueue<ManualReviewAppealJob>>
  >;
  private readonly getBullAppealWorker: Cached<
    Bind1<typeof getBullWorker<ManualReviewAppealJob>>
  >;
  private readonly pendingJobIndex: PendingJobIndex;
  readonly #pendingJobIndexBackfills = new Map<string, Promise<void>>();

  constructor(
    private readonly db: CoopDb,
    private readonly dbReadReplica: CoopDb,
    private readonly moderationConfigService: Dependencies['ModerationConfigService'],
    private readonly redis: RedisConnection,
    private readonly tracer: Dependencies['Tracer'],
    private readonly meter?: Dependencies['Meter'],
  ) {
    this.pendingJobIndex = new PendingJobIndex(redis);
    // Reassingment here is a hack to work around TS syntax limitations
    // with generic instantiation expressions.
    const getOrCreateBullQueue_ = getOrCreateBullQueue<StoredManualReviewJob>;
    const getBullWorker_ = getBullWorker<StoredManualReviewJob>;
    const getOrCreateBullAppealQueue_ =
      getOrCreateBullQueue<ManualReviewAppealJob>;
    const getBullAppealWorker_ = getBullWorker<ManualReviewAppealJob>;

    this.getBullWorker = cached({
      producer: getBullWorker_.bind(null, redis),
      directives: { freshUntilAge: 600 },
      numItemsLimit: 128,
      onItemEviction: async (workerPromise) => {
        await workerPromise.close();
      },
    });

    this.getOrCreateBullQueue = cached({
      producer: getOrCreateBullQueue_.bind(null, redis),
      directives: { freshUntilAge: 600 },
      numItemsLimit: 128,
      onItemEviction: async (queuePromise) => {
        await queuePromise.close();
      },
    });

    this.getBullAppealWorker = cached({
      producer: getBullAppealWorker_.bind(null, redis),
      directives: { freshUntilAge: 600 },
      numItemsLimit: 128,
      onItemEviction: async (workerPromise) => {
        await workerPromise.close();
      },
    });

    this.getOrCreateBullAppealQueue = cached({
      producer: getOrCreateBullAppealQueue_.bind(null, redis),
      directives: { freshUntilAge: 600 },
      numItemsLimit: 128,
      onItemEviction: async (queuePromise) => {
        await queuePromise.close();
      },
    });
  }

  async checkQueueExists(orgId: string, queueId: string) {
    // NB: this intentionally hits the primary, to make sure we're giving an
    // accurate result before creating the Bull queue.
    const queue = (
      await this.db
        .select(PgQueueSelection)
        .from(queuesTable)
        .where(and(eq(queuesTable.orgId, orgId), eq(queuesTable.id, queueId)))
        .limit(1)
    ).at(0);
    if (queue === undefined) {
      throw makeQueueDoesNotExistError({ shouldErrorSpan: true });
    }
  }

  async #getBullQueue(orgId: string, queueId: string) {
    await this.checkQueueExists(orgId, queueId);
    return this.getOrCreateBullQueue({ orgId, queueId });
  }
  async #getBullAppealQueue(orgId: string, queueId: string) {
    await this.checkQueueExists(orgId, queueId);
    return this.getOrCreateBullAppealQueue({ orgId, queueId });
  }

  // TODO: try/catch create and update and throw
  // ManualReviewQueueNameExistsError and NotFoundError
  async createManualReviewQueue(input: {
    name: string;
    description: string | null;
    userIds: readonly string[];
    roleIds: readonly string[];
    hiddenActionIds: readonly string[];
    invokedBy: Invoker;
    isAppealsQueue?: boolean;
    autoCloseJobs?: boolean;
    jobSortType?: JobSortType;
    clearReportsDisposition?: ClearReportsDisposition | null;
    clearReportsScope?: ClearReportsScope;
    clearReportsTriggerActionIds?: readonly string[];
  }) {
    const {
      name,
      description,
      userIds,
      roleIds,
      hiddenActionIds,
      invokedBy,
      isAppealsQueue,
      autoCloseJobs,
      jobSortType: requestedJobSortType = 'FIFO',
      clearReportsDisposition,
      clearReportsScope,
      clearReportsTriggerActionIds,
    } = input;
    const { orgId } = invokedBy;

    // Appeal jobs are never enqueued with a priority, so appeals queues are
    // always FIFO no matter what the caller asks for.
    const jobSortType = isAppealsQueue ? 'FIFO' : requestedJobSortType;

    if (!invokedBy.permissions.includes(UserPermission.EDIT_MRT_QUEUES)) {
      throw makeUnauthorizedError(
        'You do not have permission to create a queue',
        { shouldErrorSpan: true },
      );
    }

    // Defense-in-depth org-scoping: every user granted access to the new
    // queue must belong to the caller's org. The queue itself is always
    // created in the caller's org (orgId from the invoker).
    await assertUsersInOrg(this.db, { orgId, userIds });
    await assertRolesInOrg(this.db, { orgId, roleIds });
    const uniqueRoleIds = [...new Set(roleIds)];

    let createdQueue: ManualReviewQueue;
    try {
      createdQueue = await transactionWithRetry(
        this.db,
        async (transaction) => {
          const orgHasQueuesAlready = await transaction
            .select({ id: queuesTable.id })
            .from(queuesTable)
            .where(
              and(
                eq(queuesTable.orgId, orgId),
                eq(queuesTable.isAppealsQueue, isAppealsQueue ?? false),
              ),
            )
            .limit(1)
            .then((queues) => queues.length > 0);

          const [queue] = await transaction
            .insert(queuesTable)
            .values([
              {
                id: uuidv1(),
                name,
                orgId,
                isDefaultQueue: !orgHasQueuesAlready,
                description: replaceEmptyStringWithNull(description),
                isAppealsQueue: isAppealsQueue ?? false,
                autoCloseJobs: autoCloseJobs ?? false,
                jobSortType,
                clearReportsDisposition: clearReportsDisposition ?? null,
                clearReportsScope: clearReportsScope ?? 'CURRENT_QUEUE',
              },
            ])
            .returning(PgQueueSelection);

          await transaction
            .insert(usersAndAccessibleQueues)
            .values(userIds.map((userId) => ({ queueId: queue.id, userId })));

          if (uniqueRoleIds.length > 0) {
            await transaction
              .insert(rolesAndAccessibleQueues)
              .values(
                uniqueRoleIds.map((roleId) => ({ queueId: queue.id, roleId })),
              );
          }

          await this.updateHiddenActionsForQueue({
            transaction,
            queueId: queue.id,
            actionIdsToHide: hiddenActionIds,
            actionIdsToUnhide: [],
            orgId,
          });
          await this.setClearReportsTriggerActionsForQueue({
            transaction,
            queueId: queue.id,
            orgId,
            actionIds: clearReportsTriggerActionIds ?? [],
          });
          return queue;
        },
      );
    } catch (e) {
      if (isUniqueViolationError(e)) {
        throw makeManualReviewQueueNameExistsError({ shouldErrorSpan: true });
      }
      throw e;
    }

    // A brand-new queue has no jobs, so its index is complete from the start.
    if (!createdQueue.isAppealsQueue) {
      await this.pendingJobIndex.markBuilt({
        orgId,
        queueId: createdQueue.id,
      });
    }
    return createdQueue;
  }

  async updateManualReviewQueue(input: {
    orgId: string;
    queueId: string;
    name?: string;
    description?: string | null;
    userIds: readonly string[];
    roleIds: readonly string[];
    actionIdsToHide: readonly string[];
    actionIdsToUnhide: readonly string[];
    autoCloseJobs?: boolean;
    jobSortType?: JobSortType;
    clearReportsDisposition?: ClearReportsDisposition | null;
    clearReportsScope?: ClearReportsScope;
    // When provided, replaces the queue's full set of trigger actions.
    clearReportsTriggerActionIds?: readonly string[];
  }) {
    const {
      queueId,
      orgId,
      name,
      description,
      userIds,
      roleIds,
      actionIdsToHide,
      actionIdsToUnhide,
      autoCloseJobs,
      jobSortType,
      clearReportsDisposition,
      clearReportsScope,
      clearReportsTriggerActionIds,
    } = input;

    // Defense-in-depth org-scoping: the target queue and every user granted
    // access must belong to the caller's org. Reject before any write so a
    // cross-org queueId or userId can't mutate users_and_accessible_queues
    // rows belonging to another org.
    await assertUsersAndQueuesInOrg(this.db, {
      orgId,
      userIds,
      queueIds: [queueId],
    });
    await assertRolesInOrg(this.db, { orgId, roleIds });

    return transactionWithRetry(this.db, async (transaction) => {
      const [updatedQueues, _, __] = await Promise.all([
        transaction
          .update(queuesTable)
          .set(
            removeUndefinedKeys({
              name,
              description: replaceEmptyStringWithNull(description),
              autoCloseJobs,
              jobSortType,
              // null disables the feature and must survive removeUndefinedKeys.
              clearReportsDisposition,
              clearReportsScope,
            }),
          )
          .where(and(eq(queuesTable.id, queueId), eq(queuesTable.orgId, orgId)))
          .returning(PgQueueSelection),
        transaction
          .insert(usersAndAccessibleQueues)
          .values(userIds.map((userId) => ({ queueId, userId })))
          .onConflictDoNothing(),
        transaction
          .delete(usersAndAccessibleQueues)
          .where(
            and(
              eq(usersAndAccessibleQueues.queueId, queueId),
              notInArray(usersAndAccessibleQueues.userId, [...userIds]),
            ),
          ),
      ]);
      // The queue can vanish between the org check and the update; throw so
      // the transaction rolls back.
      const updatedQueue = updatedQueues.at(0);
      if (updatedQueue === undefined) {
        throw makeQueueDoesNotExistError({ shouldErrorSpan: true });
      }

      if (roleIds.length > 0) {
        await transaction
          .insert(rolesAndAccessibleQueues)
          .values(roleIds.map((roleId) => ({ queueId, roleId })))
          .onConflictDoNothing();
        await transaction
          .delete(rolesAndAccessibleQueues)
          .where(
            and(
              eq(rolesAndAccessibleQueues.queueId, queueId),
              notInArray(rolesAndAccessibleQueues.roleId, [...roleIds]),
            ),
          );
      } else {
        await transaction
          .delete(rolesAndAccessibleQueues)
          .where(eq(rolesAndAccessibleQueues.queueId, queueId));
      }

      await this.updateHiddenActionsForQueue({
        transaction,
        queueId,
        orgId,
        actionIdsToHide,
        actionIdsToUnhide,
      });
      if (clearReportsTriggerActionIds !== undefined) {
        await this.setClearReportsTriggerActionsForQueue({
          transaction,
          queueId,
          orgId,
          actionIds: clearReportsTriggerActionIds,
        });
      }
      return updatedQueue;
    });
  }

  /**
   * @returns true when the queue that was trying to be deleted
   * exists and is successfully deleted, false when the queue
   * did not exist and throws when the delete fails for some reason
   */
  async deleteManualReviewQueue(orgId: string, queueId: string) {
    const defaultQueueId = await this.getDefaultQueueIdForOrg(orgId);
    if (queueId === defaultQueueId) {
      throw makeUnableToDeleteDefaultQueueError({ shouldErrorSpan: true });
    }
    const queue = await this.getOrCreateBullQueue({ orgId, queueId });

    let numDeletedRows: number;
    try {
      numDeletedRows = await transactionWithRetry(
        this.db,
        async (transaction) =>
          this.#deleteQueueRows(transaction, orgId, queueId),
      );
    } catch (e) {
      const constraint = getPgConstraintName(e);
      if (
        isForeignKeyViolationError(e) &&
        (constraint === 'routing_rules_destination_queue_id_fkey' ||
          constraint === 'appeals_routing_rules_destination_queue_id_fkey')
      ) {
        // routing_rules and appeals_routing_rules have RESTRICT FKs to this
        // queue. Query for their names so the error message is actionable.
        const [dependentRoutingRules, dependentAppealsRoutingRules] =
          await Promise.all([
            this.db
              .select({ name: routingRules.name })
              .from(routingRules)
              .where(
                and(
                  eq(routingRules.destinationQueueId, queueId),
                  eq(routingRules.orgId, orgId),
                ),
              ),
            this.db
              .select({ name: appealsRoutingRules.name })
              .from(appealsRoutingRules)
              .where(
                and(
                  eq(appealsRoutingRules.destinationQueueId, queueId),
                  eq(appealsRoutingRules.orgId, orgId),
                ),
              ),
          ]);
        const ruleNames = [
          ...dependentRoutingRules.map((r) => r.name),
          ...dependentAppealsRoutingRules.map((r) => r.name),
        ];
        throw makeQueueHasDependentRoutingRulesError(ruleNames, {
          shouldErrorSpan: false,
        });
      }
      throw e;
    }

    if (numDeletedRows === 1) {
      try {
        await queue.obliterate({ force: true });
      } catch (e) {
        // The DB row is already gone at this point, so a retry would see
        // numDeletedRows === 0 and skip obliterate() entirely, silently
        // leaving orphaned Bull/Redis data behind. Best-effort cleanup:
        // surface the failure to the active tracing span (mirrors the
        // pattern used elsewhere, e.g. `UserApi.logout`) so ops can run
        // `server/bin/recover-mrt-queue.ts`, but still report success since
        // the DB delete itself succeeded.
        this.tracer.logActiveSpanFailedIfAny(e);
      }
      await this.pendingJobIndex
        .clear({ orgId, queueId })
        .catch((e: unknown) => this.tracer.logActiveSpanFailedIfAny(e));
    }

    return numDeletedRows === 1;
  }

  /**
   * Deletes the queue scoped by org first. If it doesn't belong to the
   * caller's org, no rows are touched and we bail before deleting any join
   * rows. `users_and_accessible_queues` has no `org_id` column, so an unscoped
   * delete would otherwise wipe another org's access rows when the parent
   * delete matches 0 rows.
   */
  async #deleteQueueRows(
    transaction: CoopTx,
    orgId: string,
    queueId: string,
  ): Promise<number> {
    const queueDelete = await transaction
      .delete(queuesTable)
      .where(and(eq(queuesTable.id, queueId), eq(queuesTable.orgId, orgId)));

    const deleted = queueDelete.rowCount ?? 0;
    if (deleted === 0) {
      return 0;
    }

    await transaction
      .delete(usersAndAccessibleQueues)
      .where(eq(usersAndAccessibleQueues.queueId, queueId));

    return deleted;
  }

  async deleteManualReviewQueueForTestsDO_NOT_USE(
    orgId: string,
    queueId: string,
  ) {
    const queue = await this.getOrCreateBullQueue({ orgId, queueId });

    await queue.obliterate({ force: true });
    await this.pendingJobIndex.clear({ orgId, queueId });

    // See `deleteManualReviewQueue` for why this is serialized + ownership-
    // checked. Same pattern, just without the default-queue guard.
    //
    // routing_rules and appeals_routing_rules have RESTRICT FKs to this queue,
    // so we must delete any referencing rules before deleting the queue.
    const numDeletedRows = await transactionWithRetry(
      this.db,
      async (transaction) => {
        await transaction
          .delete(routingRules)
          .where(
            and(
              eq(routingRules.destinationQueueId, queueId),
              eq(routingRules.orgId, orgId),
            ),
          );

        await transaction
          .delete(appealsRoutingRules)
          .where(
            and(
              eq(appealsRoutingRules.destinationQueueId, queueId),
              eq(appealsRoutingRules.orgId, orgId),
            ),
          );

        return this.#deleteQueueRows(transaction, orgId, queueId);
      },
    );

    return numDeletedRows === 1;
  }

  async getDefaultQueueIdForOrg(orgId: string) {
    return this.#getDefaultQueueId(orgId, false);
  }

  async getDefaultAppealsQueueIdForOrg(orgId: string) {
    return this.#getDefaultQueueId(orgId, true);
  }

  async #getDefaultQueueId(orgId: string, isAppealsQueue: boolean) {
    const queue = (
      await this.db
        .select({ id: queuesTable.id })
        .from(queuesTable)
        .where(
          and(
            eq(queuesTable.orgId, orgId),
            eq(queuesTable.isAppealsQueue, isAppealsQueue),
            eq(queuesTable.isDefaultQueue, true),
          ),
        )
        .limit(1)
    ).at(0);
    if (queue === undefined) {
      // Every org gets default queues at creation; callers rely on a throw.
      throw new Error(
        `No default ${isAppealsQueue ? 'appeals ' : ''}queue for org`,
      );
    }
    return queue.id;
  }

  async getReviewableQueuesForUser(opts: {
    invoker: Invoker;
    queueIds?: readonly string[];
  }) {
    const { invoker, queueIds } = opts;
    const { userId, permissions, orgId } = invoker;

    const bypassQueuePermissions = permissions.includes(
      UserPermission.EDIT_MRT_QUEUES,
    );
    const canSeeQueues =
      permissions.includes(UserPermission.VIEW_MRT) || bypassQueuePermissions;

    if (!canSeeQueues || queueIds?.length === 0) {
      return [];
    }

    return this.db
      .select(PgQueueSelection)
      .from(queuesTable)
      .where(
        and(
          eq(queuesTable.orgId, orgId),
          queueIds != null ? inArray(queuesTable.id, [...queueIds]) : undefined,
          bypassQueuePermissions
            ? undefined
            : this.#isAccessibleToUser(userId, orgId),
        ),
      );
  }

  // A queue is accessible when the reviewer is individually assigned to it, or
  // when their role is assigned to it (see `roleAccessibleQueueIds`).
  #isAccessibleToUser(userId: string, orgId: string) {
    return or(
      inArray(queuesTable.id, this.individuallyAccessibleQueueIds(userId)),
      inArray(queuesTable.id, this.roleAccessibleQueueIds(userId, orgId)),
    );
  }

  private individuallyAccessibleQueueIds(userId: string) {
    return this.db
      .select({ queueId: usersAndAccessibleQueues.queueId })
      .from(usersAndAccessibleQueues)
      .where(eq(usersAndAccessibleQueues.userId, userId));
  }

  private roleAccessibleQueueIds(userId: string, orgId: string) {
    const { users } = schema;
    return this.db
      .select({ queueId: rolesAndAccessibleQueues.queueId })
      .from(rolesAndAccessibleQueues)
      .where(
        eq(
          rolesAndAccessibleQueues.roleId,
          this.db
            .select({ roleId: users.roleId })
            .from(users)
            .where(and(eq(users.id, userId), eq(users.orgId, orgId))),
        ),
      );
  }

  async getQueueForOrg(opts: {
    orgId: string;
    userId: string;
    queueId: string;
  }) {
    const { orgId, userId, queueId } = opts;
    const queue = (
      await this.db
        .select(PgQueueSelection)
        .from(queuesTable)
        .where(
          and(
            eq(queuesTable.orgId, orgId),
            eq(queuesTable.id, queueId),
            this.#isAccessibleToUser(userId, orgId),
          ),
        )
        .limit(1)
    ).at(0);
    return queue;
  }

  async getFavoriteQueuesForUser(opts: { orgId: string; userId: string }) {
    const { orgId, userId } = opts;
    return this.db
      .select(PgQueueSelection)
      .from(usersAndFavoriteMrtQueues)
      .innerJoin(
        queuesTable,
        eq(usersAndFavoriteMrtQueues.queueId, queuesTable.id),
      )
      .where(
        and(
          eq(usersAndFavoriteMrtQueues.userId, userId),
          eq(usersAndFavoriteMrtQueues.orgId, orgId),
        ),
      );
  }

  async addFavoriteQueueForUser(opts: {
    userId: string;
    orgId: string;
    queueId: string;
  }) {
    const { userId, orgId, queueId } = opts;
    await this.db
      .insert(usersAndFavoriteMrtQueues)
      .values({ userId, orgId, queueId })
      .onConflictDoNothing();
  }

  async removeFavoriteQueueForUser(opts: {
    userId: string;
    orgId: string;
    queueId: string;
  }) {
    const { userId, orgId, queueId } = opts;
    await this.db
      .delete(usersAndFavoriteMrtQueues)
      .where(
        and(
          eq(usersAndFavoriteMrtQueues.userId, userId),
          eq(usersAndFavoriteMrtQueues.orgId, orgId),
          eq(usersAndFavoriteMrtQueues.queueId, queueId),
        ),
      );
  }

  async getAllQueuesForOrgAndDangerouslyBypassPermissioning(orgId: string) {
    return this.db
      .select(PgQueueSelection)
      .from(queuesTable)
      .where(eq(queuesTable.orgId, orgId));
  }

  async getQueueForOrgAndDangerouslyBypassPermissioning(opts: {
    orgId: string;
    queueId: string;
  }) {
    const queue = (
      await this.db
        .select(PgQueueSelection)
        .from(queuesTable)
        .where(
          and(
            eq(queuesTable.orgId, opts.orgId),
            eq(queuesTable.id, opts.queueId),
          ),
        )
        .limit(1)
    ).at(0);
    return queue;
  }

  async getUsersWhoCanSeeQueue(opts: { orgId: string; queueId: string }) {
    const { orgId, queueId } = opts;
    return this.db
      .select({ userId: usersAndAccessibleQueues.userId })
      .from(usersAndAccessibleQueues)
      .where(
        and(
          eq(usersAndAccessibleQueues.queueId, queueId),
          inArray(usersAndAccessibleQueues.queueId, this.#queueIdsInOrg(orgId)),
        ),
      );
  }

  async getAssignedRoleIdsForQueue(opts: { orgId: string; queueId: string }) {
    const { orgId, queueId } = opts;
    const rows = await this.db
      .select({ roleId: rolesAndAccessibleQueues.roleId })
      .from(rolesAndAccessibleQueues)
      .where(
        and(
          eq(rolesAndAccessibleQueues.queueId, queueId),
          inArray(rolesAndAccessibleQueues.queueId, this.#queueIdsInOrg(orgId)),
        ),
      );
    return rows.map((it) => it.roleId);
  }

  #queueIdsInOrg(orgId: string) {
    return this.db
      .select({ id: queuesTable.id })
      .from(queuesTable)
      .where(eq(queuesTable.orgId, orgId));
  }

  async addAccessibleQueuesForUser(opts: {
    orgId: string;
    userIds: readonly string[];
    queueIds: readonly string[];
  }) {
    const { orgId, userIds, queueIds } = opts;
    await assertUsersAndQueuesInOrg(this.db, {
      orgId,
      userIds,
      queueIds,
    });

    return this.db
      .insert(usersAndAccessibleQueues)
      .values(
        userIds.flatMap((userId) =>
          queueIds.map((queueId) => ({ queueId, userId })),
        ),
      )
      .onConflictDoNothing();
  }

  async removeAccessibleQueuesForUser(opts: {
    orgId: string;
    userId: string;
    queueIds: readonly string[];
  }) {
    const { orgId, userId, queueIds } = opts;
    await assertUsersAndQueuesInOrg(this.db, {
      orgId,
      userIds: [userId],
      queueIds,
    });

    return this.db
      .delete(usersAndAccessibleQueues)
      .where(
        and(
          eq(usersAndAccessibleQueues.userId, userId),
          inArray(usersAndAccessibleQueues.queueId, [...queueIds]),
        ),
      );
  }

  async #getJob(
    externalId: JobId,
    queue: ReadonlyDeep<Queue<StoredManualReviewJob>>,
  ) {
    const { bullId } = parseExternalId(externalId);

    const job = await queue.getJob(bullId);

    // NB: this check ensures that the job is actually the requested one,
    // not a new job about the same item.
    return job?.data.id === externalId ? job : undefined;
  }

  async #getAppealJob(
    externalId: JobId,
    queue: ReadonlyDeep<Queue<ManualReviewAppealJob>>,
  ) {
    const { bullId } = parseExternalId(externalId);

    const job = await queue.getJob(bullId);

    // NB: this check ensures that the job is actually the requested one,
    // not a new job about the same item.
    return job?.data.id === externalId ? job : undefined;
  }

  async getJobFromItemId(opts: {
    orgId: string;
    queueId: string;
    itemId: string;
    itemTypeId: string;
  }): Promise<ManualReviewJob | undefined> {
    const { orgId, queueId, itemId, itemTypeId } = opts;
    const queue = await this.#getBullQueue(orgId, queueId);
    const job = await queue.getJob(
      itemIdToBullJobId({ id: itemId, typeId: itemTypeId }),
    );
    if (job) {
      const converted = await this.legacyJobToJob(job, orgId);
      return converted.data;
    } else {
      return undefined;
    }
  }

  /**
   * Enqueues a new job to the specified queue, or does nothing if a job already
   * exists in that queue for the same item.
   */
  async addJob(opts: {
    orgId: string;
    queueId: string;
    reenqueuedFrom?: OriginJobInfo;
    jobPayload: {
      createdAt?: Date;
      policyIds: string[];
      payload: ManualReviewJobPayload;
    };
    enqueueSourceInfo: ManualReviewJobEnqueueSourceInfo;
    priority?: number;
  }) {
    const {
      orgId,
      queueId,
      jobPayload,
      reenqueuedFrom,
      enqueueSourceInfo,
      priority,
    } = opts;
    const { payload, policyIds } = jobPayload;

    const queue = await this.#getBullQueue(orgId, queueId);

    const bullJobId = itemIdToBullJobId({
      id: payload.item.itemId,
      typeId: payload.item.itemTypeIdentifier.id,
    });
    const jobId = bullJobIdtoExternalJobId(bullJobId);
    const createdAt = jobPayload.createdAt ?? new Date();

    const indexable = Number.isFinite(createdAt.getTime());
    // Indexed before the add so a read never sees the job without an entry.
    if (indexable) {
      await this.pendingJobIndex.add({
        orgId,
        queueId,
        entries: [{ jobId, createdAtMs: createdAt.getTime() }],
      });
    }

    const newJob = await queue.add(
      bullJobId,
      {
        orgId,
        payload,
        id: jobId,
        createdAt,
        policyIds,
        reenqueuedFrom,
        enqueueSourceInfo,
      },
      {
        removeOnComplete: true,
        jobId: bullJobId,
        ...(priority != null && { priority }),
      },
    );

    // A read that ran while the add was in flight found no BullMQ job for
    // our entry and dropped it, so write it again now that the job exists.
    // If BullMQ instead ignored the add because the BullJobId was taken, our
    // entry names a job that was never stored. A failure here mustn't fail
    // an enqueue that succeeded.
    if (indexable) {
      try {
        const storedJob = await queue.getJob(bullJobId);
        if (storedJob?.data.id === jobId) {
          await this.pendingJobIndex.add({
            orgId,
            queueId,
            entries: [{ jobId, createdAtMs: createdAt.getTime() }],
          });
        } else {
          await this.pendingJobIndex.remove({
            orgId,
            queueId,
            jobIds: [jobId],
          });
        }
      } catch (error: unknown) {
        this.tracer.logActiveSpanFailedIfAny(error);
      }
    }

    this.meter?.recordManualReviewEvent('enqueue_call_succeeded', {
      queue_id: queueId,
      item_type_id: payload.item.itemTypeIdentifier.id,
    });

    // Again, because new job data comes in in the non-legacy format, it's safe
    // to cast.
    return newJob.data satisfies StoredManualReviewJob as ManualReviewJob;
  }

  /**
   * Enqueues a new appeal job to the specified queue, or does nothing if a job already
   * exists in that queue for the same item.
   */
  async addAppealJob(opts: {
    orgId: string;
    queueId: string;
    reenqueuedFrom?: OriginJobInfo;
    jobPayload: {
      createdAt?: Date;
      policyIds: string[];
      payload: ManualReviewAppealJobPayload;
    };
    enqueueSourceInfo: AppealEnqueueSourceInfo;
  }) {
    const { orgId, queueId, jobPayload, reenqueuedFrom, enqueueSourceInfo } =
      opts;
    const { payload, policyIds } = jobPayload;

    const queue = await this.#getBullAppealQueue(orgId, queueId);

    const bullJobId = itemIdToBullJobId({
      id: payload.item.itemId,
      typeId: payload.item.itemTypeIdentifier.id,
    });
    const jobId = bullJobIdtoExternalJobId(bullJobId);
    const createdAt = jobPayload.createdAt ?? new Date();

    const newJob = await queue.add(
      bullJobId,
      {
        orgId,
        payload,
        id: jobId,
        createdAt,
        policyIds,
        reenqueuedFrom,
        enqueueSourceInfo,
      },
      { removeOnComplete: true, jobId: bullJobId },
    );

    this.meter?.recordManualReviewEvent('appeal_enqueue_call_succeeded', {
      queue_id: queueId,
      item_type_id: payload.item.itemTypeIdentifier.id,
    });

    return newJob.data;
  }

  async getAppealJobs(opts: {
    orgId: string;
    queueId: string;
    jobIds: Readonly<JobId[]>;
  }): Promise<ManualReviewAppealJob[]> {
    const limit = pLimit(10);
    const { orgId, queueId, jobIds } = opts;

    const queue = await this.#getBullAppealQueue(orgId, queueId);
    const jobs = await Promise.all(
      jobIds.map(async (jobId) =>
        limit(async () => {
          return this.#getAppealJob(jobId, queue);
        }),
      ),
    );

    return filterNullOrUndefined(jobs).map((job) => job.data);
  }

  async getJobs(opts: {
    orgId: string;
    queueId: string;
    jobIds: Readonly<JobId[]>;
  }): Promise<ManualReviewJob[]> {
    const limit = pLimit(10);
    const { orgId, queueId, jobIds } = opts;

    const queue = await this.#getBullQueue(orgId, queueId);
    const jobs = await Promise.all(
      jobIds.map(async (jobId) =>
        limit(async () => {
          const job = await this.#getJob(jobId, queue);
          return job ? this.legacyJobToJob(job, orgId) : undefined;
        }),
      ),
    );

    return filterNullOrUndefined(jobs).map((job) => job.data);
  }

  async extendJobLock(opts: {
    orgId: string;
    queueId: string;
    jobId: JobId;
    lockToken: string;
    isAppealsQueue: boolean;
  }) {
    const { orgId, queueId, jobId, lockToken, isAppealsQueue } = opts;
    if (isAppealsQueue) {
      const queue = await this.#getBullAppealQueue(orgId, queueId);
      const job = await this.#getAppealJob(jobId, queue);
      if (!job) return false;
      return (
        (await job.extendLock(lockToken, MANUAL_REVIEW_LOCK_DURATION_MS)) === 1
      );
    }

    const queue = await this.#getBullQueue(orgId, queueId);
    const job = await this.#getJob(jobId, queue);
    if (!job) return false;
    return (
      (await job.extendLock(lockToken, MANUAL_REVIEW_LOCK_DURATION_MS)) === 1
    );
  }

  async getAllJobsForQueue(opts: {
    orgId: string;
    queueId: string;
    limit?: number;
  }) {
    const concurrencyLimit = pLimit(10);
    const { orgId, queueId } = opts;
    const queue = await this.#getBullQueue(orgId, queueId);
    const maxJobs = Math.max(0, Math.min(opts.limit ?? 50, 50));
    const legacyJobs = await queue.getJobs(undefined, 0, maxJobs);
    const jobs = await Promise.all(
      // eslint-disable-next-line @typescript-eslint/promise-function-async
      legacyJobs.map((job) =>
        concurrencyLimit(async () => this.legacyJobToJob(job, orgId)),
      ),
    );
    return filterNullOrUndefined(jobs).map((job) => job.data);
  }

  async updateJobForQueue(opts: {
    orgId: string;
    queueId: string;
    jobId: JobId;
    data: ManualReviewJob;
  }) {
    const { orgId, queueId, jobId, data } = opts;
    const queue = await this.#getBullQueue(orgId, queueId);
    const { bullId } = parseExternalId(jobId);
    const job = await queue.getJob(bullId);
    // updateData is unlocked; abort if the slot was already taken over by
    // a new job for the same item (different external id) so we don't
    // clobber a reviewer's in-flight decision payload.
    if (!job || job.data.id !== jobId) {
      return undefined;
    }
    const createdAtMs = new Date(data.createdAt).getTime();
    if (Number.isFinite(createdAtMs)) {
      await this.pendingJobIndex.add({
        orgId,
        queueId,
        entries: [{ jobId, createdAtMs }],
      });
    }
    await job.updateData(data);

    // Because the `data` arg above is a ManualReviewJob, we know the stored
    // data for this particular job won't be in the legacy format.
    return job.data satisfies StoredManualReviewJob as ManualReviewJob;
  }

  /**
   * Sets a job's BullMQ priority without touching its data, so it can't
   * clobber a concurrent payload merge. Returns false if the job is gone.
   *
   * Safe in any job state: BullMQ only re-inserts jobs that are in `wait` or
   * `prioritized`. For active and delayed jobs it just records the priority
   * on the job, and BullMQ applies it when the job returns to the queue
   * (e.g. after `releaseJobLock` moves it to delayed).
   */
  async setJobPriority(opts: {
    orgId: string;
    queueId: string;
    jobId: JobId;
    priority: number;
  }): Promise<boolean> {
    const { orgId, queueId, jobId, priority } = opts;
    const queue = await this.#getBullQueue(orgId, queueId);
    const { bullId } = parseExternalId(jobId);
    const job = await queue.getJob(bullId);
    if (!job || job.data.id !== jobId) {
      return false;
    }
    // changePriority re-inserts the job even when the value is unchanged,
    // which sends it to the back of its priority tier (or of `wait`).
    if (job.priority === priority) {
      return true;
    }
    await job.changePriority({ priority });
    return true;
  }

  /**
   * Gives every pending job on a queue a fresh priority, e.g. after the
   * queue's sort mode changes.
   *
   * Works in two phases. Changing a job's priority reorders the same list
   * we'd be paging through, which can skip jobs or process them twice — so
   * first collect every job's (id, createdAt, itemId) into a snapshot (tiny
   * tuples, cheap to hold even for huge queues), then walk the snapshot and
   * update each job by id.
   *
   * `getPriorities` receives every pending item id at once and returns a
   * priority per item id. Resolving priorities in bulk keeps a re-sort to a
   * single data warehouse query instead of one per job.
   *
   * The snapshot is walked oldest-first. Jobs given equal priority dequeue
   * in the order we updated them, not the order they originally arrived —
   * so updating oldest-first is what keeps FIFO order intact.
   *
   * The update phase re-fetches each job by id. That's a second Redis
   * round-trip per job, but BullMQ's `changePriority` is a method on `Job`,
   * so the only way to avoid it is to hold every job's full payload in memory
   * for the whole sweep — worse for exactly the large queues this batching
   * protects.
   *
   * `shouldContinue` is checked before each write so a caller that has lost
   * its lock can stop without overwriting a newer sweep's priorities.
   */
  async recomputePrioritiesForQueue(opts: {
    orgId: string;
    queueId: string;
    getPriorities: (
      items: ReadonlyArray<{ itemId: string; user: UserIdentifier }>,
    ) => Promise<ReadonlyMap<string, number>>;
    shouldContinue?: () => boolean;
  }): Promise<{ aborted: boolean; snapshotStable: boolean }> {
    const { orgId, queueId, getPriorities, shouldContinue = () => true } = opts;
    const queue = await this.#getBullQueue(orgId, queueId);
    const batchSize = 200;

    const pending: Array<{
      bullId: string;
      enqueuedAtMs: number;
      dataCreatedAtMs: number;
      itemId: string;
      user: UserIdentifier;
    }> = [];
    const seen = new Set<string>();
    // Offset paging while reviewers dequeue can skip jobs, because removing
    // a job shifts every later job to a lower offset. Repeat full passes
    // (the seen-set dedupes) until one finds nothing new.
    let snapshotStable = false;
    for (let pass = 0; pass < MAX_RECOMPUTE_SNAPSHOT_PASSES; pass++) {
      if (!shouldContinue()) {
        return { aborted: true, snapshotStable };
      }
      const seenBeforePass = seen.size;
      let start = 0;
      while (true) {
        // Priority-enqueued jobs live in BullMQ's 'prioritized' state, not
        // 'waiting'.
        const jobs = await queue.getJobs(
          ['waiting', 'prioritized', 'delayed', 'active'],
          start,
          start + batchSize - 1,
        );
        if (jobs.length === 0) break;
        for (const job of jobs) {
          if (job.id == null || seen.has(job.id)) continue;
          const bullId = job.id;
          seen.add(bullId);
          const item = (job.data as ManualReviewJob).payload.item;
          // Legacy jobs use `id` instead of `itemId`.
          const itemWithLegacyId = item as { itemId?: string; id?: string };
          const itemId = itemWithLegacyId.itemId ?? itemWithLegacyId.id;
          if (itemId == null) continue;
          // Bull-managed arrival order is the FIFO tie-break key. It only has
          // millisecond resolution, so jobs enqueued in the same millisecond
          // fall back to the job's own createdAt.
          const toSortableMs = (ms: number) =>
            Number.isFinite(ms) ? ms : Number.MAX_SAFE_INTEGER;
          const dataCreatedAtMs = toSortableMs(
            new Date(job.data.createdAt).getTime(),
          );
          pending.push({
            bullId,
            enqueuedAtMs:
              typeof job.timestamp === 'number'
                ? toSortableMs(job.timestamp)
                : dataCreatedAtMs,
            dataCreatedAtMs,
            itemId,
            user: userIdentifierFromItem(item),
          });
        }
        if (jobs.length < batchSize) break;
        start += batchSize;
      }
      if (seen.size === seenBeforePass) {
        snapshotStable = true;
        break;
      }
    }

    pending.sort(
      (a, b) =>
        a.enqueuedAtMs - b.enqueuedAtMs ||
        a.dataCreatedAtMs - b.dataCreatedAtMs,
    );

    const priorities = await getPriorities(
      pending.map(({ itemId, user }) => ({ itemId, user })),
    );

    for (const { bullId, itemId } of pending) {
      if (!shouldContinue()) {
        return { aborted: true, snapshotStable };
      }
      const priority = priorities.get(itemId);
      // No priority resolved for this item — leave the job's current one
      // alone rather than guessing.
      if (priority == null) continue;
      const bullJob = await queue.getJob(bullId);
      // Dequeued or removed since the snapshot — nothing to re-stamp.
      if (!bullJob) continue;
      // Active and delayed jobs are stamped too: BullMQ records the priority
      // on the job without re-inserting it, and applies it when the job
      // returns to the queue (e.g. a reviewer skips it).
      await bullJob.changePriority({ priority });
    }
    return { aborted: false, snapshotStable };
  }

  /**
   * Yields every undecided job on a queue (waiting, prioritized, delayed, or
   * active) for bounded admin sweeps such as reporter invalidation. Includes
   * `active` jobs so sweeps can update what a reviewer currently has dequeued;
   * excludes terminal states (completed/failed). `maxJobs` caps a single
   * sweep so it can't pin Redis indefinitely.
   *
   * Iterates in two phases: first snapshots all external JobIds (bounded
   * by `maxJobs`), then fetches each by id and yields it. This keeps the
   * iterator safe when callers delete or update jobs mid-traversal, which
   * index-based pagination over a mutating list would not.
   */
  async *iteratePendingJobsForQueue(opts: {
    orgId: string;
    queueId: string;
    batchSize?: number;
    maxJobs?: number;
    // Set `truncated` when the queue exceeded `maxJobs`.
    progress?: { truncated: boolean };
  }): AsyncIterable<ManualReviewJob> {
    const { orgId, queueId } = opts;
    const batchSize = Math.max(1, Math.min(opts.batchSize ?? 200, 500));
    const maxJobs = Math.max(0, opts.maxJobs ?? 10_000);

    const queue = await this.#getBullQueue(orgId, queueId);

    const snapshotIds: JobId[] = [];
    let start = 0;
    while (snapshotIds.length < maxJobs) {
      const end = start + batchSize - 1;
      const legacyJobs = await queue.getJobs(
        ['waiting', 'prioritized', 'delayed', 'active'],
        start,
        end,
      );
      if (legacyJobs.length === 0) {
        break;
      }
      for (const legacy of legacyJobs) {
        if (snapshotIds.length >= maxJobs) {
          break;
        }
        const id = legacy.data?.id;
        if (id != null) {
          snapshotIds.push(id);
        }
      }
      if (legacyJobs.length < batchSize) {
        break;
      }
      start += batchSize;
    }

    if (opts.progress != null) {
      opts.progress.truncated = snapshotIds.length >= maxJobs;
    }

    for (const jobId of snapshotIds) {
      // `getJobs` re-reads each job and converts to the current format. If
      // the job was decided / removed between snapshot and now, the result
      // is empty and we silently skip it.
      const jobs = await this.getJobs({ orgId, queueId, jobIds: [jobId] });
      if (jobs.length > 0) {
        yield jobs[0];
      }
    }
  }

  /**
   * Looks up a pending job by its external JobId without requiring a
   * queueId. Fast path via `job_creations`; falls back to a per-queue
   * Bull lookup (keyed on the derived BullJobId) for jobs whose
   * `job_creations` row never landed.
   *
   * NB: the fallback path is O(non-appeal queues) Redis round-trips per
   * call. Acceptable for admin-triggered actions (button click) but do
   * not call from hot paths.
   *
   * Returns undefined when the job is no longer pending, or when the
   * external id is malformed (admin pasted a stale / wrong id).
   */
  async findPendingJobByJobId(opts: {
    orgId: string;
    jobId: JobId;
  }): Promise<{ job: ManualReviewJob; queueId: string } | undefined> {
    const { orgId, jobId } = opts;
    // External JobIds are `<b64url(bullId)>:<b64url(guid)>`. Reject
    // anything that doesn't parse so we don't blow up the per-queue
    // fallback below for stale / typo'd ids.
    if (!isParsableExternalId(jobId)) {
      return undefined;
    }
    const row = (
      await this.db
        .select({ queueId: jobCreations.queueId })
        .from(jobCreations)
        .where(and(eq(jobCreations.orgId, orgId), eq(jobCreations.id, jobId)))
        .limit(1)
    ).at(0);
    if (row) {
      const jobs = await this.getJobs({
        orgId,
        queueId: row.queueId,
        jobIds: [jobId],
      });
      if (jobs.length > 0) {
        return { job: jobs[0], queueId: row.queueId };
      }
    }
    const queues =
      await this.getAllQueuesForOrgAndDangerouslyBypassPermissioning(orgId);
    for (const queue of queues) {
      if (queue.isAppealsQueue) {
        continue;
      }
      const jobs = await this.getJobs({
        orgId,
        queueId: queue.id,
        jobIds: [jobId],
      });
      if (jobs.length > 0) {
        return { job: jobs[0], queueId: queue.id };
      }
    }
    return undefined;
  }

  /**
   * Removes a pending job from a queue by its external JobId without
   * requiring a lock token. Used by admin-triggered bulk maintenance
   * (e.g. invalidating reports from a reporter).
   *
   * Returns true if the job was removed, false if it was already gone.
   * The Bull-internal `BullJobId` is derived from the external JobId, and
   * we verify `job.data.id === externalId` before removal so a stale
   * lookup that finds a *different* job for the same item is a no-op.
   */
  async removeJobByJobIdUnsafe(opts: {
    orgId: string;
    queueId: string;
    jobId: JobId;
  }): Promise<boolean> {
    const { orgId, queueId, jobId } = opts;
    const queue = await this.getOrCreateBullQueue({ orgId, queueId });
    const bullJobId = parseExternalId(jobId).bullId;

    const job = await queue.getJob(bullJobId);
    if (!job || job.data.id !== jobId) {
      return false;
    }
    // Bull's `remove` throws when the job is currently locked by a worker;
    // we want callers to fall back to scrub-in-place in that case. Other
    // errors (e.g. Redis transient failures) must propagate so the caller
    // doesn't conflate them with "already gone".
    try {
      const status = await queue.remove(bullJobId);
      if (status === 1) {
        await this.pendingJobIndex.remove({ orgId, queueId, jobIds: [jobId] });
      }
      return status === 1;
    } catch (err: unknown) {
      if (isJobLockedError(err)) {
        return false;
      }
      throw err;
    }
  }

  /**
   * Removes a pending job. Tries an unlocked `remove`; if the job is
   * locked, atomically completes it with `invokerUserId` as the lock
   * token (per the `lockToken === userId` convention) so a reviewer
   * deleting a job they themselves dequeued succeeds without stealing
   * another reviewer's lock. Returns `false` on token mismatch so
   * callers can fall back to scrubbing.
   */
  async removeJobAllowingInvokerLock(opts: {
    orgId: string;
    queueId: string;
    jobId: JobId;
    invokerUserId: string;
  }): Promise<boolean> {
    const { orgId, queueId, jobId, invokerUserId } = opts;
    const queue = await this.getOrCreateBullQueue({ orgId, queueId });
    const { bullId: bullJobId } = parseExternalId(jobId);
    const job = await queue.getJob(bullJobId);
    if (!job || job.data.id !== jobId) {
      return false;
    }

    try {
      const status = await queue.remove(bullJobId);
      if (status === 1) {
        await this.pendingJobIndex.remove({ orgId, queueId, jobIds: [jobId] });
        return true;
      }
    } catch (err: unknown) {
      if (!isJobLockedError(err)) {
        throw err;
      }
      // Locked: fall through to the token-validated path.
    }

    try {
      await job.moveToCompleted(null, invokerUserId, false);
      await this.pendingJobIndex.remove({ orgId, queueId, jobIds: [jobId] });
      return true;
    } catch {
      // Lock token mismatch (different user) or the job's state moved
      // between getJob and moveToCompleted. Either way, caller should
      // scrub.
      return false;
    }
  }

  async deleteAllJobsFromQueue(opts: {
    orgId: string;
    queueId: string;
    userPermissions: readonly UserPermission[];
  }) {
    const { orgId, queueId, userPermissions } = opts;
    // Admin-only (MANAGE_ORG). `obliterate` wipes pending payloads from
    // Redis irreversibly; recovery is via `server/bin/recover-mrt-queue.ts`.
    if (!userPermissions.includes(UserPermission.MANAGE_ORG)) {
      throw makeDeleteAllJobsInsufficientPermissionsError({
        shouldErrorSpan: true,
      });
    }

    const queue = await this.#getBullQueue(orgId, queueId);
    await queue.obliterate({ force: true });
    // Left unbuilt rather than reset to empty: a job enqueued while the queue
    // was being wiped may have lost its entry, and the backfill picks it up.
    await this.pendingJobIndex.clear({ orgId, queueId });
  }

  async dequeueNextAppealJobWithLock(opts: {
    orgId: string;
    queueId: string;
    lockToken: string;
  }): Promise<{
    job: ManualReviewAppealJob;
    lockToken: string;
  } | null> {
    const { orgId, queueId, lockToken } = opts;

    await this.checkQueueExists(orgId, queueId);
    const worker = await this.getBullAppealWorker({ orgId, queueId });

    while (true) {
      // block: false so a drained queue returns null immediately instead of
      // long-polling and hanging the reviewer's request.
      const job = await worker.getNextJob(lockToken, { block: false });

      if (!job) {
        return null;
      }

      // Race condition: a job can be decided but not yet dequeued.
      // If the front job already has a decision, remove it and grab the next.
      const decision = await this.#findDecisionForJob(orgId, job.data.id);

      if (decision === undefined) {
        return { job: job.data, lockToken };
      }

      await this.removeJob({
        orgId,
        queueId,
        lockToken,
        jobId: job.data.id,
      }).catch((error: unknown) => {
        this.tracer.logActiveSpanFailedIfAny(error);
      });
    }
  }

  async dequeueNextJobWithLock(opts: {
    orgId: string;
    queueId: string;
    lockToken: string;
  }): Promise<{
    job: ManualReviewJob;
    lockToken: string;
  } | null> {
    const { orgId, queueId, lockToken } = opts;

    await this.checkQueueExists(orgId, queueId);
    const worker = await this.getBullWorker({ orgId, queueId });

    // Jobs this reviewer skipped within the skip window (the lock token is
    // the reviewer's userId). The scan steps past them by keeping them locked
    // until it finishes, then releases them in `finally` so they return to
    // the shared pool — a skip is per-reviewer, not global.
    const reviewerSkips = await this.getActiveReviewerSkips({
      orgId,
      queueId,
      reviewerId: lockToken,
    });
    const heldAside: Job<StoredManualReviewJob>[] = [];

    try {
      while (true) {
        const job = await worker.getNextJob(lockToken, { block: false });

        if (!job) {
          return null;
        }
        if (reviewerSkips.has(job.data.id)) {
          heldAside.push(job);
          continue;
        }

        const convertedJob = await this.legacyJobToJob(job, orgId);

        // Race condition: a job can be decided but not yet dequeued.
        // If the front job already has a decision, remove it and grab the next.
        const decision = await this.#findDecisionForJob(
          orgId,
          convertedJob.data.id,
        );

        if (decision === undefined) {
          return { job: convertedJob.data, lockToken };
        }

        await this.removeJob({
          orgId,
          queueId,
          lockToken,
          jobId: convertedJob.data.id,
        }).catch((error: unknown) => {
          this.tracer.logActiveSpanFailedIfAny(error);
        });
      }
    } finally {
      // Release the held-aside jobs so other reviewers can pick them up
      // immediately. This reviewer stays excluded via the skip set.
      for (const held of heldAside) {
        await this.releaseJobLock({
          orgId,
          queueId,
          jobId: held.data.id,
          lockToken,
        });
      }
    }
  }

  async #findDecisionForJob(orgId: string, jobId: JobId) {
    const decision = (
      await this.dbReadReplica
        .select({ id: manualReviewDecisions.id })
        .from(manualReviewDecisions)
        .where(
          and(
            gte(manualReviewDecisions.createdAt, new Date('2023-10-01')),
            eq(manualReviewDecisions.orgId, orgId),
            eq(manualReviewDecisions.id, jobIdToGuid(jobId)),
          ),
        )
        .limit(1)
    ).at(0);
    return decision;
  }

  static readonly REVIEWER_SKIP_TTL_MS = 30 * 60 * 1000;

  #reviewerSkipKey(orgId: string, queueId: string, reviewerId: string): string {
    return `{${orgId}}:mrt-reviewer-skips:${queueId}:${reviewerId}`;
  }

  /**
   * Hides a job from one reviewer for the skip window and hands it straight
   * back to everyone else.
   *
   * Releasing the lock is part of skipping, not a separate step callers have to
   * remember — there is no case for recording a skip while still holding the
   * job. `releaseJobLock` is a no-op when no lock is held, so this is safe even
   * when the caller never took one.
   */
  async recordReviewerSkip(opts: {
    orgId: string;
    queueId: string;
    reviewerId: string;
    jobId: string;
  }): Promise<void> {
    const { orgId, queueId, reviewerId, jobId } = opts;
    const key = this.#reviewerSkipKey(orgId, queueId, reviewerId);
    const expiresAt = Date.now() + QueueOperations.REVIEWER_SKIP_TTL_MS;
    await this.redis.zadd(key, expiresAt, jobId);
    // Backstop: the whole set disappears once everything in it has expired.
    await this.redis.pexpire(key, QueueOperations.REVIEWER_SKIP_TTL_MS);

    // The lock token is the reviewer's own id.
    await this.releaseJobLock({
      orgId,
      queueId,
      jobId: instantiateOpaqueType<JobId>(jobId),
      lockToken: reviewerId,
    });
  }

  async getActiveReviewerSkips(opts: {
    orgId: string;
    queueId: string;
    reviewerId: string;
  }): Promise<Set<string>> {
    const { orgId, queueId, reviewerId } = opts;
    const key = this.#reviewerSkipKey(orgId, queueId, reviewerId);
    // Drop expired entries, then read what's still active.
    await this.redis.zremrangebyscore(key, 0, Date.now());
    const ids = await this.redis.zrange(key, 0, -1);
    return new Set(ids);
  }

  /**
   * When returning a job that's already in the new format, ensure DEFAULT
   * payloads never carry allMediaItems so they resolve to the regular manual
   * review view (not NCMEC) and show full decision options.
   */
  #returnJobWithNormalizedDefaultPayloadIfNeeded(
    job: Job<ManualReviewJob>,
  ): Job<ManualReviewJob> {
    const p = job.data.payload as Record<string, unknown> & { kind?: string };
    if (p.kind !== 'DEFAULT' || !('allMediaItems' in p)) {
      return job;
    }
    const payloadWithUnknownKeys = job.data.payload as Record<string, unknown>;
    const { allMediaItems: _omitted, ...payloadWithoutNcmec } =
      payloadWithUnknownKeys;
    job.data = {
      ...job.data,
      payload: payloadWithoutNcmec as ManualReviewJobPayload,
    };
    return job;
  }

  /**
   * TODO: remove when we no longer need to support legacy jobs
   */
  async legacyJobToJob(
    job: Job<StoredManualReviewJob>,
    orgId: string,
  ): Promise<Job<ManualReviewJob>> {
    if (
      'policyIds' in job.data &&
      'submissionId' in job.data.payload.item &&
      'reportedForReasons' in job.data.payload &&
      'reportHistory' in job.data.payload
    ) {
      return this.#returnJobWithNormalizedDefaultPayloadIfNeeded(
        job as Job<ManualReviewJob>,
      );
    }

    const legacyItem = job.data.payload.item;
    const convertedItem =
      await this.legacyItemWithTypeIdentifierToItemSubmissionWithTypeIdentifier(
        orgId,
        legacyItem,
      );

    let payload: ManualReviewJobPayload;
    // The type complexity of both StoredManualReviewJob and
    // ManualReviewJobPayload is pretty overwhelming, even for TS. so we are
    // putting the payload kind in a variable to help TS do some type narrowing.
    const jobKind = job.data.payload.kind;
    if (jobKind === 'DEFAULT') {
      const { allMediaItems: _omitted, ...storedPayloadWithoutNcmec } = job.data
        .payload as Record<string, unknown> & { allMediaItems?: unknown };
      payload = {
        ...storedPayloadWithoutNcmec,
        kind: 'DEFAULT',
        item: convertedItem,

        ...('itemThreadContentItems' in job.data.payload
          ? {
              itemThreadContentItems: job.data.payload.itemThreadContentItems
                ? await Promise.all(
                    job.data.payload.itemThreadContentItems.map(async (it) =>
                      'submissionId' in it
                        ? it
                        : this.legacyItemWithTypeIdentifierToItemSubmissionWithTypeIdentifier(
                            orgId,
                            it,
                          ),
                    ),
                  )
                : job.data.payload.itemThreadContentItems,
            }
          : {}),
        ...('additionalContentItems' in job.data.payload
          ? {
              additionalContentItems: job.data.payload.additionalContentItems
                ? await Promise.all(
                    job.data.payload.additionalContentItems.map(async (it) =>
                      'submissionId' in it
                        ? it // leave as-is if we're already in the new format
                        : this.legacyItemWithTypeIdentifierToItemSubmissionWithTypeIdentifier(
                            orgId,
                            it,
                          ),
                    ),
                  )
                : job.data.payload.additionalContentItems,
            }
          : {}),
        ...(!('reportedForReasons' in job.data.payload)
          ? {
              reportedForReasons: [
                {
                  reason:
                    'reportedForReason' in job.data.payload
                      ? job.data.payload.reportedForReason
                      : undefined,
                  reporterId: job.data.payload.reporterIdentifier,
                },
              ],
            }
          : { reportedForReasons: job.data.payload.reportedForReasons ?? [] }),
        // Not worth building this as slowly all lobs will have it, we can miss
        // one report's worth of history until then
        ...(!('reportHistory' in job.data.payload)
          ? { reportHistory: [] }
          : { reportHistory: job.data.payload.reportHistory }),
      };
    } else {
      // kind is inferred to be 'NCMEC' here
      payload = {
        ...job.data.payload,
        kind: 'NCMEC',
        item: convertedItem,
        allMediaItems: await Promise.all(
          'allMediaItems' in job.data.payload
            ? job.data.payload.allMediaItems.map(async (mediaItem) => {
                if ('submissionId' in mediaItem.contentItem) {
                  return {
                    ...mediaItem,
                    contentItem: mediaItem.contentItem,
                  };
                }

                return {
                  ...mediaItem,
                  contentItem:
                    await this.legacyItemWithTypeIdentifierToItemSubmissionWithTypeIdentifier(
                      orgId,
                      mediaItem.contentItem,
                    ),
                };
              })
            : [],
        ),
        ...(!('reportHistory' in job.data.payload)
          ? { reportHistory: [] }
          : { reportHistory: job.data.payload.reportHistory }),
      };
    }

    const policyIds =
      'policyIds' in job.data
        ? job.data.policyIds
        : 'policyId' in job.data.payload && job.data.payload.policyId
          ? [job.data.payload.policyId]
          : [];

    const convertedJobData = {
      ...safePick(job.data, [
        'id',
        'createdAt',
        'orgId',
        'reenqueuedFrom',
        'enqueueSourceInfo',
      ]),
      policyIds,
      payload,
    } satisfies ManualReviewJob;

    job.data = convertedJobData;
    // cast here is safe bc TS checked above that convertedJobData is a ManualReviewJob
    return job as Job<ManualReviewJob>;
  }

  /**
   * TODO: remove when we no longer need to support legacy jobs
   */
  async legacyItemWithTypeIdentifierToItemSubmissionWithTypeIdentifier(
    orgId: string,
    legacyItem: LegacyItemWithTypeIdentifier | ItemSubmissionWithTypeIdentifier,
  ): Promise<ItemSubmissionWithTypeIdentifier> {
    if ('submissionId' in legacyItem) {
      return legacyItem;
    }

    const itemType = await this.moderationConfigService.getItemType({
      orgId,
      itemTypeSelector: legacyItem.typeIdentifier,
    });

    if (!itemType) {
      throw new Error('Item type not found');
    }

    return instantiateOpaqueType<ItemSubmissionWithTypeIdentifier>({
      itemId: legacyItem.id,
      itemTypeIdentifier: legacyItem.typeIdentifier,
      data: legacyItem.data,
      submissionId: makeSubmissionId(),
      creator:
        itemType.kind === 'CONTENT'
          ? getFieldValueForRole(
              itemType.schema,
              itemType.schemaFieldRoles,
              'creatorId',
              legacyItem.data,
            )
          : undefined,
    });
  }

  /**
   * Attempts to move the job to completed using the given lock, but falls back
   * to removing the job manually. This will fail if a different Worker has a
   * lock on the job.
   */
  async removeJob(opts: {
    orgId: string;
    queueId: string;
    jobId: JobId;
    lockToken: string;
  }) {
    const { orgId, queueId, jobId } = opts;
    try {
      await this.#markLockedJobCompleted(opts);
    } catch (error: unknown) {
      // The most common case where this throws if the lock token has expired,
      // so try to remove it manually.
      const queue = await this.getOrCreateBullQueue({ orgId, queueId });
      const bullJobId = parseExternalId(jobId).bullId;
      const removeJobStatus = await queue.remove(bullJobId);
      if (removeJobStatus !== 1) {
        throw new Error('Failed to remove job');
      }
    }
    await this.pendingJobIndex.remove({ orgId, queueId, jobIds: [jobId] });
  }

  /**
   * If the job is not found, silently does nothing.
   */
  async #markLockedJobCompleted(opts: {
    orgId: string;
    queueId: string;
    jobId: JobId;
    lockToken: string;
  }) {
    const { orgId, queueId, lockToken, jobId } = opts;
    const queue = await this.getOrCreateBullQueue({ orgId, queueId });
    const job = await this.#getJob(jobId, queue);

    await job?.moveToCompleted(null, lockToken, false);
  }

  /**
   * Releases the lock on a job and moves it back to the waiting state.
   * This is used when a job is skipped - we want to release the lock
   * so the job can be reviewed later, rather than waiting for it to
   * become stalled.
   */
  async releaseJobLock(opts: {
    orgId: string;
    queueId: string;
    jobId: JobId;
    lockToken: string;
  }) {
    const { orgId, queueId, lockToken, jobId } = opts;
    try {
      const queue = await this.getOrCreateBullQueue({ orgId, queueId });
      const job = await this.#getJob(jobId, queue);

      if (!job) {
        // Job not found, nothing to release
        return;
      }

      // Move the job to delayed state with timestamp = now (0 delay)
      // This releases the lock and makes the job immediately available
      // The token parameter ensures only the holder of the lock can release it
      await job.moveToDelayed(Date.now(), lockToken);
    } catch (error: unknown) {
      this.tracer.logActiveSpanFailedIfAny(error);
    }
  }

  async getPendingJobCount(opts: { orgId: string; queueId: string }) {
    const { orgId, queueId } = opts;
    const queue = await this.#getBullQueue(orgId, queueId);

    // Returns the number of waiting or delayed jobs
    // https://api.docs.bullmq.io/classes/Queue.html#count
    return queue.count();
  }

  /**
   * Batched variant that skips per-queue existence checks. The caller
   * must have already verified the queues exist (e.g. via
   * getAllQueuesForOrgAndDangerouslyBypassPermissioning).
   */
  async getTotalPendingJobCountForQueues(
    orgId: string,
    queueIds: string[],
  ): Promise<number> {
    const concurrencyLimit = pLimit(10);
    const counts = await Promise.all(
      queueIds.map(async (queueId) =>
        concurrencyLimit(async () => {
          const queue = await this.getOrCreateBullQueue({ orgId, queueId });
          return queue.count();
        }),
      ),
    );
    return counts.reduce((sum, count) => sum + count, 0);
  }

  async getOldestJobCreatedAt(opts: {
    orgId: string;
    queueId: string;
    isAppealsQueue: boolean;
  }): Promise<Date | null> {
    const { orgId, queueId, isAppealsQueue } = opts;

    // Appeal jobs are never prioritized, so the scan below is already O(1)
    // for them and they aren't indexed.
    if (!isAppealsQueue) {
      if (await this.pendingJobIndex.isBuilt({ orgId, queueId })) {
        return this.#getOldestJobCreatedAtFromIndex({ orgId, queueId });
      }
      this.#startPendingJobIndexBackfill({ orgId, queueId });
    }

    return this.#scanOldestJobCreatedAt({ orgId, queueId, isAppealsQueue });
  }

  /**
   * Walks the index oldest-first and returns the first entry BullMQ confirms
   * is still pending. Entries for jobs that are gone are dropped; dequeued
   * (active) jobs are skipped but kept, since they come back if the reviewer
   * skips them or the lock lapses.
   */
  async #getOldestJobCreatedAtFromIndex(opts: {
    orgId: string;
    queueId: string;
  }): Promise<Date | null> {
    const { orgId, queueId } = opts;
    const queue = await this.#getBullQueue(orgId, queueId);

    let offset = 0;
    let checked = 0;
    let prunedAny = false;
    while (checked < OLDEST_JOB_MAX_CANDIDATES) {
      const entries = await this.pendingJobIndex.range({
        orgId,
        queueId,
        offset,
        count: Math.min(
          OLDEST_JOB_CANDIDATE_BATCH_SIZE,
          OLDEST_JOB_MAX_CANDIDATES - checked,
        ),
      });
      if (entries.length === 0) {
        return null;
      }
      checked += entries.length;

      const candidates = await Promise.all(
        entries.map(async (entry) => {
          const { bullId } = parseExternalId(
            instantiateOpaqueType<JobId>(entry.jobId),
          );
          const job = await queue.getJob(bullId);
          const isSameJob = job != null && job.data.id === entry.jobId;
          return {
            entry,
            job: isSameJob ? job : undefined,
            state: isSameJob ? await job.getState() : undefined,
          };
        }),
      );

      const gone: string[] = [];
      for (const { entry, job, state } of candidates) {
        if (job === undefined || state === undefined) {
          gone.push(entry.jobId);
          continue;
        }
        if (state === 'active') {
          offset++;
          continue;
        }
        if (!PENDING_JOB_STATES.has(state)) {
          gone.push(entry.jobId);
          continue;
        }
        const createdAt = new Date(job.data.createdAt);
        if (!Number.isFinite(createdAt.getTime())) {
          offset++;
          continue;
        }
        if (createdAt.getTime() !== entry.createdAtMs) {
          // The entry is out of order. Its corrected position may be ahead of
          // entries already skipped, so walk again from the start.
          await this.pendingJobIndex.add({
            orgId,
            queueId,
            entries: [{ jobId: entry.jobId, createdAtMs: createdAt.getTime() }],
          });
          offset = 0;
          break;
        }
        await this.pendingJobIndex.remove({ orgId, queueId, jobIds: gone });
        return createdAt;
      }
      // Removed entries shift later ones down, so `offset` only counts the
      // ones we kept.
      await this.pendingJobIndex.remove({ orgId, queueId, jobIds: gone });
      prunedAny ||= gone.length > 0;
    }
    // Pruning means the next read starts further along. Otherwise every
    // candidate is a live job reviewers are holding, and the next read would
    // stall on the same ones, so fall back to the scan.
    return prunedAny
      ? null
      : this.#scanOldestJobCreatedAt({
          orgId,
          queueId,
          isAppealsQueue: false,
        });
  }

  /**
   * Populates the index from BullMQ for a queue that predates it. Jobs
   * enqueued meanwhile index themselves, so the scan only has to catch the
   * ones already there. Runs at most once at a time per queue per process;
   * concurrent runs on other processes are harmless because writes are
   * idempotent.
   */
  #startPendingJobIndexBackfill(opts: { orgId: string; queueId: string }) {
    const key = `${opts.orgId}:${opts.queueId}`;
    if (this.#pendingJobIndexBackfills.has(key)) {
      return;
    }
    const backfill = this.backfillPendingJobIndex(opts)
      .catch((error: unknown) => {
        this.tracer.logActiveSpanFailedIfAny(error);
      })
      .finally(() => {
        this.#pendingJobIndexBackfills.delete(key);
      });
    this.#pendingJobIndexBackfills.set(key, backfill);
  }

  async awaitPendingJobIndexBackfills() {
    await Promise.all(this.#pendingJobIndexBackfills.values());
  }

  async backfillPendingJobIndex(opts: { orgId: string; queueId: string }) {
    const { orgId, queueId } = opts;
    const queue = await this.#getBullQueue(orgId, queueId);

    const seen = new Set<string>();
    // Offset paging while reviewers dequeue can skip jobs, because removing
    // a job shifts every later job to a lower offset. Repeat full passes
    // until one finds nothing new; if that never happens, leave the index
    // unbuilt so a later read retries.
    for (let pass = 0; pass < MAX_RECOMPUTE_SNAPSHOT_PASSES; pass++) {
      const seenBeforePass = seen.size;
      let start = 0;
      while (true) {
        const jobs = await queue.getJobs(
          ['waiting', 'prioritized', 'delayed', 'active'],
          start,
          start + PENDING_JOB_INDEX_BACKFILL_BATCH_SIZE - 1,
        );
        if (jobs.length === 0) break;
        const entries = jobs.flatMap((job) => {
          const jobId = job.data.id;
          const createdAtMs = new Date(job.data.createdAt).getTime();
          if (seen.has(jobId)) return [];
          seen.add(jobId);
          // A job without a usable createdAt has no age to report.
          return Number.isFinite(createdAtMs) ? [{ jobId, createdAtMs }] : [];
        });
        await this.pendingJobIndex.add({ orgId, queueId, entries });
        if (jobs.length < PENDING_JOB_INDEX_BACKFILL_BATCH_SIZE) break;
        start += PENDING_JOB_INDEX_BACKFILL_BATCH_SIZE;
      }
      if (seen.size === seenBeforePass) {
        await this.pendingJobIndex.markBuilt({ orgId, queueId });
        return;
      }
    }
  }

  async #scanOldestJobCreatedAt(opts: {
    orgId: string;
    queueId: string;
    isAppealsQueue: boolean;
  }): Promise<Date | null> {
    const { orgId, queueId, isAppealsQueue } = opts;
    const queue = isAppealsQueue
      ? await this.#getBullAppealQueue(orgId, queueId)
      : await this.#getBullQueue(orgId, queueId);

    // `prioritized` is ordered by priority, not age, so finding its oldest
    // job means scanning all of it. Past the cap, report "unknown" rather
    // than an age computed from a partial scan.
    if (
      (await queue.getPrioritizedCount()) > OLDEST_JOB_PRIORITIZED_SCAN_LIMIT
    ) {
      return null;
    }

    // getWaiting/getDelayed return oldest-first, so their first entry is the
    // oldest.
    const [waitingJobs, delayedJobs, prioritizedJobs] = await Promise.all([
      queue.getWaiting(0, 0),
      queue.getDelayed(0, 0),
      queue.getPrioritized(0, OLDEST_JOB_PRIORITIZED_SCAN_LIMIT - 1),
    ]);

    const createdAts = [
      ...waitingJobs.slice(0, 1),
      ...delayedJobs.slice(0, 1),
      ...prioritizedJobs,
    ].map((job) => job.data.createdAt);

    if (createdAts.length === 0) {
      return null;
    }

    return createdAts.reduce((oldest, createdAt) =>
      new Date(createdAt).getTime() < new Date(oldest).getTime()
        ? createdAt
        : oldest,
    );
  }

  async close() {
    return Promise.all([
      this.getOrCreateBullQueue.close(),
      this.getBullWorker.close(),
      this.getOrCreateBullAppealQueue.close(),
      this.getBullAppealWorker.close(),
    ]);
  }

  async getExistingJobsForItem(opts: {
    orgId: string;
    itemId: string;
    itemTypeId: string;
    queueIds: string[];
  }) {
    const { orgId, itemId, itemTypeId, queueIds } = opts;
    if (queueIds.length === 0) {
      return [];
    }
    // Check postgres for creations within the last 7 days so we don't have to
    // search every bull queue for every item.
    const recentJobCreationQueues = await this.db
      .select({ queueId: jobCreations.queueId })
      .from(jobCreations)
      .where(
        and(
          eq(jobCreations.orgId, orgId),
          eq(jobCreations.itemId, itemId),
          eq(jobCreations.itemTypeId, itemTypeId),
          gte(jobCreations.createdAt, new Date(Date.now() - WEEK_MS)),
          inArray(jobCreations.queueId, queueIds),
        ),
      );
    const jobsWithQueue = await Promise.all(
      recentJobCreationQueues.map(async (rows) => {
        const { queueId } = rows;
        const queue = await this.getOrCreateBullQueue({ orgId, queueId });
        const legacyJob = await queue.getJob(
          itemIdToBullJobId({ id: itemId, typeId: itemTypeId }),
        );
        if (legacyJob) {
          const job = await this.legacyJobToJob(legacyJob, orgId);
          return {
            job: job.data,
            queueId,
          };
        }
        return undefined;
      }),
    );

    return filterNullOrUndefined(jobsWithQueue);
  }

  async getHiddenActionsForQueue(opts: { queueId: string; orgId: string }) {
    const { queueId, orgId } = opts;
    return (
      await this.db
        .select({ actionId: queuesAndHiddenActions.actionId })
        .from(queuesAndHiddenActions)
        .where(
          and(
            eq(queuesAndHiddenActions.queueId, queueId),
            eq(queuesAndHiddenActions.orgId, orgId),
          ),
        )
    ).map((it) => it.actionId);
  }

  // NB: Making the transaction required means this function should only be used
  // inside another transaction.
  async updateHiddenActionsForQueue(opts: {
    queueId: string;
    actionIdsToHide: readonly string[];
    actionIdsToUnhide: readonly string[];
    orgId: string;
    transaction?: CoopTx;
  }) {
    const { transaction, queueId, actionIdsToHide, actionIdsToUnhide, orgId } =
      opts;

    if (actionIdsToHide.length === 0 && actionIdsToUnhide.length === 0) {
      return undefined;
    }

    const queryInterface: CoopDbOrTx = transaction ?? this.db;

    if (actionIdsToHide.length > 0) {
      await queryInterface
        .insert(queuesAndHiddenActions)
        .values(
          actionIdsToHide.map((actionId) => ({ queueId, actionId, orgId })),
        );
    }

    if (actionIdsToUnhide.length > 0) {
      await queryInterface
        .delete(queuesAndHiddenActions)
        .where(
          and(
            eq(queuesAndHiddenActions.queueId, queueId),
            eq(queuesAndHiddenActions.orgId, orgId),
            inArray(queuesAndHiddenActions.actionId, [...actionIdsToUnhide]),
          ),
        );
    }
  }

  // Action IDs whose use triggers the clear-other-reports sweep (issue #650).
  async getClearReportsTriggerActionsForQueue(opts: {
    queueId: string;
    orgId: string;
  }): Promise<string[]> {
    const { queueId, orgId } = opts;
    return (
      await this.db
        .select({ actionId: queuesAndClearReportsTriggerActions.actionId })
        .from(queuesAndClearReportsTriggerActions)
        .where(
          and(
            eq(queuesAndClearReportsTriggerActions.queueId, queueId),
            eq(queuesAndClearReportsTriggerActions.orgId, orgId),
          ),
        )
    ).map((it) => it.actionId);
  }

  // Replaces the queue's trigger actions with `actionIds` (pass [] to clear).
  async setClearReportsTriggerActionsForQueue(opts: {
    queueId: string;
    orgId: string;
    actionIds: readonly string[];
    transaction?: CoopTx;
  }) {
    const { queueId, orgId, actionIds, transaction } = opts;
    const queryInterface: CoopDbOrTx = transaction ?? this.db;

    await queryInterface
      .delete(queuesAndClearReportsTriggerActions)
      .where(
        and(
          eq(queuesAndClearReportsTriggerActions.queueId, queueId),
          eq(queuesAndClearReportsTriggerActions.orgId, orgId),
        ),
      );

    const uniqueActionIds = [...new Set(actionIds)];
    if (uniqueActionIds.length > 0) {
      await queryInterface
        .insert(queuesAndClearReportsTriggerActions)
        .values(
          uniqueActionIds.map((actionId) => ({ queueId, actionId, orgId })),
        );
    }
  }
}

/**
 * We want Bull to dedupe jobs on the same item, so this function maps each
 * distinct item identifier object to a string that can be used as a Bull job id.
 * Uses '.' as separator because BullMQ v5 disallows ':' in custom job ids.
 *
 * NB: only exported for use in tests.
 * @private
 */
const BULL_JOB_ID_SEPARATOR = '.';

export function itemIdToBullJobId({ typeId, id }: ItemIdentifier) {
  if (!typeId || !id) {
    throw new Error('itemTypeId and itemId cannot be empty strings');
  }

  return instantiateOpaqueType<BullJobId>(
    [typeId, id].map(b64UrlEncode).join(BULL_JOB_ID_SEPARATOR),
  );
}

/**
 * Because BullJobIds are intentionally not globally unique (across time and
 * queues), this function takes a BullJobId and combines it with a guid to make
 * a truly unique id.
 *
 * NB: only exported for use in tests.
 * @private
 */
export function bullJobIdtoExternalJobId(
  bullJobId: BullJobId,
  guid = uuidv1(),
) {
  if (!guid) {
    throw new Error('guid cannot be empty.');
  }

  return instantiateOpaqueType<JobId>(
    [bullJobId, guid].map(b64UrlEncode).join(':'),
  );
}

/**
 * This function extracts the components of a JobId, so that we can look up the
 * job in Bull by its BullJobId.
 *
 * NB: only exported for use in tests.
 * @private
 */
export function parseExternalId(externalId: JobId) {
  const idParts = externalId.split(':') as [
    B64UrlOf<BullJobId>,
    B64UrlOf<string>,
  ];
  return { bullId: b64UrlDecode(idParts[0]), guid: b64UrlDecode(idParts[1]) };
}

/**
 * This returns a UUID derived from an external JobId. In theory, this shouldn't
 * be necessary -- anything that needs to be logged as associated with the job
 * can just use the JobId directly -- but, historically, we've just used this
 * derived uuid (e.g., when logging decisions), because it's shorter.
 */
export function jobIdToGuid(jobId: JobId) {
  return parseExternalId(jobId).guid;
}

type RedisConnection = IORedis.Redis | Cluster;

export async function getBullWorker<JobData = unknown>(
  redisConnection: RedisConnection,
  queueKey: QueueKey,
) {
  const { queueId, orgId } = queueKey;
  const worker = new Worker(
    queueId,
    // An empty processor function is necessary to create
    // the timer manager that's used in checkStalledJobs
    async (_) => {
      return null;
    },
    {
      connection: redisConnection,
      lockDuration: MANUAL_REVIEW_LOCK_DURATION_MS,
      prefix: getPrefix(orgId),
      autorun: false,
      // A job is put into stalled when a user claims it and then doesn't action
      // on it for the lockDuration. When the max limit is hit, Bull puts the
      // the job into a failed queue which isn't visible to the user and then
      // never dequeues again. This can lead to bad situations like a report
      // never being actioned on, or re-enqueues of a job looking like they're
      // not working. The default is 1, and 50 should be a large enough number
      // that no reasonable user should ever hit it.
      maxStalledCount: 50,
    },
  );
  // Start the stalled jobs checker for manual job processing
  await worker.startStalledCheckTimer();

  // Cast worker to a version of its original type, but fixed to correctly
  // indicate that getNextJob() can return undefined and accepts a `block`
  // option (false = return immediately instead of long-polling).
  return worker as unknown as Omit<Worker<JobData>, 'getNextJob'> & {
    getNextJob: (
      lockToken: string,
      opts?: { block?: boolean },
    ) => Promise<Job<JobData> | undefined>;
  };
}

/**
 * NB: this is called getOrCreateBullQueue because BullMQ will silently create
 * a queue object (certainly in memory and maybe even leaving some traces in
 * Redis) if this is called with a queue id that doesn't exist yet.
 */
export async function getOrCreateBullQueue<JobData = unknown>(
  redisConnection: RedisConnection,
  queueKey: QueueKey,
) {
  const { orgId, queueId } = queueKey;
  return new Queue<JobData>(queueId, {
    connection: redisConnection,
    prefix: getPrefix(orgId),
  });
}

/**
 * Constructs a prefix out of the orgId to use for automatic sharding.
 * Using the org ID ensures that all hashes in the same Org are stored together.
 */
function getPrefix(orgId: string) {
  return '{' + orgId + '}';
}

export const makeDeleteAllJobsInsufficientPermissionsError = (
  data: ErrorInstanceData,
) =>
  new CoopError({
    status: 403,
    type: [ErrorType.Unauthorized],
    title: String(data.detail),
    name: 'DeleteAllJobsUnauthorizedError',
    ...data,
  });

const makeQueueDoesNotExistError = (data: ErrorInstanceData) => {
  return new CoopError({
    status: 400,
    type: [ErrorType.InvalidUserInput],
    title: 'The queue with this ID does not exist',
    name: 'QueueDoesNotExistError',
    ...data,
  });
};

/**
 * Thrown when a target queue, user, or role does not belong to the caller's org.
 */
const makeAccessibleQueueNotInOrgError = (data: ErrorInstanceData) =>
  new CoopError({
    status: 403,
    type: [ErrorType.Unauthorized],
    title: "Queue, user, or role does not belong to the caller's organization",
    name: 'AccessibleQueueNotInOrgError',
    ...data,
  });

/**
 * Rejects before any write if a target queue does not belong to the caller's
 * org. Defense-in-depth org-scoping for accessible-queue mutations.
 */
async function assertQueuesInOrg(
  db: CoopDbOrTx,
  opts: { orgId: string; queueIds: readonly string[] },
) {
  const { orgId, queueIds } = opts;
  const inOrgQueues = await db
    .select({ id: queuesTable.id })
    .from(queuesTable)
    .where(
      and(eq(queuesTable.orgId, orgId), inArray(queuesTable.id, [...queueIds])),
    );
  if (inOrgQueues.length !== new Set(queueIds).size) {
    throw makeAccessibleQueueNotInOrgError({ shouldErrorSpan: true });
  }
}

/**
 * Rejects before any write if a target user does not belong to the caller's
 * org. Defense-in-depth org-scoping for accessible-queue mutations.
 */
async function assertUsersInOrg(
  db: CoopDbOrTx,
  opts: { orgId: string; userIds: readonly string[] },
) {
  const { orgId, userIds } = opts;
  const { users } = schema;
  const inOrgUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.orgId, orgId), inArray(users.id, [...userIds])));
  if (inOrgUsers.length !== new Set(userIds).size) {
    throw makeAccessibleQueueNotInOrgError({ shouldErrorSpan: true });
  }
}

/** Rejects before any write if a target role does not belong to the caller's org. */
async function assertRolesInOrg(
  db: CoopDbOrTx,
  opts: { orgId: string; roleIds: readonly string[] },
) {
  const { orgId, roleIds } = opts;
  if (roleIds.length === 0) {
    return;
  }
  const { roles } = schema;
  const inOrgRoles = await db
    .select({ id: roles.id })
    .from(roles)
    .where(and(eq(roles.orgId, orgId), inArray(roles.id, [...roleIds])));
  if (inOrgRoles.length !== new Set(roleIds).size) {
    throw makeAccessibleQueueNotInOrgError({ shouldErrorSpan: true });
  }
}

/**
 * Rejects before any write if a target queue or user does not belong to the
 * caller's org.
 */
async function assertUsersAndQueuesInOrg(
  db: CoopDbOrTx,
  opts: {
    orgId: string;
    userIds: readonly string[];
    queueIds: readonly string[];
  },
) {
  await assertQueuesInOrg(db, {
    orgId: opts.orgId,
    queueIds: opts.queueIds,
  });
  await assertUsersInOrg(db, {
    orgId: opts.orgId,
    userIds: opts.userIds,
  });
}

export const makeUnableToDeleteDefaultQueueError = (
  data: ErrorInstanceData,
) => {
  return new CoopError({
    status: 403,
    type: [ErrorType.Unauthorized],
    title: 'Unable to delete default queue',
    name: 'UnableToDeleteDefaultQueueError',
    ...data,
  });
};

/**
 * Cheap, non-throwing parse check for external JobIds. Used by callers
 * that accept the id as user input (e.g. admin button) so a malformed id
 * becomes a "not found" instead of a 500.
 */
// Both halves are base64url tokens (optionally `=`-padded), so reject input
// that can't be one before paying for the per-queue fallback scan.
const B64URL_TOKEN = /^[A-Za-z0-9_\-+/=]+$/;
/** Drizzle wraps pg errors, so the constraint name may be on `cause`. */
function getPgConstraintName(error: unknown): string | undefined {
  for (const path of [['constraint'], ['cause', 'constraint']]) {
    const constraint = safeGet(error, path);
    if (typeof constraint === 'string') {
      return constraint;
    }
  }
  return undefined;
}

function isParsableExternalId(externalId: JobId): boolean {
  const parts = (externalId as string).split(':');
  return (
    parts.length === 2 &&
    B64URL_TOKEN.test(parts[0]) &&
    B64URL_TOKEN.test(parts[1])
  );
}

/**
 * BullMQ surfaces "job is locked" as an Error whose message starts with
 * "Could not remove job"; there is no exported error class to instanceof
 * against. Match defensively on the message and on a likely future
 * canonicalisation of the same condition.
 */
function isJobLockedError(err: unknown): boolean {
  if (!(err instanceof Error)) {
    return false;
  }
  const msg = err.message.toLowerCase();
  return (
    msg.includes('could not remove job') ||
    msg.includes('locked by another worker') ||
    msg.includes('lock mismatch')
  );
}

export const makeManualReviewQueueNameExistsError = (data: ErrorInstanceData) =>
  new CoopError({
    status: 409,
    type: [ErrorType.UniqueViolation],
    title:
      'A manual review queue with that name already exists in this organization.',
    name: 'ManualReviewQueueNameExistsError',
    ...data,
  });

export const makeQueueHasDependentRoutingRulesError = (
  ruleNames: string[],
  data: ErrorInstanceData,
) =>
  new CoopError({
    status: 409,
    type: [ErrorType.Conflict],
    title:
      ruleNames.length > 0
        ? `This queue cannot be deleted because it is used by the following routing rules:\n${ruleNames.join(', ')}\nUpdate or delete those rules first.`
        : 'This queue cannot be deleted because it is still referenced by one or more routing rules. Update or delete those rules first.',
    detail: ruleNames.length > 0 ? jsonStringify(ruleNames) : undefined,
    name: 'QueueHasDependentRoutingRulesError',
    ...data,
  });
