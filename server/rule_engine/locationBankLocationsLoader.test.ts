import { uid } from 'uid';

import createOrg from '../test/fixtureHelpers/createOrg.js';
import createUser from '../test/fixtureHelpers/createUser.js';
import { makeTransactionalTestWithFixture } from '../test/harness/transactionalTest.js';

const testWithBank = makeTransactionalTestWithFixture(async ({ deps }) => {
  const { org } = await createOrg(deps);
  const { org: otherOrg } = await createOrg(deps);
  const { user } = await createUser(deps.KyselyPg, org.id);
  const bank = await deps.LocationBankService.createBank({
    orgId: org.id,
    ownerId: user.id,
    name: `bank-${uid()}`,
    locations: [
      { name: 'HQ', geometry: { center: { lat: 1, lng: 2 }, radius: 3 } },
    ],
  });
  return { org, otherOrg, bank };
});

describe('getLocationBankLocationsEventuallyConsistent', () => {
  testWithBank(
    "loads a bank's locations for its own org only",
    async ({ deps, org, otherOrg, bank }) => {
      const load = deps.getLocationBankLocationsEventuallyConsistent;

      expect(await load({ orgId: org.id, bankId: bank.id })).toEqual([
        expect.objectContaining({
          name: 'HQ',
          geometry: { center: { lat: 1, lng: 2 }, radius: 3 },
        }),
      ]);
      expect(await load({ orgId: otherOrg.id, bankId: bank.id })).toEqual([]);
    },
  );
});
