/**
 * Integration test for #340: rule changes take effect.
 *
 * The rule engine reads enabled rules per item type via an eventually
 * consistent cache (`getEnabledRulesForItemTypeEventuallyConsistent`,
 * `freshUntilAge: 20s`). This test exercises that contract end-to-end against
 * the real stack:
 *
 *   1. Newly created rule fires on the next matching item submission. No prior
 *      cache entry exists for the fresh item type, so the first submission's
 *      cache miss fetches the rule from Postgres and the rule engine matches.
 *
 *   2. Updated rule supersedes the original after the cache window expires.
 *      A submission made within the cache TTL still sees the old condition;
 *      one made past it sees the new condition. The test waits past
 *      `freshUntilAge` between the update and the post-update submission.
 *
 * Each test provisions its own item type + action so the rules cache (keyed by
 * item type) starts empty for that test. Sharing an item type across tests
 * leaks cached rule lists from earlier tests, masking whether a freshly created
 * rule is actually being picked up.
 *
 * Run with: npm run test:integ
 * Requires: `npm run up && npm run db:update`
 */
import { ScalarTypes } from '@roostorg/coop-types';
import { type Kysely } from 'kysely';
import { uid } from 'uid';

import { kyselyUpdateRule } from '../../graphql/datasources/ruleKyselyPersistence.js';
import { type CombinedPg } from '../../services/combinedDbTypes.js';
import {
  ConditionConjunction,
  RuleStatus,
  RuleType,
  type ConditionSet,
} from '../../services/moderationConfigService/index.js';
import { SignalType } from '../../services/signalsService/index.js';
import { jsonStringify } from '../../utils/encoding.js';
import { makeKyselyTransactionWithRetry } from '../../utils/kyselyTransactionWithRetry.js';
import createActions from '../fixtureHelpers/createActions.js';
import createContentItemTypes from '../fixtureHelpers/createContentItemTypes.js';
import createOrg from '../fixtureHelpers/createOrg.js';
import createRule from '../fixtureHelpers/createRule.js';
import {
  makeIntegrationServer,
  type IntegrationServer,
} from './setupIntegrationServer.js';
import {
  assertNoActionExecution,
  waitForActionExecution,
  waitForItemInScylla,
} from './wait.js';

// Matches `freshUntilAge: 20` on `getEnabledRulesForItemTypeEventuallyConsistent`
// in `server/rule_engine/ruleEngineQueries.ts`. Anything past the TTL forces
// the next read to refetch, so a wait slightly longer than that proves a rule
// update reaches the engine without depending on an explicit cache-invalidate
// hook (which the rule update path does not currently provide).
const RULES_CACHE_TTL_SECONDS = 20;
const RULES_CACHE_REFRESH_BUFFER_MS = (RULES_CACHE_TTL_SECONDS + 5) * 1000;

function makeTextContainsConditionSet(
  contentTypeId: string,
  keyword: string,
): ConditionSet {
  return {
    conditions: [
      {
        input: { type: 'CONTENT_FIELD', name: 'text', contentTypeId },
        signal: {
          id: jsonStringify({ type: SignalType.TEXT_MATCHING_CONTAINS_TEXT }),
          type: SignalType.TEXT_MATCHING_CONTAINS_TEXT,
        },
        matchingValues: { strings: [keyword] },
      },
    ],
    conjunction: ConditionConjunction.AND,
  };
}

describe('Rule changes take effect (integration)', () => {
  const orgId = uid();
  let harness: IntegrationServer | undefined;
  let apiKey: string;
  let orgCleanup: (() => Promise<void>) | undefined;

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
    apiKey = orgFixture.apiKey;
    orgCleanup = orgFixture.cleanup;
  }, 60_000);

  afterAll(async () => {
    try {
      await orgCleanup?.();
    } finally {
      await harness?.shutdown();
    }
  }, 30_000);

  /**
   * Spins up a fresh item type + action pair so the per-item-type rules cache
   * starts empty. Caller passes any rule cleanups to `cleanup`; we tear
   * everything down in FK-safe order (rules → action → item type).
   */
  async function provisionScenario(deps: IntegrationServer['deps']) {
    const itemTypeFixture = await createContentItemTypes({
      moderationConfigService: deps.ModerationConfigService,
      orgId,
      extra: {
        fields: [
          {
            name: 'text',
            type: ScalarTypes.STRING,
            required: true,
            container: null,
          },
        ],
      },
    });
    const itemTypeId = itemTypeFixture.itemTypes[0].id;

    const actionsFixture = await createActions({
      actionAPI: deps.ActionAPIDataSource,
      itemTypeIds: [itemTypeId],
      orgId,
      numActions: 1,
    });
    const actionId = actionsFixture.actions[0].id;

    return {
      itemTypeId,
      actionId,
      async cleanup(ruleDestroyers: ReadonlyArray<() => Promise<void>>) {
        for (const destroy of ruleDestroyers) {
          await destroy().catch(() => undefined);
        }
        await actionsFixture.cleanup();
        await itemTypeFixture.cleanup();
      },
    };
  }

  test('newly created rule fires on the next matching item submission', async () => {
    if (!harness) throw new Error('harness was not initialized');
    const scenario = await provisionScenario(harness.deps);
    let rule: Awaited<ReturnType<typeof createRule>> | undefined;

    try {
      rule = await createRule(harness.deps.KyselyPg, orgId, {
        name: `text-contains-trigger-${uid()}`,
        status: RuleStatus.LIVE,
        ruleType: RuleType.CONTENT,
        conditionSet: makeTextContainsConditionSet(
          scenario.itemTypeId,
          'forbidden',
        ),
        actionIds: [scenario.actionId],
        contentTypeIds: [scenario.itemTypeId],
      });

      const itemId = uid();
      await harness.request
        .post('/api/v1/items/async')
        .set('x-api-key', apiKey)
        .send({
          items: [
            {
              id: itemId,
              typeId: scenario.itemTypeId,
              data: { text: 'this contains the forbidden keyword' },
            },
          ],
        })
        .expect(202);

      // Gate on Scylla so we know the worker has picked up the submission before
      // we start polling for the (potentially later) action execution row.
      // `waitForItemInScylla` looks up by `item_identifier` only (per its doc
      // comment), so guard against a cross-org id collision after the row comes
      // back.
      const scyllaRow = await waitForItemInScylla(harness.deps, {
        orgId,
        itemIdentifier: { id: itemId, typeId: scenario.itemTypeId },
      });
      expect(scyllaRow.org_id).toBe(orgId);

      const actionRow = await waitForActionExecution(harness.deps, {
        orgId,
        actionId: scenario.actionId,
        itemIdentifier: { id: itemId, typeId: scenario.itemTypeId },
      });
      expect(actionRow.action_id).toBe(scenario.actionId);
    } finally {
      await scenario.cleanup(rule ? [rule.destroy] : []);
    }
  }, 60_000);

  test('updated rule applies to items submitted after the cache refreshes', async () => {
    if (!harness) throw new Error('harness was not initialized');
    const scenario = await provisionScenario(harness.deps);
    let rule: Awaited<ReturnType<typeof createRule>> | undefined;

    try {
      rule = await createRule(harness.deps.KyselyPg, orgId, {
        name: `text-contains-update-${uid()}`,
        status: RuleStatus.LIVE,
        ruleType: RuleType.CONTENT,
        conditionSet: makeTextContainsConditionSet(
          scenario.itemTypeId,
          'firstkeyword',
        ),
        actionIds: [scenario.actionId],
        contentTypeIds: [scenario.itemTypeId],
      });

      // Pre-update: confirm the rule fires on the original condition so the
      // post-update "no action" assertion has a meaningful baseline.
      const preUpdateItemId = uid();
      await harness.request
        .post('/api/v1/items/async')
        .set('x-api-key', apiKey)
        .send({
          items: [
            {
              id: preUpdateItemId,
              typeId: scenario.itemTypeId,
              data: { text: 'matches firstkeyword pre-update' },
            },
          ],
        })
        .expect(202);

      await waitForActionExecution(harness.deps, {
        orgId,
        actionId: scenario.actionId,
        itemIdentifier: { id: preUpdateItemId, typeId: scenario.itemTypeId },
      });

      // Update the rule's condition. The cached rule list for this item type
      // is now stale; reads within `freshUntilAge` will still see the original
      // condition. There is no explicit invalidation on the rule-update path.
      const kysely = harness.deps.KyselyPg as Kysely<CombinedPg>;
      const transactionWithRetry = makeKyselyTransactionWithRetry(kysely);
      await transactionWithRetry(
        { isolationLevel: 'repeatable read' },
        async (trx) => {
          await kyselyUpdateRule(trx, {
            id: rule!.id,
            orgId,
            name: undefined,
            description: undefined,
            conditionSet: makeTextContainsConditionSet(
              scenario.itemTypeId,
              'secondkeyword',
            ),
            tags: undefined,
            ruleType: RuleType.CONTENT,
            maxDailyActions: undefined,
            expirationTime: undefined,
            parentId: undefined,
            actionIds: undefined,
            policyIds: undefined,
            contentTypeIds: undefined,
          });
        },
      );

      // Wait past the cache TTL so the next read refetches and sees the update.
      await new Promise((r) => setTimeout(r, RULES_CACHE_REFRESH_BUFFER_MS));

      // Submission matching the *new* condition: action should fire.
      const newMatchItemId = uid();
      await harness.request
        .post('/api/v1/items/async')
        .set('x-api-key', apiKey)
        .send({
          items: [
            {
              id: newMatchItemId,
              typeId: scenario.itemTypeId,
              data: { text: 'matches secondkeyword post-update' },
            },
          ],
        })
        .expect(202);

      await waitForActionExecution(harness.deps, {
        orgId,
        actionId: scenario.actionId,
        itemIdentifier: { id: newMatchItemId, typeId: scenario.itemTypeId },
      });

      // Submission matching the *old* condition: should NOT fire under the
      // updated rule.
      const staleMatchItemId = uid();
      await harness.request
        .post('/api/v1/items/async')
        .set('x-api-key', apiKey)
        .send({
          items: [
            {
              id: staleMatchItemId,
              typeId: scenario.itemTypeId,
              data: { text: 'matches firstkeyword post-update' },
            },
          ],
        })
        .expect(202);

      // Wait for Scylla so we know the worker started processing this
      // submission. Same cross-org guard as in the test above.
      // `assertNoActionExecution` then waits for `analytics.CONTENT_API_REQUESTS`
      // (logged after `runEnabledRules`) before checking absence — that
      // post-rules signal, not Scylla, is what makes the negative trustworthy.
      const staleScyllaRow = await waitForItemInScylla(harness.deps, {
        orgId,
        itemIdentifier: { id: staleMatchItemId, typeId: scenario.itemTypeId },
      });
      expect(staleScyllaRow.org_id).toBe(orgId);
      await assertNoActionExecution(harness.deps, {
        orgId,
        actionId: scenario.actionId,
        itemIdentifier: { id: staleMatchItemId, typeId: scenario.itemTypeId },
      });
    } finally {
      await scenario.cleanup(rule ? [rule.destroy] : []);
    }
  }, 120_000);
});
