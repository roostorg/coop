import { faker } from '@faker-js/faker';
import { uid } from 'uid';

import { UserRole } from '../../services/userManagementService/index.js';
import createOrg from '../../test/fixtureHelpers/createOrg.js';
import { makeTransactionalTestWithFixture } from '../../test/harness/transactionalTest.js';
import {
  kyselyUserFindByEmailAndOrg,
  kyselyUserInsert,
} from './userKyselyPersistence.js';

function samlUserInput(orgId: string) {
  return {
    id: uid(),
    orgId,
    email: faker.internet.email(),
    firstName: faker.name.firstName(),
    lastName: faker.name.lastName(),
    role: UserRole.ADMIN,
    loginMethods: ['saml'] as const,
    password: null,
  };
}

describe('kyselyUserFindByEmailAndOrg', () => {
  const testWithFixture = makeTransactionalTestWithFixture(async ({ deps }) => {
    const { org } = await createOrg(
      {
        KyselyPg: deps.KyselyPg,
        ModerationConfigService: deps.ModerationConfigService,
        ApiKeyService: deps.ApiKeyService,
      },
      uid(),
    );
    return { org };
  });

  testWithFixture(
    'returns the row when email and org match',
    async ({ deps, org }) => {
      const input = samlUserInput(org.id);
      await kyselyUserInsert({ db: deps.KyselyPg, ...input });
      const result = await kyselyUserFindByEmailAndOrg(deps.KyselyPg, {
        email: input.email,
        orgId: org.id,
      });
      expect(result).toMatchObject({ id: input.id, orgId: org.id });
    },
  );

  // Security regression (GHSA-2v93-383c-9fw2): a SAML assertion that
  // authenticates `orgId` must never resolve a user who lives in another org.
  testWithFixture(
    'returns undefined when the email exists in a different org',
    async ({ deps, org }) => {
      const input = samlUserInput(org.id);
      await kyselyUserInsert({ db: deps.KyselyPg, ...input });
      const result = await kyselyUserFindByEmailAndOrg(deps.KyselyPg, {
        email: input.email,
        orgId: `different-org-${uid()}`,
      });
      expect(result).toBeUndefined();
    },
  );

  testWithFixture(
    'returns undefined when the email does not exist',
    async ({ deps, org }) => {
      const result = await kyselyUserFindByEmailAndOrg(deps.KyselyPg, {
        email: `missing-${uid()}@example.com`,
        orgId: org.id,
      });
      expect(result).toBeUndefined();
    },
  );
});
