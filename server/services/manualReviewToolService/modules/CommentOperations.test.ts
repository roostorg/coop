import { v1 as uuidv1 } from 'uuid';

import getBottle from '../../../iocContainer/index.js';
import { UserPermission } from '../../../models/types/permissioning.js';
import createOrg from '../../../test/fixtureHelpers/createOrg.js';
import createUser from '../../../test/fixtureHelpers/createUser.js';
import { makeTestWithFixture } from '../../../test/utils.js';
import CommentOperations from './CommentOperations.js';

describe('CommentOperations', () => {
  const testWithFixtures = makeTestWithFixture(async () => {
    const container = (await getBottle()).container;
    const pgQuery = container.KyselyPg;
    const commentOps = new CommentOperations(pgQuery);

    // Create test org
    const orgId = uuidv1();
    const { cleanup: orgCleanup } = await createOrg(
      { Org: container.Sequelize.Org },
      container.ModerationConfigService,
      container.ApiKeyService,
      orgId,
    );

    // Create test user
    const { user, cleanup: userCleanup } = await createUser(
      container.Sequelize,
      orgId,
    );

    // Create a queue (required for job_creations foreign key)
    const queue = await container.ManualReviewToolService.createManualReviewQueue({
      name: 'Test Queue',
      description: null,
      userIds: [user.id],
      hiddenActionIds: [],
      isAppealsQueue: false,
      invokedBy: {
        userId: user.id,
        permissions: [UserPermission.EDIT_MRT_QUEUES],
        orgId,
      },
    });

    // Create test item identifiers and jobs
    const itemId = uuidv1();
    const itemTypeId = uuidv1();
    const jobId1 = uuidv1();
    const jobId2 = uuidv1();

    await pgQuery
      .insertInto('manual_review_tool.job_creations')
      .values([
        {
          id: jobId1 as any,
          org_id: orgId,
          item_id: itemId,
          item_type_id: itemTypeId,
          queue_id: queue.id,
          created_at: new Date('2023-01-01'),
          enqueue_source_info: {},
        },
        {
          id: jobId2 as any,
          org_id: orgId,
          item_id: itemId,
          item_type_id: itemTypeId,
          queue_id: queue.id,
          created_at: new Date('2023-01-02'),
          enqueue_source_info: {},
        },
      ])
      .execute();

    return {
      commentOps,
      pgQuery,
      orgId,
      userId: user.id,
      itemId,
      itemTypeId,
      jobId1,
      jobId2,
      queueId: queue.id,
      async cleanup() {
        // Clean up comments
        await pgQuery
          .deleteFrom('manual_review_tool.job_comments')
          .where('org_id', '=', orgId)
          .execute();

        // Clean up job_creations
        await pgQuery
          .deleteFrom('manual_review_tool.job_creations')
          .where('org_id', '=', orgId)
          .execute();

        // Clean up queue
        await container.ManualReviewToolService.deleteManualReviewQueueForTestsDO_NOT_USE(
          orgId,
          queue.id,
        );

        // Clean up user and org
        await userCleanup();
        await orgCleanup();

        // Close database connections
        await container.KyselyPg.destroy();
        await container.KyselyPgReadReplica.destroy();
      },
    };
  });

  describe('getRelatedJobIds', () => {
    testWithFixtures(
      'should return single job ID when job not found in job_creations',
      async ({ commentOps, orgId }) => {
        const nonExistentJobId = uuidv1();

        // Access private method for testing
        const result = await (commentOps as any).getRelatedJobIds({
          orgId,
          jobId: nonExistentJobId,
        });

        expect(result).toEqual([nonExistentJobId]);
      },
    );

    testWithFixtures(
      'should return all related job IDs when job found in job_creations',
      async ({ commentOps, orgId, jobId1, jobId2 }) => {
        const result = await (commentOps as any).getRelatedJobIds({
          orgId,
          jobId: jobId1,
        });

        expect(result).toHaveLength(2);
        expect(result).toContain(jobId1);
        expect(result).toContain(jobId2);
      },
    );
  });

  describe('getComments', () => {
    testWithFixtures(
      'should return comments for single job when job not in job_creations',
      async ({ commentOps, pgQuery, orgId, userId }) => {
        const singleJobId = uuidv1();

        // Add a comment directly to a job not in job_creations
        await pgQuery
          .insertInto('manual_review_tool.job_comments')
          .values({
            id: uuidv1(),
            org_id: orgId,
            job_id: singleJobId,
            comment_text: 'Test comment',
            author_id: userId,
            created_at: new Date(),
          })
          .execute();

        const result = await commentOps.getComments({ orgId, jobId: singleJobId });

        expect(result).toHaveLength(1);
        expect(result[0].commentText).toBe('Test comment');
      },
    );

    testWithFixtures(
      'should return comments for all related jobs when job found in job_creations',
      async ({ commentOps, pgQuery, orgId, userId, jobId1, jobId2 }) => {
        // Add comments to both related jobs
        await pgQuery
          .insertInto('manual_review_tool.job_comments')
          .values([
            {
              id: uuidv1(),
              org_id: orgId,
              job_id: jobId1,
              comment_text: 'Comment from first queue',
              author_id: userId,
              created_at: new Date('2023-01-01T10:00:00Z'),
            },
            {
              id: uuidv1(),
              org_id: orgId,
              job_id: jobId2,
              comment_text: 'Comment from second queue',
              author_id: userId,
              created_at: new Date('2023-01-02T10:00:00Z'),
            },
          ])
          .execute();

        const result = await commentOps.getComments({ orgId, jobId: jobId1 });

        expect(result).toHaveLength(2);
        expect(result[0].commentText).toBe('Comment from first queue');
        expect(result[1].commentText).toBe('Comment from second queue');
      },
    );

    testWithFixtures(
      'should return empty array when no comments found',
      async ({ commentOps, orgId, jobId1 }) => {
        const result = await commentOps.getComments({ orgId, jobId: jobId1 });

        expect(result).toEqual([]);
      },
    );

    testWithFixtures(
      'should order comments by created_at ascending',
      async ({ commentOps, pgQuery, orgId, userId, jobId1 }) => {
        // Add comments with specific timestamps
        await pgQuery
          .insertInto('manual_review_tool.job_comments')
          .values([
            {
              id: uuidv1(),
              org_id: orgId,
              job_id: jobId1,
              comment_text: 'Third comment',
              author_id: userId,
              created_at: new Date('2023-01-03T10:00:00Z'),
            },
            {
              id: uuidv1(),
              org_id: orgId,
              job_id: jobId1,
              comment_text: 'First comment',
              author_id: userId,
              created_at: new Date('2023-01-01T10:00:00Z'),
            },
            {
              id: uuidv1(),
              org_id: orgId,
              job_id: jobId1,
              comment_text: 'Second comment',
              author_id: userId,
              created_at: new Date('2023-01-02T10:00:00Z'),
            },
          ])
          .execute();

        const result = await commentOps.getComments({ orgId, jobId: jobId1 });

        expect(result).toHaveLength(3);
        expect(result[0].commentText).toBe('First comment');
        expect(result[1].commentText).toBe('Second comment');
        expect(result[2].commentText).toBe('Third comment');
      },
    );
  });

  describe('getCommentCount', () => {
    testWithFixtures(
      'should return 0 when no comments found',
      async ({ commentOps, orgId, jobId1 }) => {
        const result = await commentOps.getCommentCount({ orgId, jobId: jobId1 });

        expect(result).toBe(0);
      },
    );

    testWithFixtures(
      'should return correct count for cross-queue comments',
      async ({ commentOps, pgQuery, orgId, userId, jobId1, jobId2 }) => {
        // Add comments to both related jobs
        await pgQuery
          .insertInto('manual_review_tool.job_comments')
          .values([
            {
              id: uuidv1(),
              org_id: orgId,
              job_id: jobId1,
              comment_text: 'Comment 1',
              author_id: userId,
              created_at: new Date(),
            },
            {
              id: uuidv1(),
              org_id: orgId,
              job_id: jobId1,
              comment_text: 'Comment 2',
              author_id: userId,
              created_at: new Date(),
            },
            {
              id: uuidv1(),
              org_id: orgId,
              job_id: jobId2,
              comment_text: 'Comment 3',
              author_id: userId,
              created_at: new Date(),
            },
          ])
          .execute();

        const result = await commentOps.getCommentCount({ orgId, jobId: jobId1 });

        expect(result).toBe(3);
      },
    );
  });

  describe('addComment', () => {
    testWithFixtures(
      'should add comment successfully',
      async ({ commentOps, orgId, userId, jobId1 }) => {
        const commentText = 'New test comment';

        const result = await commentOps.addComment({
          orgId,
          jobId: jobId1,
          commentText,
          authorId: userId,
        });

        expect(result.commentText).toBe(commentText);
        expect(result.authorId).toBe(userId);
        expect(result.id).toBeDefined();
        expect(result.createdAt).toBeInstanceOf(Date);

        // Verify comment was actually inserted
        const comments = await commentOps.getComments({ orgId, jobId: jobId1 });
        expect(comments).toHaveLength(1);
        expect(comments[0].id).toBe(result.id);
      },
    );
  });

  describe('deleteComment', () => {
    testWithFixtures(
      'should delete comment successfully',
      async ({ commentOps, orgId, userId, jobId1 }) => {
        // Add a comment first
        const comment = await commentOps.addComment({
          orgId,
          jobId: jobId1,
          commentText: 'Comment to delete',
          authorId: userId,
        });

        const result = await commentOps.deleteComment({
          orgId,
          jobId: jobId1,
          userId,
          commentId: comment.id,
        });

        expect(result).toBe(true);

        // Verify comment was actually deleted
        const comments = await commentOps.getComments({ orgId, jobId: jobId1 });
        expect(comments).toHaveLength(0);
      },
    );

    testWithFixtures(
      'should return false when comment not found',
      async ({ commentOps, orgId, userId, jobId1 }) => {
        const nonExistentCommentId = uuidv1();

        const result = await commentOps.deleteComment({
          orgId,
          jobId: jobId1,
          userId,
          commentId: nonExistentCommentId,
        });

        expect(result).toBe(false);
      },
    );

    testWithFixtures(
      'should return false when comment not owned by user',
      async ({ commentOps, orgId, userId, jobId1 }) => {
        const otherUserId = uuidv1();

        // Add a comment with a different user
        const comment = await commentOps.addComment({
          orgId,
          jobId: jobId1,
          commentText: 'Comment by other user',
          authorId: otherUserId,
        });

        // Try to delete with wrong user
        const result = await commentOps.deleteComment({
          orgId,
          jobId: jobId1,
          userId, // Different user
          commentId: comment.id,
        });

        expect(result).toBe(false);

        // Verify comment was not deleted
        const comments = await commentOps.getComments({ orgId, jobId: jobId1 });
        expect(comments).toHaveLength(1);
      },
    );
  });

  describe('Cross-queue functionality integration', () => {
    testWithFixtures(
      'should show comments from previous queue after job moves',
      async ({ commentOps, orgId, userId, jobId1, jobId2 }) => {
        // Add comment to first job
        await commentOps.addComment({
          orgId,
          jobId: jobId1,
          commentText: 'Comment from original queue',
          authorId: userId,
        });

        // Add comment to second job (simulating a move to a new queue)
        await commentOps.addComment({
          orgId,
          jobId: jobId2,
          commentText: 'Comment from new queue',
          authorId: userId,
        });

        // When querying from the second job, should see both comments
        const result = await commentOps.getComments({ orgId, jobId: jobId2 });

        expect(result).toHaveLength(2);
        const commentTexts = result.map((c) => c.commentText);
        expect(commentTexts).toContain('Comment from original queue');
        expect(commentTexts).toContain('Comment from new queue');
      },
    );

    testWithFixtures(
      'should count comments from all queues',
      async ({ commentOps, orgId, userId, jobId1, jobId2 }) => {
        // Add comments to both jobs
        await commentOps.addComment({
          orgId,
          jobId: jobId1,
          commentText: 'Comment 1',
          authorId: userId,
        });
        await commentOps.addComment({
          orgId,
          jobId: jobId2,
          commentText: 'Comment 2',
          authorId: userId,
        });
        await commentOps.addComment({
          orgId,
          jobId: jobId2,
          commentText: 'Comment 3',
          authorId: userId,
        });

        const result = await commentOps.getCommentCount({ orgId, jobId: jobId2 });

        expect(result).toBe(3);
      },
    );
  });
});
