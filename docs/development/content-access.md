# Content access extensions

A deployment can supply an additional content-access policy and an audit sink.
The extension receives authenticated actor and resource metadata, never item
payloads, comment text, decision reasons or media URLs. Existing Coop permissions
still apply. With no extension registered, these fields use Coop's normal access
rules and do not persist audit events.

## Configure before startup

Pass a `contentAccess` extension to `getBottle`, or register it from a startup
module before the dependency container initializes:

```ts
import {
  registerContentAccessExtension,
  type ContentAccessExtension,
} from './server/services/contentAccessService.js';

// Supplied by the deployment. These are not built-in storage/policy services.
declare const extension: ContentAccessExtension;
registerContentAccessExtension(extension);
```

The extension has two optional async callbacks:

- `authorize(request)` must resolve to `true` to allow the protected field.
  Any other result denies it. Omitting this callback adds no restriction.
- `record(event)` must finish before the field is returned. A deployment that
  requires durable audit evidence must await a durable write here, not enqueue
  an unacknowledged background write or merely log to the console.

A policy or sink exception blocks the field with a sanitized error. No fallback
to the original content is allowed. Callback implementations must set bounded
timeouts for their dependencies; the extension does not retry them. Missing
required deployment configuration must fail startup rather than silently omit
an extension.

The policy does not receive a client-supplied actor or role. Its `actorId` and
`orgId` come from the authenticated session. Deployments may look up additional
entitlements using those identifiers. Keep entitlements outside the affected
user's control if the policy is intended to restrict administrators.

## Protected fields

| GraphQL field                                          | Resource                                                        |
| ------------------------------------------------------ | --------------------------------------------------------------- |
| `ManualReviewJob.payload`                              | Job ID; shared by active, preview, history and appeal responses |
| `ContentItem.data`, `UserItem.data`, `ThreadItem.data` | Item ID, item type ID and submission ID                         |
| `ManualReviewJobComment.commentText`                   | Comment ID                                                      |
| `ManualReviewDecision.decisionReason`                  | Decision ID, when the reason is present                         |

The checks run on the response fields, not only on URL refresh. Direct item
queries therefore also invoke them. Job and hydrated item ownership must match
the caller's organization before the callbacks run. Comments and decisions
retain the organization scoping enforced by their parent services.

Each callback request contains `orgId`, `actorId`, `requestId`, `resourceType`,
`resourceId`, `field`, and applicable item identifiers. Audit events also contain
a UUID `eventId`, an ISO timestamp `occurredAt`, and `outcome` (`authorized` or
`denied`). Policy exceptions do not produce an authorized event. Failures in
Coop's existing authentication/authorization before these fields are reached
are not recorded by this extension.

Repeated aliases of the same field/resource/actor share one check within a
GraphQL context, including a rejected check. Different item submissions get
separate events. Later requests get new IDs and run the callbacks again.
Treat `eventId` as an idempotency key for retries performed by your sink.

An `authorized` event means the field passed the additional policy and its
configured audit callback completed. It does not prove successful delivery,
video playback, reading, or a submitted decision. Other response fields may
still fail after the event is written.

## Boundaries

This is not a complete restricted-administrator role. It adds no roles,
permission grants, database tables, retention policy or audit viewer. It does
not prevent role/user/API-key management, configuration-based exfiltration,
backend fetches that happen before field resolution, or service API access.
Already issued media URLs are not revoked by a later policy denial.

JSON/text fields outside the table, REST/service endpoints, exports and
integration callbacks are not protected by this extension. A deployment must
review these paths before claiming that a user cannot access content. In
particular, do not give someone unrestricted API credentials and then rely on
these GraphQL field checks to restrict them.

Keep the audit sink restricted and avoid making actor/resource IDs metric
labels. Store only necessary metadata under the deployment's retention policy.

## Tests

```sh
cd server
npm run typecheck
npm run test:prepush -- --runInBand --coverage=false \
  services/contentAccessService.test.ts \
  graphql/modules/contentAccess.resolver.test.ts
```

The GraphQL tests use the production field resolvers with fixture root fields.
They exercise denial, audit failures, aliases, item versions and tenant checks
without a database. Full deployment validation must also cover real root
queries, parent authorization and the configured policy/audit dependencies.
