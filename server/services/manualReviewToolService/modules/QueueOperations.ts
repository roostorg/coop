/* eslint-disable max-lines */

import { type ItemIdentifier } from '@roostorg/coop-types';
import { Queue, Worker, type Job } from 'bullmq';
import { type Cluster } from 'ioredis';
import type IORedis from 'ioredis';
import { type Kysely, type Transaction } from 'kysely';
import pLimit from 'p-limit';
import { type Opaque, type ReadonlyDeep } from 'type-fest';
import { v1 as uuidv1 } from 'uuid';

import { type Dependencies } from '../../../iocContainer/index.js';
import { cached, type Cached } from '../../../utils/caching.js';
import { filterNullOrUndefined } from '../../../utils/collections.js';
import {
  b64UrlDecode,
  b64UrlEncode,
  type B64UrlOf,
} from '../../../utils/encoding.js';
import {
  CoopError,
  ErrorType,
  makeUnauthorizedError,
  type ErrorInstanceData,
} from '../../../utils/errors.js';
import { isUniqueViolationError } from '../../../utils/kysely.js';
import {
  makeKyselyTransactionWithRetry,
  type KyselyTransactionWithRetry,
} from '../../../utils/kyselyTransactionWithRetry.js';
import { removeUndefinedKeys, safePick } from '../../../utils/misc.js';
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
  type ManualReviewToolServicePg,
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

export type ManualReviewQueue = {
  id: string;
  name: string;
  description: string | null;
  orgId: string;
  createdAt: Date;
  isDefaultQueue: boolean;
  isAppealsQueue: boolean;
  autoCloseJobs: boolean;
  // Null disposition disables "clear other reports for this user" (issue #650).
  clearReportsDisposition: ClearReportsDisposition | null;
  clearReportsScope: ClearReportsScope;
};

const PgQueueSelection = [
  'id',
  'org_id as orgId',
  'name',
  'description',
  'is_default_queue as isDefaultQueue',
  'created_at as createdAt',
  'is_appeals_queue as isAppealsQueue',
  'auto_close_jobs as autoCloseJobs',
  'clear_reports_disposition as clearReportsDisposition',
  'clear_reports_scope as clearReportsScope',
] as const;

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
  | 'UnableToDeleteDefaultQueueError';

// Compound identifier for a queue. orgId is needed for security, but also
// because queues are/will be actually sharded across redis instances for
// scaling by orgId, so you need the orgId to find the queue.
type QueueKey = { orgId: string; queueId: string };

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
  private readonly transactionWithRetry: KyselyTransactionWithRetry<ManualReviewToolServicePg>;

  constructor(
    private readonly pgQuery: Kysely<ManualReviewToolServicePg>,
    private readonly pgQueryReadReplica: Kysely<ManualReviewToolServicePg>,
    private readonly moderationConfigService: Dependencies['ModerationConfigService'],
    redis: RedisConnection,
  ) {
    this.transactionWithRetry = makeKyselyTransactionWithRetry(this.pgQuery);
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
    const queue = await this.pgQuery
      .selectFrom('manual_review_tool.manual_review_queues')
      .select(PgQueueSelection)
      .where('org_id', '=', orgId)
      .where('id', '=', queueId)
      .executeTakeFirst();
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
    hiddenActionIds: readonly string[];
    invokedBy: Invoker;
    isAppealsQueue?: boolean;
    autoCloseJobs?: boolean;
    clearReportsDisposition?: ClearReportsDisposition | null;
    clearReportsScope?: ClearReportsScope;
    clearReportsTriggerActionIds?: readonly string[];
  }) {
    const {
      name,
      description,
      userIds,
      hiddenActionIds,
      invokedBy,
      isAppealsQueue,
      autoCloseJobs,
      clearReportsDisposition,
      clearReportsScope,
      clearReportsTriggerActionIds,
    } = input;
    const { orgId } = invokedBy;

    if (!invokedBy.permissions.includes(UserPermission.EDIT_MRT_QUEUES)) {
      throw makeUnauthorizedError(
        'You do not have permission to create a queue',
        { shouldErrorSpan: true },
      );
    }

    try {
      return await this.transactionWithRetry(async (transaction) => {
        // In newer versions of kysely, this is greatly simplified with
        // `transaction.selectNoFrom(eb => eb.exists(...))`, but we're blocked on
        // updating by https://github.com/kysely-org/kysely/issues/577#issuecomment-1804900006
        const orgHasQueuesAlready = await transaction
          .selectFrom('manual_review_tool.manual_review_queues')
          .where('org_id', '=', orgId)
          .where('is_appeals_queue', '=', isAppealsQueue ?? false)
          .limit(1)
          .execute()
          .then((queues) => queues.length > 0);

        const queue = await transaction
          .insertInto('manual_review_tool.manual_review_queues')
          .returning(PgQueueSelection)
          .values([
            {
              id: uuidv1(),
              name,
              org_id: orgId,
              is_default_queue: !orgHasQueuesAlready,
              description: replaceEmptyStringWithNull(description),
              is_appeals_queue: isAppealsQueue ?? false,
              auto_close_jobs: autoCloseJobs ?? false,
              clear_reports_disposition: clearReportsDisposition ?? null,
              clear_reports_scope: clearReportsScope ?? 'CURRENT_QUEUE',
            },
          ])
          .executeTakeFirstOrThrow();

        await transaction
          .insertInto('manual_review_tool.users_and_accessible_queues')
          .values(
            userIds.map((userId) => ({
              queue_id: queue.id,
              user_id: userId,
            })),
          )
          .executeTakeFirstOrThrow();

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
      });
    } catch (e) {
      if (isUniqueViolationError(e)) {
        throw makeManualReviewQueueNameExistsError({ shouldErrorSpan: true });
      }
      throw e;
    }
  }

  async updateManualReviewQueue(input: {
    orgId: string;
    queueId: string;
    name?: string;
    description?: string | null;
    userIds: readonly string[];
    actionIdsToHide: readonly string[];
    actionIdsToUnhide: readonly string[];
    autoCloseJobs?: boolean;
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
      actionIdsToHide,
      actionIdsToUnhide,
      autoCloseJobs,
      clearReportsDisposition,
      clearReportsScope,
      clearReportsTriggerActionIds,
    } = input;

    return this.transactionWithRetry(async (transaction) => {
      const [updatedQueue, _, __] = await Promise.all([
        transaction
          .updateTable('manual_review_tool.manual_review_queues')
          .set(
            removeUndefinedKeys({
              name,
              description: replaceEmptyStringWithNull(description),
              auto_close_jobs: autoCloseJobs,
              // null disables the feature and must survive removeUndefinedKeys.
              clear_reports_disposition: clearReportsDisposition,
              clear_reports_scope: clearReportsScope,
            }),
          )
          .where('id', '=', queueId)
          .where('org_id', '=', orgId)
          .returning(PgQueueSelection)
          .executeTakeFirstOrThrow(),
        transaction
          .insertInto('manual_review_tool.users_and_accessible_queues')
          .values(
            userIds.map((userId) => ({
              queue_id: queueId,
              user_id: userId,
            })),
          )
          .onConflict((oc) => oc.doNothing())
          .executeTakeFirstOrThrow(),
        transaction
          .deleteFrom('manual_review_tool.users_and_accessible_queues')
          .where('queue_id', '=', queueId)
          .where('user_id', 'not in', userIds)
          .executeTakeFirstOrThrow(),
      ]);

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

    await queue.obliterate({ force: true });

    const numDeletedRows = await this.transactionWithRetry(
      async (transaction) => {
        // Delete the queue scoped by org first. If it doesn't belong to the
        // caller's org, no rows are touched and we bail before deleting any
        // join rows. `users_and_accessible_queues` has no `org_id` column,
        // so an unscoped delete would otherwise wipe another org's access
        // rows when the parent delete matches 0 rows.
        const queueDelete = await transaction
          .deleteFrom('manual_review_tool.manual_review_queues')
          .where('id', '=', queueId)
          .where('org_id', '=', orgId)
          .executeTakeFirst();

        if (queueDelete.numDeletedRows === 0n) {
          return 0n;
        }

        await transaction
          .deleteFrom('manual_review_tool.users_and_accessible_queues')
          .where('queue_id', '=', queueId)
          .execute();

        return queueDelete.numDeletedRows;
      },
    );

    return numDeletedRows === 1n;
  }

  async deleteManualReviewQueueForTestsDO_NOT_USE(
    orgId: string,
    queueId: string,
  ) {
    const queue = await this.getOrCreateBullQueue({ orgId, queueId });

    await queue.obliterate({ force: true });

    // See `deleteManualReviewQueue` for why this is serialized + ownership-
    // checked. Same pattern, just without the default-queue guard.
    const numDeletedRows = await this.transactionWithRetry(
      async (transaction) => {
        const queueDelete = await transaction
          .deleteFrom('manual_review_tool.manual_review_queues')
          .where('id', '=', queueId)
          .where('org_id', '=', orgId)
          .executeTakeFirst();

        if (queueDelete.numDeletedRows === 0n) {
          return 0n;
        }

        await transaction
          .deleteFrom('manual_review_tool.users_and_accessible_queues')
          .where('queue_id', '=', queueId)
          .execute();

        return queueDelete.numDeletedRows;
      },
    );

    return numDeletedRows === 1n;
  }

  async getDefaultQueueIdForOrg(orgId: string) {
    const queue = await this.pgQuery
      .selectFrom('manual_review_tool.manual_review_queues')
      .select(['id'])
      .where('org_id', '=', orgId)
      .where('is_appeals_queue', '=', false)
      .where('is_default_queue', '=', true)
      .executeTakeFirstOrThrow();
    return queue.id;
  }

  async getDefaultAppealsQueueIdForOrg(orgId: string) {
    const queue = await this.pgQuery
      .selectFrom('manual_review_tool.manual_review_queues')
      .select(['id'])
      .where('org_id', '=', orgId)
      .where('is_appeals_queue', '=', true)
      .where('is_default_queue', '=', true)
      .executeTakeFirstOrThrow();
    return queue.id;
  }

  async getReviewableQueuesForUser(opts: { invoker: Invoker }) {
    const { invoker } = opts;
    const { userId, permissions, orgId } = invoker;

    const canSeeQueues = permissions.includes(UserPermission.VIEW_MRT);
    const bypassQueuePermissions = permissions.includes(
      UserPermission.EDIT_MRT_QUEUES,
    );

    if (!canSeeQueues) {
      return [];
    }

    return this.pgQuery
      .selectFrom('manual_review_tool.manual_review_queues')
      .select(PgQueueSelection)
      .where('org_id', '=', orgId)
      .$if(!bypassQueuePermissions, (query) =>
        query.where(
          'id',
          'in',
          this.pgQuery
            .selectFrom('manual_review_tool.users_and_accessible_queues')
            .select('queue_id')
            .where('user_id', '=', userId),
        ),
      )
      .execute();
  }

  async getQueueForOrg(opts: {
    orgId: string;
    userId: string;
    queueId: string;
  }) {
    const { orgId, userId, queueId } = opts;
    return this.pgQuery
      .selectFrom('manual_review_tool.manual_review_queues')
      .select(PgQueueSelection)
      .where('org_id', '=', orgId)
      .where('id', '=', queueId)
      .where(
        'id',
        'in',
        this.pgQuery
          .selectFrom('manual_review_tool.users_and_accessible_queues')
          .select('queue_id')
          .where('user_id', '=', userId),
      )
      .executeTakeFirst();
  }

  async getFavoriteQueuesForUser(opts: { orgId: string; userId: string }) {
    const { orgId, userId } = opts;
    return this.pgQuery
      .selectFrom(
        'manual_review_tool.users_and_favorite_mrt_queues as favorite_queues',
      )
      .innerJoin(
        'manual_review_tool.manual_review_queues as queues',
        'favorite_queues.queue_id',
        'queues.id',
      )
      .select([
        'queues.id',
        'queues.org_id as orgId',
        'queues.name',
        'queues.description',
        'queues.is_default_queue as isDefaultQueue',
        'queues.created_at as createdAt',
        'queues.is_appeals_queue as isAppealsQueue',
        'queues.auto_close_jobs as autoCloseJobs',
        'queues.clear_reports_disposition as clearReportsDisposition',
        'queues.clear_reports_scope as clearReportsScope',
      ])
      .where('favorite_queues.user_id', '=', userId)
      .where('favorite_queues.org_id', '=', orgId)
      .execute();
  }

  async addFavoriteQueueForUser(opts: {
    userId: string;
    orgId: string;
    queueId: string;
  }) {
    const { userId, orgId, queueId } = opts;
    await this.pgQuery
      .insertInto('manual_review_tool.users_and_favorite_mrt_queues')
      .values({ user_id: userId, org_id: orgId, queue_id: queueId })
      .onConflict((oc) => oc.doNothing())
      .execute();
  }

  async removeFavoriteQueueForUser(opts: {
    userId: string;
    orgId: string;
    queueId: string;
  }) {
    const { userId, orgId, queueId } = opts;
    await this.pgQuery
      .deleteFrom('manual_review_tool.users_and_favorite_mrt_queues')
      .where('user_id', '=', userId)
      .where('org_id', '=', orgId)
      .where('queue_id', '=', queueId)
      .execute();
  }

  async getAllQueuesForOrgAndDangerouslyBypassPermissioning(orgId: string) {
    return this.pgQuery
      .selectFrom('manual_review_tool.manual_review_queues')
      .select(PgQueueSelection)
      .where('org_id', '=', orgId)
      .execute();
  }

  async getQueueForOrgAndDangerouslyBypassPermissioning(opts: {
    orgId: string;
    queueId: string;
  }) {
    return this.pgQuery
      .selectFrom('manual_review_tool.manual_review_queues')
      .select(PgQueueSelection)
      .where('org_id', '=', opts.orgId)
      .where('id', '=', opts.queueId)
      .executeTakeFirst();
  }

  async getUsersWhoCanSeeQueue(opts: { orgId: string; queueId: string }) {
    const { orgId, queueId } = opts;
    return this.pgQuery
      .selectFrom('manual_review_tool.users_and_accessible_queues')
      .select(['user_id as userId'])
      .where('queue_id', '=', queueId)
      .where(
        'queue_id',
        'in',
        this.pgQuery
          .selectFrom('manual_review_tool.manual_review_queues')
          .select('id')
          .where('org_id', '=', orgId),
      )
      .execute();
  }

  async addAccessibleQueuesForUser(
    userIds: string[],
    queueIds: readonly string[],
  ) {
    return this.pgQuery
      .insertInto('manual_review_tool.users_and_accessible_queues')
      .values(
        userIds.flatMap((userId) =>
          queueIds.map((queueId) => ({ queue_id: queueId, user_id: userId })),
        ),
      )
      .onConflict((oc) => oc.doNothing())
      .execute();
  }

  async removeAccessibleQueuesForUser(
    userId: string,
    queueIds: readonly string[],
  ) {
    return this.pgQuery
      .deleteFrom('manual_review_tool.users_and_accessible_queues')
      .where('user_id', '=', userId)
      .where('queue_id', 'in', queueIds)
      .execute();
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
  }) {
    const { orgId, queueId, jobPayload, reenqueuedFrom, enqueueSourceInfo } =
      opts;
    const { payload, policyIds } = jobPayload;

    const queue = await this.#getBullQueue(orgId, queueId);

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
    await job.updateData(data);

    // Because the `data` arg above is a ManualReviewJob, we know the stored
    // data for this particular job won't be in the legacy format.
    return job.data satisfies StoredManualReviewJob as ManualReviewJob;
  }

  /**
   * Yields every undecided job on a queue (waiting, delayed, or active) for
   * bounded admin sweeps such as reporter invalidation. Includes `active`
   * jobs so sweeps can update what a reviewer currently has dequeued;
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
        ['waiting', 'delayed', 'active'],
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
        const id = legacy?.data?.id;
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
    const row = await this.pgQuery
      .selectFrom('manual_review_tool.job_creations')
      .select(['queue_id'])
      .where('org_id', '=', orgId)
      .where('id', '=', jobId)
      .executeTakeFirst();
    if (row) {
      const jobs = await this.getJobs({
        orgId,
        queueId: row.queue_id,
        jobIds: [jobId],
      });
      if (jobs.length > 0) {
        return { job: jobs[0], queueId: row.queue_id };
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

    let hasDecision = true;
    while (hasDecision) {
      const job = await worker.getNextJob(lockToken);

      if (!job) {
        return null;
      }

      // There is a race condition due to the locking mechanism where a job can
      // be decided on but not dequeued, so we check here if the first job in the
      // queue has a decision, and if so use the lock token to immediately
      // remove it, then grab a new job and return to the caller. it is very
      // unlikely that there are multiple jobs like this at the front of the
      // queue, but not impossible.
      const decision = await this.pgQueryReadReplica
        .selectFrom('manual_review_tool.manual_review_decisions')
        .where('created_at', '>=', new Date('2023-10-01'))
        .where('org_id', '=', orgId)
        .where('id', '=', jobIdToGuid(job.data.id))
        .executeTakeFirst();

      hasDecision = decision !== undefined;

      if (hasDecision) {
        await this.removeJob({
          orgId,
          queueId,
          lockToken,
          jobId: job.data.id,
        }).catch(() => {});
        // then continue while loop
      } else {
        // this is the most likely case, where there is a job
        // and it has never been decided before
        return { job: job.data, lockToken };
      }
    }
    return null;
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

    let hasDecision = true;
    while (hasDecision) {
      const job = await worker.getNextJob(lockToken);

      if (!job) {
        return null;
      }

      const convertedJob = await this.legacyJobToJob(job, orgId);

      // There is a race condition due to the locking mechanism where a job can
      // be decided on but not dequeued, so we check here if the first job in the
      // queue has a decision, and if so use the lock token to immediately
      // remove it, then grab a new job and return to the caller. it is very
      // unlikely that there are multiple jobs like this at the front of the
      // queue, but not impossible.
      const decision = await this.pgQueryReadReplica
        .selectFrom('manual_review_tool.manual_review_decisions')
        .select(['decision_components']) // not really necessary to return anything
        .where('created_at', '>=', new Date('2023-10-01'))
        .where('org_id', '=', orgId)
        .where('id', '=', jobIdToGuid(convertedJob.data.id))
        .executeTakeFirst();

      hasDecision = decision !== undefined;

      if (hasDecision) {
        await this.removeJob({
          orgId,
          queueId,
          lockToken,
          jobId: convertedJob.data.id,
        }).catch(() => {});
        // then continue while loop
      } else {
        // this is the most likely case, where there is a job
        // and it has never been decided before
        return { job: convertedJob.data, lockToken };
      }
    }
    return null;
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
    try {
      await this.#markLockedJobCompleted(opts);
    } catch (error: unknown) {
      // The most common case where this throws if the lock token has expired,
      // so try to remove it manually.
      const { orgId, queueId, jobId } = opts;
      const queue = await this.getOrCreateBullQueue({ orgId, queueId });
      const bullJobId = parseExternalId(jobId).bullId;
      const removeJobStatus = await queue.remove(bullJobId);
      if (removeJobStatus !== 1) {
        throw new Error('Failed to remove job');
      }
    }
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
      // If the lock has already expired or the job is in a different state,
      // we can safely ignore the error as the job is already released
      // or will be handled by the stalled job checker
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
    const queue = isAppealsQueue
      ? await this.#getBullAppealQueue(orgId, queueId)
      : await this.#getBullQueue(orgId, queueId);

    // Get the first waiting job and first delayed job
    // BullMQ maintains FIFO order within each state, so we only need to compare
    // the first job from each state to find the oldest overall
    const [waitingJobs, delayedJobs] = await Promise.all([
      queue.getJobs(['waiting'], 0, 0),
      queue.getJobs(['delayed'], 0, 0),
    ]);

    // If no jobs exist in either state, return null
    if (waitingJobs.length === 0 && delayedJobs.length === 0) {
      return null;
    }

    // If only one type exists, return it
    if (waitingJobs.length === 0) return delayedJobs[0].data.createdAt;
    if (delayedJobs.length === 0) return waitingJobs[0].data.createdAt;

    // Both exist, return the older one
    const waitingTime = new Date(waitingJobs[0].data.createdAt).getTime();
    const delayedTime = new Date(delayedJobs[0].data.createdAt).getTime();
    return waitingTime < delayedTime
      ? waitingJobs[0].data.createdAt
      : delayedJobs[0].data.createdAt;
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
  }) {
    const { orgId, itemId, itemTypeId } = opts;
    // Check postgres for creations within the last 7 days so we don't have to
    // search every bull queue for every item.
    const recentJobCreationQueues = await this.pgQuery
      .selectFrom('manual_review_tool.job_creations')
      .select(['queue_id'])
      .where('org_id', '=', orgId)
      .where('item_id', '=', itemId)
      .where('item_type_id', '=', itemTypeId)
      .where('created_at', '>=', new Date(Date.now() - WEEK_MS))
      .execute();
    const jobsWithQueue = await Promise.all(
      recentJobCreationQueues.map(async (rows) => {
        const queueId = rows.queue_id;
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
      await this.pgQuery
        .selectFrom('manual_review_tool.queues_and_hidden_actions')
        .select(['action_id'])
        .where('queue_id', '=', queueId)
        .where('org_id', '=', orgId)
        .execute()
    ).map((it) => it.action_id);
  }

  // NB: Making the transaction required means this function should only be used
  // inside another transaction.
  async updateHiddenActionsForQueue(opts: {
    queueId: string;
    actionIdsToHide: readonly string[];
    actionIdsToUnhide: readonly string[];
    orgId: string;
    transaction?: Transaction<ManualReviewToolServicePg>;
  }) {
    const { transaction, queueId, actionIdsToHide, actionIdsToUnhide, orgId } =
      opts;

    if (actionIdsToHide.length === 0 && actionIdsToUnhide.length === 0) {
      return undefined;
    }

    const queryInterface = transaction ?? this.pgQuery;

    if (actionIdsToHide.length > 0) {
      await queryInterface
        .insertInto('manual_review_tool.queues_and_hidden_actions')
        .values(
          actionIdsToHide.map((actionId) => ({
            queue_id: queueId,
            action_id: actionId,
            org_id: orgId,
          })),
        )
        .execute();
    }

    if (actionIdsToUnhide.length > 0) {
      await queryInterface
        .deleteFrom('manual_review_tool.queues_and_hidden_actions')
        .where('queue_id', '=', queueId)
        .where('org_id', '=', orgId)
        .where('action_id', 'in', actionIdsToUnhide)
        .execute();
    }
  }

  // Action IDs whose use triggers the clear-other-reports sweep (issue #650).
  async getClearReportsTriggerActionsForQueue(opts: {
    queueId: string;
    orgId: string;
  }): Promise<string[]> {
    const { queueId, orgId } = opts;
    return (
      await this.pgQuery
        .selectFrom(
          'manual_review_tool.queues_and_clear_reports_trigger_actions',
        )
        .select(['action_id'])
        .where('queue_id', '=', queueId)
        .where('org_id', '=', orgId)
        .execute()
    ).map((it) => it.action_id);
  }

  // Replaces the queue's trigger actions with `actionIds` (pass [] to clear).
  async setClearReportsTriggerActionsForQueue(opts: {
    queueId: string;
    orgId: string;
    actionIds: readonly string[];
    transaction?: Transaction<ManualReviewToolServicePg>;
  }) {
    const { queueId, orgId, actionIds, transaction } = opts;
    const queryInterface = transaction ?? this.pgQuery;

    await queryInterface
      .deleteFrom('manual_review_tool.queues_and_clear_reports_trigger_actions')
      .where('queue_id', '=', queueId)
      .where('org_id', '=', orgId)
      .execute();

    const uniqueActionIds = [...new Set(actionIds)];
    if (uniqueActionIds.length > 0) {
      await queryInterface
        .insertInto(
          'manual_review_tool.queues_and_clear_reports_trigger_actions',
        )
        .values(
          uniqueActionIds.map((actionId) => ({
            queue_id: queueId,
            action_id: actionId,
            org_id: orgId,
          })),
        )
        .execute();
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
      lockDuration: 600000,
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
  // indicate that getNextJob() can return undefined
  return worker as unknown as Omit<Worker<JobData>, 'getNextJob'> & {
    getNextJob: (lockToken: string) => Promise<Job<JobData> | undefined>;
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
