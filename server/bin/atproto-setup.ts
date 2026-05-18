#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Creates the AT Protocol (Bluesky) item types needed by the atproto demo
 * firehose connector. Run this once after `npm run create-org` to register
 * the item types, then pass the printed item type IDs to `npm run atproto:demo`.
 *
 * Usage:
 *   cd server && npm run atproto:setup -- --org-id <orgId>
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
  })
  .help()
  .parse();

const orgId = argv['org-id'];

async function setup() {
  const bottle = await getBottle();
  const { ModerationConfigService, closeSharedResourcesForShutdown } =
    bottle.container;

  try {
    // atproto User item type — represents the author of a post
    const userType = await ModerationConfigService.createUserType(orgId, {
      name: 'atproto User',
      description: 'AT Protocol/Bluesky account.',
      schema: [
        { name: 'handle', type: 'STRING', required: true, container: null },
        { name: 'displayName', type: 'STRING', required: false, container: null },
        { name: 'description', type: 'STRING', required: false, container: null },
        { name: 'avatar', type: 'IMAGE', required: false, container: null },
        { name: 'indexedAt', type: 'DATETIME', required: false, container: null },
      ],
      schemaFieldRoles: {
        displayName: 'handle',
        profileIcon: 'avatar',
        createdAt: 'indexedAt',
      },
    });

    // atproto Post item type — represents a post from the firehose
    const postType = await ModerationConfigService.createContentType(orgId, {
      name: 'atproto Post',
      description: 'Post ingested from the AT Protocol Jetstream firehose.',
      schema: [
        { name: 'text', type: 'STRING', required: true, container: null },
        { name: 'url', type: 'URL', required: true, container: null },
        { name: 'did', type: 'STRING', required: false, container: null },
        { name: 'handle', type: 'STRING', required: false, container: null },
        { name: 'displayName', type: 'STRING', required: false, container: null },
        { name: 'langs', type: 'STRING', required: false, container: null },
        { name: 'createdAt', type: 'DATETIME', required: false, container: null },
        { name: 'replyTo', type: 'STRING', required: false, container: null },
      ],
      schemaFieldRoles: {
        displayName: 'text',
        createdAt: 'createdAt',
      },
    });

    console.log('\n✅ AT Protocol item types created successfully!\n');
    console.log('═'.repeat(60));
    console.log('Copy these IDs for use with the firehose connector:');
    console.log('═'.repeat(60));
    console.log(`atproto User item type ID:  ${userType.id}`);
    console.log(`atproto Post item type ID:  ${postType.id}`);
    console.log('═'.repeat(60));
    console.log('\nStart the firehose connector:');
    console.log(
      `  npm run atproto:demo -- --api-key <key> --post-type-id ${postType.id}\n`,
    );

    await closeSharedResourcesForShutdown();
    process.exit(0);
  } catch (error: unknown) {
    console.error('\n❌ Error creating AT Protocol item types:\n');
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
