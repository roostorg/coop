#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Script to create a new organization and admin user
 * 
 * Usage:
 *   npm run create-org -- \
 *     --name "My Org" \
 *     --email "admin@example.com" \
 *     --website "https://example.com" \
 *     --firstName "John" \
 *     --lastName "Doe" \
 *     --password "securePassword123"
 */

import { uid } from 'uid';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { kyselyOrgInsert } from '../graphql/datasources/orgKyselyPersistence.js';
import getBottle from '../iocContainer/index.js';
import { hashPassword } from '../services/userManagementService/index.js';

const argv = await yargs(hideBin(process.argv))
  .options({
    name: {
      type: 'string',
      demandOption: true,
      description: 'Organization name',
    },
    email: {
      type: 'string',
      demandOption: true,
      description: 'Admin user email',
    },
    website: {
      type: 'string',
      demandOption: true,
      description: 'Organization website URL',
      coerce: (value: string) => {
        if (!/^https?:\/\//i.test(value)) {
          return `https://${value}`;
        }
        return value;
      },
    },
    firstName: {
      type: 'string',
      demandOption: true,
      description: 'Admin user first name',
    },
    lastName: {
      type: 'string',
      demandOption: true,
      description: 'Admin user last name',
    },
    password: {
      type: 'string',
      demandOption: true,
      description: 'Admin user password',
    },
  })
  .help()
  .parse();

async function createOrgAndUser() {
  const bottle = await getBottle();
  const container = bottle.container;

  try {
    const orgId = uid();
    const userId = uid();

    // Create org first so FK-dependent tables can reference it
    const org = await kyselyOrgInsert({
      db: container.KyselyPg,
      id: orgId,
      email: argv.email,
      name: argv.name,
      websiteUrl: argv.website,
    });

    // Create signing keys and API key (both reference org via FK)
    await container.SigningKeyPairService.createAndStoreSigningKeys(orgId);

    const { apiKey: rawApiKey } =
      await container.ApiKeyService.createApiKey(
        orgId,
        'Main API Key',
        'Primary API key for organization',
        null,
      );

    // Initialize org settings
    await Promise.all([
      container.ModerationConfigService.createDefaultUserType(orgId),
      container.OrgCreationLogger.logOrgCreated(
        orgId,
        argv.name,
        argv.email,
        argv.website,
      ),
      container.UserManagementService.upsertOrgDefaultUserInterfaceSettings({
        orgId,
      }),
      container.OrgSettingsService.upsertOrgDefaultSettings({ orgId }),
      container.ManualReviewToolService.upsertDefaultSettings({ orgId }),
    ]);

    // Hash the password and create the admin user
    const hashedPassword = await hashPassword(argv.password);
    const user = await container.Sequelize.User.create({
      id: userId,
      email: argv.email,
      password: hashedPassword,
      firstName: argv.firstName,
      lastName: argv.lastName,
      role: 'ADMIN',
      approvedByAdmin: true,
      orgId,
      loginMethods: ['password'],
    });

    // Success! Print the details
    console.log('\n✅ Organization and admin user created successfully!\n');
    console.log('═'.repeat(60));
    console.log('Organization Details:');
    console.log('═'.repeat(60));
    console.log(`Organization ID:   ${org.id}`);
    console.log(`Organization Name: ${org.name}`);
    console.log(`Organization Email: ${org.email}`);
    console.log(`Website URL:       ${org.websiteUrl}`);
    console.log('\n' + '═'.repeat(60));
    console.log('Admin User Details:');
    console.log('═'.repeat(60));
    console.log(`User ID:           ${user.id}`);
    console.log(`Name:              ${user.firstName} ${user.lastName}`);
    console.log(`Email:             ${user.email}`);
    console.log(`Role:              ${user.role}`);
    console.log('\n' + '═'.repeat(60));
    console.log('🔑 API KEY (STORE THIS SECURELY!)');
    console.log('═'.repeat(60));
    console.log('\nNew API key generated successfully! Please copy and store it securely.\n');
    console.log(`API Key: ${rawApiKey}\n`);
    console.log('⚠️  This API key will not be shown again. Save it now!');
    console.log('═'.repeat(60) + '\n');

    // Close all database connections
    await container.closeSharedResourcesForShutdown();
    process.exit(0);
  } catch (error: unknown) {
    console.error('\n❌ Error creating organization and user:\n');
    console.error(error);
    
    // Try to close resources even on error
    try {
      await container.closeSharedResourcesForShutdown();
    } catch (shutdownError) {
      console.error('Error during shutdown:', shutdownError);
    }
    
    process.exit(1);
  }
}

createOrgAndUser().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});

