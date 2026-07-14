# Server Scripts

This directory contains utility scripts for managing the Coop server.

## get-invite-token.ts

Retrieves the signup invite link for a user that was invited from the UI.

### Usage

From the `server` directory, run:

```bash
npm run get-invite -- --email "user@example.com"
```

### Parameters

- `--email`: Email address of the invited user (required)

### Output

The script will display:

- Invite details (email, role, org ID, created date)
- **Signup URL** - The full URL to complete signup

### Example Output

```
✅ Invite Token Found!

════════════════════════════════════════════════════════════
Invite Details:
════════════════════════════════════════════════════════════
Email:         user@example.com
Role:          MODERATOR
Organization:  abc123xyz
Created At:    2025-12-10T20:15:30.000Z

════════════════════════════════════════════════════════════
🔗 Signup URL:
════════════════════════════════════════════════════════════

http://localhost:3000/signup/a1b2c3d4e5f6...

Copy this URL and paste it in your browser to sign up.
════════════════════════════════════════════════════════════
```

### Notes

- Invite tokens are stored in the `public.invite_user_tokens` table.
- Emails are normally sent to new users, but require SENDGRID token for this.
- The script shows the most recent invite for the given email.

---

## create-org-and-user.ts

Creates a new organization with an admin user and generates an API key.

### Usage

From the `server` directory, run:

```bash
npm run create-org -- \
  --name "My Organization" \
  --email "admin@example.com" \
  --website "https://example.com" \
  --firstName "John" \
  --lastName "Doe" \
  --password "testpassword123"
```

### Parameters

All parameters are required:

- `--name`: Organization name (must be unique)
- `--email`: Admin user email (must be unique)
- `--website`: Organization website URL (must be a valid URL)
- `--firstName`: Admin user's first name
- `--lastName`: Admin user's last name
- `--password`: Admin user's password (minimum 8 characters recommended)

### Output

The script will output:

- Organization ID
- Organization details (name, email, website)
- Admin user ID and details
- **API Key** - This is only shown once! Copy and store it securely.

### Example Output

```
✅ Organization and admin user created successfully!

════════════════════════════════════════════════════════════
Organization Details:
════════════════════════════════════════════════════════════
Organization ID:   abc123xyz
Organization Name: My Organization
Organization Email: admin@example.com
Website URL:       https://example.com

════════════════════════════════════════════════════════════
Admin User Details:
════════════════════════════════════════════════════════════
User ID:           user456def
Name:              John Doe
Email:             admin@example.com
Role:              ADMIN

════════════════════════════════════════════════════════════
🔑 API KEY (STORE THIS SECURELY!)
════════════════════════════════════════════════════════════

New API key generated successfully! Please copy and store it securely.

API Key: ABC123-XYZ789-DEF456-GHI012

⚠️  This API key will not be shown again. Save it now!
════════════════════════════════════════════════════════════
```

### What Gets Created

The script performs the following actions:

1. **Creates an Organization** with the provided details
2. **Generates an API Key** for the organization
3. **Creates Signing Keys** for JWT token verification
4. **Initializes Organization Settings**:
   - Default user type for moderation
   - Default user interface settings
   - Default organization settings
   - Default manual review tool settings
5. **Creates an Admin User** with:
   - Password login method enabled
   - Admin role permissions
   - Approved status

### Notes

- The API key is only displayed once. Make sure to copy and store it securely.
- The organization name and email must be unique in the database.
- The password should be strong and at least 8 characters long.
- All database connections are properly closed after the script completes.

### Troubleshooting

If the script fails:

- Check that your database connection is configured correctly in `.env`
- Verify that the organization name and email don't already exist
- Ensure the website URL is valid (must start with `http://` or `https://`)
- Check the console output for specific error messages

---

## recover-mrt-queue.ts

Re-enqueues items into a Manual Review Tool queue after Redis loss.

Pending MRT job payloads only live in Redis (BullMQ). When a queue is
obliterated — intentionally via the "Delete All Jobs" button, or
unintentionally via a Redis cluster reset / data loss — the items disappear
from the moderator's queue. The list of WHICH items were enqueued is
preserved in Postgres (`manual_review_tool.job_creations`); rebuilt
`reportHistory` is sourced from the data warehouse table
`REPORTING_SERVICE.REPORTS`; item bodies are re-fetched via
`ItemInvestigationService.getItemByIdentifier`, which cascades through
Scylla (`item_submission_by_thread`), the org's Partial Items endpoint,
and the data warehouse (6-month lookback) — using whichever source still
has the item.

### Usage

Get the `--queueId` from the MRT queues dashboard (the "ID" column has a
copy-to-clipboard button next to each id). The mode is auto-detected from
the queue's role in `ncmec_org_settings`, so the same command works for
both default and NCMEC queues:

```bash
# Dry run -- prints what would be re-enqueued, makes no changes
npm run recover-mrt-queue -- \
  --orgId "<orgId>" \
  --queueId "<queueId>"

# Actually re-enqueue
npm run recover-mrt-queue -- \
  --orgId "<orgId>" \
  --queueId "<queueId>" \
  --apply
```

### Parameters

- `--orgId` (required): Organization id whose queue is being recovered.
- `--queueId` (required): MRT queue id to recover into. Must already exist.
- `--mode default|ncmec` (optional): job kind to re-enqueue. Defaults to
  auto-detect: `ncmec` if `--queueId` matches the org's
  `ncmec_org_settings.default_ncmec_queue_id`, else `default`. Pass
  explicitly only to override (rare; only useful for orgs whose routing
  rules send DEFAULT jobs into the NCMEC queue, or vice versa). The
  configuration banner prints both the chosen mode and its source.
- `--since "<ISO timestamp>"` (default: 30 days ago): only consider
  `job_creations` rows after this timestamp.
- `--limit <N>` (default `10000`, max `100000`): cap on number of items.
- `--apply` (default off): actually call enqueue. Without this flag, the
  script is a dry-run and prints the items it would re-enqueue.
- `--no-report-history` (default off): skip rebuilding `reportHistory` from
  the data warehouse (useful if the warehouse is unavailable).

### Safety

- Dry-run by default. `--apply` is required to make any changes.
- Items that already have a decision in
  `manual_review_tool.manual_review_decisions` are filtered out.
- BullMQ dedupes by `(itemTypeId, itemId)` per queue, so re-running the
  script on a partially-recovered queue is safe.
- Per-item enqueue errors are logged and counted but do not abort the run.
- The script validates that `--orgId` and `--queueId` look like opaque ids
  before issuing any DB queries.

### What it does NOT recover

- The original BullMQ `JobId` values are not preserved — recovered jobs
  receive new ids derived from the item identifier.
- Item field data is whatever the cascade above can find. If the item has
  been hard-deleted from Scylla, the org has no Partial Items endpoint,
  and the warehouse 6-month lookback misses, the item is logged as
  skipped and counted in the final summary.
- Report history is best-effort: only inbound `submitReport` rows that made
  it into `REPORTING_SERVICE.REPORTS` are restored. Rule-driven enqueues
  (`ENQUEUE_TO_MRT`) never had a report history to begin with.

---

## seed-trustcon.ts

Seeds a TrustCon TVEC demo into an existing ingestion org. Everything it
creates (policies, banks, rules, queues, actions) is attributed to the
Christchurch Call Foundation (CCF), which authored the template TVEC policy;
Coop only provides the tooling.

### What gets created

1. Resolves the `ATproto-post` / `ATproto-account` item types (must already
   exist from the staging seed migration; the script errors out if
   `ATproto-post` is missing).
2. One Coop policy per CCF TVEC "remove" category (TVEC1..TVEC8), named
   `CCF TVEC: <code> <title>`, with the real CCF policy text as `policyText`.
3. A placeholder keyword bank (`CCF Christchurch keyword dataset
(placeholder)`) with benign stand-in terms. Swap in the real CCF lexicon by
   editing the `KEYWORD_TERMS` array at the top of the script.
4. An empty benign HMA hash bank (`CCF known-content stand-in (benign)`).
   Populate it with harmless images later via the HMA UI.
5. A Zentropi CoPE-B classifier rule (assumes the org's Zentropi credential is
   already configured; no API key is set).
6. Two manual review queues: `CCF TVEC standard review` and
   `CCF TVEC priority review`.
7. Three LIVE content rules (hash-match, keyword-match, classifier), each
   linked to a relevant CCF policy and enqueuing to MRT.
8. Two `CUSTOM_ACTION` webhook actions (`Emit Bleep label (CCF demo)` /
   `Emit Bloop label (CCF demo)`) that POST to `<relay-url>/label`.
9. A default routing rule sending `ATproto-post` items to the standard queue.

The script is idempotent by name: re-running it skips entities that already
exist.

### Usage

From the `server` directory:

```bash
npm run seed-trustcon -- \
  --org-id "<orgId>" \
  --relay-url "http://localhost:8090"
```

### Parameters

- `--org-id` (required): ingestion org to seed into.
- `--relay-url` (required): base URL of the Ozone label relay; the webhook
  actions POST to `<relay-url>/label`.
- `--user-id` (optional): admin user id to attribute config to. Defaults to the
  first `ADMIN` user in the org.
- `--zentropi-labeler-version-id` (optional): Zentropi CoPE-B labeler version id
  to wire into the classifier rule's subcategory. Without it the classifier rule
  is created but has no published labeler to evaluate against.

### Notes

- Requires the staging DB seed to have run first (creates the ATproto item
  types).
- The keyword bank ships with obvious placeholder terms; replace them with the
  real CCF dataset before using the demo for anything real.
