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
