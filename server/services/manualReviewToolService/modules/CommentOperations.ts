import { v1 as uuidv1 } from 'uuid';

import { type PrismaPgClient } from '../../../storage/prisma/index.js';
import { makeNotFoundError } from '../../../utils/errors.js';
import { isForeignKeyViolationError } from '../../../utils/kysely.js';

export type ManualReviewJobComment = {
  id: string;
  commentText: string;
  authorId: string;
  createdAt: Date;
};

const manualReviewCommentDbSelection = {
  id: true,
  comment_text: true,
  author_id: true,
  created_at: true,
} as const;

function toComment(row: {
  id: string;
  comment_text: string;
  author_id: string;
  created_at: Date;
}): ManualReviewJobComment {
  return {
    id: row.id,
    commentText: row.comment_text,
    authorId: row.author_id,
    createdAt: row.created_at,
  };
}

export default class CommentOperations {
  constructor(private readonly prisma: PrismaPgClient) {}

  private async getRelatedJobIds(opts: {
    orgId: string;
    jobId: string;
  }): Promise<string[]> {
    const { orgId, jobId } = opts;

    // First get the item identifiers for the current job
    const currentJob = await this.prisma.job_creations.findFirst({
      select: { item_id: true, item_type_id: true },
      where: { org_id: orgId, id: jobId },
    });

    if (!currentJob) {
      // Fallback to single job if current job not found in job_creations
      return [jobId];
    }

    // Get all job IDs for the same item across all queues
    const relatedJobIds = await this.prisma.job_creations.findMany({
      select: { id: true },
      where: {
        org_id: orgId,
        item_id: currentJob.item_id,
        item_type_id: currentJob.item_type_id,
      },
    });

    return relatedJobIds.map((row) => row.id);
  }

  async getComments(opts: { orgId: string; jobId: string }) {
    const { orgId } = opts;
    const jobIds = await this.getRelatedJobIds(opts);

    const comments = await this.prisma.job_comments.findMany({
      select: manualReviewCommentDbSelection,
      where: { org_id: orgId, job_id: { in: jobIds } },
      orderBy: { created_at: 'asc' },
    });

    return comments.map(toComment);
  }

  async getCommentCount(opts: { orgId: string; jobId: string }) {
    const { orgId } = opts;
    const jobIds = await this.getRelatedJobIds(opts);

    return this.prisma.job_comments.count({
      where: { org_id: orgId, job_id: { in: jobIds } },
    });
  }

  async addComment(opts: {
    orgId: string;
    jobId: string;
    commentText: string;
    authorId: string;
  }) {
    const { orgId, jobId, commentText, authorId } = opts;
    try {
      const comment = await this.prisma.job_comments.create({
        select: manualReviewCommentDbSelection,
        data: {
          id: uuidv1(),
          org_id: orgId,
          job_id: jobId,
          comment_text: commentText,
          author_id: authorId,
        },
      });

      return toComment(comment);
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
    const result = await this.prisma.job_comments.deleteMany({
      where: {
        org_id: orgId,
        job_id: jobId,
        author_id: userId,
        id: commentId,
      },
    });

    return result.count === 1;
  }
}
