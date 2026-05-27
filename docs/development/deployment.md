# Deployment

For historical reference, AWS infrastructure code (CDK, Helm charts, Pulumi, CDKTF) that was previously used for production deployments is available on the [`0.1` branch](https://github.com/roostorg/coop/tree/0.1/.devops). That infrastructure code may have drifted from the current application architecture and is no longer maintained, but can serve as a reference for your own deployment.

**IMPORTANT** When you run migrations, we create a sample org which contains users with default passwords. Make sure you clean up in a production environment.

## Settings

Settings live across several database tables. Many are not yet exposed in the front-end UI and can only be configured directly in the database.

### Organization settings

The `public.org_settings` table is the main catch-all for org-level feature flags and integration configuration. It controls which major features are enabled (appeals, reporting rules, multi-policy actions), integration points (SSO/SAML, the Partial Items API, appeal callbacks), and behavioral settings like how long user strikes remain active.

#### Appeals

Settings for [Appeals](../user/appeals.md) using the [Appeals API](../api/appeals.md).

| Setting                   | Default | Where to configure                 |
| ------------------------- | ------- | ---------------------------------- |
| `has_appeals_enabled`     | `false` | Database-only                      |
| `appeal_callback_url`     | `NULL`  | **Settings** → **Appeal Settings** |
| `appeal_callback_headers` | `NULL`  | **Settings** → **Appeal Settings** |
| `appeal_callback_body`    | `NULL`  | **Settings** → **Appeal Settings** |

#### Single-sign-on

| Setting        | Default | Where to configure     |
| -------------- | ------- | ---------------------- |
| `saml_enabled` | `false` | Database-only          |
| `sso_url`      | `NULL`  | **Settings** → **SSO** |
| `cert`         | `NULL`  | **Settings** → **SSO** |

#### Partial Items

Custom endpoint and headers for fetching additional item data using the [Partial Items API](../api/partial-items.md).

| Setting                         | Default | Where to configure |
| ------------------------------- | ------- | ------------------ |
| `partial_items_endpoint`        | `NULL`  | Database-only      |
| `partial_items_request_headers` | `NULL`  | Database-only      |

#### Proactive Rules

Gates the [Proactive Rules](../user/rules.md#proactive-rules) feature.

| Setting                       | Default | Where to configure |
| ----------------------------- | ------- | ------------------ |
| `has_reporting_rules_enabled` | `false` | Database-only      |

#### Others

| Setting                              | Default | Where to configure |
| ------------------------------------ | ------- | ------------------ |
| `allow_multiple_policies_per_action` | `false` | Database-only      |
| `user_strike_ttl_days`               | `90`    | Database-only      |

### Review Console settings

The `manual_review_tool.manual_review_tool_settings` table controls reviewer behavior in the Review Console.

#### Decision requirements

| Setting                         | Default | Where to configure |
| ------------------------------- | ------- | ------------------ |
| `requires_policy_for_decisions` | `false` | Database-only      |
| `mrt_requires_decision_reason`  | `false` | Database-only      |

#### Reviewer UI

| Setting                           | Default | Where to configure |
| --------------------------------- | ------- | ------------------ |
| `hide_skip_button_for_non_admins` | `false` | Database-only      |
| `preview_jobs_view_enabled`       | `false` | Database-only      |

#### Callbacks

| Setting               | Default | Where to configure |
| --------------------- | ------- | ------------------ |
| `ignore_callback_url` | `NULL`  | Database-only      |

### Default reviewer interface settings

The `user_management_service.org_default_user_interface_settings` table stores the org-wide defaults for reviewer wellness and safety interface preferences. These values apply to new reviewers when they join; individual reviewers can override them in their own settings.

| Setting                       | Default | Where to configure          |
| ----------------------------- | ------- | --------------------------- |
| `moderator_safety_blur_level` | `2`     | **Settings** → **Wellness** |
| `moderator_safety_grayscale`  | `true`  | **Settings** → **Wellness** |
| `moderator_safety_mute_video` | `true`  | **Settings** → **Wellness** |

<style>
  /* TODO: move this to site-wide style override */
  table {
    width: 100%;
  }
</style>
