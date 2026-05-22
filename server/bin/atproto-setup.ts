#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Creates or updates the AT Protocol item types needed by the atproto demo
 * firehose connector. Run this once after `npm run create-org` to register
 * the item types, then pass the printed item type IDs to `npm run atproto:demo`.
 *
 * To update existing item types (e.g. to add new fields to an existing org),
 * pass the existing type IDs with --post-type-id and --user-type-id.
 *
 * Usage:
 *   cd server && npm run atproto:setup -- --org-id <orgId>
 *   cd server && npm run atproto:setup -- --org-id <orgId> --post-type-id <id> --user-type-id <id>
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
      description: 'Existing atproto Post item type ID — triggers update mode',
    },
    'user-type-id': {
      type: 'string',
      description: 'Existing atproto User item type ID — triggers update mode',
    },
  })
  .help()
  .parse();

const orgId = argv['org-id'];
const existingPostTypeId = argv['post-type-id'];
const existingUserTypeId = argv['user-type-id'];
const updateMode = Boolean(existingPostTypeId && existingUserTypeId);

const USER_SCHEMA = [
  { name: 'handle', type: 'STRING', required: true, container: null },
  { name: 'displayName', type: 'STRING', required: false, container: null },
  { name: 'description', type: 'STRING', required: false, container: null },
  { name: 'avatar', type: 'IMAGE', required: false, container: null },
  { name: 'indexedAt', type: 'DATETIME', required: false, container: null },
] as const;

const USER_ROLES = {
  displayName: 'handle',
  profileIcon: 'avatar',
  createdAt: 'indexedAt',
} as const;

const POST_SCHEMA = [
  { name: 'text', type: 'STRING', required: true, container: null },
  { name: 'url', type: 'URL', required: true, container: null },
  { name: 'did', type: 'STRING', required: false, container: null },
  { name: 'handle', type: 'STRING', required: false, container: null },
  { name: 'displayName', type: 'STRING', required: false, container: null },
  { name: 'langs', type: 'STRING', required: false, container: null },
  { name: 'createdAt', type: 'DATETIME', required: false, container: null },
  { name: 'replyTo', type: 'STRING', required: false, container: null },
  { name: 'embedType', type: 'STRING', required: false, container: null },
  { name: 'embedUrl', type: 'URL', required: false, container: null },
  { name: 'embedTitle', type: 'STRING', required: false, container: null },
  { name: 'embedDescription', type: 'STRING', required: false, container: null },
  { name: 'embedThumb', type: 'URL', required: false, container: null },
] as const;

const POST_ROLES = {
  displayName: 'text',
  createdAt: 'createdAt',
} as const;

async function setup() {
  const bottle = await getBottle();
  const { ModerationConfigService, closeSharedResourcesForShutdown } =
    bottle.container;

  try {
    let userTypeId: string;
    let postTypeId: string;

    if (updateMode) {
      console.log('\nUpdating existing AT Protocol item types…\n');

      const userType = await ModerationConfigService.updateUserType(orgId, {
        id: existingUserTypeId as string,
        schema: USER_SCHEMA,
        schemaFieldRoles: USER_ROLES,
      });
      userTypeId = userType.id;

      const postType = await ModerationConfigService.updateContentType(orgId, {
        id: existingPostTypeId as string,
        schema: POST_SCHEMA,
        schemaFieldRoles: POST_ROLES,
      });
      postTypeId = postType.id;

      console.log('✅ AT Protocol item types updated successfully!\n');
    } else {
      console.log('\nCreating AT Protocol item types…\n');

      const userType = await ModerationConfigService.createUserType(orgId, {
        name: 'atproto User',
        description: 'AT Protocol account.',
        schema: USER_SCHEMA,
        schemaFieldRoles: USER_ROLES,
      });
      userTypeId = userType.id;

      const postType = await ModerationConfigService.createContentType(orgId, {
        name: 'atproto Post',
        description: 'Post ingested from the AT Protocol Jetstream firehose.',
        schema: POST_SCHEMA,
        schemaFieldRoles: POST_ROLES,
      });
      postTypeId = postType.id;

      console.log('✅ AT Protocol item types created successfully!\n');
    }

    console.log('═'.repeat(60));
    console.log('Copy these IDs for use with the firehose connector:');
    console.log('═'.repeat(60));
    console.log(`atproto User item type ID:  ${userTypeId}`);
    console.log(`atproto Post item type ID:  ${postTypeId}`);
    console.log('═'.repeat(60));
    console.log('\nStart the firehose connector:');
    console.log(
      `  npm run atproto:demo -- --api-key <key> --post-type-id ${postTypeId} --user-type-id ${userTypeId}\n`,
    );

    await closeSharedResourcesForShutdown();
    process.exit(0);
  } catch (error: unknown) {
    console.error('\n❌ Error setting up AT Protocol item types:\n');
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
