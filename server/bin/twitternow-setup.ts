#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Creates or updates the twitter.now item types needed by the twitter.now
 * demo connector. Run this once after `npm run create-org` to register the
 * item types, then pass the printed item type IDs to `npm run twitternow:demo`.
 *
 * To update existing item types (e.g. to add new fields to an existing org),
 * pass the existing type IDs with --post-type-id, --user-type-id, and
 * --thread-type-id.
 *
 * Usage:
 *   cd server && npm run twitternow:setup -- --org-id <orgId>
 *   cd server && npm run twitternow:setup -- --org-id <orgId> --post-type-id <id> --user-type-id <id> --thread-type-id <id>
 */
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import getBottle from '../iocContainer/index.js';

const argv = await yargs(hideBin(process.argv))
  .options({
    'org-id': {
      type: 'string',
      demandOption: true,
      description: 'Organization ID (from npm run create-org)',
    },
    'post-type-id': {
      type: 'string',
      description:
        'Existing twitter.now Post item type ID — triggers update mode',
    },
    'user-type-id': {
      type: 'string',
      description:
        'Existing twitter.now User item type ID — triggers update mode',
    },
    'thread-type-id': {
      type: 'string',
      description:
        'Existing twitter.now Thread item type ID — triggers update mode',
    },
  })
  .help()
  .parse();

const orgId = argv['org-id'];
const existingPostTypeId = argv['post-type-id'];
const existingUserTypeId = argv['user-type-id'];
const existingThreadTypeId = argv['thread-type-id'];
const updateMode = Boolean(
  existingPostTypeId && existingUserTypeId && existingThreadTypeId,
);

const USER_SCHEMA = [
  { name: 'handle', type: 'STRING', required: true, container: null },
  { name: 'displayName', type: 'STRING', required: false, container: null },
  { name: 'avatar', type: 'IMAGE', required: false, container: null },
  { name: 'bio', type: 'STRING', required: false, container: null },
  { name: 'location', type: 'STRING', required: false, container: null },
  { name: 'website', type: 'URL', required: false, container: null },
  { name: 'trustScore', type: 'NUMBER', required: false, container: null },
  {
    name: 'badges',
    type: 'ARRAY',
    required: false,
    container: {
      containerType: 'ARRAY',
      keyScalarType: null,
      valueScalarType: 'STRING',
    },
  },
  {
    name: 'foundingMemberNumber',
    type: 'NUMBER',
    required: false,
    container: null,
  },
] as const;

const USER_ROLES = {
  displayName: 'displayName',
  profileIcon: 'avatar',
} as const;

// A conversation, keyed by its top-most (root) post's id — every post
// belongs to exactly one thread; only replies additionally have a `parent`.
const THREAD_SCHEMA = [
  { name: 'url', type: 'URL', required: false, container: null },
  { name: 'createdAt', type: 'DATETIME', required: false, container: null },
] as const;

const THREAD_ROLES = {
  createdAt: 'createdAt',
} as const;

const POST_SCHEMA = [
  { name: 'text', type: 'STRING', required: true, container: null },
  { name: 'url', type: 'URL', required: true, container: null },
  { name: 'creator', type: 'RELATED_ITEM', required: false, container: null },
  { name: 'thread', type: 'RELATED_ITEM', required: false, container: null },
  { name: 'parent', type: 'RELATED_ITEM', required: false, container: null },
  { name: 'handle', type: 'STRING', required: false, container: null },
  { name: 'displayName', type: 'STRING', required: false, container: null },
  { name: 'createdAt', type: 'DATETIME', required: false, container: null },
  { name: 'category', type: 'STRING', required: false, container: null },
  { name: 'likes', type: 'NUMBER', required: false, container: null },
  { name: 'reposts', type: 'NUMBER', required: false, container: null },
  { name: 'replyCount', type: 'NUMBER', required: false, container: null },
  {
    name: 'hashtags',
    type: 'ARRAY',
    required: false,
    container: {
      containerType: 'ARRAY',
      keyScalarType: null,
      valueScalarType: 'STRING',
    },
  },
  {
    name: 'mentions',
    type: 'ARRAY',
    required: false,
    container: {
      containerType: 'ARRAY',
      keyScalarType: null,
      valueScalarType: 'STRING',
    },
  },
  { name: 'isRepost', type: 'BOOLEAN', required: false, container: null },
  {
    name: 'repostedByHandle',
    type: 'STRING',
    required: false,
    container: null,
  },
  {
    name: 'replyToUsername',
    type: 'STRING',
    required: false,
    container: null,
  },
  {
    name: 'images',
    type: 'ARRAY',
    required: false,
    container: {
      containerType: 'ARRAY',
      keyScalarType: null,
      valueScalarType: 'IMAGE',
    },
  },
  { name: 'video', type: 'VIDEO', required: false, container: null },
] as const;

const POST_ROLES = {
  displayName: 'text',
  createdAt: 'createdAt',
  creatorId: 'creator',
  // Coop requires threadId whenever parentId is set (and createdAt whenever
  // either is set) — see validate_content_parent_field_dependencies in the
  // schema.
  threadId: 'thread',
  parentId: 'parent',
} as const;

async function setup() {
  const bottle = await getBottle();
  const { ModerationConfigService, closeSharedResourcesForShutdown } =
    bottle.container;

  try {
    let userTypeId: string;
    let threadTypeId: string;
    let postTypeId: string;

    if (updateMode) {
      console.log('\nUpdating existing twitter.now item types…\n');

      const userType = await ModerationConfigService.updateUserType(orgId, {
        id: existingUserTypeId as string,
        schema: USER_SCHEMA,
        schemaFieldRoles: USER_ROLES,
      });
      userTypeId = userType.id;

      const threadType = await ModerationConfigService.updateThreadType(orgId, {
        id: existingThreadTypeId as string,
        schema: THREAD_SCHEMA,
        schemaFieldRoles: THREAD_ROLES,
      });
      threadTypeId = threadType.id;

      const postType = await ModerationConfigService.updateContentType(orgId, {
        id: existingPostTypeId as string,
        schema: POST_SCHEMA,
        schemaFieldRoles: POST_ROLES,
      });
      postTypeId = postType.id;

      console.log('✅ twitter.now item types updated successfully!\n');
    } else {
      console.log('\nCreating twitter.now item types…\n');

      const userType = await ModerationConfigService.createUserType(orgId, {
        name: 'twitter.now User',
        description: 'twitter.now account.',
        schema: USER_SCHEMA,
        schemaFieldRoles: USER_ROLES,
      });
      userTypeId = userType.id;

      const threadType = await ModerationConfigService.createThreadType(orgId, {
        name: 'twitter.now Thread',
        description: 'A twitter.now conversation, keyed by its root post id.',
        schema: THREAD_SCHEMA,
        schemaFieldRoles: THREAD_ROLES,
      });
      threadTypeId = threadType.id;

      const postType = await ModerationConfigService.createContentType(orgId, {
        name: 'twitter.now Post',
        description: 'Post ingested from the public twitter.now API.',
        schema: POST_SCHEMA,
        schemaFieldRoles: POST_ROLES,
      });
      postTypeId = postType.id;

      console.log('✅ twitter.now item types created successfully!\n');
    }

    console.log('═'.repeat(60));
    console.log('Copy these IDs for use with the demo connector:');
    console.log('═'.repeat(60));
    console.log(`twitter.now User item type ID:    ${userTypeId}`);
    console.log(`twitter.now Thread item type ID:  ${threadTypeId}`);
    console.log(`twitter.now Post item type ID:    ${postTypeId}`);
    console.log('═'.repeat(60));
    console.log('\nStart the demo connector:');
    console.log(
      `  npm run twitternow:demo -- --api-key <key> --post-type-id ${postTypeId} --user-type-id ${userTypeId} --thread-type-id ${threadTypeId}\n`,
    );

    await closeSharedResourcesForShutdown();
    process.exit(0);
  } catch (error: unknown) {
    console.error('\n❌ Error setting up twitter.now item types:\n');
    console.error(error);
    try {
      await closeSharedResourcesForShutdown();
    } catch (shutdownError) {
      console.error('Error during shutdown:', shutdownError);
    }
    process.exit(1);
  }
}

setup().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
