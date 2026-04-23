import { uid } from 'uid';

import createOrg from '../../test/fixtureHelpers/createOrg.js';
import { makeMockedServer } from '../../test/setupMockedServer.js';
import { makeTestWithFixture } from '../../test/utils.js';

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
  });
});
