# Architecture

Overview of Coop's system architecture for developers and operators.

## Overview

Coop is built as a monorepo with a React frontend, Node.js backend, and multi-database architecture designed for high-throughput content moderation at scale. Coop:

- Lets operations and policy teams manage settings, like which queue to send reports to, or number of strikes per enforcement, without requiring engineers to change backend code

- Supports both automation and a manual review process

- Provides intuitive UI with role-based access control permissioning

- Includes an embedded media player for image and video

- Contains built-in best-practice wellness features

- Uses webhook-based architecture to link effects with events

- Logs an audit trail of actions taken, metadata about the action (incl. When it happened and who it was performed by), and the corresponding policy

- Supports dev/staging environments for manual testing and automated integration tests

### Technology stack

| Layer             | Technologies                                              |
| :---------------- | :-------------------------------------------------------- |
| **Frontend**      | React, TypeScript, Ant Design, TailwindCSS, Apollo Client |
| **Backend**       | Node.js, Express, Apollo Server, TypeScript               |
| **Databases**     | PostgreSQL, Scylla(5.2), ClickHouse, Redis                |
| **Messaging**     | BullMQ (Redis)                                            |
| **ORM**           | Sequelize, Kysely                                         |
| **Auth**          | Passport.js, express-session, SAML (SSO)                  |
| **Observability** | OpenTelemetry                                             |

### Directory structure

```text
coop/
├── client/                    # React frontend
│   └── src/
│       ├── webpages/         # Page components
│       ├── graphql/          # GraphQL queries/mutations
│       ├── components/       # Shared UI components
│       └── utils/            # Utility Functions
│
├── server/                    # Node.js backend
│   ├── bin/                  # CLI scripts
│   ├── graphql/              # GraphQL schema and resolvers
│   ├── iocContainer/         # Dependency injection setup
│   ├── models/               # Sequelize ORM models
│   ├── routes/               # REST API routes
│   ├── rule_engine/          # Rule evaluation logic
│   ├── services/             # Business logic services including NCMEC
│   └── workers_jobs/         # Background processing
│
├── db/                        # Database migrations
│   └── src/scripts/
│       ├── api-server-pg/     # PostgreSQL
│       ├── clickhouse/        # ClickHouse
│       └── scylla/            # Scylla
│
└── docs/                      # Documentation
```

## Backend service registration

Coop's backend uses [BottleJS](https://github.com/young-steveo/bottlejs) for dependency injection, enabling lazy loading, middleware hooks, and decorators. New services are registered in [`server/iocContainer/index.ts`](https://github.com/roostorg/coop/blob/main/server/iocContainer/index.ts); that's the starting point when adding a new service and making it available to the rest of the application.

## API

Coop accepts content via REST APIs. All API requests require an organization API key passed via the `x-api-key` header.

See the [API Reference](../api/) for details including all endpoints and request/response schemas.

### Sending to Coop

Content comes into Coop via a platform sending items to the [Items API](../api/items.md) for automated enforcement, and user reports to the [Report API](../api/report.md) to be routed to the Review Console.

To backfill historical data, fetch related items in the review console that haven't yet been sent to Coop, and ensure items are up-to-date when viewed, platforms can use the [Partial Items API](../api/partial-items.md).

### Actions from Coop

When an action is triggered by a proactive rule or moderator decision, Coop sends a webhook back to the organization's platform. See [Handling Actions](../api/actions.md) for details on the webhook format and how to process it.

## Rules

Coop supports two sets of [rules](../user/rules.md). Each has separate code paths, storage tables, and UI surfaces.

### Proactive Rules

When an item is submitted, Coop retrieves all [Proactive Rules](../user/rules.md#proactive-rules) associated with the item’s type. Proactive Rules act in parallel to determine automatic actions, including potentially sending the item to the review console.

Each rule is evaluated by recursively processing its `conditionSet`, extracting values from the item, optionally passing them through signals, and comparing results using configured comparators.

Rule status: `LIVE`, `DRAFT`, `BACKGROUND`, `EXPIRED`

- Code: `/server/models/rules/RuleModel.ts`
- Storage tables:
  - `manual_review_tool.routing_rules`
  - `manual_review_tool.routing_rules_to_item_types`
  - `manual_review_tool.routing_rules_history`
  - `manual_review_tool.appeal_routing_rules`
  - `manual_review_tool.appeal_routing_rules_to_item_types`
- UI: `/client/src/webpages/dashboard/rules/`

### Routing Rules

When a report is submitted or a proactive rule sends an item to the review console, it is evaluated by [Routing Rules](../user/rules.md#routing-rules). The first routing rule that succeeds routes the item into the appropriate queue awaiting review as a job.

- Code: `/server/services/manualReviewToolService/modules/JobRouting.ts`
- Storage tables:
  - `public.rules`
  - `public.rules_and_actions`
  - `public.rules_and_item_types`
  - `public.rules_and_policies`
  - `public.rules_history`
- UI: `/client/src/webpages/dashboard/mrt/queue_routing/`

## Review Console

The [Review Console](../user/review-console.md) (sometimes referred to as "manual review tool" or "MRT" in the codebase) is a BullMQ-backed queue system used for human review. Items enter the review console as a [Job](../user/concepts.md#jobs) via rule actions or user reports. Each Job is enriched with context (user scores, related items) and routed to a named queue via routing rules configured in the UI. Moderators claim Jobs via exclusive locks (so only one person can claim one Job) and make decisions by performing [Actions](../user/concepts.md#actions), which trigger downstream callbacks or reporting workflows (ie. NCMEC).

### Queue operations

**File**: `/server/services/manualReviewToolService/modules/QueueOperations.ts`

Jobs can be enqueued from:

- Rules engine execution
- User reports
- Post-action workflows
- Review Console internal jobs

**Users:**

- Dequeue jobs with exclusive locks
- Submit decisions
- Trigger post-decision webhooks or NCMEC reporting

**Supported decision types:**

- `IGNORE`
- `CUSTOM_ACTION`
- `SUBMIT_NCMEC_REPORT`
- `ACCEPT_APPEAL`
- `REJECT_APPEAL`
- `TRANSFORM_JOB_AND_RECREATE_IN_QUEUE`
- `AUTOMATIC_CLOSE`

**Manual Enqueue:**

```typescript
{
  orgId: string;
  correlationId: RuleExecutionCorrelationId | ActionExecutionCorrelationId;
  createdAt: Date;
  enqueueSource: 'REPORT' | 'RULE_EXECUTION' | 'POST_ACTIONS' | 'MRT_JOB';
  enqueueSourceInfo: ReportEnqueueSourceInfo | RuleExecutionEnqueueSourceInfo | ...;
  payload: ManualReviewJobPayloadInput;
  policyIds: string[];
}
```

**Entry from Rules Engine** (ActionPublisher.ts):

```typescript
case ActionType.ENQUEUE_TO_MRT:
  await this.manualReviewToolService.enqueue({
    orgId,
    payload: { kind: 'DEFAULT', item, reportHistory: [], ... },
    enqueueSource: 'RULE_EXECUTION',
    enqueueSourceInfo: { kind: 'RULE_EXECUTION', rules: rules.map(x => x.id) },
    correlationId,
    policyIds: policies.map(it => it.id),
  });
```

**Dequeue with lock:**

```typescript
async dequeueNextJob(opts: {
  orgId: string;
  queueId: string;
  userId: string;
}): Promise<{ job: ManualReviewJob; lockToken: string } | null>
```

**Submit Decisions:**

```typescript
async submitDecision(opts: SubmitDecisionInput): Promise<SubmitDecisionResponse>
```

## Actions

Actions are performed when a rule matches or a moderator submits a decision.

Action types:

- CUSTOMER_DEFINED_ACTION: POST webhook to platform infrastructure
- ENQUEUE_TO_MRT: Send to the review console
- ENQUEUE_TO_NCMEC: Route to NCMEC reporting queue

**Webhook structure:**

```json
{
  "item": { "id": "...", "typeId": "..." },
  "policies": [{ "id": "...", "name": "...", "penalty": "..." }],
  "rules": [{ "id": "...", "name": "..." }],
  "action": { "id": "..." },
  "custom": {},
  "actorEmail": "moderator@example.com"
}
```

Failed webhook deliveries retry five times with exponential back off.

**Webhook field reference:**

| Property     | Type            | Always present? | Description                                                                                                     |
| :----------- | :-------------- | :-------------- | :-------------------------------------------------------------------------------------------------------------- |
| `item`       | Item            | Always          | The Item that should receive this Action.                                                                       |
| `action`     | Action          | Always          | Information about the Action being triggered.                                                                   |
| `policies`   | Array\<Policy\> | Always          | Policies associated with this action. May contain multiple entries if multiple rules triggered the same action. |
| `rules`      | Array\<Rule\>   | Not always      | Rules that triggered this action. Empty if triggered via manual review or bulk actioning.                       |
| `custom`     | Object          | Not always      | Custom parameters configured in the Action form under "Body".                                                   |
| `actorEmail` | String          | Not always      | Email of the Coop user who took the action. Omitted for automated rule or AI-triggered actions.                 |

## Storage

Coop uses a multiple database storage system:

- **PostgreSQL** stores configuration, rules, users, sessions, and decisions with ACID guarantees.
- **Redis (via BullMQ)** powers review console job queues, caching, and aggregation counters for very low latency.
- **ScyllaDb (5.2)** stores item submission history for high-throughput writes with materialized views for varied access patterns.
- **ClickHouse** serves as the analytics warehouse for rule executions, actions and user statistics.

### PostgreSQL

ACID-compliant storage for config, auth, rules, and operational data including:

- _public_: orgs, users, actions, policies, item_types, banks, api_keys
- _jobs_: Scheduled job tracking
- _manual_review_tool:_ manual review queues, decisions, routing rules, comments
- _ncmec_reporting_: Child safety NCMEC reports
- _reporting_rules:_ User / content reporting rules
- _signal_service:_ Signal configuration
- _user_management_service_: User management
- _users_statistics_service:_ User statistics

### Redis

Used as low-latency hot cache for:

- **Review Console**: BullMQ job queues
- **Caching**: Sets, Sorted Sets, Lua scripts
- **Distributed counters**

### ScyllaDb

Used for high-throughput item history (Investigations tool and associated users/items). It serves as time-series item submission storage with multiple access patterns

Tables/Views

- **item_submission_by_thread**: Primary table
- **item_submission_by_item_id**: Lookup by item ID
- **item_submission_by_thread_and_time**: Thread and time range
- **item_submission_by_creator**: Lookup by creator

### ClickHouse

Serves as the OLAP storage for analytics, aggregations, and audit trails

Databases and key tables

- **analytics**: RULE_EXECUTIONS, ACTION_EXECUTIONS, CONTENT_API_REQUESTS, ITEM_MODEL_SCORES_LOG
- **action executions:** ACTION_STATISTICS_SERVICE: BY_ACTION, BY_RULE, BY_POLICY, ACTIONED_SUBMISSION_COUNTS
  - MANUAL_REVIEW_TOOL: ROUTING_RULE_EXECUTIONS
- **Reporting and appeal stats:** REPORTING_SERVICE: REPORTS, APPEALS, REPORTING_RULE_EXECUTIONS
- **User level metrics:** USER_STATISTICS_SERVICE: LIFETIME_ACTION_STATS, SUBMISSION_STATS, USER_SCORES

## Signals

Signals are scoring or evaluation functions used by rules. They range from simple text matching to third-party ML services.

The rules engine calls signals when evaluating conditions that need a score. Results are memoized and cached for reuse. Signals extend a shared base class and define metadata and execution logic.

File: `/server/services/signalsService`

**Signals Base Class:**
File: `/server/services/signalsService/signals/SignalBase.ts`

```typescript
abstract class SignalBase<Input, OutputType, MatchingValue, Type> {
  abstract get id(): SignalId;
  abstract get displayName(): string;
  abstract get description(): string;
  abstract get eligibleInputs(): readonly Input[];
  abstract get outputType(): OutputType;
  abstract get supportedLanguages(): readonly Language[] | 'ALL';
  abstract get integration(): Integration | null;
  abstract getCost(): number;
  abstract run(input: SignalInput): Promise<SignalResult | SignalErrorResult>;
}
```

# Configuration

User roles

- ADMIN: Full access
- RULES_MANAGER: Can modify live rules
- ANALYST: View insights
- MODERATOR_MANAGER: Managers MRT queues
- MODERATOR: Reviews assigned queues
- CHILD_SAFETY_MODERATOR: Access to NCMEC data
- EXTERNAL_MODERATOR: View-only MRT access

Permissions

- MANAGE_ORG: ADMIN
- MUTATE_LIVE_RULES: ADMIN, RULES_MANAGER
- VIEW_MRT: All moderator roles
- EDIT_MRT_QUEUES: ADMIN, MODERATOR_MANAGER
- VIEW_CHILD_SAFETY_DATA: ADMIN, MODERATOR_MANAGER, CHILD_SAFETY_MODERATOR

## Authentication

Coop supports three authentication methods: API key authentication for programmatic access, session-based, and SAML/SSO.

### API Key Authentication

API keys authenticate programmatic requests to REST endpoints. All API requests require the x-api-key header.

1. Middleware extracts the x-api-key header
2. Key is validated via SHA-256 hash lookup in the database
3. If valid, orgId is set on the request for downstream handlers
4. Returns 401 Unauthorized if invalid or missing

- Keys are 32-byte random values, SHA-256 hashed before storage
- Each key is scoped to a single team (ie. if you have different teams in the same organization whose data should not mix)
- Last-used timestamp tracked for auditing
- Keys can be rotated (creates new key, deactivates old)

Files:

- Middleware: `/server/utils/apiKeyMiddleware.ts`
- Service: `/server/services/apiKeyService/apiKeyService.ts`

### Session-Based Authentication

Session authentication is used for dashboard UI access via GraphQL.

1. User submits credentials via GraphQL login mutation
2. Passport's GraphQLLocalStrategy validates email/password
3. Password verified via bcrypt comparison
4. On success, user serialized to session via passport.serializeUser()
5. Session stored in PostgreSQL via connect-pg-simple

Session configuration:

- Store: PostgreSQL-backed
- Cookie: Secure flag in production, 30-day expiry
- Session secret: process.env.SESSION_SECRET

Files: `/server/api.ts`

### SAML/SSO Authentication

Enterprise SSO uses SAML with per-organization configuration.

1. User navigates to /saml/login/{orgId}
2. Passport's MultiSamlStrategy retrieves org-specific SAML settings
3. User redirected to configured SAML provider
4. Provider authenticates and posts assertion to callback URL
5. User email extracted from SAML assertion
6. User record looked up and session created

Configuration (per org in org_settings table):

- saml_enabled: Boolean flag
- sso_url: SAML entry point URL
- cert: Certificate for validation

Files:

- `/server/api.ts`
- `/server/services/SSOService/SSOService.ts`
