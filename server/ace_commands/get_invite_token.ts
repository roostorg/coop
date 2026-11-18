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
  static override options: CommandOptions = { startApp: true };

  static {
    this.defineFlag('email', {
      type: 'string',
      required: true,
      description: 'Email address of the invited user',
    });
  }

  declare email: string;

  override async run() {
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

      const uiUrl = process.env.UI_URL ?? 'http://localhost:3000';
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
