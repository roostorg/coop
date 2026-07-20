/* eslint-disable max-lines */
import { faker } from '@faker-js/faker';
import { Kysely } from 'kysely';
import { type UnionToIntersection } from 'type-fest';
import { uid } from 'uid';

import getBottle from '../../iocContainer/index.js';
import createOrg from '../../test/fixtureHelpers/createOrg.js';
import createRule from '../../test/fixtureHelpers/createRule.js';
import createUser from '../../test/fixtureHelpers/createUser.js';
import { makeTransactionalTestWithFixture } from '../../test/harness/transactionalTest.js';
import { type MockedServer } from '../../test/setupMockedServer.js';
import {
  makeMockPgDialect,
  type MockPgExecute,
} from '../../test/stubs/KyselyPg.js';
import { makeTestWithFixture } from '../../test/utils.js';
import { ErrorType } from '../../utils/errors.js';
import { type Satisfies } from '../../utils/typescript-types.js';
import { type ModerationConfigServicePg } from './dbTypes.js';
import {
  RuleStatus,
  RuleType,
  type ConditionSet,
  type Policy,
} from './index.js';
import { ModerationConfigService } from './moderationConfigService.js';
import { PolicyType } from './types/policies.js';

type TestDeps = MockedServer['deps'];

type Sut = ConstructorParameters<typeof ModerationConfigService>[0];

// We test the moderationConfigService as a black box: every test gets a fresh
// org and seeds data only through the public methods, then verifies it can read
// or delete that data with only the public methods. The transactional harness
// rolls everything back after each test, so there's no cleanup and no state
// leaking between tests (and therefore no ordering dependency between them).
//
// To test that the correct db is queried (i.e., replicas vs the primary), we
// use two service instances, each with access only to the db we expect to be
// hit; the other db is a kysely instance that throws if it's ever used.
function makeSuts(primary: Sut, replica: Sut) {
  const kyselyShouldBeUnused = new Kysely<ModerationConfigServicePg>({
    dialect: makeMockPgDialect(
      jest.fn<MockPgExecute>().mockImplementation(async () => {
        throw new Error('Did not expect this kysely instance to be used!');
      }),
    ),
  });

  return {
    sutWithPrimary: new ModerationConfigService(
      primary,
      kyselyShouldBeUnused,
      async () => {},
    ),
    sutWithReadReplica: new ModerationConfigService(
      kyselyShouldBeUnused,
      replica,
      async () => {},
    ),
  };
}

async function setupOrg(deps: TestDeps) {
  const suts = makeSuts(deps.KyselyPg, deps.KyselyPgReadReplica);
  const { org, defaultUserItemType } = await createOrg(
    {
      KyselyPg: deps.KyselyPg,
      ModerationConfigService: deps.ModerationConfigService,
      ApiKeyService: deps.ApiKeyService,
    },
    uid(),
  );
  return { ...suts, org, defaultUserItemType };
}

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

async function expectReadReplicaUse<T extends SupportsReplicaMethod>(
  suts: {
    sutWithPrimary: ModerationConfigService;
    sutWithReadReplica: ModerationConfigService;
  },
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
  await suts.sutWithPrimary[method](filters);
  await suts.sutWithPrimary[method]({ ...filters, readFromReplica: false });
  await suts.sutWithReadReplica[method]({ ...filters, readFromReplica: true });
}

const dummySchema = [
  { name: 'fakeField', type: 'STRING', required: false, container: null },
] as const;

const minimalRuleConditionSet = {
  conjunction: 'AND' as const,
  conditions: [
    {
      input: { type: 'FULL_ITEM' as const },
      comparator: 'IS_NOT_PROVIDED' as const,
    },
  ],
} satisfies ConditionSet;

const itemTypeSnapshotMatchers = {
  id: expect.any(String),
  version: expect.any(String),
  orgId: expect.any(String),
};

const actionSnapshotMatchers = {
  id: expect.any(String),
  orgId: expect.any(String),
};

describe('ModerationConfigService', () => {
  const testWithOrg = makeTransactionalTestWithFixture(async ({ deps }) =>
    setupOrg(deps),
  );

  describe('#getRuleByIdAndOrg', () => {
    const testWithRuleRow = makeTransactionalTestWithFixture(
      async ({ deps }) => {
        const base = await setupOrg(deps);
        const { user } = await createUser(deps.KyselyPg, base.org.id);
        const rule = await createRule(deps.KyselyPg, base.org.id, {
          creator: user,
          name: 'getRuleByIdAndOrg fixture rule',
          ruleType: RuleType.USER,
          status: RuleStatus.DRAFT,
          conditionSet: minimalRuleConditionSet,
        });

        return { ...base, user, ruleId: rule.id };
      },
    );

    testWithRuleRow(
      'returns the rule when the org id matches the rule row',
      async ({ sutWithPrimary, org, ruleId }) => {
        const row = await sutWithPrimary.getRuleByIdAndOrg(ruleId, org.id, {
          readFromReplica: false,
        });
        expect(row).not.toBeNull();
        expect(row!.id).toBe(ruleId);
        expect(row!.orgId).toBe(org.id);
      },
    );

    testWithRuleRow(
      'returns null when the org id does not match (IDOR guard)',
      async ({ sutWithPrimary, deps, ruleId }) => {
        const { org: otherOrg } = await createOrg(
          {
            KyselyPg: deps.KyselyPg,
            ModerationConfigService: deps.ModerationConfigService,
            ApiKeyService: deps.ApiKeyService,
          },
          uid(),
        );
        const row = await sutWithPrimary.getRuleByIdAndOrg(
          ruleId,
          otherOrg.id,
          {
            readFromReplica: false,
          },
        );
        expect(row).toBeNull();
      },
    );
  });

  describe('ItemType-Returning methods', () => {
    describe('Creation methods', () => {
      describe('#createContentType', () => {
        testWithOrg(
          'should return and durably save the new item type',
          async ({ sutWithPrimary, org }) => {
            const saved = await sutWithPrimary.createContentType(org.id, {
              schema: dummySchema,
              description: null,
              name: 'Content Item Type',
              schemaFieldRoles: {
                displayName: 'fakeField',
              },
            });

            const fetched = await sutWithPrimary.getItemType({
              orgId: org.id,
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
                  "ipAddress": undefined,
                  "isDeleted": undefined,
                  "parentId": undefined,
                  "threadId": undefined,
                },
                "schemaVariant": "original",
                "version": Any<String>,
              }
            `,
            );
            expect(saved.orgId).toBe(org.id);
            expect(saved).toEqual(fetched);
          },
        );
      });

      describe('#createThreadType', () => {
        testWithOrg(
          'should return and durably save the new item type',
          async ({ sutWithPrimary, org }) => {
            const saved = await sutWithPrimary.createThreadType(org.id, {
              schema: dummySchema,
              description: 'Test description',
              name: 'Thread Item Type',
              schemaFieldRoles: {
                displayName: 'fakeField',
              },
            });

            const fetched = await sutWithPrimary.getItemType({
              orgId: org.id,
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
                  "ipAddress": undefined,
                  "isDeleted": undefined,
                },
                "schemaVariant": "original",
                "version": Any<String>,
              }
            `,
            );
            expect(saved.orgId).toBe(org.id);
            expect(saved).toEqual(fetched);
          },
        );
      });

      describe('#createUserType', () => {
        testWithOrg(
          'should return and durably save the new item type',
          async ({ sutWithPrimary, org }) => {
            const saved = await sutWithPrimary.createUserType(org.id, {
              schema: dummySchema,
              description: null,
              name: 'User Item Type',
              schemaFieldRoles: {
                displayName: 'fakeField',
              },
            });

            const fetched = await sutWithPrimary.getItemType({
              orgId: org.id,
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
                  "email": undefined,
                  "ipAddress": undefined,
                  "isDeleted": undefined,
                  "profileIcon": undefined,
                },
                "schemaVariant": "original",
                "version": Any<String>,
              }
            `,
            );
            expect(saved.orgId).toBe(org.id);
            expect(saved).toEqual(fetched);
          },
        );
      });
    });

    describe('Read methods', () => {
      describe('#getItemTypes', () => {
        testWithOrg(
          'should return all item types, properly formatted',
          async ({ sutWithPrimary, org, defaultUserItemType }) => {
            const contentType = await sutWithPrimary.createContentType(org.id, {
              schema: dummySchema,
              description: null,
              name: 'Content Item Type',
              schemaFieldRoles: { displayName: 'fakeField' },
            });
            const threadType = await sutWithPrimary.createThreadType(org.id, {
              schema: dummySchema,
              description: null,
              name: 'Thread Item Type',
              schemaFieldRoles: { displayName: 'fakeField' },
            });
            const userType = await sutWithPrimary.createUserType(org.id, {
              schema: dummySchema,
              description: null,
              name: 'User Item Type',
              schemaFieldRoles: { displayName: 'fakeField' },
            });

            const expected = [
              defaultUserItemType,
              contentType,
              threadType,
              userType,
            ];
            const res = await sutWithPrimary.getItemTypes({ orgId: org.id });
            expect(res).toHaveLength(expected.length);
            expect(res).toEqual(expect.arrayContaining(expected));
          },
        );
      });

      describe('#getItemTypesByKind', () => {
        testWithOrg(
          'should filter by kind',
          async ({ sutWithPrimary, org, defaultUserItemType }) => {
            const contentType = await sutWithPrimary.createContentType(org.id, {
              schema: dummySchema,
              description: null,
              name: 'Content Item Type',
              schemaFieldRoles: { displayName: 'fakeField' },
            });
            const threadType = await sutWithPrimary.createThreadType(org.id, {
              schema: dummySchema,
              description: null,
              name: 'Thread Item Type',
              schemaFieldRoles: { displayName: 'fakeField' },
            });
            const userType = await sutWithPrimary.createUserType(org.id, {
              schema: dummySchema,
              description: null,
              name: 'User Item Type',
              schemaFieldRoles: { displayName: 'fakeField' },
            });

            const userItemTypes = await sutWithPrimary.getItemTypesByKind({
              orgId: org.id,
              kind: 'USER',
            });
            const contentItemTypes = await sutWithPrimary.getItemTypesByKind({
              orgId: org.id,
              kind: 'CONTENT',
            });
            const threadItemTypes = await sutWithPrimary.getItemTypesByKind({
              orgId: org.id,
              kind: 'THREAD',
            });

            expect(userItemTypes).toHaveLength(2);
            expect(userItemTypes).toEqual(
              expect.arrayContaining([defaultUserItemType, userType]),
            );

            expect(contentItemTypes).toEqual([contentType]);
            expect(threadItemTypes).toEqual([threadType]);
          },
        );
      });

      describe('#getDefaultUserType', () => {
        testWithOrg(
          'should return the default user type, properly formatted',
          async ({ sutWithPrimary, org, defaultUserItemType }) => {
            const res = await sutWithPrimary.getDefaultUserType({
              orgId: org.id,
            });
            expect(res).toEqual(defaultUserItemType);
          },
        );
      });

      describe('#getItemTypesForAction', () => {
        testWithOrg(
          'should query from the proper db',
          async ({ sutWithPrimary, sutWithReadReplica, org }) => {
            // These tests will throw if the wrong db is used (see kyselyShouldBeUnused)
            await sutWithPrimary.getItemTypesForAction({
              orgId: org.id,
              actionId: 'someId',
              directives: { maxAge: 0 },
            });
            await sutWithReadReplica.getItemTypesForAction({
              orgId: org.id,
              actionId: 'someId',
              directives: { maxAge: 10 },
            });
          },
        );

        it.skip('should return the right results', () => {});
      });

      describe('#getItemTypesForRule', () => {
        testWithOrg(
          'should query from the proper db',
          async ({ sutWithPrimary, sutWithReadReplica, org }) => {
            await expectReadReplicaUse(
              { sutWithPrimary, sutWithReadReplica },
              'getItemTypesForRule',
              { orgId: org.id, ruleId: 'sasts' },
            );
          },
        );

        it.skip('should return the right results', () => {});
      });
    });
  });

  describe('Action-returning methods', () => {
    describe('Creation methods', () => {
      describe('#upsertBuiltInActions', () => {
        testWithOrg(
          'seeds the three built-in (non-CUSTOM_ACTION) rows for the org',
          async ({ sutWithPrimary, org }) => {
            const all = await sutWithPrimary.getActions({ orgId: org.id });
            const builtIns = all.filter(
              (it) => it.actionType !== 'CUSTOM_ACTION',
            );
            const types = builtIns.map((it) => it.actionType).sort();
            expect(types).toEqual(
              [
                'ENQUEUE_AUTHOR_TO_MRT',
                'ENQUEUE_TO_MRT',
                'ENQUEUE_TO_NCMEC',
              ].sort(),
            );
            for (const action of builtIns) {
              expect(action.orgId).toBe(org.id);
              expect(action).not.toHaveProperty('callbackUrl');
            }
          },
        );

        testWithOrg(
          'is idempotent: calling twice does not create duplicates',
          async ({ sutWithPrimary, org }) => {
            const before = await sutWithPrimary.getActions({
              orgId: org.id,
            });
            const beforeBuiltIns = before
              .filter((it) => it.actionType !== 'CUSTOM_ACTION')
              .map((it) => it.id)
              .sort();
            await sutWithPrimary.upsertBuiltInActions(org.id);
            const after = await sutWithPrimary.getActions({
              orgId: org.id,
            });
            const afterBuiltIns = after
              .filter((it) => it.actionType !== 'CUSTOM_ACTION')
              .map((it) => it.id)
              .sort();
            expect(afterBuiltIns).toEqual(beforeBuiltIns);
          },
        );

        testWithOrg(
          'built-ins surface for the appropriate item type kinds',
          async ({ sutWithPrimary, org, defaultUserItemType }) => {
            const contentType = await sutWithPrimary.createContentType(org.id, {
              schema: dummySchema,
              description: null,
              name: faker.random.alphaNumeric(16),
              schemaFieldRoles: { displayName: 'fakeField' },
            });

            const forUser = await sutWithPrimary.getActionsForItemType({
              orgId: org.id,
              itemTypeId: defaultUserItemType.id,
              itemTypeKind: 'USER',
            });
            expect(forUser.map((it) => it.actionType).sort()).toEqual(
              ['ENQUEUE_TO_MRT', 'ENQUEUE_TO_NCMEC'].sort(),
            );

            const forContent = await sutWithPrimary.getActionsForItemType({
              orgId: org.id,
              itemTypeId: contentType.id,
              itemTypeKind: 'CONTENT',
            });
            expect(forContent.map((it) => it.actionType).sort()).toEqual(
              [
                'ENQUEUE_AUTHOR_TO_MRT',
                'ENQUEUE_TO_MRT',
                'ENQUEUE_TO_NCMEC',
              ].sort(),
            );
          },
        );
      });

      describe('#createAction', () => {
        testWithOrg(
          'should return and durably save the new action',
          async ({ sutWithPrimary, org }) => {
            const saved = await sutWithPrimary.createAction(org.id, {
              name: 'Test Action',
              description: 'Test description',
              type: 'CUSTOM_ACTION',
              callbackUrl: 'https://example.com',
              callbackUrlHeaders: null,
              callbackUrlBody: null,
              applyUserStrikes: false,
            });

            const [fetched] = await sutWithPrimary.getActions({
              orgId: org.id,
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
                "customMrtApiParams": null,
                "description": "Test description",
                "id": Any<String>,
                "name": "Test Action",
                "orgId": Any<String>,
                "penalty": "NONE",
              }
            `,
            );
            expect(saved.orgId).toBe(org.id);
            expect(saved).toEqual(fetched);
          },
        );
      });
    });

    describe('Read methods', () => {
      describe('#getActions', () => {
        testWithOrg(
          'should query from the proper db',
          async ({ sutWithPrimary, sutWithReadReplica, org }) => {
            await expectReadReplicaUse(
              { sutWithPrimary, sutWithReadReplica },
              'getActions',
              { orgId: org.id },
            );
          },
        );

        testWithOrg(
          'should return all custom actions, properly formatted',
          async ({ sutWithPrimary, org }) => {
            const createdActions = [
              await sutWithPrimary.createAction(org.id, {
                name: faker.random.alphaNumeric(16),
                description: 'Test description',
                type: 'CUSTOM_ACTION',
                callbackUrl: 'https://example.com',
                callbackUrlHeaders: null,
                callbackUrlBody: null,
                applyUserStrikes: false,
              }),
              await sutWithPrimary.createAction(org.id, {
                name: faker.random.alphaNumeric(16),
                description: null,
                type: 'CUSTOM_ACTION',
                callbackUrl: 'https://example.com',
                callbackUrlHeaders: null,
                callbackUrlBody: null,
                applyUserStrikes: false,
              }),
            ];

            const res = await sutWithPrimary.getActions({ orgId: org.id });
            const customActions = res.filter(
              (it) => it.actionType === 'CUSTOM_ACTION',
            );
            expect(customActions).toHaveLength(createdActions.length);
            expect(customActions).toEqual(
              expect.arrayContaining(createdActions),
            );
          },
        );

        testWithOrg(
          'should round-trip a non-null customMrtApiParams value',
          async ({ sutWithPrimary, deps, org }) => {
            const action = await sutWithPrimary.createAction(org.id, {
              name: faker.random.alphaNumeric(16),
              description: null,
              type: 'CUSTOM_ACTION',
              callbackUrl: 'https://example.com',
              callbackUrlHeaders: null,
              callbackUrlBody: null,
            });

            // Legacy shape pre-dating the typed parameter spec — set it via raw
            // Kysely to verify the read mapping still surfaces older rows
            // unchanged for back-compat.
            const params = [
              { key: 'foo', value: 'bar' },
              { key: 'baz', value: 'qux' },
            ];
            await deps.KyselyPg.updateTable('public.actions')
              .set({ custom_mrt_api_params: params })
              .where('id', '=', action.id)
              .where('org_id', '=', org.id)
              .execute();

            const [fetched] = await sutWithPrimary.getActions({
              orgId: org.id,
              ids: [action.id],
            });
            expect(fetched).toBeDefined();
            expect(fetched.actionType).toBe('CUSTOM_ACTION');
            // The narrowed CustomAction shape exposes customMrtApiParams.
            expect(
              (fetched as { customMrtApiParams: unknown }).customMrtApiParams,
            ).toEqual(params);
          },
        );

        testWithOrg(
          'round-trips typed parameters through createAction',
          async ({ sutWithPrimary, org }) => {
            const parameters = [
              {
                name: 'num_days_banned',
                displayName: 'Days to ban',
                type: 'NUMBER',
                required: true,
                min: 1,
                max: 365,
                defaultValue: 7,
              },
              {
                name: 'reason',
                displayName: 'Reason',
                type: 'SELECT',
                required: true,
                options: [
                  { value: 'spam', label: 'Spam' },
                  { value: 'abuse', label: 'Abuse' },
                ],
              },
              {
                name: 'notify_user',
                displayName: 'Notify user',
                type: 'BOOLEAN',
                required: false,
                defaultValue: false,
              },
            ];

            const created = await sutWithPrimary.createAction(org.id, {
              name: faker.random.alphaNumeric(16),
              description: null,
              type: 'CUSTOM_ACTION',
              callbackUrl: 'https://example.com',
              callbackUrlHeaders: null,
              callbackUrlBody: null,
              parameters,
            });

            const [fetched] = await sutWithPrimary.getActions({
              orgId: org.id,
              ids: [created.id],
            });
            expect(fetched.actionType).toBe('CUSTOM_ACTION');
            const stored = (fetched as { customMrtApiParams: unknown })
              .customMrtApiParams;
            expect(stored).toEqual(parameters);
          },
        );

        testWithOrg(
          'rejects invalid parameters at create time',
          async ({ sutWithPrimary, org }) => {
            await expect(
              sutWithPrimary.createAction(org.id, {
                name: faker.random.alphaNumeric(16),
                description: null,
                type: 'CUSTOM_ACTION',
                callbackUrl: 'https://example.com',
                callbackUrlHeaders: null,
                callbackUrlBody: null,
                parameters: [
                  {
                    name: 'invalid name with spaces',
                    displayName: 'X',
                    type: 'STRING',
                    required: false,
                  },
                ],
              }),
            ).rejects.toMatchObject({ status: 400 });
          },
        );
      });
    });

    describe('Update methods', () => {
      describe('#updateCustomAction', () => {
        const testWithAction = makeTransactionalTestWithFixture(
          async ({ deps }) => {
            const base = await setupOrg(deps);
            const action = await base.sutWithPrimary.createAction(base.org.id, {
              name: faker.random.alphaNumeric(16),
              description: 'before',
              type: 'CUSTOM_ACTION',
              callbackUrl: 'https://before.example.com',
              callbackUrlHeaders: null,
              callbackUrlBody: null,
              applyUserStrikes: false,
            });
            return { ...base, action };
          },
        );

        testWithAction(
          'should update user-editable fields and bump updated_at',
          async ({ sutWithPrimary, deps, org, action }) => {
            const before = await deps.KyselyPg.selectFrom('public.actions')
              .select(['updated_at'])
              .where('id', '=', action.id)
              .executeTakeFirstOrThrow();

            // Wait briefly so updated_at can advance even on fast clocks.
            await new Promise((resolve) => setTimeout(resolve, 5));

            const updated = await sutWithPrimary.updateCustomAction(org.id, {
              actionId: action.id,
              patch: {
                description: 'after',
                callbackUrl: 'https://after.example.com',
                applyUserStrikes: true,
              },
            });

            expect(updated.actionType).toBe('CUSTOM_ACTION');
            expect(updated.description).toBe('after');
            expect(updated.callbackUrl).toBe('https://after.example.com');
            expect(updated.applyUserStrikes).toBe(true);

            const after = await deps.KyselyPg.selectFrom('public.actions')
              .select(['updated_at', 'description'])
              .where('id', '=', action.id)
              .executeTakeFirstOrThrow();
            expect(after.description).toBe('after');
            expect(after.updated_at.getTime()).toBeGreaterThan(
              before.updated_at.getTime(),
            );
          },
        );

        testWithAction(
          'should not bump updated_at for an empty patch with no itemTypeIds',
          async ({ sutWithPrimary, deps, org, action }) => {
            const before = await deps.KyselyPg.selectFrom('public.actions')
              .select(['updated_at'])
              .where('id', '=', action.id)
              .executeTakeFirstOrThrow();

            await new Promise((resolve) => setTimeout(resolve, 5));

            const result = await sutWithPrimary.updateCustomAction(org.id, {
              actionId: action.id,
              patch: {},
            });

            const after = await deps.KyselyPg.selectFrom('public.actions')
              .select(['updated_at'])
              .where('id', '=', action.id)
              .executeTakeFirstOrThrow();
            expect(after.updated_at.getTime()).toBe(
              before.updated_at.getTime(),
            );
            expect(result.id).toBe(action.id);
          },
        );

        testWithAction(
          'should throw NotFound when called with the wrong org',
          async ({ sutWithPrimary, deps, action }) => {
            const { org: otherOrg } = await createOrg(
              {
                KyselyPg: deps.KyselyPg,
                ModerationConfigService: deps.ModerationConfigService,
                ApiKeyService: deps.ApiKeyService,
              },
              uid(),
            );
            await expect(
              sutWithPrimary.updateCustomAction(otherOrg.id, {
                actionId: action.id,
                patch: { description: 'leaked' },
              }),
            ).rejects.toThrow(
              expect.objectContaining({ type: [ErrorType.NotFound] }),
            );

            // The action's row in the original org must be untouched.
            const row = await deps.KyselyPg.selectFrom('public.actions')
              .select(['description'])
              .where('id', '=', action.id)
              .executeTakeFirstOrThrow();
            expect(row.description).toBe('before');
          },
        );

        testWithAction(
          'updates parameters when patch.parameters is supplied',
          async ({ sutWithPrimary, org, action }) => {
            await sutWithPrimary.updateCustomAction(org.id, {
              actionId: action.id,
              patch: {
                parameters: [
                  {
                    name: 'foo',
                    displayName: 'Foo',
                    type: 'STRING',
                    required: false,
                  },
                ],
              },
            });

            const [afterSet] = await sutWithPrimary.getActions({
              orgId: org.id,
              ids: [action.id],
            });
            expect(
              (afterSet as { customMrtApiParams: unknown }).customMrtApiParams,
            ).toEqual([
              {
                name: 'foo',
                displayName: 'Foo',
                type: 'STRING',
                required: false,
              },
            ]);

            // Passing `[]` should clear, not leave the existing list in place.
            await sutWithPrimary.updateCustomAction(org.id, {
              actionId: action.id,
              patch: { parameters: [] },
            });
            const [afterClear] = await sutWithPrimary.getActions({
              orgId: org.id,
              ids: [action.id],
            });
            expect(
              (afterClear as { customMrtApiParams: unknown })
                .customMrtApiParams,
            ).toBeNull();
          },
        );

        testWithAction(
          'leaves parameters unchanged when patch.parameters is omitted',
          async ({ sutWithPrimary, org, action }) => {
            await sutWithPrimary.updateCustomAction(org.id, {
              actionId: action.id,
              patch: {
                parameters: [
                  {
                    name: 'foo',
                    displayName: 'Foo',
                    type: 'STRING',
                    required: false,
                  },
                ],
              },
            });
            await sutWithPrimary.updateCustomAction(org.id, {
              actionId: action.id,
              patch: { description: 'after' },
            });
            const [fetched] = await sutWithPrimary.getActions({
              orgId: org.id,
              ids: [action.id],
            });
            expect(fetched.description).toBe('after');
            expect(
              (fetched as { customMrtApiParams: unknown }).customMrtApiParams,
            ).toEqual([
              {
                name: 'foo',
                displayName: 'Foo',
                type: 'STRING',
                required: false,
              },
            ]);
          },
        );

        testWithAction(
          'should reject renaming onto an existing action name',
          async ({ sutWithPrimary, org, action }) => {
            const other = await sutWithPrimary.createAction(org.id, {
              name: faker.random.alphaNumeric(16),
              description: null,
              type: 'CUSTOM_ACTION',
              callbackUrl: 'https://example.com',
              callbackUrlHeaders: null,
              callbackUrlBody: null,
            });
            await expect(
              sutWithPrimary.updateCustomAction(org.id, {
                actionId: action.id,
                patch: { name: other.name },
              }),
            ).rejects.toThrow(
              expect.objectContaining({
                type: [ErrorType.UniqueViolation],
              }),
            );
          },
        );

        testWithAction(
          'should replace the item-type junction when itemTypeIds is provided',
          async ({ sutWithPrimary, deps, org, action }) => {
            const itemTypeA = await sutWithPrimary.createContentType(org.id, {
              schema: dummySchema,
              description: null,
              name: faker.random.alphaNumeric(16),
              schemaFieldRoles: { displayName: 'fakeField' },
            });
            const itemTypeB = await sutWithPrimary.createContentType(org.id, {
              schema: dummySchema,
              description: null,
              name: faker.random.alphaNumeric(16),
              schemaFieldRoles: { displayName: 'fakeField' },
            });

            await sutWithPrimary.updateCustomAction(org.id, {
              actionId: action.id,
              patch: {},
              itemTypeIds: [itemTypeA.id],
            });
            expect(
              await deps.KyselyPg.selectFrom('public.actions_and_item_types')
                .select(['item_type_id'])
                .where('action_id', '=', action.id)
                .execute(),
            ).toEqual([{ item_type_id: itemTypeA.id }]);

            await sutWithPrimary.updateCustomAction(org.id, {
              actionId: action.id,
              patch: {},
              itemTypeIds: [itemTypeB.id],
            });
            expect(
              await deps.KyselyPg.selectFrom('public.actions_and_item_types')
                .select(['item_type_id'])
                .where('action_id', '=', action.id)
                .execute(),
            ).toEqual([{ item_type_id: itemTypeB.id }]);

            await sutWithPrimary.updateCustomAction(org.id, {
              actionId: action.id,
              patch: {},
              itemTypeIds: [],
            });
            expect(
              await deps.KyselyPg.selectFrom('public.actions_and_item_types')
                .select(['item_type_id'])
                .where('action_id', '=', action.id)
                .execute(),
            ).toEqual([]);
          },
        );
      });
    });

    describe('Delete methods', () => {
      describe('#deleteCustomAction', () => {
        const testWithAction = makeTransactionalTestWithFixture(
          async ({ deps }) => {
            const base = await setupOrg(deps);
            const action = await base.sutWithPrimary.createAction(base.org.id, {
              name: faker.random.alphaNumeric(16),
              description: null,
              type: 'CUSTOM_ACTION',
              callbackUrl: 'https://example.com',
              callbackUrlHeaders: null,
              callbackUrlBody: null,
            });
            return { ...base, action };
          },
        );

        testWithAction(
          'should return true and delete the action on success',
          async ({ sutWithPrimary, org, action }) => {
            const result = await sutWithPrimary.deleteCustomAction({
              orgId: org.id,
              actionId: action.id,
            });
            expect(result).toBe(true);
            expect(
              await sutWithPrimary.getActions({
                orgId: org.id,
                ids: [action.id],
              }),
            ).toEqual([]);
          },
        );

        testWithOrg(
          'should return false when the action does not exist',
          async ({ sutWithPrimary, org }) => {
            const result = await sutWithPrimary.deleteCustomAction({
              orgId: org.id,
              actionId: uid(),
            });
            expect(result).toBe(false);
          },
        );

        testWithAction(
          'should return false when called with the wrong org and leave the row intact',
          async ({ sutWithPrimary, deps, org, action }) => {
            const { org: otherOrg } = await createOrg(
              {
                KyselyPg: deps.KyselyPg,
                ModerationConfigService: deps.ModerationConfigService,
                ApiKeyService: deps.ApiKeyService,
              },
              uid(),
            );
            const result = await sutWithPrimary.deleteCustomAction({
              orgId: otherOrg.id,
              actionId: action.id,
            });
            expect(result).toBe(false);
            const [stillThere] = await sutWithPrimary.getActions({
              orgId: org.id,
              ids: [action.id],
            });
            expect(stillThere.id).toBe(action.id);
          },
        );

        testWithAction(
          'should clean up rules_and_actions and actions_and_item_types junction rows',
          async ({ sutWithPrimary, deps, org, action }) => {
            const itemType = await sutWithPrimary.createContentType(org.id, {
              schema: dummySchema,
              description: null,
              name: faker.random.alphaNumeric(16),
              schemaFieldRoles: { displayName: 'fakeField' },
            });
            const rule = await createRule(deps.KyselyPg, org.id);

            await deps.KyselyPg.insertInto('public.actions_and_item_types')
              .values({ action_id: action.id, item_type_id: itemType.id })
              .execute();
            await deps.KyselyPg.insertInto('public.rules_and_actions')
              .values({ action_id: action.id, rule_id: rule.id })
              .execute();

            const result = await sutWithPrimary.deleteCustomAction({
              orgId: org.id,
              actionId: action.id,
            });
            expect(result).toBe(true);
            expect(
              await deps.KyselyPg.selectFrom('public.actions_and_item_types')
                .select(['action_id'])
                .where('action_id', '=', action.id)
                .execute(),
            ).toEqual([]);
            expect(
              await deps.KyselyPg.selectFrom('public.rules_and_actions')
                .select(['action_id'])
                .where('action_id', '=', action.id)
                .execute(),
            ).toEqual([]);
          },
        );
      });
    });

    describe('#getActionsForItemType', () => {
      const testWithItemTypeAndActions = makeTransactionalTestWithFixture(
        async ({ deps }) => {
          const base = await setupOrg(deps);
          const { sutWithPrimary, org } = base;

          const itemType = await sutWithPrimary.createContentType(org.id, {
            schema: dummySchema,
            description: null,
            name: faker.random.alphaNumeric(16),
            schemaFieldRoles: { displayName: 'fakeField' },
          });

          const viaJunctionAction = await sutWithPrimary.createAction(org.id, {
            name: faker.random.alphaNumeric(16),
            description: null,
            type: 'CUSTOM_ACTION',
            callbackUrl: 'https://example.com',
            callbackUrlHeaders: null,
            callbackUrlBody: null,
            itemTypeIds: [itemType.id],
          });

          const viaAppliesAllAction = await sutWithPrimary.createAction(
            org.id,
            {
              name: faker.random.alphaNumeric(16),
              description: null,
              type: 'CUSTOM_ACTION',
              callbackUrl: 'https://example.com',
              callbackUrlHeaders: null,
              callbackUrlBody: null,
            },
          );
          await deps.KyselyPg.updateTable('public.actions')
            .set({ applies_to_all_items_of_kind: ['CONTENT'] })
            .where('id', '=', viaAppliesAllAction.id)
            .execute();

          // Action satisfying both branches; result should still include it once.
          const viaBothAction = await sutWithPrimary.createAction(org.id, {
            name: faker.random.alphaNumeric(16),
            description: null,
            type: 'CUSTOM_ACTION',
            callbackUrl: 'https://example.com',
            callbackUrlHeaders: null,
            callbackUrlBody: null,
            itemTypeIds: [itemType.id],
          });
          await deps.KyselyPg.updateTable('public.actions')
            .set({ applies_to_all_items_of_kind: ['CONTENT'] })
            .where('id', '=', viaBothAction.id)
            .execute();

          return {
            ...base,
            itemType,
            viaJunctionAction,
            viaAppliesAllAction,
            viaBothAction,
          };
        },
      );

      testWithItemTypeAndActions(
        'should return actions from both branches, deduped, scoped to the org',
        async ({
          sutWithPrimary,
          deps,
          org,
          itemType,
          viaJunctionAction,
          viaAppliesAllAction,
          viaBothAction,
        }) => {
          const result = await sutWithPrimary.getActionsForItemType({
            orgId: org.id,
            itemTypeId: itemType.id,
            itemTypeKind: 'CONTENT',
            readFromReplica: false,
          });

          const customIds = result
            .filter((it) => it.actionType === 'CUSTOM_ACTION')
            .map((it) => it.id)
            .sort();
          expect(customIds).toEqual(
            [
              viaJunctionAction.id,
              viaAppliesAllAction.id,
              viaBothAction.id,
            ].sort(),
          );

          // Calling with a different org should never surface this org's
          // applies-to-all rows (they'd otherwise leak across orgs since the
          // ANY(...) predicate alone has no tenant scope).
          const { org: otherOrg } = await createOrg(
            {
              KyselyPg: deps.KyselyPg,
              ModerationConfigService: deps.ModerationConfigService,
              ApiKeyService: deps.ApiKeyService,
            },
            uid(),
          );
          const otherResult = await sutWithPrimary.getActionsForItemType({
            orgId: otherOrg.id,
            itemTypeId: itemType.id,
            itemTypeKind: 'CONTENT',
            readFromReplica: false,
          });
          expect(
            otherResult.filter((it) => it.actionType === 'CUSTOM_ACTION'),
          ).toEqual([]);
        },
      );
    });

    describe('#getActionsForRuleId', () => {
      const testWithRuleAndAction = makeTransactionalTestWithFixture(
        async ({ deps }) => {
          const base = await setupOrg(deps);
          const { sutWithPrimary, org } = base;

          const rule = await createRule(deps.KyselyPg, org.id);
          const action = await sutWithPrimary.createAction(org.id, {
            name: faker.random.alphaNumeric(16),
            description: null,
            type: 'CUSTOM_ACTION',
            callbackUrl: 'https://example.com',
            callbackUrlHeaders: null,
            callbackUrlBody: null,
          });
          await deps.KyselyPg.insertInto('public.rules_and_actions')
            .values({ action_id: action.id, rule_id: rule.id })
            .execute();
          return { ...base, rule, action };
        },
      );

      testWithRuleAndAction(
        'should return actions for a rule scoped to the caller org',
        async ({ sutWithPrimary, org, rule, action }) => {
          const result = await sutWithPrimary.getActionsForRuleId({
            orgId: org.id,
            ruleId: rule.id,
            readFromReplica: false,
          });
          expect(result.map((it) => it.action.id)).toEqual([action.id]);
        },
      );

      testWithRuleAndAction(
        'should not return actions when called with a different org',
        async ({ sutWithPrimary, deps, rule }) => {
          const { org: otherOrg } = await createOrg(
            {
              KyselyPg: deps.KyselyPg,
              ModerationConfigService: deps.ModerationConfigService,
              ApiKeyService: deps.ApiKeyService,
            },
            uid(),
          );
          const result = await sutWithPrimary.getActionsForRuleId({
            orgId: otherOrg.id,
            ruleId: rule.id,
            readFromReplica: false,
          });
          expect(result).toEqual([]);
        },
      );
    });
  });

  describe('Policy returning methods', () => {
    describe('Read methods', () => {
      testWithOrg(
        'should query from the proper db',
        async ({ sutWithPrimary, sutWithReadReplica, org }) => {
          await expectReadReplicaUse(
            { sutWithPrimary, sutWithReadReplica },
            'getPolicies',
            { orgId: org.id },
          );
        },
      );

      // TODO: Fill in this test once we've implemented the policy mutations
      testWithOrg.skip(
        'should return all policies, properly formatted',
        async ({ sutWithPrimary, org }) => {
          const createdPolicies = [] as Policy[];
          const res = await sutWithPrimary.getPolicies({ orgId: org.id });
          expect(res).toHaveLength(createdPolicies.length);
          expect(res).toEqual(expect.arrayContaining(createdPolicies));
        },
      );
    });
    describe('Mutations', () => {
      const testWithUserAndOrg = makeTransactionalTestWithFixture(
        async ({ deps }) => {
          const base = await setupOrg(deps);
          const { user } = await createUser(deps.KyselyPg, base.org.id);
          return { ...base, user };
        },
      );

      testWithUserAndOrg(
        'should create a root policy',
        async ({ sutWithPrimary, org, user }) => {
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
        async ({ sutWithPrimary, org, user }) => {
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
        async ({ sutWithPrimary, org, user }) => {
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
        async ({ sutWithPrimary, org, user }) => {
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
    describe('Mutations', () => {
      describe('#createTextBank', () => {
        testWithOrg(
          'should create a text bank',
          async ({ sutWithPrimary, org }) => {
            const textBank = await sutWithPrimary.createTextBank(org.id, {
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

            expect(textBank.orgId).toBe(org.id);
          },
        );
      });
    });

    describe('Read methods', () => {
      describe('#getTextBanks', () => {
        testWithOrg(
          'should return all text banks, properly formatted',
          async ({ sutWithPrimary, org }) => {
            const createdTextBanks = [
              await sutWithPrimary.createTextBank(org.id, {
                name: 'Test Text Bank 1',
                description: 'Test description',
                type: 'STRING' as const,
                strings: ['test entry 1', 'test entry 2'],
              }),
              await sutWithPrimary.createTextBank(org.id, {
                name: 'Test Text Bank 2',
                description: null,
                type: 'REGEX' as const,
                strings: ['.*'],
              }),
            ];

            const res = await sutWithPrimary.getTextBanks({ orgId: org.id });
            expect(res).toHaveLength(createdTextBanks.length);
            expect(res).toEqual(expect.arrayContaining(createdTextBanks));
          },
        );
      });

      describe('#getTextBank', () => {
        testWithOrg(
          'should return a specific text bank, properly formatted',
          async ({ sutWithPrimary, org }) => {
            const textBank = await sutWithPrimary.createTextBank(org.id, {
              name: 'Test Text Bank',
              description: 'Test description',
              type: 'STRING' as const,
              strings: ['test entry 1', 'test entry 2'],
            });

            const res = await sutWithPrimary.getTextBank({
              orgId: org.id,
              id: textBank.id,
            });
            expect(res).toEqual(textBank);
          },
        );
      });
    });
  });

  describe('#getItemType', () => {
    const testWithOneItemTypeFixture = makeTransactionalTestWithFixture(
      async ({ deps }) => {
        const base = await setupOrg(deps);
        const itemType = await base.sutWithPrimary.createContentType(
          base.org.id,
          {
            schema: dummySchema,
            description: null,
            name: faker.random.alphaNumeric(16),
            schemaFieldRoles: {
              displayName: 'fakeField',
            },
          },
        );

        return { ...base, itemType };
      },
    );

    const testWithTwoItemTypesFixture = makeTransactionalTestWithFixture(
      async ({ deps }) => {
        const base = await setupOrg(deps);
        const itemType = await base.sutWithPrimary.createContentType(
          base.org.id,
          {
            schema: dummySchema,
            description: null,
            name: faker.random.alphaNumeric(16),
            schemaFieldRoles: {
              displayName: 'fakeField',
            },
          },
        );

        const newItemType = await base.sutWithPrimary.updateContentType(
          base.org.id,
          {
            id: itemType.id,
            name: faker.random.alphaNumeric(16),
            schemaFieldRoles: {
              creatorId: undefined,
            },
          },
        );

        return { ...base, itemType, newItemType };
      },
    );

    testWithOrg(
      "Should return undefined if an item type with the given ID doesn't exist",
      async ({ sutWithPrimary, org }) => {
        const itemType = await sutWithPrimary.getItemType({
          orgId: org.id,
          itemTypeSelector: { id: 'fakeId' },
        });

        expect(itemType).toBeUndefined();
      },
    );
    testWithOneItemTypeFixture(
      'Should return a partial item type if requested for a selector without a version',
      async ({ sutWithPrimary, org, itemType }) => {
        const fetched = await sutWithPrimary.getItemType({
          orgId: org.id,
          itemTypeSelector: { id: itemType.id, schemaVariant: 'partial' },
        });

        expect(fetched).not.toBeNull();
        fetched!.schema.forEach((it) => expect(it.required).toEqual(false));
      },
    );
    testWithTwoItemTypesFixture(
      'Should return a partial item type if requested for a selector with a version',
      async ({ sutWithPrimary, org, itemType, newItemType }) => {
        const fetched = await sutWithPrimary.getItemType({
          orgId: org.id,
          itemTypeSelector: {
            id: itemType.id,
            schemaVariant: 'partial',
            version: newItemType.version,
          },
        });

        expect(fetched).not.toBeNull();
        expect(fetched!.name).toEqual(newItemType.name);
        fetched!.schema.forEach((it) => expect(it.required).toEqual(false));
      },
    );
    testWithTwoItemTypesFixture(
      'Should return latest item type if only an ID is provided',
      async ({ sutWithPrimary, org, itemType, newItemType }) => {
        const fetched = await sutWithPrimary.getItemType({
          orgId: org.id,
          itemTypeSelector: { id: itemType.id },
        });

        expect(fetched).not.toBeNull();
        expect(fetched!.name).toEqual(newItemType.name);
      },
    );
    // Fetching a *historical* version needs two versions with distinct
    // timestamps. `item_type_versions` is a view over the system-versioned
    // `item_types` table, whose `version` is `transaction_timestamp()`. The
    // rollback harness runs the whole test in one transaction, so a create +
    // update there share a timestamp and collapse into a single version — there
    // is no older version left to fetch. This test therefore commits its two
    // versions through the real container (separate transactions => distinct
    // timestamps) and cleans up after itself; it's still self-contained.
    const testWithHistoricalItemType = makeTestWithFixture(async () => {
      const { container } = await getBottle();
      const sut = new ModerationConfigService(
        container.KyselyPg,
        container.KyselyPgReadReplica,
        async () => {},
      );
      const { org, cleanup: orgCleanup } = await createOrg(
        {
          KyselyPg: container.KyselyPg,
          ModerationConfigService: container.ModerationConfigService,
          ApiKeyService: container.ApiKeyService,
        },
        uid(),
      );
      const itemType = await sut.createContentType(org.id, {
        schema: dummySchema,
        description: null,
        name: faker.random.alphaNumeric(16),
        schemaFieldRoles: { displayName: 'fakeField' },
      });

      return {
        sut,
        org,
        itemType,
        async cleanup() {
          await orgCleanup();
          await Promise.all([
            container.KyselyPg.destroy(),
            container.KyselyPgReadReplica.destroy(),
          ]);
        },
      };
    });

    testWithHistoricalItemType(
      'Should return requested item type version',
      async ({ sut, org, itemType }) => {
        await sut.updateContentType(org.id, {
          id: itemType.id,
          name: faker.random.alphaNumeric(16),
          schemaFieldRoles: {
            creatorId: undefined,
          },
        });

        const fetched = await sut.getItemType({
          orgId: org.id,
          itemTypeSelector: { id: itemType.id, version: itemType.version },
        });

        expect(fetched).not.toBeNull();
        expect(fetched!.name).toEqual(itemType.name);
      },
    );
  });
});
