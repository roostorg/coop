/**
 * Exercises the standalone services ported to TypeORM directly against a
 * database built by the migrations, inside a rolled-back transaction.
 */
import crypto from 'node:crypto';
import { uid } from 'uid';

import { getPgConnectionParams } from '../../iocContainer/index.js';
import { makeApiKeyService } from '../../services/apiKeyService/index.js';
import { makeOrgSettingsService } from '../../services/orgSettingsService/index.js';
import { PostgresSigningKeyPairStorage } from '../../services/signingKeyPairService/index.js';
import { makeSSOService } from '../../services/SSOService/index.js';
import { createTransactionalTestDb } from '../../test/harness/transactionalPgPool.js';
import { jsonStringify } from '../../utils/encoding.js';
import makeRefreshJob from '../../workers_jobs/RefreshMRTDecisionsMaterializedViewJob.js';
import { TypeormHandle } from './dataSource.js';

describe('services ported to TypeORM (standalone)', () => {
  it('org settings, SSO, API keys, signing keys and the MRT decisions job round-trip', async () => {
    const tdb = createTransactionalTestDb(getPgConnectionParams());
    await tdb.begin();
    const handle = new TypeormHandle(tdb.pool);
    try {
      const ds = await handle.get();
      const orgId = uid();
      await ds.query(
        `INSERT INTO orgs (id, email, name, website_url, created_at, updated_at) VALUES ($1, $2, $1, 'x', now(), now())`,
        [orgId, `${orgId}@ex.com`],
      );
      const [{ id: roleId }] = await ds.query(
        `INSERT INTO roles (org_id, key, display_name) VALUES ($1, 'ADMIN', 'Admin') RETURNING id`,
        [orgId],
      );
      const userEmail = `${uid()}@ex.com`;
      await ds.query(
        `INSERT INTO users (id, email, first_name, last_name, created_at, updated_at, org_id, role_id, login_methods, password) VALUES ($1, $2, 'a', 'b', now(), now(), $3, $4, ARRAY['password']::login_method_enum[], 'x')`,
        [uid(), userEmail, orgId, roleId],
      );

      // org settings
      const settings = makeOrgSettingsService(handle);
      expect(await settings.hasAppealsEnabled(orgId)).toBe(false);
      expect(await settings.userStrikeTTLInDays(orgId)).toBe(90);
      await settings.upsertOrgDefaultSettings({ orgId });
      await settings.upsertOrgDefaultSettings({ orgId });
      expect(
        await settings.updateUserStrikeTTL({ orgId, ttlDays: 30 }),
      ).toEqual({ user_strike_ttl_days: 30 });
      expect(
        await settings.updateAppealSettings({
          orgId,
          callbackUrl: 'https://cb',
          callbackHeaders: { a: '1' },
          callbackBody: null,
        }),
      ).toEqual({
        appeal_callback_url: 'https://cb',
        appeal_callback_headers: { a: '1' },
        appeal_callback_body: null,
      });
      expect(await settings.getAppealSettings(orgId)).toEqual({
        appealCallbackUrl: 'https://cb',
        appealCallbackHeaders: { a: '1' },
        appealCallbackBody: null,
      });
      await settings.updateHasAppealsEnabled({ orgId, enabled: true });
      expect(await settings.hasAppealsEnabled(orgId)).toBe(true);
      await settings.updatePartialItemsSettings({
        orgId,
        endpoint: 'https://p',
        requestHeaders: { h: 'v' },
      });
      expect(await settings.partialItemsInfo(orgId)).toEqual({
        partialItemsEndpoint: 'https://p',
        partialItemsRequestHeaders: { h: 'v' },
      });
      await expect(
        settings.updateSamlEnabled({ orgId, enabled: true }),
      ).rejects.toThrow('Cannot enable SAML SSO');
      expect(
        await settings.updateSamlSettings({
          orgId,
          ssoUrl: 'https://sso',
          cert: 'c',
        }),
      ).toBe(true);
      await settings.updateSamlEnabled({ orgId, enabled: true });
      expect(await settings.getSamlSettings(orgId)).toEqual({
        saml_enabled: true,
        sso_url: 'https://sso',
        cert: 'c',
      });
      expect(await settings.getSamlSettings('missing')).toBeUndefined();
      await settings.close();

      // SSO
      const sso = new makeSSOService(handle);
      expect(await sso.getSSORedirectUrlForUserEmail(userEmail)).toBe(
        `/api/v1/saml/login/${orgId}`,
      );
      await expect(
        sso.getSSORedirectUrlForUserEmail('nobody@ex.com'),
      ).rejects.toThrow('no result');

      // API keys
      const keys = new makeApiKeyService(handle);
      const first = await keys.createApiKey(orgId, 'k1', null, null);
      expect(first.record).toMatchObject({
        orgId,
        name: 'k1',
        description: null,
        isActive: true,
        lastUsedAt: null,
        createdBy: null,
      });
      expect(first.record.createdAt).toBeInstanceOf(Date);
      const second = await keys.createApiKey(orgId, 'k2', 'd', null);
      expect(await keys.getActiveApiKeyForOrg(orgId)).toEqual(second.record);
      expect(await keys.validateApiKey(first.apiKey)).toBeNull();
      expect(await keys.validateApiKey(second.apiKey)).toBe(orgId);
      expect(await keys.getOrgIdFromActivatedKey(second.apiKey)).toBe(orgId);
      const all = await keys.getApiKeysForOrg(orgId);
      expect(all.map((k) => k.name).sort()).toEqual(['k1', 'k2']);
      expect(all.find((k) => k.name === 'k2')?.lastUsedAt).toBeInstanceOf(Date);
      expect(await keys.deactivateApiKey(second.record.id, orgId)).toBe(true);
      expect(await keys.deactivateApiKey(second.record.id, 'other')).toBe(
        false,
      );
      expect(await keys.deleteApiKey(first.record.id, orgId)).toBe(true);
      expect(await keys.deleteApiKey(first.record.id, orgId)).toBe(false);

      // signing keys
      const storage = new PostgresSigningKeyPairStorage(handle);
      const pair = await crypto.subtle.generateKey(
        {
          name: 'RSASSA-PKCS1-v1_5',
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: 'SHA-256',
        },
        true,
        ['sign', 'verify'],
      );
      await storage.storeKeyPair({ orgId }, pair);
      await storage.storeKeyPair({ orgId }, pair); // upsert path
      const [{ t }] = await ds.query(
        `SELECT jsonb_typeof(key_data) AS t FROM signing_keys WHERE org_id = $1`,
        [orgId],
      );
      expect(t).toBe('object');
      const priv = await storage.fetchPrivateKey({ orgId });
      const pub = await storage.fetchPublicKey({ orgId });
      const sig = await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5',
        priv,
        Buffer.from('hi'),
      );
      expect(
        await crypto.subtle.verify(
          'RSASSA-PKCS1-v1_5',
          pub,
          sig,
          Buffer.from('hi'),
        ),
      ).toBe(true);

      // MRT decisions materialization job
      const job = makeRefreshJob(async () => {}, handle);
      const seed = async (n: number) => {
        for (let i = 0; i < n; i++) {
          await ds.query(
            `INSERT INTO manual_review_tool.manual_review_decisions
               (id, job_payload, queue_id, reviewer_id, org_id, decision_components)
             VALUES (gen_random_uuid(), $1::jsonb, $2, 'rev', $3, ARRAY['{"type":"NO_ACTION"}'::jsonb])`,
            [
              jsonStringify({
                id: uid(),
                payload: {
                  item: { itemId: uid(), itemTypeIdentifier: { id: uid() } },
                },
              }),
              uid(),
              orgId,
            ],
          );
        }
      };
      const count = async () =>
        Number(
          (
            await ds.query(
              `SELECT count(*) AS c FROM manual_review_tool.dim_mrt_decisions_materialized WHERE org_id = $1`,
              [orgId],
            )
          )[0].c,
        );
      await seed(3);
      expect(await count()).toBe(0);
      await job.run();
      expect(await count()).toBe(3);
      await job.run();
      expect(await count()).toBe(3);
      await seed(2);
      await job.run();
      expect(await count()).toBe(5);
    } finally {
      await handle.destroy();
      await tdb.rollback();
      await tdb.end();
    }
  }, 60_000);
});
