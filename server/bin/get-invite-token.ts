#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Script to get invite token for a user
 * 
 * Usage:
 *   npm run get-invite -- --email "user@example.com"
 */

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import getBottle from '../iocContainer/index.js';

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
    const result = await container.KyselyPg
      .selectFrom('public.invite_user_tokens')
      .selectAll()
      .where('email', '=', argv.email)
      .orderBy('created_at', 'desc')
      .limit(1)
      .execute();

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
    console.log(`Organization:  ${invite.org_id}`);
    console.log(`Created At:    ${invite.created_at}`);
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

