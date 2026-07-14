#!/usr/bin/env node
/* eslint-disable no-console */
/* eslint-disable max-lines -- embeds the full CCF TVEC policy text verbatim */
/**
 * Seed a TrustCon TVEC demo into an existing ingestion org.
 *
 * Everything this script creates (policies, banks, rules, queues, actions) is
 * attributed to the CHRISTCHURCH CALL FOUNDATION (CCF) in its names and
 * descriptions. CCF authored the template TVEC policy; ROOST/Coop only provides
 * the tooling that operationalizes it.
 *
 * The policy text embedded below is the Christchurch Call Foundation template
 * TVEC policy, sourced from:
 *   model-community/resources/policy-packs/christchurch-call-foundation/tvec-policy/
 * It is embedded (rather than read from disk at runtime) so the script is
 * self-contained and does not depend on a sibling repo being checked out in
 * staging/CI.
 *
 * Usage (from the `server` directory):
 *   npm run seed-trustcon -- \
 *     --org-id <orgId> \
 *     --relay-url http://localhost:8090
 *
 * Optional:
 *   --user-id <userId>                    Admin user to attribute config to.
 *                                         Defaults to the first ADMIN in the org.
 *   --zentropi-labeler-version-id <id>    Zentropi CoPE-B labeler version to wire
 *                                         into the classifier rule's subcategory.
 *
 * Prerequisite: the `ATproto-post` and `ATproto-account` item types must already
 * exist (created by the staging DB seed migration
 * `add_atproto_item_types.seed.staging.sql`). The script exits with a clear
 * error if `ATproto-post` is missing.
 */
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import getBottle from '../iocContainer/index.js';
import {
  CoopInput,
  PolicyType,
  type ConditionSet,
} from '../services/moderationConfigService/index.js';
import { SignalType } from '../services/signalsService/index.js';
import {
  getPermissionsForRole,
  type Invoker,
} from '../services/userManagementService/index.js';
import { jsonStringify } from '../utils/encoding.js';
import { isCoopErrorOfType } from '../utils/errors.js';
import { type NonEmptyString } from '../utils/typescript-types.js';

// ---------------------------------------------------------------------------
// Placeholder keyword dataset.
//
// The real CCF keyword/lexicon dataset is not available yet. These terms are
// deliberately benign and obviously-placeholder. Swap in the real list by
// replacing this single array.
// ---------------------------------------------------------------------------
const KEYWORD_TERMS = [
  'ccf-placeholder-term-one',
  'ccf-placeholder-term-two',
  'ccf-placeholder-term-three',
];

// ---------------------------------------------------------------------------
// CCF template TVEC policy — one Coop policy per "Invalid Content Type" (remove)
// category the policy defines (TVEC1..TVEC8). Text is verbatim from the CCF
// template TVEC policy.
// ---------------------------------------------------------------------------
const POLICY_SOURCE_NOTE =
  'Source: Christchurch Call Foundation template TVEC policy';

type TvecCategory = {
  code: string;
  title: string;
  policyText: string;
};

const TVEC_CATEGORIES: readonly TvecCategory[] = [
  {
    code: 'TVEC1',
    title: 'Branded terrorist content and perpetrator produced content',
    policyText: `TVEC1: Branded terrorist content and perpetrator produced content.
Content produced and shared by terrorist or violent extremist actors and communities or by an affiliated media outlet. This category also includes attack-related content produced by the perpetrator of a terrorist attack.

Examples:
- Statements produced by terrorist organizations
- Manifestos produced by perpetrators of terrorist and violent extremist attacks
- Pledges of allegiances to a terrorist or violent extremist organisation by the perpetrator of an attack
- Magazines produced by terrorist organisations, reading material produced by terrorist organizations`,
  },
  {
    code: 'TVEC2',
    title: 'Credible threat to life',
    policyText: `TVEC2: Credible threat to life - Escalate to law enforcement.
Content whereby the user indicates a credible threat to life or property. Credible threats must have at least two threat indicators, such as:
  - a named or clearly identified target;
  - a specific location;
  - a stated or implied timeframe;
  - evidence of access to weapons or means;
  - and/or evidence of attack planning.
A single factor alone is generally insufficient to be considered a credible threat to life.`,
  },
  {
    code: 'TVEC3',
    title:
      'Detailed description of the tactics involved in a terrorist or violent extremist attack',
    policyText: `TVEC3: Detailed description of the tactics involved in a terrorist or violent extremist attack.
Detailed description and information of terrorist and violent extremist attacks, providing readers with comprehensive insights into the specific tactics, techniques, and procedures (TTPs) used to plan and carry out an attack, which can inform copycat attacks.

Examples:
- Detailed accounts of the weapons used by a perpetrator of a terrorist or violent extremist attack and how they were procured
- Detailed accounts about the choice and identification of targets by a perpetrator of a terrorist or violent extremist attack
- Detailed account about how a perpetrator of a terrorist or violent extremist attack used online services to prepare for an attack and share content related to an attack`,
  },
  {
    code: 'TVEC4',
    title: 'Material support to a terrorist or violent extremist actor',
    policyText: `TVEC4: Material support to a terrorist or violent extremist actor.
Content inviting users to provide financial or other material support to terrorist and violent extremist actors and communities, including through crowdfunding campaigns, sales of merchandise, event tickets, or donations.

Examples:
- Crowdfunding campaigns / invitation to donate for/by terrorist or violent extremist groups/individuals
- Advertising the sale of merchandise (including books, music, event tickets, memorabilia) to support terrorist or violent extremist groups`,
  },
  {
    code: 'TVEC5',
    title: 'Instructional material to commit a terrorist attack',
    policyText: `TVEC5: Instructional material to commit a terrorist attack.
Content providing users with practical and tactical information on how to conduct a terrorist attack, including information on weapons and on identifying targets.

Examples:
- Instructions on how to build a bomb, conduct a mass shooting, or commit a mass casualty attack
- Guidance on how to identify and choose targets for maximising casualties.`,
  },
  {
    code: 'TVEC6',
    title:
      'Recruitment to a terrorist or violent extremist organisation or communities',
    policyText: `TVEC6: Recruitment to a terrorist or violent extremist organisation or communities.
Content aimed at recruiting new members into terrorist or violent extremist groups or communities. This includes redirecting people towards other online platforms for the specific purpose of joining a violent extremist community or terrorist group.

Examples:
- Direction to private discussion spaces hosted by terrorist or violent extremist groups or communities, including redirection to other online platforms
- Direction to terrorist and violent extremist materials, including on other platforms
- Information on how to contact a terrorist or violent extremist actor or community`,
  },
  {
    code: 'TVEC7',
    title: 'Support, praise, or promotion of a terrorism or violent extremism',
    policyText: `TVEC7: Support, praise, or promotion of a terrorism or violent extremism.
Content that expresses support, praise, promotion, or apology for a terrorist or violent extremist actor, community, or attack; including when shared by people who are not part of terrorist or violent extremist organisations or communities.

Examples:
- Content celebrating TVE actors and the attacks they have committed, or other criminal TVE activities
- Content explaining a TVE ideology / actor / or attack in a manner that justifies it`,
  },
  {
    code: 'TVEC8',
    title:
      'Incitement to violence or criminal acts for a terrorist or violent extremist purpose',
    policyText: `TVEC8: Incitement to violence or criminal acts for a terrorist or violent extremist purpose.
Content that incites other users to commit violent acts on behalf of terrorist or violent extremist actors or inspired by terrorist or violent extremist ideologies.

Examples:
- Statements endorsing copy-cat attacks
- Statements promoting violence in the name of a TVE actor
- Statements promoting violence for the advancement of terrorist and violent extremist goals
- Statements promoting mass violence on the basis of race, gender, religion, sexuality, nationality, disability or other protected classes`,
  },
];

const POLICY_NAME_PREFIX = 'CCF TVEC:';
const RULE_NAME_PREFIX = 'CCF TVEC:';

const KEYWORD_BANK_NAME = 'CCF Christchurch keyword dataset (placeholder)';
const HASH_BANK_NAME = 'CCF known-content stand-in (benign)';
const STANDARD_QUEUE_NAME = 'CCF TVEC standard review';
const PRIORITY_QUEUE_NAME = 'CCF TVEC priority review';
const BLEEP_ACTION_NAME = 'Emit Bleep label (CCF demo)';
const BLOOP_ACTION_NAME = 'Emit Bloop label (CCF demo)';

const argv = await yargs(hideBin(process.argv))
  .options({
    'org-id': {
      type: 'string',
      demandOption: true,
      description: 'Ingestion org ID to seed the TrustCon TVEC demo into',
    },
    'relay-url': {
      type: 'string',
      demandOption: true,
      description:
        'Base URL of the Ozone label relay (e.g. http://localhost:8090)',
    },
    'user-id': {
      type: 'string',
      demandOption: false,
      description:
        'Admin user id to attribute created config to. Defaults to the first ADMIN in the org.',
    },
    'zentropi-labeler-version-id': {
      type: 'string',
      demandOption: false,
      description:
        'Zentropi CoPE-B labeler version id to wire into the classifier rule subcategory.',
    },
  })
  .help()
  .parse();

function findByName<T extends { name: string }>(
  items: readonly T[],
  name: string,
): T | undefined {
  return items.find((it) => it.name === name);
}

async function seedTrustcon() {
  const orgId = argv['org-id'];
  const relayUrl = argv['relay-url'].replace(/\/+$/, '');

  const bottle = await getBottle();
  const container = bottle.container;

  // Derived from the datasource method so we don't import GQL-generated types
  // into a non-graphql file (eslint no-restricted-syntax).
  type CreateContentRuleInput = Parameters<
    typeof container.RuleAPIDataSource.createContentRule
  >[0];

  const created = {
    policies: [] as string[],
    rules: [] as string[],
  };

  try {
    // -----------------------------------------------------------------------
    // Step 1: Resolve item types (must already exist via the seed migration).
    // -----------------------------------------------------------------------
    const itemTypes = await container.ModerationConfigService.getItemTypes({
      orgId,
    });
    const postType = findByName(itemTypes, 'ATproto-post');
    const accountType = findByName(itemTypes, 'ATproto-account');
    if (!postType) {
      console.error(
        `\nItem type "ATproto-post" not found in org "${orgId}".\n` +
          `Run the staging DB seed first (adds ATproto-post / ATproto-account):\n` +
          `  npm run db:update -- --env staging --db api-server-pg\n`,
      );
      await container.closeSharedResourcesForShutdown();
      process.exit(1);
    }
    const postTypeId = postType.id;
    console.log(`Item type ATproto-post: ${postTypeId}`);
    if (accountType) {
      console.log(`Item type ATproto-account: ${accountType.id}`);
    }

    // -----------------------------------------------------------------------
    // Resolve an admin user id and build an Invoker with full ADMIN perms.
    // -----------------------------------------------------------------------
    let adminUserId: string;
    const userIdArg = argv['user-id'];
    if (userIdArg) {
      adminUserId = userIdArg;
    } else {
      const adminRow = await container.KyselyPg.selectFrom('public.users')
        .select('id')
        .where('org_id', '=', orgId)
        .where('role', '=', 'ADMIN')
        .executeTakeFirst();
      if (!adminRow) {
        console.error(
          `\nNo ADMIN user found in org "${orgId}". Pass --user-id explicitly.\n`,
        );
        await container.closeSharedResourcesForShutdown();
        process.exit(1);
      }
      adminUserId = adminRow.id;
    }
    console.log(`Attributing config to user: ${adminUserId}`);

    const invoker: Invoker = {
      userId: adminUserId,
      orgId,
      permissions: getPermissionsForRole('ADMIN'),
    };

    // -----------------------------------------------------------------------
    // Step 2: Policies — one per TVEC category (idempotent by name).
    // -----------------------------------------------------------------------
    const existingPolicies =
      await container.ModerationConfigService.getPolicies({ orgId });
    const policyIdByCode = new Map<string, string>();
    for (const category of TVEC_CATEGORIES) {
      const name = `${POLICY_NAME_PREFIX} ${category.code} ${category.title}`;
      const existing = findByName(existingPolicies, name);
      if (existing) {
        console.log(`Policy exists, skipping: ${name}`);
        policyIdByCode.set(category.code, existing.id);
        continue;
      }
      try {
        const policy = await container.ModerationConfigService.createPolicy({
          orgId,
          policy: {
            name,
            parentId: null,
            policyText: category.policyText,
            enforcementGuidelines: `${POLICY_SOURCE_NOTE}. Category ${category.code}: ${category.title}.`,
            policyType: PolicyType.TERRORISM,
          },
          invokedBy: invoker,
        });
        policyIdByCode.set(category.code, policy.id);
        created.policies.push(name);
        console.log(`Created policy: ${name} (${policy.id})`);
      } catch (error: unknown) {
        if (isCoopErrorOfType(error, 'PolicyNameExistsError')) {
          console.log(`Policy already exists, skipping: ${name}`);
        } else {
          throw error;
        }
      }
    }

    // -----------------------------------------------------------------------
    // Step 3: Keyword bank (placeholder terms) — idempotent by name.
    // -----------------------------------------------------------------------
    const existingTextBanks =
      await container.ModerationConfigService.getTextBanks({ orgId });
    let keywordBankId: string;
    const existingKeywordBank = findByName(
      existingTextBanks,
      KEYWORD_BANK_NAME,
    );
    if (existingKeywordBank) {
      keywordBankId = existingKeywordBank.id;
      console.log(`Keyword bank exists, skipping: ${KEYWORD_BANK_NAME}`);
    } else {
      const bank = await container.ModerationConfigService.createTextBank(
        orgId,
        {
          name: KEYWORD_BANK_NAME,
          description:
            'Placeholder pending the CCF keyword/lexicon dataset. Swap in the real terms.',
          type: 'STRING',
          strings: [...KEYWORD_TERMS],
          ownerId: null,
        },
      );
      keywordBankId = bank.id;
      console.log(
        `Created keyword bank: ${KEYWORD_BANK_NAME} (${keywordBankId})`,
      );
    }

    // -----------------------------------------------------------------------
    // Step 4: HMA hash bank (benign stand-in, left empty).
    // -----------------------------------------------------------------------
    let hashBankId: string;
    const existingHashBank = await container.HMAHashBankService.getBank(
      orgId,
      HASH_BANK_NAME,
    );
    if (existingHashBank) {
      hashBankId = String(existingHashBank.id);
      console.log(`Hash bank exists, skipping: ${HASH_BANK_NAME}`);
    } else {
      const hashBank = await container.HMAHashBankService.createBank(
        orgId,
        HASH_BANK_NAME,
        'Benign stand-in for a shared TVEC hash set; populated with harmless images (e.g. chicken photos) for the workshop.',
        1.0,
      );
      hashBankId = String(hashBank.id);
      console.log(`Created hash bank: ${HASH_BANK_NAME} (${hashBankId})`);
    }

    // -----------------------------------------------------------------------
    // Step 8: Two CUSTOM_ACTION webhook actions (Bleep / Bloop labels).
    // Created before the queues (step 6) so the queues can expose them, and
    // before the rules (step 7) if we ever attach them there. Idempotent by
    // name.
    // -----------------------------------------------------------------------
    const existingActions = await container.ModerationConfigService.getActions({
      orgId,
    });

    async function ensureLabelAction(
      name: string,
      labelVal: string,
    ): Promise<string> {
      const existing = findByName(existingActions, name);
      if (existing) {
        console.log(`Action exists, skipping: ${name}`);
        return existing.id;
      }
      try {
        const action = await container.ModerationConfigService.createAction(
          orgId,
          {
            name,
            description: `CCF TVEC demo: emit the "${labelVal}" Ozone label via the label relay.`,
            type: 'CUSTOM_ACTION',
            callbackUrl: `${relayUrl}/label`,
            callbackUrlHeaders: {},
            callbackUrlBody: { labelVal },
            itemTypeIds: [postTypeId],
          },
        );
        console.log(`Created action: ${name} (${action.id})`);
        return action.id;
      } catch (error: unknown) {
        if (isCoopErrorOfType(error, 'ActionNameExistsError')) {
          console.log(`Action already exists, skipping: ${name}`);
          const refreshed = await container.ModerationConfigService.getActions({
            orgId,
          });
          const found = findByName(refreshed, name);
          if (found) {
            return found.id;
          }
        }
        throw error;
      }
    }

    const bleepActionId = await ensureLabelAction(BLEEP_ACTION_NAME, 'bleep');
    const bloopActionId = await ensureLabelAction(BLOOP_ACTION_NAME, 'bloop');

    // Built-in ENQUEUE_TO_MRT action id (used by the LIVE rules below).
    const enqueueAction = existingActions.find(
      (a) => a.actionType === 'ENQUEUE_TO_MRT',
    );
    if (!enqueueAction) {
      console.error(
        `\nBuilt-in ENQUEUE_TO_MRT action not found for org "${orgId}". ` +
          `It is created by createOrg's upsertBuiltInActions; ensure the org was set up correctly.\n`,
      );
      await container.closeSharedResourcesForShutdown();
      process.exit(1);
    }
    const enqueueActionId = enqueueAction.id;

    // -----------------------------------------------------------------------
    // Step 6: Two manual review queues. The Bleep/Bloop label actions are kept
    // OUT of hiddenActionIds so reviewers can pick them. Standard queue is
    // created first so it becomes the org default queue (catches unrouted
    // items). Idempotent by name.
    // -----------------------------------------------------------------------
    const existingQueues =
      await container.ManualReviewToolService.getAllQueuesForOrgAndDangerouslyBypassPermissioning(
        { orgId },
      );

    async function ensureQueue(name: string): Promise<string> {
      const existing = findByName(existingQueues, name);
      if (existing) {
        console.log(`Queue exists, skipping: ${name}`);
        return existing.id;
      }
      try {
        const queue =
          await container.ManualReviewToolService.createManualReviewQueue({
            name,
            description: `${POLICY_SOURCE_NOTE}. CCF TVEC review queue.`,
            userIds: [],
            // Explicitly empty so the Bleep/Bloop label actions remain pickable.
            hiddenActionIds: [],
            invokedBy: invoker,
            isAppealsQueue: false,
          });
        console.log(`Created queue: ${name} (${queue.id})`);
        return queue.id;
      } catch (error: unknown) {
        if (isCoopErrorOfType(error, 'ManualReviewQueueNameExistsError')) {
          console.log(`Queue already exists, skipping: ${name}`);
          const refreshed =
            await container.ManualReviewToolService.getAllQueuesForOrgAndDangerouslyBypassPermissioning(
              { orgId },
            );
          const found = findByName(refreshed, name);
          if (found) {
            return found.id;
          }
        }
        throw error;
      }
    }

    const standardQueueId = await ensureQueue(STANDARD_QUEUE_NAME);
    const priorityQueueId = await ensureQueue(PRIORITY_QUEUE_NAME);

    // -----------------------------------------------------------------------
    // Step 5 + 7: LIVE content rules. Each rule enqueues to MRT (ENQUEUE_TO_MRT)
    // and is linked to a relevant CCF policy. Idempotent by name (RuleName
    // exists is caught and skipped).
    //
    // NOTE on per-queue routing: ENQUEUE_TO_MRT enqueues to MRT generally; which
    // queue an item lands in is decided by the routing rules (step 9), not the
    // action. The standard queue is the org default queue (created first), so
    // unrouted items land there. Fine-grained "hash-match => priority queue"
    // routing needs a routing rule keyed on the rule's label/policy; that
    // refinement is left as a TODO below (see step 9).
    // -----------------------------------------------------------------------
    const existingRules =
      await container.ModerationConfigService.getRulesForOrg(orgId);

    async function ensureRule(
      name: string,
      conditionSet: CreateContentRuleInput['conditionSet'],
      policyCode: string,
    ): Promise<void> {
      if (findByName(existingRules, name)) {
        console.log(`Rule exists, skipping: ${name}`);
        return;
      }
      const policyId = policyIdByCode.get(policyCode);
      const input: CreateContentRuleInput = {
        name,
        description: `${POLICY_SOURCE_NOTE}. CCF TVEC demo rule.`,
        status: 'LIVE',
        contentTypeIds: [postTypeId],
        conditionSet,
        actionIds: [enqueueActionId],
        policyIds: policyId ? [policyId] : [],
        tags: [],
        maxDailyActions: null,
      };
      try {
        const rule = await container.RuleAPIDataSource.createContentRule(
          input,
          adminUserId,
          orgId,
        );
        created.rules.push(name);
        console.log(`Created rule: ${name} (${rule.id})`);
      } catch (error: unknown) {
        if (isCoopErrorOfType(error, 'RuleNameExistsError')) {
          console.log(`Rule already exists, skipping: ${name}`);
        } else {
          throw error;
        }
      }
    }

    // Hash-match rule (IMAGE_EXACT_MATCH against the benign HMA bank).
    // Intended for the PRIORITY queue (see routing note above).
    await ensureRule(
      `${RULE_NAME_PREFIX} known-content hash match (priority)`,
      {
        conjunction: 'AND',
        conditions: [
          {
            input: { type: 'CONTENT_COOP_INPUT', name: CoopInput.ANY_IMAGE },
            signal: {
              id: jsonStringify({ type: SignalType.IMAGE_EXACT_MATCH }),
              type: SignalType.IMAGE_EXACT_MATCH,
              name: 'Image exact match',
            },
            matchingValues: { imageBankIds: [hashBankId] },
          },
        ],
      },
      'TVEC1',
    );

    // Keyword-match rule (TEXT_MATCHING_CONTAINS_TEXT against the placeholder
    // keyword bank). Routes (by default) to the STANDARD queue.
    await ensureRule(
      `${RULE_NAME_PREFIX} keyword match (standard)`,
      {
        conjunction: 'AND',
        conditions: [
          {
            input: { type: 'CONTENT_COOP_INPUT', name: CoopInput.ALL_TEXT },
            signal: {
              id: jsonStringify({
                type: SignalType.TEXT_MATCHING_CONTAINS_TEXT,
              }),
              type: SignalType.TEXT_MATCHING_CONTAINS_TEXT,
              name: 'Contains text',
            },
            matchingValues: { textBankIds: [keywordBankId] },
          },
        ],
      },
      'TVEC7',
    );

    // Classifier rule (Zentropi CoPE-B). The org's Zentropi credential is
    // assumed already configured, so no API key is set here.
    //
    // Policy-text wiring: the Zentropi labeler signal takes NO signal args for
    // policy text (SignalArgsByType[ZENTROPI_LABELER] === undefined). The policy
    // to steer against is a *published Zentropi labeler*, referenced by its
    // labeler_version_id in the condition's `subcategory` field
    // (see ZentropiLabelerSignal.description). The CCF policy text therefore
    // lives in the linked Coop policy (TVEC7) for reviewer context, and steers
    // the classifier only via the published labeler.
    //
    // TODO: publish a Zentropi CoPE-B labeler from the CCF TVEC policy text and
    // pass its version id via --zentropi-labeler-version-id so the classifier
    // actually evaluates against the CCF policy. Without it the rule is created
    // but the signal has no labeler to run.
    const zentropiLabelerVersionId = argv['zentropi-labeler-version-id'];
    await ensureRule(
      `${RULE_NAME_PREFIX} Zentropi CoPE-B classifier (standard)`,
      {
        conjunction: 'AND',
        conditions: [
          {
            input: { type: 'CONTENT_COOP_INPUT', name: CoopInput.ALL_TEXT },
            signal: {
              id: jsonStringify({ type: SignalType.ZENTROPI_LABELER }),
              type: SignalType.ZENTROPI_LABELER,
              name: 'Zentropi Labeler',
              ...(zentropiLabelerVersionId
                ? { subcategory: zentropiLabelerVersionId }
                : {}),
            },
            comparator: 'GREATER_THAN_OR_EQUALS',
            threshold: 0.8,
          },
        ],
      },
      'TVEC7',
    );

    // -----------------------------------------------------------------------
    // Step 9: Routing rules. Default rule routes ATproto-post items to the
    // STANDARD queue. Idempotent by name.
    //
    // TODO: add a higher-priority routing rule that sends hash-match hits to the
    // PRIORITY queue. That requires a condition keyed on the hash-match rule's
    // label/policy (e.g. CONTENT_COOP_INPUT "Relevant Policy" EQUALS the TVEC1
    // policy id). Left out here to keep the default routing trivially correct.
    // -----------------------------------------------------------------------
    const existingRoutingRules =
      await container.ManualReviewToolService.getRoutingRules({ orgId });
    const defaultRoutingRuleName = 'CCF TVEC default routing (standard)';
    if (findByName([...existingRoutingRules], defaultRoutingRuleName)) {
      console.log(`Routing rule exists, skipping: ${defaultRoutingRuleName}`);
    } else {
      // Trivially-satisfiable catch-all: match posts whose text field is not
      // absent is unreliable, so we lean on the standard queue also being the
      // org default queue. This routing rule makes the intent explicit.
      const routingConditionSet: ConditionSet = {
        conjunction: 'AND',
        conditions: [
          {
            input: { type: 'FULL_ITEM' },
            comparator: 'IS_NOT_PROVIDED',
          },
        ],
      };
      try {
        const routingRule =
          await container.ManualReviewToolService.createRoutingRule({
            orgId,
            name: defaultRoutingRuleName,
            status: 'LIVE',
            itemTypeIds: [postTypeId as NonEmptyString],
            creatorId: adminUserId,
            conditionSet: routingConditionSet,
            destinationQueueId: standardQueueId,
          });
        console.log(
          `Created routing rule: ${defaultRoutingRuleName} (${routingRule.id})`,
        );
      } catch (error: unknown) {
        if (isCoopErrorOfType(error, 'RoutingRuleNameExistsError')) {
          console.log(
            `Routing rule already exists, skipping: ${defaultRoutingRuleName}`,
          );
        } else {
          throw error;
        }
      }
    }

    // -----------------------------------------------------------------------
    // Summary.
    // -----------------------------------------------------------------------
    console.log('\n' + '='.repeat(60));
    console.log('TrustCon CCF TVEC demo seeded.');
    console.log('='.repeat(60));
    console.log(`Org:                ${orgId}`);
    console.log(`Policies created:   ${created.policies.length}`);
    console.log(`Rules created:      ${created.rules.length}`);
    console.log(`Keyword bank id:    ${keywordBankId} (placeholder terms)`);
    console.log(
      `Hash bank id:       ${hashBankId} (empty; add images via HMA)`,
    );
    console.log(`Standard queue id:  ${standardQueueId}`);
    console.log(`Priority queue id:  ${priorityQueueId}`);
    console.log(`Bleep action id:    ${bleepActionId}`);
    console.log(`Bloop action id:    ${bloopActionId}`);
    console.log(`Label relay:        ${relayUrl}/label`);
    console.log('='.repeat(60) + '\n');

    await container.closeSharedResourcesForShutdown();
    process.exit(0);
  } catch (error: unknown) {
    console.error('\nError seeding TrustCon CCF TVEC demo:\n');
    console.error(error);
    try {
      await container.closeSharedResourcesForShutdown();
    } catch (shutdownError) {
      console.error('Error during shutdown:', shutdownError);
    }
    process.exit(1);
  }
}

seedTrustcon().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
