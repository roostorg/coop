#!/usr/bin/env node
/**
 * Entry point for AdonisJS' ace CLI: `node bin/console.js <command>`
 * (`node transpiled/bin/console.js` from a checkout, after `pnpm run build`).
 */
import { createCoopApp } from '../adonis/createApp.js';

const { ignitor } = await createCoopApp('console');
await ignitor
  .ace()
  .handle(process.argv.splice(2))
  .catch(async (error: unknown) => {
    process.exitCode = 1;
    const { prettyPrintError } = await import('@adonisjs/core');
    await prettyPrintError(error);
  });
