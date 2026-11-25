import { uid } from 'uid';

import createOrg from '../../test/fixtureHelpers/createOrg.js';
import createUser from '../../test/fixtureHelpers/createUser.js';
import { makeTransactionalTestWithFixture } from '../../test/harness/transactionalTest.js';
import { LocationBankRepository } from './locationBankRepository.js';

const area = (name: string) => ({
  id: uid(),
  name,
  geometry: { center: { lat: 1, lng: 2 }, radius: 3 },
});

const testWithBanks = makeTransactionalTestWithFixture(async ({ deps }) => {
  const repo = new LocationBankRepository(deps.KyselyPg);
  const makeBank = async () => {
    const { org } = await createOrg(deps);
    const { user } = await createUser(deps.KyselyPg, org.id);
    const bank = await repo.insert({
      id: uid(),
      orgId: org.id,
      ownerId: user.id,
      name: `bank-${uid()}`,
      description: null,
    });
    await repo.addLocations(bank, [area(`${bank.id}-location`)]);
    return bank;
  };
  return { repo, mine: await makeBank(), theirs: await makeBank() };
});

describe('LocationBankRepository org scoping', () => {
  testWithBanks(
    "reads nothing from another org's bank",
    async ({ repo, mine, theirs }) => {
      expect(await repo.findById(mine.orgId, theirs.id)).toBeUndefined();
      expect(await repo.listForOrg(mine.orgId)).toEqual([mine]);

      const locations = await repo.findLocations(mine.orgId, [
        mine.id,
        theirs.id,
      ]);
      expect(locations.get(mine.id)?.map((it) => it.name)).toEqual([
        `${mine.id}-location`,
      ]);
      expect(locations.get(theirs.id)).toEqual([]);
    },
  );

  testWithBanks(
    "changes nothing in another org's bank",
    async ({ repo, mine, theirs }) => {
      expect(
        await repo.update(mine.orgId, theirs.id, { name: 'stolen' }),
      ).toBeUndefined();
      expect(await repo.delete(mine.orgId, theirs.id)).toBe(false);

      expect(await repo.findById(theirs.orgId, theirs.id)).toEqual(theirs);
      const locations = await repo.findLocations(theirs.orgId, [theirs.id]);
      expect(locations.get(theirs.id)).toHaveLength(1);
    },
  );

  testWithBanks('deletes a bank with its locations', async ({ repo, mine }) => {
    expect(await repo.delete(mine.orgId, mine.id)).toBe(true);
    expect(await repo.findById(mine.orgId, mine.id)).toBeUndefined();
    expect(
      (await repo.findLocations(mine.orgId, [mine.id])).get(mine.id),
    ).toEqual([]);
  });
});
