import { uid } from 'uid';

import { type ConditionSet } from '../../services/moderationConfigService/index.js';
import { jsonStringify } from '../../utils/encoding.js';
import { type NonEmptyString } from '../../utils/typescript-types.js';
import createOrg from '../fixtureHelpers/createOrg.js';
import createUser from '../fixtureHelpers/createUser.js';
import {
  makeIntegrationServer,
  type IntegrationServer,
} from './setupIntegrationServer.js';

const PASSWORD = 'ReportingRuleInsights123!';

describe('reporting rule sample details (integration)', () => {
  const orgId = uid();
  const itemId = uid();
  let harness: IntegrationServer | undefined;
  let orgCleanup: (() => Promise<unknown>) | undefined;
  let userCleanup: (() => Promise<unknown>) | undefined;
  let ruleId: string;
  let itemTypeId: string;
  let userEmail: string;

  beforeAll(async () => {
    harness = await makeIntegrationServer();

    const orgFixture = await createOrg(
      {
        KyselyPg: harness.deps.KyselyPg,
        ModerationConfigService: harness.deps.ModerationConfigService,
        ApiKeyService: harness.deps.ApiKeyService,
      },
      orgId,
    );
    orgCleanup = orgFixture.cleanup;
    itemTypeId = orgFixture.defaultUserItemType.id;

    const userFixture = await createUser(harness.deps.KyselyPg, orgId, {
      password: PASSWORD,
      loginMethods: ['password'],
      approvedByAdmin: true,
    });
    userCleanup = userFixture.cleanup;
    userEmail = userFixture.user.email;

    const actions = await harness.deps.ModerationConfigService.getActions({
      orgId,
    });
    if (actions.length === 0) throw new Error('expected a built-in action');
    const action = actions[0];

    const rule = await harness.deps.ReportingService.createReportingRule({
      orgId,
      creatorId: userFixture.user.id,
      name: `reporting-rule-insights-${uid()}`,
      status: 'LIVE',
      itemTypeIds: [itemTypeId as NonEmptyString],
      actionIds: [action.id],
      policyIds: [],
      // The rule body is immaterial to this read-path test.
      conditionSet: {
        conjunction: 'AND',
        conditions: [],
      } as unknown as ConditionSet,
    });
    ruleId = rule.id;
  }, 60_000);

  afterAll(async () => {
    try {
      await userCleanup?.();
      await orgCleanup?.();
    } finally {
      await harness?.shutdown();
    }
  }, 30_000);

  test('returns the selected report execution, or the newest one when no timestamp is provided', async () => {
    if (!harness) throw new Error('harness was not initialized');

    const ruleVersion = new Date();
    const selectedAt = new Date(ruleVersion.valueOf() + 1_000);
    const newerAt = new Date(ruleVersion.valueOf() + 2_000);
    const otherItemTypeId = uid();

    await insertExecution({
      harness,
      ruleId,
      orgId,
      itemId,
      itemTypeId,
      ruleVersion,
      executedAt: selectedAt,
      itemData: { selection: 'expected' },
    });
    await insertExecution({
      harness,
      ruleId,
      orgId,
      itemId,
      itemTypeId,
      ruleVersion,
      executedAt: newerAt,
      itemData: { selection: 'newer-decoy' },
    });
    await insertExecution({
      harness,
      ruleId,
      orgId,
      itemId,
      itemTypeId: otherItemTypeId,
      ruleVersion,
      executedAt: selectedAt,
      itemData: { selection: 'type-decoy' },
    });

    const login = await harness.request.post('/api/v1/graphql').send({
      query: `mutation {
        login(input: { email: ${jsonStringify(userEmail)}, password: ${jsonStringify(PASSWORD)} }) {
          __typename
        }
      }`,
    });
    expect(login.body?.data?.login?.__typename).toBe('LoginSuccessResponse');

    const query = `query($input: GetFullResultForItemInput!) {
        getFullReportingRuleResultForItem(input: $input) {
          ... on ReportingRuleExecutionResult {
            itemId
            itemTypeId
            itemData
            ts
          }
          ... on NotFoundError {
            title
          }
        }
      }`;
    const response = await harness.request.post('/api/v1/graphql').send({
      query,
      variables: {
        input: {
          ruleId,
          item: { id: itemId, typeId: itemTypeId },
          date: selectedAt.toISOString(),
          lookback: 'LATEST',
        },
      },
    });

    expect(response.body.errors).toBeUndefined();
    expect(response.body.data.getFullReportingRuleResultForItem).toEqual({
      itemId,
      itemTypeId,
      itemData: jsonStringify({ selection: 'expected' }),
      ts: selectedAt.toISOString(),
    });

    const responseWithoutTimestamp = await harness.request
      .post('/api/v1/graphql')
      .send({
        query,
        variables: {
          input: {
            ruleId,
            item: { id: itemId, typeId: itemTypeId },
            lookback: 'LATEST',
          },
        },
      });

    expect(responseWithoutTimestamp.body.errors).toBeUndefined();
    expect(
      responseWithoutTimestamp.body.data.getFullReportingRuleResultForItem,
    ).toEqual({
      itemId,
      itemTypeId,
      itemData: jsonStringify({ selection: 'newer-decoy' }),
      ts: newerAt.toISOString(),
    });
  }, 60_000);
});

async function insertExecution(opts: {
  harness: IntegrationServer;
  ruleId: string;
  orgId: string;
  itemId: string;
  itemTypeId: string;
  ruleVersion: Date;
  executedAt: Date;
  itemData: object;
}) {
  await opts.harness.deps.DataWarehouse.query(
    `INSERT INTO REPORTING_SERVICE.REPORTING_RULE_EXECUTIONS
      (rule_name, rule_id, rule_version, rule_environment, org_id,
       correlation_id, result, passed, ts, ds, policy_ids, item_data,
       item_id, item_type_name, item_type_id, item_type_kind, item_type_schema,
       item_type_schema_field_roles, item_type_version, item_type_schema_variant)
     VALUES (
       ?, ?, parseDateTime64BestEffort(?), ?, ?, ?, ?, ?,
       parseDateTime64BestEffort(?), toDate(parseDateTime64BestEffort(?)),
       ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
     )`,
    opts.harness.deps.Tracer,
    [
      'Integration test rule',
      opts.ruleId,
      opts.ruleVersion.toISOString(),
      'LIVE',
      opts.orgId,
      'integration-test',
      '{"conjunction":"AND","conditions":[],"result":{"outcome":"PASSED"}}',
      1,
      opts.executedAt.toISOString(),
      opts.executedAt.toISOString(),
      [],
      jsonStringify(opts.itemData),
      opts.itemId,
      'User',
      opts.itemTypeId,
      'USER',
      '{}',
      '{}',
      '1',
      'original',
    ],
  );
}
