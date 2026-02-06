import { type Kysely } from 'kysely';
import { v1 as uuidv1 } from 'uuid';

import { makeNotFoundError } from '../../../utils/errors.js';
import { isForeignKeyViolationError } from '../../../utils/kysely.js';
import { type ManualReviewToolServicePg } from '../dbTypes.js';

export type ManualReviewJobComment = {
  id: string;
  commentText: string;
  authorId: string;
  createdAt: Date;
};

const manualReviewCommentDbSelection = [
  'id',
  'comment_text as commentText',
  'author_id as authorId',
  'created_at as createdAt',
] as const;

export default class CommentOperations {
  constructor(private readonly pgQuery: Kysely<ManualReviewToolServicePg>) {}

  private async getRelatedJobIds(opts: { orgId: string; jobId: string }): Promise<string[]> {
    const { orgId, jobId } = opts;

    // First get the item identifiers for the current job
    const currentJob = await this.pgQuery
      .selectFrom('manual_review_tool.job_creations')
      .select(['item_id', 'item_type_id'])
      .where('org_id', '=', orgId)
      .where('id', '=', jobId as any)
      .executeTakeFirst();

    if (!currentJob) {
      // Fallback to single job if current job not found in job_creations
      return [jobId];
    }

    // Get all job IDs for the same item across all queues
    const relatedJobIds = await this.pgQuery
      .selectFrom('manual_review_tool.job_creations')
      .select(['id'])
      .where('org_id', '=', orgId)
      .where('item_id', '=', currentJob.item_id)
      .where('item_type_id', '=', currentJob.item_type_id)
      .execute();

    return relatedJobIds.map(row => row.id);
  }

  async getComments(opts: { orgId: string; jobId: string }) {
    const { orgId } = opts;
    const jobIds = await this.getRelatedJobIds(opts);

    const comments = await this.pgQuery
      .selectFrom('manual_review_tool.job_comments')
      .select(manualReviewCommentDbSelection)
      .where('org_id', '=', orgId)
      .where('job_id', 'in', jobIds as any[])
      .orderBy('created_at', 'asc')
      .execute();

    return comments;
  }

  async getCommentCount(opts: { orgId: string; jobId: string }) {
    const { orgId } = opts;
    const jobIds = await this.getRelatedJobIds(opts);

    const result = await this.pgQuery
      .selectFrom('manual_review_tool.job_comments')
      .select((eb) => eb.fn.count('id').as('count'))
      .where('org_id', '=', orgId)
      .where('job_id', 'in', jobIds as any[])
      .executeTakeFirst();

    return result?.count ? Number(result.count) : 0;
  }

  async addComment(opts: {
    orgId: string;
    jobId: string;
    commentText: string;
    authorId: string;
  }) {
    const { orgId, jobId, commentText, authorId } = opts;
    try {
      const comment = await this.pgQuery
        .insertInto('manual_review_tool.job_comments')
        .returning(manualReviewCommentDbSelection)
        .values([
          {
            id: uuidv1(),
            org_id: orgId,
            job_id: jobId,
            comment_text: commentText,
            author_id: authorId,
          },
        ])
        .executeTakeFirst();

      return comment!;
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
    const result = await this.pgQuery
      .deleteFrom('manual_review_tool.job_comments')
      .where('org_id', '=', orgId)
      .where('job_id', '=', jobId)
      .where('author_id', '=', userId)
      .where('id', '=', commentId)
      .executeTakeFirst();

    return result.numDeletedRows === 1n;
  }
}
