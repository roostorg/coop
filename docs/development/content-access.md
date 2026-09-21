# Content access extensions

A deployment can supply an additional content-access policy and an audit sink.
The extension receives authenticated actor and resource metadata, never item
payloads, comment text, decision reasons or media URLs. Existing Coop permissions
still apply. With no extension registered, these fields use Coop's normal access
rules and do not persist audit events.

## Configure before startup

Pass a `contentAccess` extension to `getBottle`, or register it before the dependency
container initializes. For a startup module located at `server/content-access-startup.ts`
(compiled alongside `services/` in `server/transpiled/`):

```ts
import {
  registerContentAccessExtension,
  type ContentAccessExtension,
} from './services/contentAccessService.js';

// Supplied by the deployment. These are not built-in storage/policy services.
declare const extension: ContentAccessExtension;
registerContentAccessExtension(extension);
```

Object literals and class instances are supported; callbacks keep their original
`this` receiver. The container captures the callbacks when it creates the service.
Explicit `getBottle({ contentAccess: ... })` configuration takes precedence over a
registered extension, including `{}` to disable it. The latest active registration
wins; its cleanup function removes only that registration and is safe to call
repeatedly or out of order. Cleanup affects future containers, not existing ones.

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

## Failure handling and diagnostics

Denials use GraphQL `FORBIDDEN`; unavailable policy/audit dependencies return
`INTERNAL_SERVER_ERROR` with `Content access verification is unavailable.` The
production non-null schema is unchanged. A denied `payload`, item `data` or
`commentText` therefore nulls the nearest nullable ancestor, potentially an entire
job list or the response's `data`. Clients must handle GraphQL errors; this API
does not promise partial redaction or preserve job metadata in a failing subtree.

Existing Coop tracing records separate `authorize:ContentAccessService` and
`record:ContentAccessService` spans when those callbacks run. Failures record only
a sanitized exception and the stage, field, resource type and request ID. Raw
callback exception text, content and actor/resource identifiers are not recorded.
Use the request ID to correlate with deployment-owned diagnostics; a callback
requiring deeper diagnosis must sanitize its own logs. No spans, audit calls or
extra item-type hydration are added when both callbacks are absent.

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
  services/contentAccessService.tracing.test.ts \
  graphql/modules/contentAccess.resolver.test.ts
```

The GraphQL tests reuse production SDL/object types and field resolvers with
fixture root data sources, executing through Apollo and its production formatter.
They exercise real null propagation, denial audit metadata, sanitized failures,
aliases, item versions, tenant checks and the no-extension compatibility path.
Service tests cover class callbacks, the container factory, every cleanup ordering
for three registrations and sanitized tracing. Full deployment validation must
still cover real root queries, parent authorization and configured policy/audit
dependencies.
