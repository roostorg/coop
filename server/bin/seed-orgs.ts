#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Create several demo orgs for the TrustCon workshop, each with a small team of
 * users spread across roles, and write the login/API details to a credentials
 * file for facilitators to hand out. Optionally runs the CCF seed per org so
 * each org arrives with the demo policies, queues, rules, and actions.
 *
 * Usage (from repo root):
 *   npm run seed-orgs -- --orgs 6 --users-per-org 5 --password trustcon \
 *     --relay-url http://localhost:8090
 *
 * Credentials are written to ./workshop-credentials.md (+ .csv), which is
 * gitignored. Passwords are demo-only; do not reuse real ones.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { uid } from 'uid';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { kyselyOrgInsert } from '../graphql/datasources/orgKyselyPersistence.js';
import { kyselyUserInsert } from '../graphql/datasources/userKyselyPersistence.js';
import getBottle from '../iocContainer/index.js';
import {
  hashPassword,
  UserRole,
} from '../services/userManagementService/index.js';

// A realistic T&S team, in the order users are assigned. ADMIN is always first
// because the CCF seed attributes its config to the org's ADMIN user.
const ROLE_ORDER: UserRole[] = [
  UserRole.ADMIN,
  UserRole.RULES_MANAGER,
  UserRole.MODERATOR_MANAGER,
  UserRole.MODERATOR,
  UserRole.ANALYST,
];

const argv = await yargs(hideBin(process.argv))
  .options({
    orgs: {
      type: 'number',
      default: 6,
      description: 'How many orgs to create',
    },
    'users-per-org': {
      type: 'number',
      default: 5,
      description: `Users per org (1-${ROLE_ORDER.length}), assigned across roles`,
    },
    password: {
      type: 'string',
      default: 'trustcon',
      description: 'Shared password for every demo user',
    },
    prefix: {
      type: 'string',
      default: 'TrustCon Team',
      description: 'Org display-name prefix (org N is "<prefix> N")',
    },
    domain: {
      type: 'string',
      default: 'trustcon.local',
      description: 'Email domain for generated users',
    },
    'relay-url': {
      type: 'string',
      description: 'Passed through to the CCF seed for Bleep/Bloop actions',
    },
    seed: {
      type: 'boolean',
      default: true,
      description: 'Run the CCF seed (seed-trustcon) for each org',
    },
    out: {
      type: 'string',
      default: 'workshop-credentials.md',
      description: 'Credentials output file (a .csv is written alongside)',
    },
  })
  .help()
  .parse();

type SeededUser = { email: string; role: UserRole; password: string };
type SeededOrg = {
  index: number;
  name: string;
  orgId: string;
  apiKey: string;
  adminUserId: string;
  users: SeededUser[];
};

function roleSlug(role: string): string {
  return role.toLowerCase().replace(/_/g, '-');
}

async function main() {
  const usersPerOrg = Math.max(
    1,
    Math.min(argv['users-per-org'], ROLE_ORDER.length),
  );
  if (usersPerOrg !== argv['users-per-org']) {
    console.warn(
      `\n⚠️  users-per-org clamped to ${usersPerOrg} (roles available: ${ROLE_ORDER.length}).`,
    );
  }

  const bottle = await getBottle();
  const container = bottle.container;
  const seeded: SeededOrg[] = [];

  try {
    for (let n = 1; n <= argv.orgs; n++) {
      const orgId = uid();
      const name = `${argv.prefix} ${n}`;
      const website = `https://team${n}.${argv.domain}`;
      const orgEmail = `admin.team${n}@${argv.domain}`;

      const org = await kyselyOrgInsert({
        db: container.KyselyPg,
        id: orgId,
        email: orgEmail,
        name,
        websiteUrl: website,
      });

      await container.SigningKeyPairService.createAndStoreSigningKeys(orgId);
      const { apiKey } = await container.ApiKeyService.createApiKey(
        orgId,
        'Main API Key',
        'Primary API key for organization',
        null,
      );

      await Promise.all([
        container.ModerationConfigService.createDefaultUserType(orgId),
        container.ModerationConfigService.upsertBuiltInActions(orgId),
        container.OrgCreationLogger.logOrgCreated(
          orgId,
          name,
          orgEmail,
          website,
        ),
        container.UserManagementService.upsertOrgDefaultUserInterfaceSettings({
          orgId,
        }),
        container.OrgSettingsService.upsertOrgDefaultSettings({ orgId }),
        container.ManualReviewToolService.upsertDefaultSettings({ orgId }),
      ]);

      const hashedPassword = await hashPassword(argv.password);
      const users: SeededUser[] = [];
      let adminUserId = '';

      for (const role of ROLE_ORDER.slice(0, usersPerOrg)) {
        const userId = uid();
        const email = `${roleSlug(role)}.team${n}@${argv.domain}`;
        await kyselyUserInsert({
          db: container.KyselyPg,
          id: userId,
          orgId,
          email,
          password: hashedPassword,
          firstName: argv.prefix.split(' ').pop() ?? 'Team',
          lastName: `${n} ${role}`,
          role,
          approvedByAdmin: true,
          loginMethods: ['password'],
        });
        if (role === UserRole.ADMIN) adminUserId = userId;
        users.push({ email, role, password: argv.password });
      }

      seeded.push({
        index: n,
        name,
        orgId: org.id,
        apiKey,
        adminUserId,
        users,
      });
      console.log(`✅ Created ${name} (${org.id}) with ${users.length} users`);
    }

    // Parent DB work is done; release pooled connections before spawning the
    // per-org CCF seed as independent child processes.
    await container.closeSharedResourcesForShutdown();

    writeCredentials(seeded);

    if (argv.seed) {
      for (const o of seeded) {
        const args = [
          'run',
          'seed-trustcon',
          '--',
          '--org-id',
          o.orgId,
          '--user-id',
          o.adminUserId,
        ];
        if (argv['relay-url']) args.push('--relay-url', argv['relay-url']);
        console.log(`\n▶️  Seeding CCF config for ${o.name} (${o.orgId})`);
        try {
          execFileSync('npm', args, { stdio: 'inherit' });
        } catch {
          console.error(
            `❌ CCF seed failed for ${o.name} (${o.orgId}); continuing. ` +
              `Re-run: npm run seed-trustcon -- --org-id ${o.orgId} --user-id ${o.adminUserId}`,
          );
        }
      }
    }

    console.log(
      `\n✅ Done. ${seeded.length} orgs, ${seeded.reduce((n, o) => n + o.users.length, 0)} users.` +
        `\n🔑 Credentials written to ${resolve(argv.out)} (and .csv). Do not commit.\n`,
    );
    process.exit(0);
  } catch (error: unknown) {
    console.error('\n❌ Error seeding orgs:\n', error);
    try {
      await container.closeSharedResourcesForShutdown();
    } catch (shutdownError) {
      console.error('Error during shutdown:', shutdownError);
    }
    process.exit(1);
  }
}

function writeCredentials(seeded: SeededOrg[]): void {
  const md: string[] = [
    '# TrustCon workshop: Coop login credentials',
    '',
    '**DO NOT COMMIT.** Demo credentials for the shared Coop Codespace.',
    '',
    `Client: http://localhost:3000 · Generated ${new Date().toISOString()}`,
    '',
  ];
  const csv: string[] = ['org,org_id,api_key,email,role,password'];

  for (const o of seeded) {
    md.push(`## ${o.name}`, '');
    md.push(`- Org ID: \`${o.orgId}\``);
    md.push(`- API key: \`${o.apiKey}\``, '');
    md.push('| Email | Role | Password |', '| --- | --- | --- |');
    for (const u of o.users) {
      md.push(`| ${u.email} | ${u.role} | ${u.password} |`);
      csv.push(
        [o.name, o.orgId, o.apiKey, u.email, u.role, u.password]
          .map((f) => `"${String(f).replace(/"/g, '""')}"`)
          .join(','),
      );
    }
    md.push('');
  }

  // eslint-disable-next-line security/detect-non-literal-fs-filename -- path is an operator-supplied CLI arg
  writeFileSync(argv.out, md.join('\n'));
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- path is an operator-supplied CLI arg
  writeFileSync(argv.out.replace(/\.md$/, '.csv'), csv.join('\n'));
}

main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
