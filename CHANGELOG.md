# main (unreleased)

## Security

> [!NOTE]
> For security announcements, we encourage adopters to subscribe to the [security-announce@roost.tools mailing list](https://groups.google.com/a/roost.tools/g/security-announce).

- Routine dependency package upgrades to address vulnerabilities
- See [Security and quality](https://github.com/roostorg/community/security) for published security advisories

## NCMEC

- Added `email` as a supported schema field role for user items, ensuring inclusion and validation for NCMEC reports (#840, #842)
- `EMAIL_ADDRESS` added as a first-class scalar in `@roostorg/coop-types` (v2.4.0) (#841)
- Auto-populate `originalFileName` (from the media URL) and `fileRelevance` (defaults to `Reported`) for NCMEC reports (#855). The same PR also wires `priorCTReports` end-to-end, but the field does not populate in production yet because an earlier duplicate-submission check stops the report before the lookup runs; resolving that check is tracked as a follow-up.
- Fixed `fileDetails.ipCaptureEvent` XSD element ordering: `ipCaptureEvent` was emitted after `industryClassification`, which NCMEC's validator rejected (`cvc-complex-type.2.4.a`). Affected any adopter who had the IP-address schema field role configured on a Content item type. Latent since the `/fileinfo` submission path was first written; activated by #641 (#856).

## Review Console

- Added User Strikes count to job and item investigation views (#766)
- Added decision reasons to recent decisions view and CSV exports (#772)
- Split "require decision reason" into separate action and ignore settings (#780)
- Fixed duplicate entries in recent decisions (#774)
- Empty threads are no longer hidden (#804)
- Improved Review Console dashboard display by ellipsizing long queue IDs (#849)
- Improved moderator textarea placeholder for clarity (#711)
- Fixed content URL rendering in the review iframe when no content proxy is configured (#777)

## Actions

- Parameterized actions now work with proactive rules and user strikes (#792)
- New per-queue "clear other reports for a user" sweep action; sweep now also handles related items (#817, #835)
- Added `creator` field to action webhook callbacks (#755)

## Investigations

- Added IP address lookup to investigation view (#754)

## Other fixes

- Added client-side email validation for invites (#786)
- Express session store now properly closed on API shutdown (#825)

## CI & infrastructure

- Server integration tests now run in CI (#827); basic Playwright E2E test suite added (#823)
- Server tests isolated via transaction rollback (#732)
- TypeScript type-checking added for `db` and `migrator` in CI (#782)
- Prettier enforced globally in CI (#834)
- GitHub Actions updated to Node 24 runtime (#795)
- `zizmor` added to lint CI workflows for security issues (#721)
- Knip added across all packages to remove unused dependencies (#734, #760, #761, #762)
- Redis user/password now correctly set in no-cluster mode (#747)

## New contributors

- @reitblatt made their first contribution in https://github.com/roostorg/coop/pull/785
- @jess-upscrolled made their first contribution in https://github.com/roostorg/coop/pull/804
- @ltianyi992 made their first contribution in https://github.com/roostorg/coop/pull/711

**Full Changelog**: https://github.com/roostorg/coop/compare/1.0.1...main

# Coop 1.0.1

## Review Console

- Incomplete User Score removed from UI in favor of User Strikes (#726)
- Related items now show the item's name rather than its raw ID; duplicate entries removed (#730)

## NCMEC

- Minimum image count required before submitting an NCMEC report is now configurable (#710)
- Policy selection and decision-reason requirements are skipped for NCMEC jobs, which don't meaningfully apply (#737, closes #736)

## Integrations

- OpenAI integration correctly labeled as "OpenAI Moderation API" with a link to the model card in the UI (#742, #739)

## Documentation

- Administration guide expanded to cover newly-added organization settings
- User Strikes docs added
- Role Management section added to the administration guide, covering configurable roles and permissions

## Removals

- GDPR delete endpoint, database table, and related documentation removed; the endpoint was reconsidered and dropped rather than implemented (#728, closes #336)

## CI & infrastructure

- Docker image release workflow fixed; manual trigger for releases added (#741)
- AGENTS.md added to `.github/` for AI coding assistants (#731)
- Only run License Check when we should check licenses (#745)

**Full Changelog**: https://github.com/roostorg/coop/compare/1.0...1.0.1

# Coop 1.0

We're thrilled to share Coop 1.0! This is our first major release and the one we've been building toward since Coop went open source: ready for self-hosted deployment by platforms of all sizes. Since v0.1, we've focused on three major areas:

- **Making it easier to get started** for developers, contributors, and self-hosters including both significant simplification and completely rewritten documentation

- **Expanded features & capability** in response to adopters' production usage, including review console features and child safety reporting

- **Reliability & sustainability** including several fixes, improvements, and security hardening to ensure Coop is production-ready and well-positioned as a critical open source project

## Making it easier to get started

We focused a _ton_ of time and effort on making it faster, easier, and lighter-weight to get up and running with Coop.

### Simplification & modernization

Coop 1.0 is dramatically simpler to deploy than earlier versions. We now build and publish Docker images for easier testing and deployment. We migrated from Sequelize to Kysely, making Coop lighter-weight and easier to keep secure with fewer dependencies. We replaced Kafka with BullMQ for item submission processing, removing one of the most operationally demanding deployment dependencies. And we cleaned up a significant amount of SaaS-era code that was never meant for self-hosted deployments, including legacy client marketing and tracking assets, Snowflake, the legacy risk AI model, and other unmaintained remnants.

On the modernization front, we upgraded to Apollo v5, Express 5, and migrated the client build from Create React App to Vite.

### Rewritten documentation

Before Coop 1.0, our documentation was a mix of SaaS-oriented content, early architectural notes, and several incomplete attempts to expand coverage. We spent significant time completely reworking it. The README is simpler to skim, and the new docs site structure separates content into four distinct sections: user guide, development and deployment, API reference, and integrations. We also implemented versioning, so docs for `main` will always live at [roostorg.github.io/coop/latest](https://roostorg.github.io/coop/latest) and docs for this release at [roostorg.github.io/coop/1.0](https://roostorg.github.io/coop/1.0.0).

### Admin settings

We built out a new granular capability-based permissions system that makes it easier to customize what roles and permissions are available for your team. As a SaaS product, several features for organizations were also hidden behind database-only toggles; to make it easier to customize Coop for your platform and deployment, we've moved these settings directly into the Coop front-end for administrators.

## Expanded features & capability

We were extremely fortunate to have multiple platforms adopt Coop during the 1.0 development cycle; this meant we had real-world users sharing invaluable feedback. As a result, Coop 1.0 is now a better product—not just for these adopters, but for everyone. We shipped several significant capabilities as a result:

### Review & moderation improvements

- User Strikes are now enabled, giving platforms a native way to track and act on repeat violations directly within Coop
- Parameterized actions let moderators pass runtime values when making decisions, making enforcement workflows significantly more flexible
- "Invalidate reports from a reporter" action is now available in the manual review tool, useful for addressing spam reporting
- The investigation tool now surfaces users even when no submitted item is available
- Comments from deleted users are now visible on manual review jobs
- Policy selection and decision reason requirements are now enforced server-side, closing a gap where those constraints were UI-only
- Recent actions list refreshes automatically after submitting an action
- Point of Interest (Google Maps) is gracefully disabled when no API key is configured

### Additional platform needs

- Coop now supports OpenAI's omni-moderation-latest model as an image moderation signal source
- HMA exchanges can now be configured directly from the Coop UI, removing the need to manage that setup separately
- IP address is now a first-class schema field role for tagging items with source IP data
- A new MEDIA content type is supported end to end, from submission through the review console
- A `create-org` script is now available for provisioning new organizations from the command line

### Child safety improvements

- Built-in NCMEC enqueue actions are now available to all orgs
- NCMEC and Review Console enqueue actions now work for users with no prior submission record
- Added `additionalInfo` to NCMEC reports and fixed XML element ordering
- Failed NCMEC submissions now persist and surface with a retry option in the Reports dashboard
- IP address is now automatically added to NCMEC reports when present
- NCMEC report routing moved from hardcoded values to environment config
- Reviewer-friendly error messages now surface for failed NCMEC jobs

## Reliability & sustainability

As a critical open source project that empowers platforms to keep their users safe, it's crucial that Coop is reliable, sustainable, and secure. We focused on ensuring Coop 1.0 meets these goals and will continue to meet them going forward.

### Fixes

- Postgres idle-client errors crashes are fixed
- ClickHouse outages no longer crash dashboard pages
- Fixed server crashes from transient ClickHouse errors and capped Scylla memory to prevent OOM
- Review queues can support large bursts of job creation when backfilling or populating queues
- GraphQL depth limit set and depth-limit crashes resolved
- Server now fails fast on Redis outage during async item submission rather than hanging
- Dashboard routes lazy-loaded to prevent cascading failures
- Fixed the Submit button being cut off when content overflows in MRT and investigation views
- Fixed CoopButton links not respecting disabled state

### Security & dependencies

When we first released Coop's source code, there was a significant amount of dependency debt to address. Coop 1.0 resolves every known critical and high severity alert through a combination of dependency removal and version updates across the entire project. We also hardened our supply chain practices: GitHub Actions are now SHA-pinned with `--ignore-scripts`, and the Busybox Docker image is pinned by digest to prevent silent substitution. We added automated license scanning to CI to enforce compatibility with Coop's Apache-2.0 license.

### Other improvements

- End-to-end integration tests added for item submission, report flow, and rule changes
- CI checks moved into Docker Compose services for consistency with local development
- Husky pre-commit hooks wired up with lint-staged
- `AGENTS.md` added with Coop-specific guidance for AI coding assistants
- Issue forms added to guide bug reports and feature requests

## Get involved

We're building Coop in the open and this release reflects the work of an incredibly active community of contributors, adopters, and testers. Whether you're deploying Coop, hitting a rough edge, or have ideas to explore, please [open an issue](https://github.com/roostorg/coop/issues/new) or [join our Discord](https://discord.gg/5Csqnw2FSQ). Your feedback directly [shapes our roadmap](https://github.com/roostorg/community/blob/main/roadmap.md).

## Thank you!

A huge thank you to everyone who contributed to this release, and a special welcome to our nine new contributors making their first contributions to Coop: [@TomHawk123](https://github.com/TomHawk123), [@dom-notion](https://github.com/dom-notion), [@vinaysrao1](https://github.com/vinaysrao1), [@samuelralak](https://github.com/samuelralak), [@ThatKoffe](https://github.com/ThatKoffe), [@haileyok](https://github.com/haileyok), [@davidyshin](https://github.com/davidyshin), [@ded-furby](https://github.com/ded-furby), and [@JagadeeshChandra12](https://github.com/JagadeeshChandra12), alongside returning contributors [@juanmrad](https://github.com/juanmrad), [@julietshen](https://github.com/julietshen), [@pawiecz](https://github.com/pawiecz), [@cassidyjames](https://github.com/cassidyjames), [serendipty01](https://github.com/serendipty01), [@wayjaywang ](https://github.com/wayjaywang), and [@calebmcquaid](https://github.com/calebmcquaid). This release is a testament to what an open, collaborative community can build together. Thank you all. 🎉

**Full Changelog**: [0.1...1.0.0](https://github.com/roostorg/coop/compare/0.1...1.0.0)

---

# Coop v0.1

We're excited to share Coop v0.1! This release is all about strengthening the foundation: better integrations, improved stability, and a handful of meaningful feature additions driven by early community feedback.

## What's new

- Coop now supports Zentropi as a signal source, expanding the range of classifiers you can plug into your review workflows
- You can now use Amazon SES as an email backend option, giving teams more flexibility in how they handle notifications
- Several quality-of-life improvements to the NCMEC reporting flow, including matched bank info on the NCMEC view, additional field fixes, and a default NCMEC queue to simplify setup
- Users can now rotate signing keys directly, an important step toward stronger operational security
- The investigation workflow's action flow has been meaningfully improved and better documented
- We've laid the scaffolding for a config-based integrations plugin system, including types, a registry, and a logo API. This should make it easier to build and ship signal integrations going forward!

## Under the hood

- Upgraded BullMQ to latest and bumped several deprecated packages
- Locked Node to v24.14.0 for consistency across development environments
- Updated cookies to follow XSS and CSRF best practices
- Fixed a Kafka connect error that could cause unhandled promise rejections to crash the process
- Resolved Recharts division-by-zero errors and improved error boundary coverage
- Updated port from 5000 to 9876 to avoid conflicts with macOS Monterey and later
- Removed react-google-charts in favor of lighter alternatives, with accompanying UI fixes
- Fixed code scanning alerts surfaced by GitHub
- Various CI improvements and dependency cleanup

## Get involved

We're building Coop in the open and this release reflects the fixes, features, and improvements that came directly from people digging in and contributing. Whether you're running Coop in a test environment, hitting a rough edge, or have ideas you want to explore, please [open an issue](https://github.com/roostorg/coop/issues/new) or [join our Discord](https://discord.gg/5Csqnw2FSQ). Your feedback directly [shapes our roadmap](https://github.com/roostorg/community/blob/main/roadmap.md).

## Thank you!

A huge thank you to everyone who contributed to this release, and a special welcome to our five new contributors making their first contributions to Coop: @serendipty01, @samidh, @calebmcquaid, and @mac-df alongside returning contributors @juanmrad, @julietshen, @pawiecz, and @vinaysrao1. This release is a testament to what an open, collaborative community can build together. Thank you all. 🎉

**Full Changelog**: https://github.com/roostorg/coop/compare/0.0...0.1

---

# Coop v0

We’re thrilled to announce the initial release of Coop! This v0 release includes core review capabilities alongside specialized child safety workflow functionality:

- Context-rich review console for content flagged by ML models, user reports, or detection rules
- Flexible signal abstraction for integrating classifiers
- Queue routing and orchestration based on signals, priority, and policy
- Reviewer wellness capabilities built-in (per organization/individual)
- Automated and manual enforcement workflows with complete audit trails
- Appeals handling with dedicated review workflows
- Compatible with OSS storage (Postgres, Scylla 5.2, Clickhouse) but other storage can be plugged in
- Insightful dashboards for tracking performance and feedback to improve rules and policies
- HMA integration for hash matching (CSAM, TVEC, NCII, internal hash banks, etc.)
- Comprehensive child safety tools for known CSAM, novel CSAM detection, and reporting

As an early v0 release, we've focused on getting core review capabilities and child safety workflows into a usable state—but there's still active development ahead. You can expect features and documentation that will evolve based on community feedback.

For more information about Coop, check out our [announcement blog post](https://roost.tools/blog/meet-coop-v-0/).

## Get Involved

We're developing Coop in the open and want to hear from you. Whether you're testing it out, running into issues, or have ideas for improvements, please [open an issue](https://github.com/roostorg/coop/issues/new/choose) or [join our Discord](https://discord.gg/5Csqnw2FSQ). Your feedback directly shapes our [roadmap](https://roostorg.github.io/community/roadmap.html).

## Thank You

This release was possible because of the efforts of contributors who worked through complex redesign, partners who believed in the vision of open source safety tools, and the broader trust and safety community who provided feedback and guidance. Thank you especially to @juanmrad, @pawiecz, @kbicevski, Sjoerd Simons, @emanueleaina, @dom-notion, @cassidyjames, @vinaysrao1, @wayjaywang, and @julietshen.
