/* eslint-disable max-lines */
import { faker } from '@faker-js/faker';
import { Kysely } from 'kysely';
import { type UnionToIntersection } from 'type-fest';
import { uid } from 'uid';

import getBottle from '../../iocContainer/index.js';
import createOrg from '../../test/fixtureHelpers/createOrg.js';
import createUser from '../../test/fixtureHelpers/createUser.js';
import {
  makeMockPgDialect,
  type MockPgExecute,
} from '../../test/stubs/KyselyPg.js';
import { makeTestWithFixture } from '../../test/utils.js';
import { ErrorType } from '../../utils/errors.js';
import { type Satisfies } from '../../utils/typescript-types.js';
import { type ModerationConfigServicePg } from './dbTypes.js';
import {
  type Action,
  type ItemType,
  type Policy,
  type UserItemType,
} from './index.js';
import { ModerationConfigService } from './moderationConfigService.js';
import { PolicyType } from './types/policies.js';

describe('ModerationConfigService', () => {
  let container: Awaited<ReturnType<typeof getBottle>>['container'];
  let sutWithPrimary: ModerationConfigService;
  let sutWithReadReplica: ModerationConfigService;
  let defaultUserItemType: UserItemType;

  // NB: because we don't create a new org for each tests (that feels like
  // overkill), we have to track entities added in each write test, by adding
  // them to the variables below, so that we can assert on the results when
  // reading.
  const createdItemTypes = {
    ALL: [] as ItemType[],
    get USER() {
      return this.ALL.filter((it) => it.kind === 'USER');
    },
    get CONTENT() {
      return this.ALL.filter((it) => it.kind === 'CONTENT');
    },
    get THREAD() {
      return this.ALL.filter((it) => it.kind === 'THREAD');
    },
  };

  const createdActions = [] as Action[];

  const createdPolicies = [
    {
      id: '1',
      name: 'Example policy',
      orgId: 'orgId',
      parentId: 'parentId',
      createdAt: new Date(),
      updatedAt: new Date(),
      semanticVersion: 1,
      policyText: '',
      policyType: PolicyType.DRUG_SALES,
      userStrikeCount: 1,
      applyUserStrikeCountConfigToChildren: false,
      penalty: 'NONE',
    },
  ] satisfies Policy[];

  const dummyOrgId = uid();
  const dummySchema = [
    { name: 'fakeField', type: 'STRING', required: false, container: null },
  ] as const;

  // Every time we'll run these tests, we'll generate a new org from scratch,
  // and then delete it at the end (which should hopefully do a cascading delete
  // of most/all of its relevant data). Testing this way let's us truly test the
  // moderationConfigService as a black box -- inserting data only using the
  // public methods, and then verifying that we can retrieve it or delete it
  // with only the public methods. Any other approach would require our tests to
  // memorize exactly what queries the service is issuing and the schema of the
  // underlying db tables, which makes the tests more brittle/harder to maintain
  // than I'd like if the service is refactored.
  beforeAll(async () => {
    // eslint-disable-next-line better-mutation/no-mutation
    container = (await getBottle()).container;

    // An instance of kysely that will throw if any queries are run through it;
    // used to test that the moderationConfigService is querying the correct db.
    const kyselyShouldBeUnused = new Kysely<ModerationConfigServicePg>({
      dialect: makeMockPgDialect(
        jest.fn<MockPgExecute>().mockImplementation(async () => {
          throw new Error('Did not expect this kysely instance to be used!');
        }),
      ),
    });

    // In order to test that the correct db is queried (i.e., replicas vs the
    // primary), we'll just use different instances of the service, where each
    // only has access to the db we expect to be hit.
    // eslint-disable-next-line better-mutation/no-mutation
    sutWithPrimary = new ModerationConfigService(
      container.KyselyPg,
      kyselyShouldBeUnused,
      async () => {},
    );

    // eslint-disable-next-line better-mutation/no-mutation
    sutWithReadReplica = new ModerationConfigService(
      kyselyShouldBeUnused,
      container.KyselyPgReadReplica,
      async () => {},
    );

    const createOrgResult = await createOrg(
      { Org: container.Sequelize.Org },
      container.ModerationConfigService,
      container.ApiKeyService,
      dummyOrgId,
    );

    // eslint-disable-next-line better-mutation/no-mutation
    defaultUserItemType = createOrgResult.defaultUserItemType;
    createdItemTypes.ALL.push(defaultUserItemType);
  });

  afterAll(async () => {
    const { Sequelize: models } = (await getBottle()).container;
    await models.Org.destroy({ where: { id: dummyOrgId } });

    await Promise.all([
      container.KyselyPg.destroy(),
      container.KyselyPgReadReplica.destroy(),
      await models.close(),
    ]);
  });

  const itemTypeSnapshotMatchers = {
    id: expect.any(String),
    version: expect.any(String),
    orgId: expect.any(String),
  };

  const actionSnapshotMatchers = {
    id: expect.any(String),
    orgId: expect.any(String),
  };

  type SupportsReplicaMethod = Satisfies<
    | 'getItemTypes'
    | 'getItemType'
    | 'getItemTypesByKind'
    | 'getDefaultUserType'
    | 'getItemTypesForAction'
    | 'getItemTypesForRule'
    | 'getActions'
    | 'getPolicies',
    keyof ModerationConfigService
  >;

  async function testReadReplicaUse<T extends SupportsReplicaMethod>(
    method: T,
    baseFilter: Parameters<ModerationConfigService[T]>[0],
  ) {
    // cast baseFilter to prevent TS errors that would arise because TS can't
    // verify that the particular string that `method` takes on at runtime
    // corresponsds to the particular binding for baseFilter.
    const filters = baseFilter as UnionToIntersection<
      Parameters<ModerationConfigService[SupportsReplicaMethod]>[0]
    >;

    // We're calling these to test that none of them throw, which'll only be
    // true if the proper db is used.
    await sutWithPrimary[method](filters);
    await sutWithPrimary[method]({ ...filters, readFromReplica: false });
    await sutWithReadReplica[method]({ ...filters, readFromReplica: true });
  }

  // NB: there is an ordering dependency between these tests, as the creation
  // tests run first and then the read tests assert on the presence of their
  // writes.
  describe('ItemType-Returning methods', () => {
    describe('Creation methods', () => {
      describe('#createContentType', () => {
        it('should return and durably save the new item type', async () => {
          const saved = await sutWithPrimary.createContentType(dummyOrgId, {
            schema: dummySchema,
            description: null,
            name: 'Content Item Type',
            schemaFieldRoles: {
              displayName: 'fakeField',
            },
          });

          const fetched = await sutWithPrimary.getItemType({
            orgId: dummyOrgId,
            itemTypeSelector: { id: saved.id },
          });

          expect(saved).toMatchInlineSnapshot(
            itemTypeSnapshotMatchers,
            `
            {
              "description": null,
              "id": Any<String>,
              "kind": "CONTENT",
              "name": "Content Item Type",
              "orgId": Any<String>,
              "schema": [
                {
                  "container": null,
                  "name": "fakeField",
                  "required": false,
                  "type": "STRING",
                },
              ],
              "schemaFieldRoles": {
                "createdAt": undefined,
                "creatorId": undefined,
                "displayName": "fakeField",
                "isDeleted": undefined,
                "parentId": undefined,
                "threadId": undefined,
              },
              "schemaVariant": "original",
              "version": Any<String>,
            }
          `,
          );
          expect(saved.orgId).toBe(dummyOrgId);
          expect(saved).toEqual(fetched);
          createdItemTypes.ALL.push(saved);
        });
      });

      describe('#createThreadType', () => {
        it('should return and durably save the new item type', async () => {
          const saved = await sutWithPrimary.createThreadType(dummyOrgId, {
            schema: dummySchema,
            description: 'Test description',
            name: 'Thread Item Type',
            schemaFieldRoles: {
              displayName: 'fakeField',
            },
          });

          const fetched = await sutWithPrimary.getItemType({
            orgId: dummyOrgId,
            itemTypeSelector: { id: saved.id },
          });

          expect(saved).toMatchInlineSnapshot(
            itemTypeSnapshotMatchers,
            `
            {
              "description": "Test description",
              "id": Any<String>,
              "kind": "THREAD",
              "name": "Thread Item Type",
              "orgId": Any<String>,
              "schema": [
                {
                  "container": null,
                  "name": "fakeField",
                  "required": false,
                  "type": "STRING",
                },
              ],
              "schemaFieldRoles": {
                "createdAt": undefined,
                "creatorId": undefined,
                "displayName": "fakeField",
                "isDeleted": undefined,
              },
              "schemaVariant": "original",
              "version": Any<String>,
            }
          `,
          );
          expect(saved.orgId).toBe(dummyOrgId);
          expect(saved).toEqual(fetched);
          createdItemTypes.ALL.push(saved);
        });
      });

      describe('#createUserType', () => {
        it('should return and durably save the new item type', async () => {
          const saved = await sutWithPrimary.createUserType(dummyOrgId, {
            schema: dummySchema,
            description: null,
            name: 'User Item Type',
            schemaFieldRoles: {
              displayName: 'fakeField',
            },
          });

          const fetched = await sutWithPrimary.getItemType({
            orgId: dummyOrgId,
            itemTypeSelector: { id: saved.id },
          });

          expect(saved).toMatchInlineSnapshot(
            itemTypeSnapshotMatchers,
            `
            {
              "description": null,
              "id": Any<String>,
              "isDefaultUserType": false,
              "kind": "USER",
              "name": "User Item Type",
              "orgId": Any<String>,
              "schema": [
                {
                  "container": null,
                  "name": "fakeField",
                  "required": false,
                  "type": "STRING",
                },
              ],
              "schemaFieldRoles": {
                "backgroundImage": undefined,
                "createdAt": undefined,
                "displayName": "fakeField",
                "isDeleted": undefined,
                "profileIcon": undefined,
              },
              "schemaVariant": "original",
              "version": Any<String>,
            }
          `,
          );
          expect(saved.orgId).toBe(dummyOrgId);
          expect(saved).toEqual(fetched);
          createdItemTypes.ALL.push(saved);
        });
      });
    });

    describe('Read methods', () => {
      describe('#getItemTypes', () => {
        it('should return all item types, properly formatted', async () => {
          const res = await sutWithPrimary.getItemTypes({ orgId: dummyOrgId });
          expect(res).toHaveLength(createdItemTypes.ALL.length);
          expect(res).toEqual(expect.arrayContaining(createdItemTypes.ALL));
        });
      });

      describe('#getItemTypesByKind', () => {
        it('should filter by kind', async () => {
          const [userItemTypes, contentItemTypes, threadItemTypes] =
            await Promise.all([
              sutWithPrimary.getItemTypesByKind({
                orgId: dummyOrgId,
                kind: 'USER',
              }),
              sutWithPrimary.getItemTypesByKind({
                orgId: dummyOrgId,
                kind: 'CONTENT',
              }),
              sutWithPrimary.getItemTypesByKind({
                orgId: dummyOrgId,
                kind: 'THREAD',
              }),
            ]);

          expect(userItemTypes).toHaveLength(createdItemTypes.USER.length);
          expect(userItemTypes).toEqual(
            expect.arrayContaining(createdItemTypes.USER),
          );

          expect(contentItemTypes).toHaveLength(
            createdItemTypes.CONTENT.length,
          );
          expect(contentItemTypes).toEqual(
            expect.arrayContaining(createdItemTypes.CONTENT),
          );

          expect(threadItemTypes).toHaveLength(createdItemTypes.THREAD.length);
          expect(threadItemTypes).toEqual(
            expect.arrayContaining(createdItemTypes.THREAD),
          );
        });
      });

      describe('#getDefaultUserType', () => {
        it('should return the defualt user type, properly formatted', async () => {
          const res = await sutWithPrimary.getDefaultUserType({
            orgId: dummyOrgId,
          });
          expect(res).toEqual(defaultUserItemType);
        });
      });

      describe('#getItemTypesForAction', () => {
        it('should query from the proper db', async () => {
          // These tests will throw if the wrong db is used (see kyselyShouldBeUnused)
          await sutWithPrimary.getItemTypesForAction({
            orgId: dummyOrgId,
            actionId: 'someId',
            directives: { maxAge: 0 },
          });
          await sutWithReadReplica.getItemTypesForAction({
            orgId: dummyOrgId,
            actionId: 'someId',
            directives: { maxAge: 10 },
          });
        });

        it.skip('should return the right results', () => {});
      });

      describe('#getItemTypesForRule', () => {
        it('should query from the proper db', async () => {
          await testReadReplicaUse('getItemTypesForRule', {
            orgId: dummyOrgId,
            ruleId: 'sasts',
          });
        });

        it.skip('should return the right results', () => {});
      });
    });
  });

  describe('Action-returning methods', () => {
    describe('Creation methods', () => {
      describe('#createAction', () => {
        it('should return and durably save the new action', async () => {
          const saved = await sutWithPrimary.createAction(dummyOrgId, {
            name: 'Test Action',
            description: 'Test description',
            type: 'CUSTOM_ACTION',
            callbackUrl: 'https://example.com',
            callbackUrlHeaders: null,
            callbackUrlBody: null,
            applyUserStrikes: false,
          });

          const [fetched] = await sutWithPrimary.getActions({
            orgId: dummyOrgId,
            ids: [saved.id],
          });

          expect(saved).toMatchInlineSnapshot(
            actionSnapshotMatchers,
            `
            {
              "actionType": "CUSTOM_ACTION",
              "applyUserStrikes": false,
              "callbackUrl": "https://example.com",
              "callbackUrlBody": null,
              "callbackUrlHeaders": null,
              "id": Any<String>,
              "name": "Test Action",
              "orgId": Any<String>,
            }
          `,
          );
          expect(saved.orgId).toBe(dummyOrgId);
          expect(saved).toEqual(fetched);
          createdActions.push(saved);
        });
      });
    });

    describe('Read methods', () => {
      describe('#getActions', () => {
        it('should query from the proper db', async () => {
          await testReadReplicaUse('getActions', { orgId: dummyOrgId });
        });

        it('should return all actions, properly formatted', async () => {
          const res = await sutWithPrimary.getActions({ orgId: dummyOrgId });
          expect(res).toHaveLength(createdActions.length);
          expect(res).toEqual(expect.arrayContaining(createdActions));
        });
      });
    });
  });

  describe('Policy returning methods', () => {
    describe('Read methods', () => {
      it('should query from the proper db', async () => {
        await testReadReplicaUse('getPolicies', { orgId: dummyOrgId });
      });

      // TODO: Fill in this test once we've implemented the policy mutations
      it.skip('should return all policies, properly formatted', async () => {
        const res = await sutWithPrimary.getPolicies({ orgId: dummyOrgId });
        expect(res).toHaveLength(createdPolicies.length);
        expect(res).toEqual(expect.arrayContaining(createdPolicies));
      });
    });
    describe('Mutations', () => {
      const testWithUserAndOrg = makeTestWithFixture(async () => {
        const { org, cleanup: orgCleanup } = await createOrg(
          { Org: container.Sequelize.Org },
          container.ModerationConfigService,
          container.ApiKeyService,
          uid(),
        );

        const { user, cleanup: userCleanup } = await createUser(
          container.Sequelize,
          org.id,
        );

        return {
          org,
          user,
          async cleanup() {
            await userCleanup();
            await orgCleanup();
          },
        };
      });

      testWithUserAndOrg(
        'should create a root policy',
        async ({ org, user }) => {
          const policy = await sutWithPrimary.createPolicy({
            orgId: org.id,
            policy: {
              name: 'Test Policy',
              policyText: 'Test policy text',
              enforcementGuidelines: 'Test enforcement guidelines',
              policyType: PolicyType.DRUG_SALES,
              parentId: null,
            },
            invokedBy: {
              orgId: org.id,
              userId: user.id,
              permissions: user.getPermissions(),
            },
          });

          const fetched = await sutWithPrimary.getPolicies({ orgId: org.id });
          expect(fetched).toHaveLength(1);
          expect(fetched[0].id).toEqual(policy.id);
        },
      );

      testWithUserAndOrg(
        'should create parent and child policies',
        async ({ org, user }) => {
          const parentPolicy = await sutWithPrimary.createPolicy({
            orgId: org.id,
            policy: {
              name: 'Test Policy',
              policyText: 'Test policy text',
              enforcementGuidelines: 'Test enforcement guidelines',
              policyType: PolicyType.DRUG_SALES,
              parentId: null,
            },
            invokedBy: {
              orgId: org.id,
              userId: user.id,
              permissions: user.getPermissions(),
            },
          });

          const childPolicy = await sutWithPrimary.createPolicy({
            orgId: org.id,
            policy: {
              name: 'Child Policy',
              policyText: 'Child policy text',
              enforcementGuidelines: 'Test enforcement guidelines',
              policyType: PolicyType.DRUG_SALES,
              parentId: parentPolicy.id,
            },
            invokedBy: {
              orgId: org.id,
              userId: user.id,
              permissions: user.getPermissions(),
            },
          });

          const fetched = await sutWithPrimary.getPolicies({ orgId: org.id });
          expect(fetched).toHaveLength(2);
          expect(
            fetched.find((it) => it.id === childPolicy.id)!.parentId,
          ).toEqual(parentPolicy.id);
        },
      );

      testWithUserAndOrg(
        'should update an existing policy',
        async ({ org, user }) => {
          const policy = await sutWithPrimary.createPolicy({
            orgId: org.id,
            policy: {
              name: 'Test Policy',
              policyText: 'Test policy text',
              enforcementGuidelines: 'Test enforcement guidelines',
              policyType: PolicyType.DRUG_SALES,
              parentId: null,
            },
            invokedBy: {
              orgId: org.id,
              userId: user.id,
              permissions: user.getPermissions(),
            },
          });

          const updatedPolicy = await sutWithPrimary.updatePolicy({
            orgId: org.id,
            policy: {
              id: policy.id,
              name: 'Updated Policy',
              policyText: 'Updated policy text',
              enforcementGuidelines: 'Updated enforcement guidelines',
              policyType: PolicyType.DRUG_SALES,
              parentId: null,
            },
            invokedBy: {
              orgId: org.id,
              userId: user.id,
              permissions: user.getPermissions(),
            },
          });

          const fetched = await sutWithPrimary.getPolicies({ orgId: org.id });
          expect(fetched).toHaveLength(1);
          expect(fetched[0].id).toEqual(updatedPolicy.id);
          expect(fetched[0].name).toEqual('Updated Policy');
          expect(fetched[0].policyText).toEqual('Updated policy text');
        },
      );

      testWithUserAndOrg(
        'Prevent creation of policy with the same name as an existing policy',
        async ({ org, user }) => {
          await sutWithPrimary.createPolicy({
            orgId: org.id,
            policy: {
              name: 'Test Policy',
              policyText: 'Test policy text',
              enforcementGuidelines: 'Test enforcement guidelines',
              policyType: PolicyType.DRUG_SALES,
              parentId: null,
            },
            invokedBy: {
              orgId: org.id,
              userId: user.id,
              permissions: user.getPermissions(),
            },
          });

          await expect(
            sutWithPrimary.createPolicy({
              orgId: org.id,
              policy: {
                name: 'Test Policy',
                policyText: 'Test policy text',
                enforcementGuidelines: 'Test enforcement guidelines',
                policyType: PolicyType.DRUG_SALES,
                parentId: null,
              },
              invokedBy: {
                orgId: org.id,
                userId: user.id,
                permissions: user.getPermissions(),
              },
            }),
          ).rejects.toThrow(
            expect.objectContaining({ type: [ErrorType.UniqueViolation] }),
          );
        },
      );
    });
  });
  describe('TextBank-returning methods', () => {
    const createdTextBanks = [] as {
      id: string;
      orgId: string;
      name: string;
      description: string | null;
      type: 'STRING' | 'REGEX';
      createdAt: Date;
      updatedAt: Date;
      ownerId: string | null;
      strings: string[];
    }[];

    describe('Mutations', () => {
      describe('#createTextBank', () => {
        it('should create a text bank', async () => {
          const textBank = await sutWithPrimary.createTextBank(dummyOrgId, {
            name: 'Test Text Bank',
            description: 'Test description',
            type: 'STRING' as const,
            strings: ['test entry 1', 'test entry 2'],
          });

          expect(textBank).toEqual(
            expect.objectContaining({
              createdAt: expect.any(Date),
              updatedAt: expect.any(Date),
              description: 'Test description',
              id: expect.any(String),
              name: 'Test Text Bank',
              orgId: expect.any(String),
              ownerId: null,
              strings: ['test entry 1', 'test entry 2'],
              type: 'STRING',
            }),
          );

          expect(textBank.orgId).toBe(dummyOrgId);
          createdTextBanks.push(textBank);
        });
      });
    });

    describe('Read methods', () => {
      describe('#getTextBanks', () => {
        it('should return all text banks, properly formatted', async () => {
          const res = await sutWithPrimary.getTextBanks({ orgId: dummyOrgId });
          expect(res).toHaveLength(createdTextBanks.length);
          expect(res).toEqual(expect.arrayContaining(createdTextBanks));
        });
      });

      describe('#getTextBank', () => {
        it('should return a specific text bank, properly formatted', async () => {
          const textBank = createdTextBanks[0];
          const res = await sutWithPrimary.getTextBank({
            orgId: dummyOrgId,
            id: textBank.id,
          });
          expect(res).toEqual(textBank);
        });
      });
    });
  });

  describe('#getItemType', () => {
    const testWithOneItemTypeFixture = makeTestWithFixture(async () => {
      const itemType = await sutWithPrimary.createContentType(dummyOrgId, {
        schema: dummySchema,
        description: null,
        name: faker.random.alphaNumeric(),
        schemaFieldRoles: {
          displayName: 'fakeField',
        },
      });

      return {
        itemType,
        async cleanup() {
          await sutWithPrimary.deleteItemType({
            orgId: dummyOrgId,
            itemTypeId: itemType.id,
          });
        },
      };
    });

    const testWithTwoItemTypesFixture = makeTestWithFixture(async () => {
      const itemType = await sutWithPrimary.createContentType(dummyOrgId, {
        schema: dummySchema,
        description: null,
        name: faker.random.alphaNumeric(),
        schemaFieldRoles: {
          displayName: 'fakeField',
        },
      });

      const newItemType = await sutWithPrimary.updateContentType(dummyOrgId, {
        id: itemType.id,
        name: faker.random.alphaNumeric(),
        schemaFieldRoles: {
          creatorId: undefined,
        },
      });

      return {
        itemType,
        newItemType,
        async cleanup() {
          await sutWithPrimary.deleteItemType({
            orgId: dummyOrgId,
            itemTypeId: itemType.id,
          });
        },
      };
    });

    it("Should return undefined if an item type with the given ID doesn't exist", async () => {
      const itemType = await sutWithPrimary.getItemType({
        orgId: dummyOrgId,
        itemTypeSelector: { id: 'fakeId' },
      });

      expect(itemType).toBeUndefined();
    });
    testWithOneItemTypeFixture(
      'Should return a partial item type if requested for a selector without a version',
      async ({ itemType }) => {
        const fetched = await sutWithPrimary.getItemType({
          orgId: dummyOrgId,
          itemTypeSelector: { id: itemType.id, schemaVariant: 'partial' },
        });

        expect(fetched).not.toBeNull();
        fetched!.schema.forEach((it) => expect(it.required).toEqual(false));
      },
    );
    testWithTwoItemTypesFixture(
      'Should return a partial item type if requested for a selector with a version',
      async ({ itemType, newItemType }) => {
        const fetched = await sutWithPrimary.getItemType({
          orgId: dummyOrgId,
          itemTypeSelector: {
            id: itemType.id,
            schemaVariant: 'partial',
            version: newItemType.version,
          },
        });

        expect(fetched).not.toBeNull();
        expect(fetched!.name).toEqual(newItemType.name);
        fetched!.schema.forEach((it) => expect(it.required).toEqual(false));

        await sutWithPrimary.deleteItemType({
          itemTypeId: itemType.id,
          orgId: dummyOrgId,
        });
      },
    );
    testWithTwoItemTypesFixture(
      'Should return latest item type if only an ID is provided',
      async ({ itemType, newItemType }) => {
        const fetched = await sutWithPrimary.getItemType({
          orgId: dummyOrgId,
          itemTypeSelector: { id: itemType.id },
        });

        expect(fetched).not.toBeNull();
        expect(fetched!.name).toEqual(newItemType.name);
      },
    );
    testWithOneItemTypeFixture(
      'Should return requested item type version',
      async ({ itemType }) => {
        await sutWithPrimary.updateContentType(dummyOrgId, {
          id: itemType.id,
          name: faker.random.alphaNumeric(),
          schemaFieldRoles: {
            creatorId: undefined,
          },
        });

        const fetched = await sutWithPrimary.getItemType({
          orgId: dummyOrgId,
          itemTypeSelector: { id: itemType.id, version: itemType.version },
        });

        expect(fetched).not.toBeNull();
        expect(fetched!.name).toEqual(itemType.name);
      },
    );
  });
});
