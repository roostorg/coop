import { and, asc, count, eq, inArray } from 'drizzle-orm';
import { v1 as uuidv1 } from 'uuid';

import { schema, type CoopDb } from '../../../storage/postgres/drizzle.js';
import { makeNotFoundError } from '../../../utils/errors.js';
import { isForeignKeyViolationError } from '../../../utils/kysely.js';

const { jobComments, jobCreations } = schema;

export type ManualReviewJobComment = {
  id: string;
  commentText: string;
  authorId: string;
  createdAt: Date;
};

const manualReviewCommentDbSelection = {
  id: jobComments.id,
  commentText: jobComments.commentText,
  authorId: jobComments.authorId,
  createdAt: jobComments.createdAt,
};

export default class CommentOperations {
  constructor(private readonly db: CoopDb) {}

  private async getRelatedJobIds(opts: {
    orgId: string;
    jobId: string;
  }): Promise<string[]> {
    const { orgId, jobId } = opts;

    // First get the item identifiers for the current job
    const currentJob = (
      await this.db
        .select({
          itemId: jobCreations.itemId,
          itemTypeId: jobCreations.itemTypeId,
        })
        .from(jobCreations)
        .where(and(eq(jobCreations.orgId, orgId), eq(jobCreations.id, jobId)))
        .limit(1)
    ).at(0);

    if (!currentJob) {
      // Fallback to single job if current job not found in job_creations
      return [jobId];
    }

    // Get all job IDs for the same item across all queues
    const relatedJobIds = await this.db
      .select({ id: jobCreations.id })
      .from(jobCreations)
      .where(
        and(
          eq(jobCreations.orgId, orgId),
          eq(jobCreations.itemId, currentJob.itemId),
          eq(jobCreations.itemTypeId, currentJob.itemTypeId),
        ),
      );

    return relatedJobIds.map((row) => row.id);
  }

  async getComments(opts: {
    orgId: string;
    jobId: string;
  }): Promise<ManualReviewJobComment[]> {
    const { orgId } = opts;
    const jobIds = await this.getRelatedJobIds(opts);

    return this.db
      .select(manualReviewCommentDbSelection)
      .from(jobComments)
      .where(
        and(eq(jobComments.orgId, orgId), inArray(jobComments.jobId, jobIds)),
      )
      .orderBy(asc(jobComments.createdAt));
  }

  async getCommentCount(opts: { orgId: string; jobId: string }) {
    const { orgId } = opts;
    const jobIds = await this.getRelatedJobIds(opts);

    const [result] = await this.db
      .select({ count: count(jobComments.id) })
      .from(jobComments)
      .where(
        and(eq(jobComments.orgId, orgId), inArray(jobComments.jobId, jobIds)),
      );

    return Number(result.count);
  }

  async addComment(opts: {
    orgId: string;
    jobId: string;
    commentText: string;
    authorId: string;
  }): Promise<ManualReviewJobComment> {
    const { orgId, jobId, commentText, authorId } = opts;
    try {
      const [comment] = await this.db
        .insert(jobComments)
        .values({ id: uuidv1(), orgId, jobId, commentText, authorId })
        .returning(manualReviewCommentDbSelection);

      return comment;
    } catch (e) {
      if (isForeignKeyViolationError(e)) {
        throw makeNotFoundError('Job not found', { shouldErrorSpan: true });
      }

      throw e;
    }
  }

  async deleteComment(opts: {
    orgId: string;
    jobId: string;
    userId: string;
    commentId: string;
  }) {
    const { orgId, jobId, userId, commentId } = opts;
    const result = await this.db
      .delete(jobComments)
      .where(
        and(
          eq(jobComments.orgId, orgId),
          eq(jobComments.jobId, jobId),
          eq(jobComments.authorId, userId),
          eq(jobComments.id, commentId),
        ),
      );

    return result.rowCount === 1;
  }
}
