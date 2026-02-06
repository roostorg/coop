# Coop Architecture

This document provides an overview of Coop's system architecture for developers and operators.

### Overview

Coop is built as a monorepo with a React frontend, Node.js backend, and multi-database architecture designed for high-throughput content moderation at scale. Coop:

* Lets operations and policy teams manage settings, like which queue to send reports to, or \# of strikes per enforcement, without requiring engineers to change backend code  
* Supports both automation and a manual review process  
* Provides intuitive UI with role-based access control permissioning  
* Includes an embedded media player for image and video   
* Best-practice wellness features built-in  
* Uses webhook-based architecture to link effects with events  
* Logs an audit trail of actions taken, metadata about the action (incl. When it happened and who it was performed by), and the corresponding policy   
* Dev/staging env for manual testing and automated integration tests

### Technology Stack

| Layer | Technologies |
| :---- | :---- |
| **Frontend** | React, TypeScript, Ant Design, TailwindCSS, Apollo Client |
| **Backend** | Node.js, Express, Apollo Server, TypeScript |
| **Databases** | PostgreSQL, Scylla(5.2), ClickHouse, Redis |
| **Messaging** | Kafka (optional), BullMQ |
| **ORM** | Sequelize, Kysely |
| **Auth** | Passport.js, express-session, SAML (SSO) |
| **Observability** | OpenTelemetry |

## **Directory Structure**

```
coop/
├── client/                    # React frontend
│   └── src/
│       ├── webpages/         # Page components
│       ├── graphql/          # GraphQL queries/mutations
│       └── components/       # Shared UI components
│       └── utils/                    # Utility Functions
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
├── .devops/
│   └── migrator/             # Database migrations
│       └── src/scripts/
│           ├── api-server-pg/  # PostgreSQL
│           ├── clickhouse/     # ClickHouse
│           └── scylla/         # Scylla
│
└── docs/                      # Documentation
```


# Coop Core Components

## API

Coop accepts both synchronous and asynchronous input.

* Synchronous input is handled via REST APIs and supports item submission, action execution, reporting workflows, policy retrieval, and related operations.  
* Asynchronous input is handled via Kafka-based event streaming using the ITEM\_SUBMISSION\_EVENT topic.

All API requests require an organization API key passed via the x-api-key header.

### Content Submission

* **File**: `/server/routes/content/ContentRoutes.ts`  
* **Route**: `Post /api/v1/content/`
* **Header**: `x-api-key: <org-api-key>`

Accepts any item (eg: content, user, thread) but only accepts a single item at a time. By default, requests are processed asynchronously. To force synchronous mode, set `sync: true` 

**Example request body (JSON):**  
```json
{
  "contentId": "unique-id-123",
  "contentType": "Comment",
  "content": {
    "text": "Hello world",
    "authorId": "user-456",
    "createdAt": "2024-01-01T00:00:00Z"
  },
  "userId": "user-456",
  "sync": false
}
```

### Item Submission

* **File**: `/server/routes/items/ItemRoutes.ts`
* **Route**: `POST /api/v1/items/async/`
* **Header**: `x-api-key: <org-api-key>`

Accepts one or more arbitrary items (users, threads, etc.). All processing is asynchronous.

**Example request body (JSON):**

```json
{
  "items": [
    {
      "id": "unique-item-id-123",
      "data": {
        "fieldName1": "value1",
        "fieldName2": 123
      },
      "typeId": "your-item-type-id",
      "typeVersion": "optional-version-string",
      "typeSchemaVariant": "original"
    }
  ]
}
``` 

### Action Execution

* **File**: `/server/routes/action/ActionRoutes.ts`
* **Route**: `POST /api/v1/actions`
* **Header**: `x-api-key: \<org-api-key\>`

**Example request body (JSON):**

```json
{
  "actionId": "action-id-to-execute",
  "itemId": "target-item-id",
  "itemTypeId": "item-type-id",
  "policyIds": ["policy-id-1", "policy-id-2"],
  "reportedItems": [
    {
      "id": "reported-item-id",
      "typeId": "reported-item-type-id"
    }
  ],
  "actorId": "user-id-who-triggered-action"
}
```

### Reporting

* **File:** `/server/routes/reporting/ReportingRoutes.ts`  
* **Route**: `POST /api/v1/report`                              
* **Header**: `x-api-key: <org-api-key>`

Used to submit reports from users or systems, including contextual items and thread history. The payload supports: 

* Reporter identity   
* Reported item   
* Thread context   
* Policy reason(s)   
* Additional contextual items

**Example request body (JSON):**

```json
{
  "reporter": {
    "kind": "user",
    "typeId": "reporter-user-type-id",
    "id": "reporter-user-id"
  },
  "reportedAt": "2024-01-15T10:30:00.000Z",
  "reportedForReason": {
    "policyId": "violated-policy-id",
    "reason": "Free-text reason from reporter",
    "csam": false
  },
  "reportedItem": {
    "id": "reported-item-id",
    "data": { "fieldName": "value" },
    "typeId": "item-type-id"
  },
  "reportedItemThread": [
    {
      "id": "thread-message-1",
      "data": { "content": "message content" },
      "typeId": "message-type-id"
    }
  ],
  "reportedItemsInThread": [
    { "id": "specific-reported-message", "typeId": "message-type-id" }
  ],
  "additionalItems": [
    { "id": "additional-context-item", "data": {}, "typeId": "item-type-id" }
  ]
}
```

### Appeal

* **File**: `/server/routes/reporting/ReportingRoutes.ts:105-154`
* **Route**: `POST /api/v1/report/appeal`                            
* **Header**: `x-api-key: <org-api-key>`  

Appeals allow users to contest actions taken against items. Appeals include the original action, violated policies, appeal reason, and optional additional context.  
                          
**Example request body (JSON):**

```json
{
  "appealId": "customer-internal-appeal-id",
  "appealedBy": {
    "typeId": "appealer-user-type-id",
    "id": "appealer-user-id"
  },
  "appealedAt": "2024-01-15T12:00:00.000Z",
  "actionedItem": {
    "id": "item-that-was-actioned",
    "data": { "fieldName": "value" },
    "typeId": "item-type-id"
  },
  "actionsTaken": ["action-id-1", "action-id-2"],
  "appealReason": "User's explanation for why they are appealing",
  "violatingPolicies": [
    { "id": "policy-id-1" },
    { "id": "policy-id-2" }
  ],
  "additionalItems": [
    { "id": "additional-context-item", "data": {}, "typeId": "item-type-id" }
  ]
}
```

### Supporting API Endpoints

* **Policies**: `GET /api/v1/policies/`  
* **User Scores**: `GET /api/v1/user_scores`  
* **GDPR Deletion**: `POST /api/v1/gdpr/delete`

### Errors

All API errors use a consistent JSON structure:

```json
{
  "errors": [
    {
      "status": 400,
      "type": ["/errors/invalid-user-input"],
      "title": "Short error description",
      "detail": "Detailed explanation (optional)",
      "pointer": "/path/to/problematic/field (optional)",
      "requestId": "correlation-id (optional)"
    }
  ]
}
```

## Rules Engine

When an item is submitted, Coop retrieves all [rules](RULES.md) associated with the item’s type. Each rule is evaluated by recursively processing its `conditionSet`, extracting values from the item, optionally passing them through signals, and comparing results using configured comparators.

Key characteristics:

* Conditions are evaluated in ascending cost order  
* Short-circuiting is applied based on conjunction type (AND / OR / XOR)  
* Expensive signals are skipped when earlier conditions fail  
* Actions are deduplicated before execution

For rules in actionable environments (e.g., `LIVE`, `MANUAL`), actions are published via the `ActionPublisher`, which handles:

* Customer webhooks  
* MRT enqueueing  
* NCMEC routing

**Location**: `/server/rule_engine`

**Rule structure:** `/server/models/rules/RuleModel.ts`

```typescript
Rule {
  id: string;
  name: string;
  status: RuleStatus;
  ruleType: RuleType;
  conditionSet: ConditionSet;
  orgId: string;
  tags: string[];
  maxDailyActions: number;
}
```

## Manual Review Tool (MRT)

The Manual Review Tool (MRT) is a BullMQ-backed queue system used for human review. Items enter MRT via rule actions or user reports. Each job is enriched with context (user scores, related items) and routes them to named queues via routing rules configured in the UI. Moderators claim tasks via exclusive locks (so only one person can claim one task) and submit decisions (aka take actions), which trigger downstream callbacks or reporting workflows (ie. NCMEC).

### Queue Management

#### Queue Operations

**File**: `/server/services/manualReviewToolService/modules/QueueOperations.ts`

Jobs can be enqueued from:

* Rules engine execution  
* User reports  
* Post-action workflows  
* MRT internal jobs

**Users:**

* Dequeue jobs with exclusive locks  
* Submit decisions  
* Trigger post-decision webhooks or NCMEC reporting

**Supported decision types:**

* `IGNORE`  
* `CUSTOM_ACTION`  
* `SUBMIT_NCMEC_REPORT`  
* `ACCEPT_APPEAL`  
* `REJECT_APPEAL`  
* `TRANSFORM_JOB_AND_RECREATE_IN_QUEUE`  
* `AUTOMATIC_CLOSE`

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

Actions are created when a rule matches or a moderator submits a decision. Coop determines *when* an action should occur; the customer determines *what* happens as a result (label / warn / ban / remove content etc). The actual action is taken by the customer after being triggered through Coop. 

Action types:

* CUSTOMER\_DEFINED\_ACTION: POST webhook to customer infrastructure  
* ENQUEUE\_TO\_MRT: Add item to the manual review queue  
* ENQUEUE\_TO\_NCMEC: Route to NCMEC reporting queue

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

## Storage

Coop uses a multiple database storage system: 

* **PostgreSQL** stores configuration, rules, users, sessions, and MRT decisions with ACID guarantees.   
* **Redis (via BullMQ)** powers MRT job queues, caching, and aggregation counters for very low latency.   
* **ScyllaDb (5.2)** stores item submission history for high-throughput writes with materialized views for varied access patterns.   
* **Clickhouse** serves as the analytics warehouse for rule executions, actions and user statistics. 

### PostgreSQL

ACID compliant storage for config, auth, rules, and operational data including:

* *public*: orgs, users, actions, policies, item\_types, banks, api_keys  
* *jobs*: Scheduled job tracking  
* *manual_review_tool:* manual review queues, decisions, routing rules, comments  
* *ncmec_reporting*: Child safety NCMEC reports  
* *reporting_rules:* User / content reporting rules  
* *signal_service:* Signal configuration  
* *user_management_service*: User management  
* *users_statistics_service:* User statistics

### Redis

Used as low-latency hot cache for:

* **MRT**: BullMQ job queues  
* **Caching**: Sets, Sorted Sets, Lua scripts  
* **Distributed counters**

### ScyllaDb

Used for high-throughput item history (Investigations tool and associated users/items). It serves as time-series item submission storage with multiple access patterns

Tables/Views

* **item_submission_by_thread**: Primary table  
* **item_submission_by_item_id**: Lookup by item ID  
* **item_submission_by_thread_and_time**: Thread and time range  
* **item_submission_by_creator**: Lookup by creator

### ClickHouse

Serves as the OLAP storage for analytics, aggregations, and audit trails

Databases and key tables

* **analytics**: RULE_EXECUTIONS, ACTION_EXECUTIONS, CONTENT_API_REQUESTS, ITEM_MODEL_SCORES_LOG  
* **action executions:** ACTION_STATISTICS_SERVICE: BY_ACTION, BY_RULE, BY_POLICY, ACTIONED_SUBMISSION_COUNTS  
  * MANUAL_REVIEW_TOOL: ROUTING_RULE_EXECUTIONS  
* **Reporting and appeal stats:** REPORTING_SERVICE: REPORTS, APPEALS, REPORTING_RULE_EXECUTIONS  
* **User level metrics:** USER_STATISTICS_SERVICE: LIFETIME_ACTION_STATS, SUBMISSION_STATS, USER_SCORES 

## Signals

Signals are scoring or evaluation functions used by rules. They range from simple text matching to third-party ML services.

The rules engine calls signals when evaluating conditions that need a score. Signals run in cost order (e.g. text matching will run early). If an early condition fails, the expensive signals are skipped. Results are memoized and cached for 30 seconds for reuse. Signals extend a shared base class and define metadata, cost, and execution logic.

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

# Services Required

* PostgreSQL  
* Redis  
* Kafka  
  * Schema registry  
  * Zookeeper  
* Clickhouse  
* ScyllaDb  
* Metrics  
  * Jaeger  
  * Open Telemetry

# Configuration

Server configuration lives in `/server/.env.example`

* Database: PostgreSQL  
* Analytics, Warehouse: Clickhouse  
* Redis: Redis  
* Scylla: Scylla

Rules

* Configured in frontend via GraphQL/dashboard UI  
* Rate limiting via maxDailyActions for each rule  
* Rule status: `LIVE`, `DRAFT`, `BACKGROUND`, `EXPIRED`  
* Signals: Configured in the rules front-end

User roles

* ADMIN: Full access  
* RULES_MANAGER: Can modify live rules  
* ANALYST: View insights  
* MODERATOR_MANAGER: Managers MRT queues  
* MODERATOR: Reviews assigned queues  
* CHILD_SAFETY_MODERATOR: Access to NCMEC data  
* EXTERNAL_MODERATOR: View only MRT access

Permissions

* MANAGE_ORG: ADMIN  
* MUTATE_LIVE_RULES: ADMIN, RULES_MANAGER  
* VIEW_MRT: All moderator roles  
* EDIT_MRT_QUEUES: ADMIN, MODERATOR_MANAGER  
* VIEW_CHILD_SAFETY_DATA: ADMIN, MODERATOR_MANAGER, CHILD\_SAFETY\_MODERATOR

# Action Rules vs Routing Rules

Coop supports two sets of [rules](RULES.md). Each has separate code paths, storage tables, and UI surfaces.

1. [Automated Action rules](RULES.md#automated-action-rules): All rules act in parallel on all events to determine auto actions and MRT decisioning  
2. [Routing rules](RULES.md#routing-rules): First routing rule that succeeds routes the MRT bound event into the appropriate queue awaiting review, the rest are executed in order.

## Rules Engine Rules

Code: `/server/models/rules/RuleModel.ts`

UI: `/client/src/webpages/dashboard/rules/`  

Storage tables:

* public.rules  
* public.rules_and_actions  
* public.rules_and_item_types  
* public.rules_and_policies  
* public.rules_history

## Routing Rules

Code: `/server/services/manualReviewToolService/modules/JobRouting.ts`
UI: `/client/src/webpages/dashboard/mrt/queue_routing/`  

Storage tables:

* manual_review_tool.routing_rules  
* manual_review_tool.routing_rules_to_item_types  
* manual_review_tool.routing_rules_history  
* manual_review_tool.appeal_routing_rules  
* manual_review_tool.appeal_routing_rules_to_item_types

## Authentication

Coop supports three authentication methods: API key authentication for programmatic access, and session-based.

### API Key Authentication

API keys authenticate programmatic requests to REST endpoints. All API requests require the x-api-key header.  
                                                                                                                  
  1. Middleware extracts the x-api-key header      
  2. Key is validated via SHA-256 hash lookup in the database                                                       
  3. If valid, orgId is set on the request for downstream handlers                                                  
  4. Returns 401 Unauthorized if invalid or missing                                                          


* Keys are 32-byte random values, SHA-256 hashed before storage                                                   
* Each key is scoped to a single team (ie. if you have different teams in the same organization whose data should not mix) 
* Last-used timestamp tracked for auditing
* Keys can be rotated (creates new key, deactivates old)                                                        
                                                                                                                    
Files:                                                                                                          
* Middleware: `/server/utils/apiKeyMiddleware.ts`                                                                   
* Service: `/server/services/apiKeyService/apiKeyService.ts`  

### Session-Based Authentication                                                                                                                         

Session authentication is used for dashboard UI access via GraphQL.                                               
                                                                          
  1. User submits credentials via GraphQL login mutation 
  2. Passport's GraphQLLocalStrategy validates email/password                                                       
  3. Password verified via bcrypt comparison
  4. On success, user serialized to session via passport.serializeUser()                                            
  5. Session stored in PostgreSQL via connect-pg-simple                                                                                                                                                              
Session configuration:                                                                                          
* Store: PostgreSQL-backed                                                                                        
* Cookie: Secure flag in production, 30-day expiry                                                                
* Session secret: process.env.SESSION_SECRET                                                                                                                                                  
  Files: `/server/api.ts`   

### SAML/SSO Authentication                                                                                         

Enterprise SSO uses SAML with per-organization configuration.                                                     
                                                                                                      
  1. User navigates to /saml/login/{orgId}
  2. Passport's MultiSamlStrategy retrieves org-specific SAML settings                                              
  3. User redirected to configured SAML provider
  4. Provider authenticates and posts assertion to callback URL            
  5. User email extracted from SAML assertion
  6. User record looked up and session created                                                                                                                                                                  
Configuration (per org in org\_settings table):                                                                  

* saml\_enabled: Boolean flag                                                                                      
* sso\_url: SAML entry point URL                                                                                   
* cert: Certificate for validation                                                                              
                                                                                                                    
  Files:                                                                                                            
`/server/api.ts (lines 142-227)`                                                                                  
`/server/services/SSOService/SSOService.ts`

