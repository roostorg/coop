# Deployment

For historical reference, AWS infrastructure code (CDK, Helm charts, Pulumi, CDKTF) that was previously used for production deployments is available on the [`0.1` branch](https://github.com/roostorg/coop/tree/0.1/.devops). That infrastructure code may have drifted from the current application architecture and is no longer maintained, but can serve as a reference for your own deployment.

**IMPORTANT** When you run migrations, we create a sample org which contains users with default passwords. Make sure you clean up in a production environment.

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
