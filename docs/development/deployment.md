# Deployment

Get Coop running on your own infrastructure. You may also be interested in the [Docker images](docker.md) and [architecture information](architecture.md).

> [!IMPORTANT]
> When you run migrations, we create a sample org which contains users with default passwords. Make sure you clean up in a production environment.

## Self-hosting checklist

Coop does not currently ship a single production deployment recipe, but the repository does include the configuration surface you need to stand up a self-hosted instance. Treat the example environment files in `db/.env.example`, `server/.env.example`, and `client/.env.example` as the starting point for your deployment-specific configuration.

### Required production configuration

At minimum, a production deployment should provide:

- Database connectivity for the API server Postgres instance and the database migrator.

- Redis connectivity for queues and background processing.

- Scylla connectivity for item submission history.

- Session secret (`SESSION_SECRET`) and other secrets.

- A public UI origin such as `UI_URL` / `VITE_UI_URL` so generated links and browser-facing flows point at the correct host.

- Email sender addresses that match your deployment.

You will usually also want to review the pool, timeout, TLS, and keepalive settings in `server/.env.example` before going live, since the defaults are tuned for local development rather than a long-running production environment.

### Optional and deployment-specific configuration

Many other settings are only required if you are enabling specific features or changing backend choices:

- Analytics and warehouse backends are controlled by `WAREHOUSE_ADAPTER` and `ANALYTICS_ADAPTER`. See [Data Warehouse Abstraction Layer](data-warehouse.md) for the supported adapters and the related ClickHouse/PostgreSQL settings.

- Child safety reporting is optional, but if you are using NCMEC reporting you must configure the org settings in Coop and set `NCMEC_ENV=production` on the server only when your deployment has been approved for live reporting. See [NCMEC CyberTipline](../integrations/ncmec.md#test-vs-production-submissions).

- Client-side integrations such as Google Places and custom docs URLs are optional and can be left unset if you do not use those capabilities. See [Content Proxy](#content-proxy) below for `VITE_CONTENT_PROXY_URL`.

- Third-party integration keys in `server/.env.example` are generally optional unless you are enabling the corresponding integration.

### Before going live

After the first successful migration and bootstrap:

1. Remove or secure the sample org and any users created with default passwords.

2. Confirm the production hostname and email settings are correct.

3. Verify your selected warehouse and analytics adapters match the backing services you actually deployed.

4. Leave `NCMEC_ENV` unset or non-`production` unless you intentionally want live CyberTipline submissions.

## Single Sign-on

Coop supports single sign-on via SAML, e.g. with Okta. Enable SSO and configure the URL and certificate under [Settings → Single Sign-on](../user/administration.md#single-sign-on).

### Example: Okta

Configuring Okta SAML for Coop requires:

- Admin mode in Okta
- Group names that match exactly between Okta and SAML
- Admin permissions in Coop
- Ability to create a custom SAML application

To set it up:

1. Create a [custom SAML application](https://help.okta.com/oag/en-us/content/topics/access-gateway/add-app-saml-pass-thru-add-okta.htm) in Okta with the following settings:

   | Setting                                         | Value                                                                                                                                               |
   | :---------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------- |
   | Single sign-on URL                              | Your organization's callback URL (e.g. `https://your-coop-instance.com/login/saml/12345/callback`). Find this in Coop under **Settings** → **SSO**. |
   | Audience URI (SP Entity ID)                     | Your Coop instance base URL (e.g. `https://your-coop-instance.com`).                                                                                |
   | `email` attribute (in **Attribute Statements**) | `email`. This depends on your identity provider's attribute mappings (e.g. Google SSO may use "Primary Email").                                     |

2. In the **Feedback** tab, check **I'm a software vendor. I'd like to integrate my app with Okta**.
3. In your app's settings, go to the **Sign On** tab. Under **SAML Signing Certificates** → **SHA-2**, click **Actions** → **View IdP metadata**.
4. Copy the contents of the XML file. In Coop, go to **Settings** → **SSO** and paste the XML into the **Identity Provider Metadata** field.
5. On the same page, enter `email` in the **Attributes** section.
6. In your Okta app under **Assignments**, assign users or groups to your app.

## Content Proxy

Coop can optionally route item content URLs through a **content proxy**: a service you host that fetches a content URL and serves it back inside the review iframe, so it can control presentation and apply wellness features (since the review UI cannot otherwise style or control content from a cross-origin iframe).

Set `VITE_CONTENT_PROXY_URL` to your proxy's base URL to enable it. Left unset (the default), matching content just loads directly in the iframe.

Coop does not ship a reference proxy implementation, so you'll need to deploy your own implementation.

### Load content

Coop loads your proxy at:

```
<VITE_CONTENT_PROXY_URL>/?contentUrl=<url-encoded content URL>
```

Your service should fetch and serve back the given `contentUrl`'s content.

### Wellness features

After the iframe loads, and whenever a reviewer changes their overlay settings, Coop posts a message to your proxy's page:

```json
{
  "type": "customControl",
  "blur": 0,
  "grayscale": false,
  "shouldTranslate": false,
  "sepia": false
}
```

`blur` ranges from `0` (none) to `6` (strongest); `grayscale` and `sepia` are simple on/off filters. Your proxy's page should listen for this message and apply the requested effects to the content it's displaying.

## Manual-review telemetry

The existing OpenTelemetry meter exports optional manual-review instruments:

- `coop-api.manual_review.events.counter` always carries `event` and `queue_id`.
  Enqueue-call and content-resolution events also carry `item_type_id`; decisions
  and `timing_unavailable_*` events carry `item_type_id`, `decision_type`, and
  `automatic`. Claims, skips, collection failures and removed-queue events carry
  no other attributes. `enqueue_call_succeeded` and `appeal_enqueue_call_succeeded`
  count successful calls, including deduplicated adds, not unique insertions.
  A stored decision is not proof that its downstream action completed.
- `coop-api.manual_review.duration_ms.histogram` carries `phase=claim_elapsed` or
  `total_to_decision`, `queue_id`, `item_type_id`, `decision_type`, and `automatic`.
  Claim elapsed includes idle time. Automatic closes and swept dispositions have
  no human claim sample; directly reviewed decisions with missing/invalid claim
  timestamps still emit availability events instead of zero durations.
- `coop-api.manual_review.snapshot.gauge` with `kind`. Set
  `MANUAL_REVIEW_METRICS_ORG_ID` on the server to opt in to that organization's
  snapshots. Without this setting, no polling takes place. The default meter
  remains a no-op unless the deployment registers an OpenTelemetry provider.

Snapshot collection uses the existing queue service and public BullMQ APIs,
about once a minute after the preceding cycle settles. The SQL list is limited to
51 rows; finding more than 50 rejects that cycle without sampling any queue.
Each queue reads at most 1,000 ready-job timestamps. No media is fetched or job
lock acquired. BullMQ may hydrate queued payloads internally; only numeric
aggregates and static queue identifiers leave the snapshot helper.

A 20-second deadline covers the entire cycle, including the queue list. Expiry
records `collection_failed_timeout` and `success=0`, prevents further reads and
discards late results. Shared database/Redis calls cannot be force-cancelled;
an in-flight read must settle before the next cycle is scheduled. A permanently
stalled read therefore leaves the collector failed, rather than accumulating
concurrent requests. Shutdown aborts scheduling and suppresses late emissions.

`collection_failed_read`, `collection_failed_queue_limit`, and
`collection_failed_timeout` count failures independently of the latest health
gauge. They use `queue_id=all` and never carry raw errors, identifiers or URLs.
A later success does not erase these historical failure counts.

The `kind` values separate jobs by state, observed oldest-ready age, timestamp
coverage, per-queue sample time and collection health/freshness. Query each kind
separately. Waiting and prioritized jobs contribute to age; active, paused and
delayed jobs do not. Age starts at the BullMQ entry timestamp. Coverage means the
bounded read passed its checks, not an atomic snapshot. Concurrent queue changes
or partial reads can understate age. Failed collection leaves the last backlog
sample unchanged; inspect health and advancing per-queue sample timestamps.

Snapshots carry `kind` and `queue_id`; job-count samples also carry `state`.
`present=1` means the queue appeared in the latest successful list. After a known
queue disappears from a successful list, the collector emits `present=0`, clears
its counts and age, sets coverage to 1 (no remaining jobs to inspect), advances
its sample timestamp, and emits `queue_removed`. A failed/partial cycle never
marks queues removed. Cleared series are tombstones, not existing empty queues;
use `present` when listing queues. Exporter-retained samples from stopped
replicas or previous processes still require freshness/retention checks.

Counters are best-effort operational signals, not an audit ledger. Replica
snapshots must not be summed. StatsD exporters may repeat stale gauges and
export non-mergeable per-host histogram percentiles. Configure privacy and
cardinality controls in the deployment's provider. No content, reviewer, URL
or free-text reason is added to metric attributes by this instrumentation.

## Historical reference

For historical reference, AWS infrastructure code (CDK, Helm charts, Pulumi, CDKTF) that was previously used for production deployments is available in the [`0.1` tag](https://github.com/roostorg/coop/tree/0.1/.devops). That infrastructure code may have drifted from the current application architecture and is no longer maintained, but may serve as a reference for your own deployment.

<style>
  /* TODO: move this to site-wide style override */
  table {
    width: 100%;
  }

  table td,
  table thead th {
    padding: 0.25em 0.5em;
  }

  table td {
    text-wrap: balance;
    word-wrap: anywhere;
  }
</style>
