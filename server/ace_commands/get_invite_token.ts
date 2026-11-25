/* eslint-disable no-console */
import { BaseCommand } from '@adonisjs/core/ace';
import type { CommandOptions } from '@adonisjs/core/types/ace';

/**
 * `node ace coop:get-invite --email user@example.com` prints the signup URL
 * for a user's most recent invite. Same output as `bin/get-invite-token.ts`.
 */
export default class GetInviteToken extends BaseCommand {
  static override commandName = 'coop:get-invite';
  static override description = 'Print the signup URL for an invited user';
  // Booted in run(), so --help needs no environment (booting builds the
  // service graph, which reads UI_URL).
  static override options: CommandOptions = { startApp: false };

  static {
    this.defineFlag('email', {
      type: 'string',
      // Checked in run(): ace exits 1 on a missing required flag even when
      // asked for --help.
      required: false,
      description: 'Email address of the invited user',
    });
  }

  declare email?: string;

  override async run() {
    if (!this.email) {
      this.logger.error('Missing required option "email"');
      this.exitCode = 1;
      return;
    }
    await this.app.boot();
    const db = await this.app.container.make('KyselyPg');
    const closeShared = await this.app.container.make(
      'closeSharedResourcesForShutdown',
    );
    try {
      const invite = await db
        .selectFrom('public.invite_user_tokens')
        .selectAll()
        .where('email', '=', this.email)
        .orderBy('created_at', 'desc')
        .limit(1)
        .executeTakeFirst();

      if (invite === undefined) {
        console.log(`\n❌ No invite token found for email: ${this.email}\n`);
        this.exitCode = 1;
        return;
      }

      const { uiUrl } = await this.app.container.make('ConfigService');
      console.log('\n✅ Invite Token Found!\n');
      console.log(`Email:         ${invite.email}`);
      console.log(`Role:          ${invite.role}`);
      console.log(`Organization:  ${invite.org_id}`);
      console.log(`Created At:    ${invite.created_at}`);
      console.log(`\n${uiUrl}/signup/${invite.token}\n`);
    } finally {
      await closeShared();
    }
  }
}
