import { eq } from 'drizzle-orm';

import { MIN_PASSWORD_LENGTH } from '../../services/userManagementService/index.js';
import { schema } from '../../storage/postgres/drizzle.js';
import createOrg from '../../test/fixtureHelpers/createOrg.js';
import { makeTransactionalTestWithFixture } from '../../test/harness/transactionalTest.js';

describe('UserAPI #signUp', () => {
  const testWithOrg = makeTransactionalTestWithFixture(async ({ deps }) =>
    createOrg(deps),
  );

  testWithOrg(
    'rejects a short password without creating a user',
    async ({ deps, org }) => {
      await expect(
        deps.DataSources.userAPI.signUp(
          {
            input: {
              email: 'new@example.com',
              password: 'a'.repeat(MIN_PASSWORD_LENGTH - 1),
              firstName: 'New',
              lastName: 'User',
              orgId: org.id,
              role: 'ADMIN',
              loginMethod: 'PASSWORD',
            },
          },
          undefined,
        ),
      ).rejects.toThrow(`at least ${MIN_PASSWORD_LENGTH} characters`);
      expect(
        await deps.DrizzlePg.select({ id: schema.users.id })
          .from(schema.users)
          .where(eq(schema.users.orgId, org.id)),
      ).toEqual([]);
    },
  );
});
