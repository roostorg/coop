import { uid } from 'uid';

import createOrg from '../../test/fixtureHelpers/createOrg.js';
import { makeMockedServer } from '../../test/setupMockedServer.js';
import { makeTestWithFixture } from '../../test/utils.js';
import { CoopError } from '../../utils/errors.js';

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
