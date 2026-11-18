#!/usr/bin/env node
/**
 * Script to get invite token for a user
 *
 * Usage in the server image:
 *   node bin/get-invite-token.js --email "user@example.com"
 *
 * Forwards to the `coop:get-invite` ace command
 * (ace_commands/get_invite_token.ts).
 */
import { createCoopApp } from '../adonis/createApp.js';

const { ignitor } = await createCoopApp('console');
await ignitor.ace().handle(['coop:get-invite', ...process.argv.slice(2)]);
