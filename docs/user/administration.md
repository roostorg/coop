# Administration

Admins manage organization-wide configuration including items, actions, policies, user access, authentication, and integrations settings. All of these settings are accessible under **Settings** in Coop.

## Item Types

Item Types represent the different types of entities on your platform.

![Configuration of an Item Type: a post from the firehose with a schema of fields that get sent to Coop including text, unique ID as well as what format the fields are in](../images/coop-items.png)

For example, a social network might have _Profile_, _Post_, _Comment_, and _Comment Thread_. A marketplace platform might include _Buyer_, _Seller_, _Product Listing_, _Product Review_, _Direct Message_, _Transaction_, etc. Every Item you send Coop needs to be an instance of exactly one of these Item Types.

When creating an Item Type, define the schema to include which fields will be included and shown to reviewers. These fields are also available in any rule logic to connect with signals for routing or automation.

## Actions

Actions represent any action you can perform on Items.

![Table of configured custom actions like: send warning, label as spam, delete content, delete account, ban email](../images/coop-actions.png)

Some common examples include _Label_, _Send Warning_, _Delete_, _Ban_, _Mute_, _Approve_, etc.

![Creating an action in Coop: add the name, description, what item types the action can run on, and a callback URL](../images/coop-define-action.png)

For every Action you define in Coop, you have to expose the action through an API endpoint that can receive requests from Coop. Whenever your rules determine that some Item should receive an Action, Coop will send a POST request to the Action's API endpoint. When your server receives that POST request, your code should actually perform the corresponding action.

![Two cards to set up API access to Google's Content Safety API and OpenAI's Moderation API](../images/coop-api-keys.png)
Coop uses an API key to gate its endpoints. Use the UI to generate an API key to authenticate any requests Coop makes to your organization’s endpoints.

## User Scores

Coop tracks a score for each user based on their moderation history. Scores help moderators prioritize review—a low-scoring user's content can be routed to a stricter queue or automatically actioned.

Each Action has a **penalty weight** (None, Low, Medium, High, or Severe), and each Policy also has a penalty weight. When a decision is made, Coop adds both weights to compute the combined penalty for that (Action, Policy) pair. Higher combined penalties push the user's score down faster.

For the scoring formula, thresholds, and an example, see [User Score](concepts.md#user-score) in Basic Concepts.

## Policies

Policies are categories of harm that are prohibited or monitored on your platform.

![Policy Dashboard showing 4 policies: Fraud, Nudity, Scams, Spam. There's a button to create new policies as well as options to add sub-policies for each existing policy and edit or delete them](../images/coop-policies.png)

Some typical examples include _Spam_, _Nudity_, _Fraud_, _Violence_, etc. Policies can have sub-policies underneath them; for example, a _Spam_ policy could have sub-policies like _Commercial Spam_, _Repetitive Content_, _Fake Engagement_, and _Scams and Phishing_.

It is often useful (and in some cases required by legislation such as the EU's Digital Services Act) to tie every action you take to one or more specific policies. For example, you could delete a comment under your _Nudity_ policy, or under your _Spam_ policy. Coop tracks those differences and measures how many actions you've taken per policy, so you can see how effectively you're enforcing each policy over time, identify gaps, and report to your team or to regulators.

Policies added in Coop's UI are visible to reviewers directly in the review flow.

Learn more about policies from the [Trust & Safety Professional Association](https://www.tspa.org/curriculum/ts-fundamentals/policy/policy-development/).

## User management

Coop uses role-based access controls to ensure the right people can access the right data.

![User management page in Coop showing different users with different emails and roles assigned to them. There is an Approval Status column and a column showing when they were created](../images/coop-manage-users.png)

You can invite users from **Settings → Users**, either copying the invite link to share directly or configuring an email service to send it automatically.

![Coop's user invitation flow](../images/coop-invite.png)

### Roles

Coop comes with seven predefined roles:

| User Role              | Access Manual Review Tool | View all Queues | Create, Delete and Edit Queues | Create, Delete and Edit Rules | Access NCMEC data | Access Insights |
| :--------------------- | :------------------------ | :-------------- | :----------------------------- | :---------------------------- | :---------------- | :-------------- |
| Admin                  | Yes                       | Yes             | Yes                            | Yes                           | Yes               | Yes             |
| Rules Manager          | No                        | No              | No                             | Yes                           | No                | Yes             |
| Moderator Manager      | Yes                       | Yes             | Yes                            | No                            | Yes               | No              |
| Child Safety Moderator | Yes                       | No              | No                             | No                            | Yes               | No              |
| Moderator              | Yes                       | No              | No                             | No                            | No                | No              |
| Analyst                | No                        | No              | No                             | No                            | No                | Yes             |
| External Moderator     | Yes                       | No              | No                             | No                            | No                | No              |

**Admin**: manage the entire organization. They have full control over all resources and settings within Coop.

**Rules Manager**: can create, edit, and deploy Live Rules, run retroaction and backtests, view rule insights, manage policies, use the Investigation tool, and bulk-action content. They cannot manage users, queues, or other organization-level settings.

**Moderator Manager**: can view and edit all queues within the Manual Review Tool, manage moderator permissions, use the Investigation tool, and bulk-action content. They can also view child safety data.

**Child Safety Moderator**: the same permissions as Moderators, but can also review Child Safety jobs and see previous Child Safety decisions.

**Moderator**: can access the Manual Review Tool, but can only review jobs from queues they've been given permission to see. They cannot see any Child Safety-related jobs or decisions.

**Analyst**: can modify and test Draft and Background Rules, run backtests, and view rule insights and the Investigation tool. They cannot create or edit Live Rules, run Retroaction, or access the Manual Review Tool.

**External Moderator**: can only review jobs in the Manual Review Tool. They cannot see any decisions or use any other tooling.

## SSO

Coop supports single sign-on via Okta SAML.

### Prerequisites

- Admin mode in Okta
- Group names that match exactly between Okta and SAML
- Admin permissions in Coop
- Ability to create a custom SAML application

### Configuration

1. Create a [custom SAML application](https://help.okta.com/oag/en-us/content/topics/access-gateway/add-app-saml-pass-thru-add-okta.htm) in Okta with the following settings:

   | Setting                                         | Value                                                                                                                                           |
   | :---------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------- |
   | Single sign-on URL                              | Your organization's callback URL (e.g. `https://your-coop-instance.com/login/saml/12345/callback`). Find this in Coop under **Settings → SSO**. |
   | Audience URI (SP Entity ID)                     | Your Coop instance base URL (e.g. `https://your-coop-instance.com`).                                                                            |
   | `email` attribute (in **Attribute Statements**) | `email`. This depends on your identity provider's attribute mappings (e.g. Google SSO may use "Primary Email").                                 |

2. In the **Feedback** tab, check **I'm a software vendor. I'd like to integrate my app with Okta**.
3. In your app's settings, go to the **Sign On** tab. Under **SAML Signing Certificates → SHA-2**, click **Actions → View IdP metadata**.
4. Copy the contents of the XML file. In Coop, go to **Settings → SSO** and paste the XML into the **Identity Provider Metadata** field.
5. On the same page, enter `email` in the **Attributes** section.
6. In your Okta app under **Assignments**, assign users or groups to your app.

## API Keys

Coop uses API keys to authenticate requests between your platform and Coop.

### Coop API key

To authenticate requests your platform sends to Coop, include your organization's API key as an HTTP header on every request. You can find or rotate your key in **Settings** → **API Keys**.

```
X-API-KEY: <<apiKey>>
Content-Type: application/json
```

To verify that incoming requests to your Action endpoints were sent by Coop, use the webhook signature verification key shown in **Settings → API Keys**. See [API Keys and Authentication](../development/api-auth.md) in the Development Guide for implementation details.
