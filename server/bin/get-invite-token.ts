#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Script to get invite token for a user
 *
 * Usage in the server image:
 *   node bin/get-invite-token.js --email "user@example.com"
 */
import { desc, eq } from 'drizzle-orm';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import getBottle from '../iocContainer/index.js';
import { schema } from '../storage/postgres/drizzle.js';

const argv = await yargs(hideBin(process.argv))
  .options({
    email: {
      type: 'string',
      demandOption: true,
      description: 'Email address of the invited user',
    },
  })
  .help()
  .parse();

async function getInviteToken() {
  const bottle = await getBottle();
  const container = bottle.container;

  try {
    const { inviteUserTokens } = schema;
    const result = await container.DrizzlePg.select()
      .from(inviteUserTokens)
      .where(eq(inviteUserTokens.email, argv.email))
      .orderBy(desc(inviteUserTokens.createdAt))
      .limit(1);

    if (result.length === 0) {
      console.log(`\n❌ No invite token found for email: ${argv.email}\n`);
      process.exit(1);
    }

    const invite = result[0];
    const uiUrl = process.env.UI_URL ?? 'http://localhost:3000';
    const signupUrl = `${uiUrl}/signup/${invite.token}`;

    console.log('\n✅ Invite Token Found!\n');
    console.log('═'.repeat(60));
    console.log('Invite Details:');
    console.log('═'.repeat(60));
    console.log(`Email:         ${invite.email}`);
    console.log(`Role:          ${invite.role}`);
    console.log(`Organization:  ${invite.orgId}`);
    console.log(`Created At:    ${invite.createdAt}`);
    console.log('\n' + '═'.repeat(60));
    console.log('🔗 Signup URL:');
    console.log('═'.repeat(60));
    console.log(`\n${signupUrl}\n`);
    console.log('Copy this URL and paste it in your browser to sign up.');
    console.log('═'.repeat(60) + '\n');

    await container.closeSharedResourcesForShutdown();
    process.exit(0);
  } catch (error: unknown) {
    console.error('\n❌ Error retrieving invite token:\n');
    console.error(error);

    try {
      await container.closeSharedResourcesForShutdown();
    } catch (shutdownError) {
      console.error('Error during shutdown:', shutdownError);
    }

    process.exit(1);
  }
}

getInviteToken().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
