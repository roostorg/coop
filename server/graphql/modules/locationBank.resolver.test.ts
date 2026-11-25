import { ScalarTypes } from '@roostorg/coop-types';
import Geohash from 'latlon-geohash';
import supertest from 'supertest';
import { uid } from 'uid';
import { vi } from 'vitest';

import { SignalType } from '../../services/signalsService/index.js';
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

const names = (locations: readonly { name: string | null }[]) =>
  locations.map((it) => it.name).sort();

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
  const placeDetails = vi
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
    gql(
      `{ myOrg { banks { locationBanks { id name locations { name } } } } }`,
      {},
    ).then((it) => it.myOrg.banks.locationBanks);

  const deleteBank = async (id: string) =>
    gql(`mutation ($id: ID!) { deleteLocationBank(id: $id) }`, { id }).then(
      (it) => it.deleteLocationBank,
    );

  // A bank with one location in another org, written directly so the test
  // doesn't depend on logging in as a second user.
  const { user: otherOrgUser } = await createUser(
    server.deps.KyselyPg,
    otherOrg.id,
  );
  const otherOrgBankId = uid();
  const otherOrgLocationId = uid();
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
  await server.deps.KyselyPg.insertInto('public.location_bank_locations')
    .values({
      id: otherOrgLocationId,
      bank_id: otherOrgBankId,
      name: 'other org location',
      geometry: point(5, 5),
    })
    .execute();

  const locationNamesInDb = async (bankId: string) =>
    server.deps.KyselyPg.selectFrom('public.location_bank_locations')
      .select('name')
      .where('bank_id', '=', bankId)
      .execute()
      .then(names);

  return {
    org,
    post,
    otherOrgBankId,
    otherOrgLocationId,
    placeDetails,
    createBank,
    updateBank,
    readBank,
    listBanks,
    deleteBank,
    locationNamesInDb,
  };
});

describe('location banks over GraphQL', () => {
  testWithOrgs(
    'creates a bank, resolving and storing Google place data',
    async ({ deps, createBank, readBank, placeDetails }) => {
      const created = await createBank({
        name: 'Stores',
        description: 'Our stores',
        locations: [
          {
            name: 'HQ',
            geometry: point(1, 2),
            bounds: {
              northeastCorner: { lat: 2, lng: 3 },
              southwestCorner: { lat: 0, lng: 1 },
            },
          },
          { geometry: point(3, 4, 0), googlePlaceId: 'place-1' },
        ],
      });

      expect(created.__typename).toBe('MutateLocationBankSuccessResponse');
      expect(placeDetails).toHaveBeenCalledOnce();
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
            bounds: {
              northeastCorner: { lat: 2, lng: 3 },
              southwestCorner: { lat: 0, lng: 1 },
            },
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
      expect(created.data).toEqual(read.data.locationBank);

      // GraphQL only exposes the place id; the details are stored too.
      const stored = await deps.KyselyPg.selectFrom(
        'public.location_bank_locations',
      )
        .select('google_place_info')
        .where('bank_id', '=', created.data.id)
        .where('google_place_info', 'is not', null)
        .executeTakeFirstOrThrow();
      expect(stored.google_place_info).toMatchObject({
        id: 'place-1',
        details: { place_id: 'place-1', name: 'Somewhere' },
        geocode: { geometry: { location: { lat: 3, lng: 4 } } },
      });
    },
  );

  testWithOrgs(
    "writes nothing when Google can't resolve a place",
    async ({ post, placeDetails, listBanks }) => {
      placeDetails.mockRejectedValueOnce(new Error('Google is down'));

      const result = await post(
        `mutation ($input: CreateLocationBankInput!) {
          createLocationBank(input: $input) { __typename }
        }`,
        {
          input: {
            name: 'Unresolved',
            locations: [{ geometry: point(0, 0), googlePlaceId: 'place-1' }],
          },
        },
      );

      expect(result.errors).toHaveLength(1);
      expect(await listBanks()).toEqual([]);
    },
  );

  testWithOrgs(
    'returns LocationBankNameExistsError for a duplicate name in the org',
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
    "allows a name that's used in another org",
    async ({ createBank }) => {
      expect(
        await createBank({ name: 'other org bank', locations: [] }),
      ).toMatchObject({ __typename: 'MutateLocationBankSuccessResponse' });
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
      expect(updated.data).toMatchObject({
        name: 'After',
        description: 'kept',
      });
      expect(names(updated.data.locations)).toEqual(['b', 'c']);
      const read = await readBank(bankId);
      expect(read.data.locationBank).toEqual(updated.data);
    },
  );

  testWithOrgs(
    'sets and clears the description',
    async ({ createBank, updateBank }) => {
      const created = await createBank({ name: 'Bank', locations: [] });
      expect(created.data.description).toBeNull();
      const { id } = created.data;

      const set = await updateBank({ id, description: 'new' });
      expect(set.data.description).toBe('new');

      const cleared = await updateBank({ id, description: null });
      expect(cleared.data.description).toBeNull();
    },
  );

  testWithOrgs(
    "rejects clearing a bank's name",
    async ({ createBank, post, readBank }) => {
      const created = await createBank({ name: 'Named', locations: [] });

      const result = await post(
        `mutation ($input: UpdateLocationBankInput!) {
          updateLocationBank(input: $input) { __typename }
        }`,
        { input: { id: created.data.id, name: null } },
      );

      expect(result.errors).toHaveLength(1);
      expect((await readBank(created.data.id)).data.locationBank.name).toBe(
        'Named',
      );
    },
  );

  testWithOrgs(
    'changes no locations when an update fails on a duplicate name',
    async ({ createBank, updateBank, locationNamesInDb }) => {
      await createBank({ name: 'Taken', locations: [] });
      const created = await createBank({
        name: 'Mine',
        locations: [{ name: 'a', geometry: point(1, 1) }],
      });

      const result = await updateBank({
        id: created.data.id,
        name: 'Taken',
        locationsToDelete: [created.data.locations[0].id],
        locationsToAdd: [{ name: 'b', geometry: point(2, 2) }],
      });

      expect(result.__typename).toBe('LocationBankNameExistsError');
      expect(await locationNamesInDb(created.data.id)).toEqual(['a']);
    },
  );

  testWithOrgs(
    'only deletes locations that belong to the bank being updated',
    async ({
      createBank,
      updateBank,
      otherOrgBankId,
      otherOrgLocationId,
      locationNamesInDb,
    }) => {
      const mine = await createBank({
        name: 'Mine',
        locations: [{ name: 'mine', geometry: point(1, 1) }],
      });
      const sibling = await createBank({
        name: 'Sibling',
        locations: [{ name: 'sibling', geometry: point(2, 2) }],
      });

      await updateBank({
        id: mine.data.id,
        locationsToDelete: [sibling.data.locations[0].id, otherOrgLocationId],
      });

      expect(await locationNamesInDb(mine.data.id)).toEqual(['mine']);
      expect(await locationNamesInDb(sibling.data.id)).toEqual(['sibling']);
      expect(await locationNamesInDb(otherOrgBankId)).toEqual([
        'other org location',
      ]);
    },
  );

  testWithOrgs(
    'lists the org banks with their locations and deletes one',
    async ({
      createBank,
      listBanks,
      deleteBank,
      readBank,
      locationNamesInDb,
    }) => {
      const a = await createBank({ name: 'A', locations: [] });
      const b = await createBank({
        name: 'B',
        locations: [{ name: 'b1', geometry: point(0, 0) }],
      });

      expect(await listBanks()).toEqual(
        expect.arrayContaining([
          { id: a.data.id, name: 'A', locations: [] },
          { id: b.data.id, name: 'B', locations: [{ name: 'b1' }] },
        ]),
      );
      expect(await deleteBank(b.data.id)).toBe(true);
      expect(await deleteBank(b.data.id)).toBe(false);
      expect(await listBanks()).toEqual([
        { id: a.data.id, name: 'A', locations: [] },
      ]);
      expect((await readBank(b.data.id)).errors?.[0].message).toMatch(
        /not found/i,
      );
      expect(await locationNamesInDb(b.data.id)).toEqual([]);
    },
  );

  testWithOrgs(
    "can't read, change or delete another org's bank",
    async ({
      deps,
      otherOrgBankId,
      otherOrgLocationId,
      post,
      readBank,
      deleteBank,
      listBanks,
      locationNamesInDb,
    }) => {
      expect((await readBank(otherOrgBankId)).errors?.[0].message).toMatch(
        /not found/i,
      );
      expect(await listBanks()).toEqual([]);

      const update = await post(
        `mutation ($input: UpdateLocationBankInput!) {
          updateLocationBank(input: $input) { __typename }
        }`,
        {
          input: {
            id: otherOrgBankId,
            name: 'stolen',
            locationsToDelete: [otherOrgLocationId],
            locationsToAdd: [{ name: 'planted', geometry: point(0, 0) }],
          },
        },
      );
      expect(update.errors?.[0].message).toMatch(/not found/i);
      expect(await deleteBank(otherOrgBankId)).toBe(false);

      const row = await deps.KyselyPg.selectFrom('public.location_banks')
        .select('name')
        .where('id', '=', otherOrgBankId)
        .executeTakeFirstOrThrow();
      expect(row.name).toBe('other org bank');
      expect(await locationNamesInDb(otherOrgBankId)).toEqual([
        'other org location',
      ]);
    },
  );

  testWithOrgs(
    'requires a logged-in user to read a bank',
    async ({ server, otherOrgBankId }) => {
      const response = await supertest(server)
        .post('/api/v1/graphql')
        .send({
          query: `query ($id: ID!) { locationBank(id: $id) { id } }`,
          variables: { id: otherOrgBankId },
        });

      expect(response.body.errors).toEqual([
        expect.objectContaining({
          extensions: expect.objectContaining({ code: 'UNAUTHENTICATED' }),
        }),
      ]);
    },
  );

  testWithOrgs(
    "the rule engine matches items against a bank's locations",
    async ({ deps, org, createBank }) => {
      const created = await createBank({
        name: 'Areas',
        locations: [
          { name: 'circle', geometry: point(40, -74, 5) },
          {
            name: 'box',
            geometry: point(51.5, 0, 0),
            bounds: {
              northeastCorner: { lat: 52, lng: 1 },
              southwestCorner: { lat: 51, lng: -1 },
            },
          },
        ],
      });
      const runSignal = deps.TransientRunSignalWithCacheFactory();
      const isIn = async (lat: number, lng: number) =>
        runSignal({
          signal: { type: SignalType.GEO_CONTAINED_WITHIN },
          value: { type: ScalarTypes.GEOHASH, value: Geohash.encode(lat, lng) },
          matchingValues: { locationBankIds: [created.data.id] },
          orgId: org.id,
        });

      expect(await isIn(40.01, -74.01)).toMatchObject({
        score: true,
        matchedValue: 'circle',
      });
      expect(await isIn(51.2, 0.5)).toMatchObject({
        score: true,
        matchedValue: 'box',
      });
      expect(await isIn(0, 0)).toMatchObject({ score: false });
    },
  );
});
