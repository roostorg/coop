import { uid } from 'uid';
import { vi } from 'vitest';

import { UserPermission } from '../../services/userManagementService/index.js';
import createOrg from '../../test/fixtureHelpers/createOrg.js';
import createUser from '../../test/fixtureHelpers/createUser.js';
import loginWithPermissions from '../../test/fixtureHelpers/loginWithPermissions.js';
import { makeTransactionalTestWithFixture } from '../../test/harness/transactionalTest.js';

const bankFields = `
  id name description
  locations {
    id
    name
    geometry { center { lat lng } radius }
    bounds { northeastCorner { lat lng } southwestCorner { lat lng } }
    googlePlaceInfo { id }
  }
`;

const mutateResult = `
  __typename
  ... on MutateLocationBankSuccessResponse { data { ${bankFields} } }
  ... on LocationBankNameExistsError { title pointer }
`;

const point = (lat: number, lng: number, radius = 10) => ({
  center: { lat, lng },
  radius,
});

// Real Postgres and resolvers; only the Google Places call is stubbed.
const testWithOrgs = makeTransactionalTestWithFixture(async (server) => {
  const { org } = await createOrg(server.deps);
  const { org: otherOrg } = await createOrg(server.deps);
  await loginWithPermissions(server, org.id, [
    UserPermission.MUTATE_LIVE_RULES,
  ]);
  // The Google Maps client is the external boundary; everything above it runs.
  const { client } = server.deps.PlacesApiService as unknown as {
    client: Record<'placeDetails' | 'geocode', (...args: unknown[]) => unknown>;
  };
  const lookupPlaceId = vi
    .spyOn(client, 'placeDetails')
    .mockImplementation(async (req) => ({
      data: {
        result: {
          place_id: (req as { params: { place_id: string } }).params.place_id,
          name: 'Somewhere',
        },
      },
    }));
  vi.spyOn(client, 'geocode').mockResolvedValue({
    data: { results: [{ geometry: { location: { lat: 3, lng: 4 } } }] },
  });

  const post = async (query: string, variables: Record<string, unknown>) =>
    server.request
      .post('/api/v1/graphql')
      .send({ query, variables })
      .then((it) => it.body);
  const gql = async (query: string, variables: Record<string, unknown>) => {
    const body = await post(query, variables);
    expect(body.errors).toBeUndefined();
    return body.data;
  };

  const createBank = async (input: Record<string, unknown>) =>
    gql(
      `mutation ($input: CreateLocationBankInput!) {
        createLocationBank(input: $input) { ${mutateResult} }
      }`,
      { input },
    ).then((it) => it.createLocationBank);

  const updateBank = async (input: Record<string, unknown>) =>
    gql(
      `mutation ($input: UpdateLocationBankInput!) {
        updateLocationBank(input: $input) { ${mutateResult} }
      }`,
      { input },
    ).then((it) => it.updateLocationBank);

  const readBank = async (id: string) =>
    post(`query ($id: ID!) { locationBank(id: $id) { ${bankFields} } }`, {
      id,
    });

  const listBanks = async () =>
    gql(`{ myOrg { banks { locationBanks { id name } } } }`, {}).then(
      (it) => it.myOrg.banks.locationBanks,
    );

  const deleteBank = async (id: string) =>
    gql(`mutation ($id: ID!) { deleteLocationBank(id: $id) }`, { id }).then(
      (it) => it.deleteLocationBank,
    );

  // A bank in another org, written directly so the test doesn't depend on
  // logging in as a second user.
  const { user: otherOrgUser } = await createUser(
    server.deps.KyselyPg,
    otherOrg.id,
  );
  const otherOrgBankId = uid();
  await server.deps.KyselyPg.insertInto('public.location_banks')
    .values({
      id: otherOrgBankId,
      name: 'other org bank',
      description: null,
      org_id: otherOrg.id,
      owner_id: otherOrgUser.id,
      updated_at: new Date(),
      full_places_api_responses: [],
    })
    .execute();

  return {
    org,
    post,
    otherOrgBankId,
    lookupPlaceId,
    createBank,
    updateBank,
    readBank,
    listBanks,
    deleteBank,
  };
});

describe('location banks over GraphQL', () => {
  testWithOrgs(
    'creates a bank, resolving Google place ids',
    async ({ createBank, readBank, lookupPlaceId }) => {
      const created = await createBank({
        name: 'Stores',
        description: 'Our stores',
        locations: [
          { name: 'HQ', geometry: point(1, 2) },
          { geometry: point(3, 4, 0), googlePlaceId: 'place-1' },
        ],
      });

      expect(created.__typename).toBe('MutateLocationBankSuccessResponse');
      expect(lookupPlaceId).toHaveBeenCalledOnce();
      const read = await readBank(created.data.id);
      expect(read.errors).toBeUndefined();
      expect(read.data.locationBank).toEqual({
        id: created.data.id,
        name: 'Stores',
        description: 'Our stores',
        locations: expect.arrayContaining([
          {
            id: expect.any(String),
            name: 'HQ',
            geometry: point(1, 2),
            bounds: null,
            googlePlaceInfo: null,
          },
          {
            id: expect.any(String),
            name: null,
            geometry: point(3, 4, 0),
            bounds: null,
            googlePlaceInfo: { id: 'place-1' },
          },
        ]),
      });
      expect(read.data.locationBank.locations).toHaveLength(2);
    },
  );

  testWithOrgs(
    'returns LocationBankNameExistsError for a duplicate name',
    async ({ createBank, updateBank }) => {
      await createBank({ name: 'Dup', locations: [] });
      const other = await createBank({ name: 'Other', locations: [] });

      expect(await createBank({ name: 'Dup', locations: [] })).toEqual({
        __typename: 'LocationBankNameExistsError',
        title: expect.any(String),
        pointer: '/input/name',
      });
      expect(
        await updateBank({ id: other.data.id, name: 'Dup' }),
      ).toMatchObject({ __typename: 'LocationBankNameExistsError' });
    },
  );

  testWithOrgs(
    'updates name, description and locations',
    async ({ createBank, updateBank, readBank }) => {
      const created = await createBank({
        name: 'Before',
        description: 'kept',
        locations: [
          { name: 'a', geometry: point(1, 1) },
          { name: 'b', geometry: point(2, 2) },
        ],
      });
      const bankId = created.data.id;
      const locationA = created.data.locations.find(
        (it: { name: string }) => it.name === 'a',
      );

      const updated = await updateBank({
        id: bankId,
        name: 'After',
        locationsToDelete: [locationA.id],
        locationsToAdd: [{ name: 'c', geometry: point(3, 3) }],
      });

      expect(updated.__typename).toBe('MutateLocationBankSuccessResponse');
      const read = await readBank(bankId);
      expect(read.data.locationBank).toMatchObject({
        name: 'After',
        description: 'kept',
      });
      expect(
        read.data.locationBank.locations
          .map((it: { name: string }) => it.name)
          .sort(),
      ).toEqual(['b', 'c']);
    },
  );

  testWithOrgs(
    'lists the org banks and deletes one',
    async ({ createBank, listBanks, deleteBank, readBank }) => {
      const a = await createBank({ name: 'A', locations: [] });
      const b = await createBank({
        name: 'B',
        locations: [{ geometry: point(0, 0) }],
      });

      expect(
        (await listBanks()).map((it: { name: string }) => it.name).sort(),
      ).toEqual(['A', 'B']);
      expect(await deleteBank(b.data.id)).toBe(true);
      expect(await deleteBank(b.data.id)).toBe(false);
      expect(await listBanks()).toEqual([{ id: a.data.id, name: 'A' }]);
      expect((await readBank(b.data.id)).errors?.[0].message).toMatch(
        /not found/i,
      );
    },
  );

  testWithOrgs(
    "can't read, change or delete another org's bank",
    async ({ deps, otherOrgBankId, post, readBank, deleteBank }) => {
      expect((await readBank(otherOrgBankId)).errors?.[0].message).toMatch(
        /not found/i,
      );
      expect(await deleteBank(otherOrgBankId)).toBe(false);

      const update = await post(
        `mutation ($input: UpdateLocationBankInput!) {
          updateLocationBank(input: $input) { __typename }
        }`,
        { input: { id: otherOrgBankId, name: 'stolen' } },
      );
      expect(update.errors?.[0].message).toMatch(/not found/i);

      const row = await deps.KyselyPg.selectFrom('public.location_banks')
        .select('name')
        .where('id', '=', otherOrgBankId)
        .executeTakeFirstOrThrow();
      expect(row.name).toBe('other org bank');
    },
  );
});
