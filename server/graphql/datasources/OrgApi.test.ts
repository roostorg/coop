import { faker } from '@faker-js/faker';
import { uid } from 'uid';

import { UserRole } from '../../models/types/permissioning.js';
import createContentItemTypes from '../../test/fixtureHelpers/createContentItemTypes.js';
import createOrg from '../../test/fixtureHelpers/createOrg.js';
import { makeMockedServer } from '../../test/setupMockedServer.js';
import { makeTestWithFixture } from '../../test/utils.js';
import { CoopError } from '../../utils/errors.js';
import { kyselyUserDeleteById, kyselyUserInsert } from './userKyselyPersistence.js';

describe('OrgAPI', () => {
  const testWithFixture = makeTestWithFixture(async () => {
    const { deps, shutdown } = await makeMockedServer();
    const { org, cleanup: orgCleanup } = await createOrg(
      {
        KyselyPg: deps.KyselyPg,
        ModerationConfigService: deps.ModerationConfigService,
        ApiKeyService: deps.ApiKeyService,
      },
      uid(),
    );
    return {
      deps,
      org,
      async cleanup() {
        await orgCleanup();
        await shutdown();
      },
    };
  });

  describe('getGraphQLOrgFromId', () => {
    testWithFixture('returns the org parent for an existing id', async ({
      deps,
      org,
    }) => {
      const result = await deps.OrgAPIDataSource.getGraphQLOrgFromId(org.id);
      expect(result).toMatchObject({
        id: org.id,
        name: org.name,
        email: org.email,
      });
    });

    testWithFixture(
      'throws when the org does not exist (replaces Sequelize rejectOnEmpty)',
      async ({ deps }) => {
        const missingId = `missing-${uid()}`;
        await expect(
          deps.OrgAPIDataSource.getGraphQLOrgFromId(missingId),
        ).rejects.toThrow(/Organization not found/);
      },
    );
  });

  describe('updateOrgInfo', () => {
    testWithFixture(
      'throws when the org does not exist',
      async ({ deps }) => {
        await expect(
          deps.OrgAPIDataSource.updateOrgInfo(`missing-${uid()}`, {
            name: 'whatever',
          }),
        ).rejects.toThrow(/Organization not found/);
      },
    );

    testWithFixture(
      'returns the updated parent when the org exists',
      async ({ deps, org }) => {
        const newName = `Renamed_${uid()}`;
        const result = await deps.OrgAPIDataSource.updateOrgInfo(org.id, {
          name: newName,
        });
        expect(result.id).toBe(org.id);
        expect(result.name).toBe(newName);
      },
    );

    testWithFixture(
      'throws a BadRequest with a pointer for malformed email',
      async ({ deps, org }) => {
        await expect(
          deps.OrgAPIDataSource.updateOrgInfo(org.id, {
            email: 'not-an-email',
          }),
        ).rejects.toMatchObject({
          name: 'BadRequestError',
          status: 400,
          pointer: '/input/email',
        });
      },
    );

    testWithFixture(
      'throws a BadRequest for malformed websiteUrl (javascript: scheme)',
      async ({ deps, org }) => {
        await expect(
          deps.OrgAPIDataSource.updateOrgInfo(org.id, {
            // eslint-disable-next-line no-script-url
            websiteUrl: 'javascript:alert(1)',
          }),
        ).rejects.toMatchObject({
          name: 'BadRequestError',
          pointer: '/input/websiteUrl',
        });
      },
    );

    testWithFixture(
      'throws a BadRequest for empty name',
      async ({ deps, org }) => {
        await expect(
          deps.OrgAPIDataSource.updateOrgInfo(org.id, { name: '' }),
        ).rejects.toBeInstanceOf(CoopError);
      },
    );

    testWithFixture(
      'does not touch the DB when validation fails (org not found only surfaces after validation passes)',
      async ({ deps }) => {
        // If validation ran AFTER the DB lookup we'd get "Organization not
        // found" here; ensure we see the BadRequest instead.
        await expect(
          deps.OrgAPIDataSource.updateOrgInfo(`missing-${uid()}`, {
            email: 'not-an-email',
          }),
        ).rejects.toMatchObject({
          name: 'BadRequestError',
          pointer: '/input/email',
        });
      },
    );
  });

  describe('getContentTypesForOrg', () => {
    testWithFixture(
      'returns every item type for the org with the fields read by the ContentType resolver',
      async ({ deps, org }) => {
        const { itemTypes, cleanup } = await createContentItemTypes({
          moderationConfigService: deps.ModerationConfigService,
          orgId: org.id,
          numItemTypes: 1,
          extra: {},
        });
        try {
          const result = await deps.OrgAPIDataSource.getContentTypesForOrg(
            org.id,
          );
          const actualIds = new Set(result.map((it) => it.id));
          for (const created of itemTypes) {
            expect(actualIds.has(created.id)).toBe(true);
          }
          for (const it of result) {
            expect(it.orgId).toBe(org.id);
            expect(typeof it.id).toBe('string');
            expect(typeof it.name).toBe('string');
            expect(['CONTENT', 'USER', 'THREAD']).toContain(it.kind);
            expect(Array.isArray(it.schema)).toBe(true);
          }
        } finally {
          await cleanup();
        }
      },
    );

    testWithFixture(
      'returns all item-type kinds, not just CONTENT (createOrg seeds a default USER)',
      async ({ deps, org }) => {
        const result = await deps.OrgAPIDataSource.getContentTypesForOrg(
          org.id,
        );
        expect(result.length).toBeGreaterThan(0);
        expect(result.some((it) => it.kind === 'USER')).toBe(true);
      },
    );

    testWithFixture(
      'does not leak item types across orgs',
      async ({ deps, org }) => {
        const { org: otherOrg, cleanup: otherOrgCleanup } = await createOrg(
          {
            KyselyPg: deps.KyselyPg,
            ModerationConfigService: deps.ModerationConfigService,
            ApiKeyService: deps.ApiKeyService,
          },
          uid(),
        );
        try {
          const result = await deps.OrgAPIDataSource.getContentTypesForOrg(
            org.id,
          );
          for (const it of result) {
            expect(it.orgId).toBe(org.id);
            expect(it.orgId).not.toBe(otherOrg.id);
          }
        } finally {
          await otherOrgCleanup();
        }
      },
    );
  });

  describe('getOrgUsersForGraphQL', () => {
    testWithFixture(
      'returns GraphQLUserParents for every user in the org with a working getPermissions() method',
      async ({ deps, org }) => {
        const adminId = uid();
        const analystId = uid();
        await kyselyUserInsert({
          db: deps.KyselyPg,
          id: adminId,
          orgId: org.id,
          email: faker.internet.email(),
          firstName: faker.name.firstName(),
          lastName: faker.name.lastName(),
          role: UserRole.ADMIN,
          loginMethods: ['saml'],
          password: null,
        });
        await kyselyUserInsert({
          db: deps.KyselyPg,
          id: analystId,
          orgId: org.id,
          email: faker.internet.email(),
          firstName: faker.name.firstName(),
          lastName: faker.name.lastName(),
          role: UserRole.ANALYST,
          loginMethods: ['saml'],
          password: null,
        });
        try {
          const users = await deps.OrgAPIDataSource.getOrgUsersForGraphQL(
            org.id,
          );
          const ids = users.map((u) => u.id).sort();
          expect(ids).toEqual([adminId, analystId].sort());
          const admin = users.find((u) => u.id === adminId)!;
          const analyst = users.find((u) => u.id === analystId)!;
          expect(admin.getPermissions()).toEqual(
            expect.arrayContaining(['EDIT_MRT_QUEUES']),
          );
          expect(analyst.getPermissions()).not.toContain('EDIT_MRT_QUEUES');
        } finally {
          await kyselyUserDeleteById(deps.KyselyPg, adminId);
          await kyselyUserDeleteById(deps.KyselyPg, analystId);
        }
      },
    );

    testWithFixture(
      'returns an empty array for an org with no users',
      async ({ deps, org }) => {
        const result = await deps.OrgAPIDataSource.getOrgUsersForGraphQL(
          org.id,
        );
        expect(result).toEqual([]);
      },
    );

    testWithFixture(
      'does not leak users across orgs',
      async ({ deps, org }) => {
        const { org: otherOrg, cleanup: otherOrgCleanup } = await createOrg(
          {
            KyselyPg: deps.KyselyPg,
            ModerationConfigService: deps.ModerationConfigService,
            ApiKeyService: deps.ApiKeyService,
          },
          uid(),
        );
        const otherUserId = uid();
        await kyselyUserInsert({
          db: deps.KyselyPg,
          id: otherUserId,
          orgId: otherOrg.id,
          email: faker.internet.email(),
          firstName: faker.name.firstName(),
          lastName: faker.name.lastName(),
          role: UserRole.ADMIN,
          loginMethods: ['saml'],
          password: null,
        });
        try {
          const result = await deps.OrgAPIDataSource.getOrgUsersForGraphQL(
            org.id,
          );
          expect(result.find((u) => u.id === otherUserId)).toBeUndefined();
        } finally {
          await kyselyUserDeleteById(deps.KyselyPg, otherUserId);
          await otherOrgCleanup();
        }
      },
    );
  });

  describe('createOrg', () => {
    testWithFixture(
      'throws a BadRequest with /input/website pointer for bad website',
      async ({ deps }) => {
        await expect(
          deps.OrgAPIDataSource.createOrg({
            input: {
              name: `NewOrg_${uid()}`,
              email: `new_${uid()}@example.com`,
              // eslint-disable-next-line no-script-url
              website: 'javascript:alert(1)',
            },
          }),
        ).rejects.toMatchObject({
          name: 'BadRequestError',
          pointer: '/input/website',
        });
      },
    );

    testWithFixture(
      'throws a BadRequest for malformed email',
      async ({ deps }) => {
        await expect(
          deps.OrgAPIDataSource.createOrg({
            input: {
              name: `NewOrg_${uid()}`,
              email: 'not-an-email',
              website: 'https://example.com',
            },
          }),
        ).rejects.toMatchObject({
          name: 'BadRequestError',
          pointer: '/input/email',
        });
      },
    );
  });
});
