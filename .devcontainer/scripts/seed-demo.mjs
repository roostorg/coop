// Fills the demo org with item types, policies, actions, a review queue and a
// rule, then sends sample posts and user reports, so every page of the UI has
// something to show. Uses only Coop's public GraphQL and REST APIs.
//
// Runs inside the `server` container (start.sh pipes it to `node`), against the
// server on localhost:8080. Safe to run again: it does nothing if the demo org
// already has its "Post" item type.

const BASE_URL = process.env.COOP_URL ?? 'http://localhost:8080';
const EMAIL = process.env.COOP_DEMO_EMAIL;
const PASSWORD = process.env.COOP_DEMO_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error('COOP_DEMO_EMAIL and COOP_DEMO_PASSWORD must be set.');
  process.exit(1);
}

let cookie = '';

async function graphql(query, variables = {}) {
  const res = await fetch(`${BASE_URL}/api/v1/graphql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ query, variables }),
  });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) {
    cookie = setCookie.split(';')[0];
  }
  const body = await res.json();
  if (body.errors?.length) {
    throw new Error(body.errors.map((e) => e.message).join('\n'));
  }
  return body.data;
}

// Mutations return a union of a success type and error types; fail on errors.
function expectSuccess(result, label) {
  if (result == null || 'title' in result) {
    throw new Error(`${label} failed: ${JSON.stringify(result)}`);
  }
  return result;
}

async function login() {
  const { login } = await graphql(
    /* GraphQL */ `
      mutation DemoLogin($input: LoginInput!) {
        login(input: $input) {
          __typename
          ... on Error {
            title
          }
        }
      }
    `,
    { input: { email: EMAIL, password: PASSWORD, remember: false } },
  );
  if (login.__typename !== 'LoginSuccessResponse') {
    throw new Error(`Couldn't log in as ${EMAIL}: ${login.__typename}`);
  }
}

async function getOrg() {
  const { me } = await graphql(/* GraphQL */ `
    query DemoMe {
      me {
        id
        orgId
      }
    }
  `);
  const { org } = await graphql(
    /* GraphQL */ `
      query DemoOrg($id: ID!) {
        org(id: $id) {
          itemTypes {
            __typename
            ... on ItemTypeBase {
              id
              name
            }
          }
        }
      }
    `,
    { id: me.orgId },
  );
  return { userId: me.id, ...org };
}

async function createContentItemType(input) {
  const { createContentItemType } = await graphql(
    /* GraphQL */ `
      mutation DemoCreateItemType($input: CreateContentItemTypeInput!) {
        createContentItemType(input: $input) {
          ... on MutateContentTypeSuccessResponse {
            data {
              id
            }
          }
          ... on Error {
            title
            detail
          }
        }
      }
    `,
    { input },
  );
  return expectSuccess(createContentItemType, `Item type ${input.name}`).data
    .id;
}

async function addPolicies(policies) {
  const { addPolicies } = await graphql(
    /* GraphQL */ `
      mutation DemoAddPolicies($policies: [AddPolicyInput!]!) {
        addPolicies(policies: $policies) {
          policies {
            id
            name
          }
          failures
        }
      }
    `,
    { policies },
  );
  if (addPolicies.failures.length > 0) {
    throw new Error(`Policies failed: ${addPolicies.failures.join(', ')}`);
  }
  return Object.fromEntries(addPolicies.policies.map((p) => [p.name, p.id]));
}

async function createAction(input) {
  const { createAction } = await graphql(
    /* GraphQL */ `
      mutation DemoCreateAction($input: CreateActionInput!) {
        createAction(input: $input) {
          ... on MutateActionSuccessResponse {
            data {
              id
            }
          }
          ... on Error {
            title
            detail
          }
        }
      }
    `,
    { input },
  );
  return expectSuccess(createAction, `Action ${input.name}`).data.id;
}

async function createQueue(input) {
  const { createManualReviewQueue } = await graphql(
    /* GraphQL */ `
      mutation DemoCreateQueue($input: CreateManualReviewQueueInput!) {
        createManualReviewQueue(input: $input) {
          ... on MutateManualReviewQueueSuccessResponse {
            data {
              id
            }
          }
          ... on Error {
            title
            detail
          }
        }
      }
    `,
    { input },
  );
  return expectSuccess(createManualReviewQueue, `Queue ${input.name}`).data.id;
}

async function createRule(input) {
  const { createContentRule } = await graphql(
    /* GraphQL */ `
      mutation DemoCreateRule($input: CreateContentRuleInput!) {
        createContentRule(input: $input) {
          ... on MutateContentRuleSuccessResponse {
            data {
              id
            }
          }
          ... on Error {
            title
            detail
          }
        }
      }
    `,
    { input },
  );
  return expectSuccess(createContentRule, `Rule ${input.name}`).data.id;
}

async function rotateApiKey() {
  const { rotateApiKey } = await graphql(
    /* GraphQL */ `
      mutation DemoRotateApiKey($input: RotateApiKeyInput!) {
        rotateApiKey(input: $input) {
          ... on RotateApiKeySuccessResponse {
            apiKey
          }
          ... on Error {
            title
            detail
          }
        }
      }
    `,
    { input: { name: 'Demo data', description: 'Used by the demo seeder' } },
  );
  return expectSuccess(rotateApiKey, 'API key').apiKey;
}

async function rest(path, apiKey, body) {
  const res = await fetch(`${BASE_URL}/api/v1/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`POST ${path}: ${res.status} ${await res.text()}`);
  }
}

const POSTS = [
  'Just finished a 10k run, feeling great!',
  'Does anyone have a good sourdough recipe?',
  'Buy cheap followers now!!! Visit totally-real-followers.example',
  'The sunset over the lake tonight was unreal.',
  'Limited offer: crypto giveaway, send 1 coin get 2 back',
  'Our community garden harvest is ready, come grab some tomatoes',
  'You are worthless and everyone here hates you',
  'Reminder: book club meets Thursday at 7pm',
  'Click here for free gift cards: giftcards-free.example',
  'Can someone recommend a beginner-friendly hiking trail?',
  'I know where you live and you will regret posting that',
  'New puppy photos coming soon, she is adorable',
  'Earn $5000 a week from home, no experience needed!!!',
  'Happy birthday to my best friend!',
  'Nobody wants you here, just leave the platform',
  'Anyone watching the game tonight?',
];

const REPORTS = [
  { post: 2, policy: 'Spam', reason: 'Selling fake followers' },
  { post: 4, policy: 'Spam', reason: 'Looks like a crypto scam' },
  { post: 6, policy: 'Harassment', reason: 'Bullying another user' },
  { post: 8, policy: 'Spam', reason: 'Phishing link' },
  { post: 10, policy: 'Violence', reason: 'Threatening message' },
  { post: 12, policy: 'Spam', reason: 'Job scam' },
  { post: 14, policy: 'Harassment', reason: 'Telling someone to leave' },
  { post: 1, policy: 'Spam', reason: 'Not sure, seems off-topic' },
];

async function main() {
  await login();
  const org = await getOrg();
  if (org.itemTypes.some((t) => t.name === 'Post')) {
    console.log('Demo data is already there.');
    return;
  }

  const userType = org.itemTypes.find((t) => t.__typename === 'UserItemType');

  const postTypeId = await createContentItemType({
    name: 'Post',
    description: 'A public post in the feed',
    fields: [
      { name: 'text', type: 'STRING', required: true },
      { name: 'author', type: 'RELATED_ITEM', required: true },
      { name: 'created_at', type: 'DATETIME', required: false },
    ],
    fieldRoles: { creatorId: 'author', createdAt: 'created_at' },
  });
  await createContentItemType({
    name: 'Comment',
    description: 'A reply to a post',
    fields: [
      { name: 'text', type: 'STRING', required: true },
      { name: 'author', type: 'RELATED_ITEM', required: true },
    ],
    fieldRoles: { creatorId: 'author' },
  });

  const policies = await addPolicies([
    {
      name: 'Spam',
      policyType: 'SPAM',
      policyText: 'No scams, fake engagement or unsolicited advertising.',
    },
    {
      name: 'Harassment',
      policyType: 'HARRASSMENT',
      policyText: 'No bullying, insults or targeted abuse of other users.',
    },
    {
      name: 'Violence',
      policyType: 'VIOLENCE',
      policyText: 'No threats of violence against people or groups.',
    },
  ]);

  // Callbacks go to example.com, which ignores them: the demo has no platform
  // to act on, but the actions still appear in the UI and in decision logs.
  const removeId = await createAction({
    name: 'Remove post',
    description: 'Takes the post down',
    itemTypeIds: [postTypeId],
    callbackUrl: 'https://example.com/coop-demo/remove',
  });
  await createAction({
    name: 'Warn author',
    description: 'Sends the author a warning about the policy',
    itemTypeIds: [postTypeId],
    callbackUrl: 'https://example.com/coop-demo/warn',
  });

  await createQueue({
    name: 'Reported posts',
    description: 'Posts users have reported',
    userIds: [org.userId],
    roleIds: [],
    hiddenActionIds: [],
    isAppealsQueue: false,
    autoCloseJobs: false,
  });

  await createRule({
    name: 'Remove obvious spam',
    description: 'Removes posts with common spam phrases',
    status: 'LIVE',
    contentTypeIds: [postTypeId],
    conditionSet: {
      conjunction: 'OR',
      conditions: [
        {
          input: { type: 'CONTENT_COOP_INPUT', name: 'All text' },
          signal: {
            id: JSON.stringify({ type: 'TEXT_MATCHING_CONTAINS_TEXT' }),
            type: 'TEXT_MATCHING_CONTAINS_TEXT',
          },
          matchingValues: {
            strings: ['buy cheap followers', 'free gift cards', 'giveaway'],
          },
        },
      ],
    },
    actionIds: [removeId],
    policyIds: [policies.Spam],
    tags: ['demo'],
  });

  const apiKey = await rotateApiKey();
  const now = Date.now();
  const authorId = (i) => `demo-user-${(i % 5) + 1}`;
  const postItem = (i) => ({
    id: `demo-post-${i + 1}`,
    typeId: postTypeId,
    data: {
      text: POSTS[i],
      author: { id: authorId(i), typeId: userType.id },
      created_at: new Date(now - (POSTS.length - i) * 60_000).toISOString(),
    },
  });

  await rest('items/async', apiKey, {
    items: POSTS.map((_, i) => postItem(i)),
  });

  for (const [n, report] of REPORTS.entries()) {
    await rest('report', apiKey, {
      reporter: {
        kind: 'user',
        id: `demo-reporter-${n + 1}`,
        typeId: userType.id,
      },
      reportedAt: new Date(now - n * 30_000).toISOString(),
      reportedForReason: {
        policyId: policies[report.policy],
        reason: report.reason,
      },
      reportedItem: postItem(report.post),
    });
  }

  console.log(
    `Demo data added: ${POSTS.length} posts, ${REPORTS.length} reports.`,
  );
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
