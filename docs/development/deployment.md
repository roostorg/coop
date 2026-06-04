# Deployment

For historical reference, AWS infrastructure code (CDK, Helm charts, Pulumi, CDKTF) that was previously used for production deployments is available on the [`0.1` branch](https://github.com/roostorg/coop/tree/0.1/.devops). That infrastructure code may have drifted from the current application architecture and is no longer maintained, but can serve as a reference for your own deployment.

**IMPORTANT** When you run migrations, we create a sample org which contains users with default passwords. Make sure you clean up in a production environment.

## Self-hosting checklist

Coop does not currently ship a single production deployment recipe, but the repository does include the configuration surface you need to stand up a self-hosted instance. Treat the example environment files in `db/.env.example`, `server/.env.example`, and `client/.env.example` as the starting point for your deployment-specific configuration.

### Required production configuration

At minimum, a production deployment should provide:

- Database connectivity for the API server Postgres instance and the database migrator.
- Redis connectivity for queues and background processing.
- Scylla connectivity for item submission history.
- Session and token secrets such as `SESSION_SECRET` and `GRAPHQL_OPAQUE_SCALAR_SECRET`.
- A public UI origin such as `UI_URL` / `VITE_UI_URL` so generated links and browser-facing flows point at the correct host.
- Email sender addresses that match your deployment.

You will usually also want to review the pool, timeout, TLS, and keepalive settings in `server/.env.example` before going live, since the defaults are tuned for local development rather than a long-running production environment.

### Optional and deployment-specific configuration

Many other settings are only required if you are enabling specific features or changing backend choices:

- Analytics and warehouse backends are controlled by `WAREHOUSE_ADAPTER` and `ANALYTICS_ADAPTER`. See [Data Warehouse Abstraction Layer](data-warehouse.md) for the supported adapters and the related ClickHouse/PostgreSQL settings.
- Child safety reporting is optional, but if you are using NCMEC reporting you must configure the org settings in Coop and set `NCMEC_ENV=production` on the server only when your deployment has been approved for live reporting. See [NCMEC CyberTipline](../integrations/ncmec.md#test-vs-production-submissions).
- Client-side integrations such as Google Places and custom docs/content proxy URLs are optional and can be left unset if you do not use those capabilities.
- Third-party integration keys in `server/.env.example` are generally optional unless you are enabling the corresponding integration.

### Before going live

After the first successful migration and bootstrap:

1. Remove or secure the sample org and any users created with default passwords.
2. Confirm the production hostname and email settings are correct.
3. Verify your selected warehouse and analytics adapters match the backing services you actually deployed.
4. Leave `NCMEC_ENV` unset or non-`production` unless you intentionally want live CyberTipline submissions.

## Settings

Settings live across several database tables. Many are not yet exposed in the front-end UI and can only be configured directly in the database.

### Organization

The `public.org_settings` table is the main catch-all for org-level feature flags and integration configuration. It controls which major features are enabled (appeals, reporting rules, multi-policy actions), integration points (SSO/SAML, the Partial Items API, appeal callbacks), and behavioral settings like how long user strikes remain active.

#### Appeals

Settings for [Appeals](../user/appeals.md) using the [Appeals API](../api/appeals.md).

| Setting                   | Default | Description                                      | Where to configure                 |
| :------------------------ | :------ | :----------------------------------------------- | :--------------------------------- |
| `has_appeals_enabled`     | `false` | Enables the appeals feature for the org          | Database-only                      |
| `appeal_callback_url`     | `NULL`  | Webhook URL called when an appeal is submitted   | **Settings** → **Appeal Settings** |
| `appeal_callback_headers` | `NULL`  | Custom headers sent with appeal webhook requests | **Settings** → **Appeal Settings** |
| `appeal_callback_body`    | `NULL`  | Custom body template for appeal webhook requests | **Settings** → **Appeal Settings** |

#### Single-sign-on

| Setting        | Default | Description                                    | Where to configure     |
| :------------- | :------ | :--------------------------------------------- | :--------------------- |
| `saml_enabled` | `false` | Activates SAML/SSO for the org                 | Database-only          |
| `sso_url`      | `NULL`  | The SAML identity provider endpoint            | **Settings** → **SSO** |
| `cert`         | `NULL`  | The SAML identity provider signing certificate | **Settings** → **SSO** |

#### Partial Items

Custom endpoint and headers for fetching additional item data using the [Partial Items API](../api/partial-items.md).

| Setting                         | Default | Description                                | Where to configure |
| :------------------------------ | :------ | :----------------------------------------- | :----------------- |
| `partial_items_endpoint`        | `NULL`  | Endpoint for fetching additional item data | Database-only      |
| `partial_items_request_headers` | `NULL`  | Custom headers for partial items requests  | Database-only      |

#### Others

| Setting                              | Default | Description                                                            | Where to configure |
| :----------------------------------- | :------ | :--------------------------------------------------------------------- | :----------------- |
| `has_reporting_rules_enabled`        | `false` | Enables Report Rules for proactive actions in response to user reports | Database-only      |
| `allow_multiple_policies_per_action` | `false` | Job decisions can reference multiple policies                          | Database-only      |
| `user_strike_ttl_days`               | `90`    | Days before user strikes expire                                        | Database-only      |

### Review Console

The `manual_review_tool.manual_review_tool_settings` table affects reviewer capabilities in the Review Console.

| Setting                           | Default | Description                                                           | Where to configure |
| :-------------------------------- | :------ | :-------------------------------------------------------------------- | :----------------- |
| `requires_policy_for_decisions`   | `false` | Moderators must choose a policy when performing a job action          | Database-only      |
| `mrt_requires_decision_reason`    | `false` | Moderators must provide a written decision when completing a job      | Database-only      |
| `hide_skip_button_for_non_admins` | `false` | Non-admins must work jobs in order and may not skip a job             | Database-only      |
| `preview_jobs_view_enabled`       | `false` | Anyone who can edit queues may preview a queue without claiming a job | Database-only      |
| `ignore_callback_url`             | `NULL`  | Where to send a webhook with item data when a job is ignored          | Database-only      |

### Wellness

The `user_management_service.org_default_user_interface_settings` table stores the org-wide defaults for reviewer wellness interface preferences. These values apply to new reviewers when they join; individual reviewers can override them in their own settings.

| Setting                       | Default | Description                                    | Where to configure          |
| :---------------------------- | :------ | :--------------------------------------------- | :-------------------------- |
| `moderator_safety_blur_level` | `2`     | Default blur intensity (0–3) for new reviewers | **Settings** → **Wellness** |
| `moderator_safety_grayscale`  | `true`  | Default grayscale mode for new reviewers       | **Settings** → **Wellness** |
| `moderator_safety_mute_video` | `true`  | Default video mute state for new reviewers     | **Settings** → **Wellness** |

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
