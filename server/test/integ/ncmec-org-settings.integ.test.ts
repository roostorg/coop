/**
 * Integration test: the reported-media hash bank setting is scoped to the
 * caller's org.
 *
 * Goes through the real GraphQL API so the org check is exercised against
 * Postgres instead of a mocked HMAHashBankService.
 *
 * Run with: docker compose run --rm test
 * Requires: `npm run up && npm run db:update`
 */
import { uid } from 'uid';

import { HashBankService } from '../../services/hmaService/index.js';
import { jsonStringify } from '../../utils/encoding.js';
import createOrg from '../fixtureHelpers/createOrg.js';
import createUser from '../fixtureHelpers/createUser.js';
import {
  makeIntegrationServer,
  type IntegrationServer,
} from './setupIntegrationServer.js';

const ADMIN_PASSWORD = 'integ-admin-password-1';

describe('updateNcmecOrgSettings reported media hash bank (integration)', () => {
  const orgId = uid();
  const otherOrgId = uid();
  let harness: IntegrationServer | undefined;
  let ownBankId: number;
  let otherOrgBankId: number;
  let orgCleanup: (() => Promise<unknown>) | undefined;
  let otherOrgCleanup: (() => Promise<unknown>) | undefined;
  let adminCleanup: (() => Promise<unknown>) | undefined;

  beforeAll(async () => {
    harness = await makeIntegrationServer();

    const orgDeps = {
      KyselyPg: harness.deps.KyselyPg,
      ModerationConfigService: harness.deps.ModerationConfigService,
      ApiKeyService: harness.deps.ApiKeyService,
    };
    orgCleanup = (await createOrg(orgDeps, orgId)).cleanup;
    otherOrgCleanup = (await createOrg(orgDeps, otherOrgId)).cleanup;

    const adminFixture = await createUser(harness.deps.KyselyPg, orgId, {
      password: ADMIN_PASSWORD,
      loginMethods: ['password'],
      approvedByAdmin: true,
    });
    adminCleanup = adminFixture.cleanup;

    const hashBanks = new HashBankService(harness.deps.KyselyPg);
    ownBankId = (
      await hashBanks.create({
        name: 'Reported CSAM',
        hma_name: `COOP_TEST_${uid()}`,
        enabled_ratio: 1,
        org_id: orgId,
      })
    ).id;
    otherOrgBankId = (
      await hashBanks.create({
        name: 'Someone else reported CSAM',
        hma_name: `COOP_TEST_${uid()}`,
        enabled_ratio: 1,
        org_id: otherOrgId,
      })
    ).id;

    const loginRes = await harness.request.post('/api/v1/graphql').send({
      query: `mutation {
        login(input: { email: ${jsonStringify(adminFixture.user.email)}, password: ${jsonStringify(ADMIN_PASSWORD)} }) {
          __typename
        }
      }`,
    });
    expect(loginRes.body?.data?.login?.__typename).toBe('LoginSuccessResponse');
  }, 60_000);

  afterAll(async () => {
    try {
      await adminCleanup?.();
      await orgCleanup?.();
      await otherOrgCleanup?.();
    } finally {
      await harness?.shutdown();
    }
  }, 30_000);

  const saveBank = async (bankId: number) => {
    if (!harness) throw new Error('harness was not initialized');
    return harness.request.post('/api/v1/graphql').send({
      query: `mutation {
        updateNcmecOrgSettings(input: {
          username: "espuser"
          password: "esppass"
          contactEmail: "reporter@example.com"
          reportedMediaHashBankId: ${bankId}
        }) {
          success
        }
      }`,
    });
  };

  const readBankId = async () => {
    if (!harness) throw new Error('harness was not initialized');
    const res = await harness.request.post('/api/v1/graphql').send({
      query: `query { ncmecOrgSettings { reportedMediaHashBankId } }`,
    });
    return res.body?.data?.ncmecOrgSettings?.reportedMediaHashBankId ?? null;
  };

  test('refuses a bank that belongs to another org and saves nothing', async () => {
    const res = await saveBank(otherOrgBankId);

    expect(res.body?.errors?.[0]?.message).toBe(
      'Selected hash bank was not found.',
    );
    expect(await readBankId()).toBeNull();
  });

  test('saves a bank that belongs to the org', async () => {
    const res = await saveBank(ownBankId);

    expect(res.body?.errors).toBeUndefined();
    expect(res.body?.data?.updateNcmecOrgSettings?.success).toBe(true);
    expect(await readBankId()).toBe(ownBankId);
  });
});
