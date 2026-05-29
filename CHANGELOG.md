# Changelog

## Coop 1.0 (unreleased)

As our first major release, Coop 1.0 is ready for self-hosted deployment by platforms of all sizes.

Coop v0 was our initial open source release, while v0.1 focused on strengthening the foundation with better integrations, improved stability, and feature additions driven by early feedback. Since then, we've been focused on three major areas for Coop 1.0:

- **Deployability** for self-hosters including both significant simplification and completely rewritten documentation to make it faster, easier, and lighter-weight to get up and running with Coop

- **Expanded features & capability** in response to adopters' production usage, including review console features and child safety reporting

- **Reliability & sustainability** including several fixes, improvements, and security hardening to ensure Coop is production-ready and well-positioned as a critical open source project

> [!NOTE]
> _Italicized items_ are open issues assigned to the 1.0 milestone that have not yet been merged.

### Deployability

We focused a _ton_ of time and effort on making Coop simpler and easier to get running.

#### Code & infrastructure simplification

The largest internal change in Coop 1.0 is the near-complete migration from Sequelize to Kysely for database access, covering the rule engine, actions, policies, users, organizations, MRT, and backtests. On the infrastructure side, BullMQ replaces Kafka for item submission processing—removing one of the most operationally demanding dependencies from the default deployment. We also cleared out SaaS-era scaffolding that was never meant for self-hosted deployments: proprietary branding, hardcoded infrastructure URLs, the old cloud deployment reference, and the SaaS-only AI risk model.

- Completed Sequelize→Kysely migration across rule engine, actions, policies, users, organizations, MRT, and backtests (#225, #260, #261, #271, #275, #290, #292, #349, #350, #354, #390)
- BullMQ replaces Kafka for item submission processing (#137)
- Express upgraded to v5 (#283)
- SSL/TLS and body schema validation added (#326)
- Stripped Cove marketing and tracking from the client (#509)
- Removed hardcoded SaaS host URLs; replaced with relative or configurable equivalents (#527)
- Removed legacy SaaS AI risk model (#293)
- Removed legacy cloud infrastructure reference (`.devops`); moved migrations to `db/` (#141)
- Removed unused Content Proxy reference (#176)
- Dropped unmaintained `graphql-passport` dependency (#462)
- Client now always uses a relative GraphQL URL (#455)
- Moved NCMEC routing from hardcoded values to environment config (#474)
- Renamed published package to `@roostorg/coop-types` (#602)
- Refactored `package.json` dependencies across packages (#549)
- Added `create-org` script for provisioning new organizations from the command line (#537)
- _Scylla made optional for deployments that don't need it (#190)_
- _Simplified getting-started experience for new evaluators (#219)_
- _Docker images published for deployment without building from source (#280)_

#### Rewritten documentation

Before Coop 1.0, our documentation was a combination of SaaS-oriented docs that we'd acquired, technical architecture notes from our assessment of the original codebase, and several attempts to expand the level of detail. While it served its purpose of getting the project off the ground, we spent a significant amount of time completely reworking the documentation. The new structure more clearly separates the docs into four distinct sections, better separating concerns:

- User guide
- Development guide
- API reference
- Integrations

We also implemented versioning for the docs meaning the latest docs for the `main` branch will always live at [roostorg.github.io/coop/latest](https://roostorg.github.io/coop/latest), while docs for version 1.0 will live at [roostorg.github.io/coop/1.0](https://roostorg.github.io/coop/1.0).

- Complete documentation rework for Coop 1.0 (#338)
- Versioned mdbook on GitHub Pages; latest docs always at `roostorg.github.io/coop/latest` (#417)
- Added Partial Items API reference (#523)
- Added deployment guide with database settings reference (#627)
- Added cost and requirements guide for third-party integrations (#595)
- Split NCMEC docs into separate user and integration guides (#526)
- Added model card for Zentropi integration (#200)
- Corrected API key scoping in architecture doc (#594)
- Updated minimum memory requirements for deployment (#371)
- Corrected links in user README (#515)
- Updated styling of "Coop" in integration docs (#147)
- Added heading to Appeals docs (#149)
- Corrected NCMEC docs link (#169)
- Removed redundant NCMEC docs (#172)
- Applied Funnel Display and Funnel Sans to docs site (#525)
- Corrected site URL in docs (#510)
- Added explicit link to GitHub repo and README in docs (#511)
- _Deployment and hosting guide (#207)_
- _Intention statement (#287)_
- _Document user strikes feature (#503)_
- _Clarify SSO docs to reflect support for any SAML provider, not just Okta (#587)_
- _Model card documentation for OpenAI Moderation API (#126)_
- _Model card documentation for Google Content Safety API (#127)_
- _Document known Coop adopters (#54)_

#### Admin settings

As a SaaS product, several features for organizations were hidden behind database-only toggles. To make it easier to customize Coop for your platform and deployment, we've moved these settings directly into the Coop front-end for administrators.

- Renamed "Employee Safety" to "Wellness" throughout settings UI (#394)
- _Appeals enable/disable toggle (#620)_
- _SAML/SSO enabled toggle, with validation that `sso_url` and `cert` are set (#623)_
- _User strike TTL configuration (#622)_
- _Require decision reason for moderator actions (#618)_
- _Require policy selection when making decisions (#619)_
- _Skip button visibility toggle for non-admin reviewers (#624)_
- _Preview jobs mode toggle (#625)_
- _Multiple policies per action toggle (#532)_
- _Partial Items API endpoint and custom request headers (#378)_
- _Ignore callback URL (#626)_
- _Granular per-permission model replacing built-in roles (#406)_
- _GDPR delete requests now execute rather than only persisting (#336)_

### Expanded features & capability

We were extremely fortunate to have multiple platforms adopt Coop during the 1.0 development cycle; this meant we had real-world users sharing invaluable feedback. As a result, Coop 1.0 is now a better product—not just for these adopters, but for everyone.

#### Review console features

- Added parameterized actions that accept runtime values when executing (#400)
- Thread-kind items now surface in user submission history (#284)
- Recent actions list refreshes automatically after submitting an action (#285)
- Investigation tool now surfaces users even when no submitted item is available (#444)
- Report information now shown on other reports table (#475)
- Comments from deleted users are now visible on manual review jobs (#407)
- Point of Interest (Google Maps) gracefully disabled when no API key is configured (#584)
- Added horizontal scrollbar and increased max width for wide tables (#162)
- Changed permission required to view policies in sidebar (#405)
- Fixed hidden inputs in proactive rule form (#368)
- Fixed Submit button being cut off when content overflows in MRT and Investigation (#463)
- Fixed CoopButton links not respecting disabled state (#472)
- _User Strikes UI under Automatic Enforcement (#597)_
- _Remove deprecated User Score in favor of User Strikes (#156, #596)_
- _Queue custom prioritization (#409)_
- _Invalidate reports from a specific user to address spam reporting (#404)_

#### Platform needs

- OpenAI image moderation support via `omni-moderation-latest` (#534)
- IP address schema field role added for tagging items with source IP data (#559, #583)
- MEDIA content type added end-to-end through server and Review Console (#605, #606, #632)

#### Child safety improvements

- Built-in NCMEC enqueue actions now available to all orgs, not just managed deployments (#393)
- Added `additionalInfo` field to NCMEC reports; fixed XML element ordering and Node 24 multipart submission (#477)
- Fixed NCMEC wellness permission check (#505)
- Reviewer-friendly error messages now surface `last_error` for NCMEC jobs (#513)
- _IP address automatically added to NCMEC reports (#592)_

### Reliability & sustainability

As a critical open source project that empowers platforms to keep their users safe, it's crucial that Coop is reliable, sustainable, and secure. We focused on ensuring Coop 1.0 met these goals and will continue to meet them going forward.

#### Fixes

- Postgres idle-client errors no longer crash the server process (#542)
- ClickHouse outages no longer crash all dashboard pages (#151)
- Server crashes on transient ClickHouse errors resolved; Scylla memory capped to prevent OOM (#412)
- Scylla connection failures stopped; connection errors now surfaced visibly (#395)
- Unbounded queries in review queues fixed (#160)
- GraphQL depth-limit crashes and related MRT/insights issues resolved (#401)
- MRT crash when `partialItems` returns an empty array fixed (#645)
- Partial item rejects of extra top-level items fixed (#601)
- Job fragment circular dependency resolved (#372)
- Dashboard routes lazy-loaded to prevent cascading failures (#334)
- Apollo retry behavior and org metadata cache improved (#184)
- `createOrg` FK ordering and built-in action seeding fixed (#604)
- MRT backfill job added (#347)
- Demo request emails can now be disabled via env var (#352)
- Coop SVG export fixed (#346)
- Sidebar flickering and space shifting when navigating from settings to dashboard fixed (#140)
- Jaeger URL now opens correctly cross-platform (#367)
- Env example updated with missing PostgreSQL variables (#413)
- `create-org` command fixed and README updated (#328)

#### Security & dependencies

<list of related PRs>

#### Other improvements

<list of related PRs>

---

## Coop v0.1

We're excited to share Coop v0.1! This release is all about strengthening the foundation: better integrations, improved stability, and a handful of meaningful feature additions driven by early community feedback.

### What's new

- Coop now supports Zentropi as a signal source, expanding the range of classifiers you can plug into your review workflows
- You can now use Amazon SES as an email backend option, giving teams more flexibility in how they handle notifications
- Several quality-of-life improvements to the NCMEC reporting flow, including matched bank info on the NCMEC view, additional field fixes, and a default NCMEC queue to simplify setup
- Users can now rotate signing keys directly, an important step toward stronger operational security
- The investigation workflow's action flow has been meaningfully improved and better documented
- We've laid the scaffolding for a config-based integrations plugin system, including types, a registry, and a logo API. This should make it easier to build and ship signal integrations going forward!

### Under the hood

- Upgraded BullMQ to latest and bumped several deprecated packages
- Locked Node to v24.14.0 for consistency across development environments
- Updated cookies to follow XSS and CSRF best practices
- Fixed a Kafka connect error that could cause unhandled promise rejections to crash the process
- Resolved Recharts division-by-zero errors and improved error boundary coverage
- Updated port from 5000 to 9876 to avoid conflicts with macOS Monterey and later
- Removed react-google-charts in favor of lighter alternatives, with accompanying UI fixes
- Fixed code scanning alerts surfaced by GitHub
- Various CI improvements and dependency cleanup

### Get involved

We're building Coop in the open and this release reflects the fixes, features, and improvements that came directly from people digging in and contributing. Whether you're running Coop in a test environment, hitting a rough edge, or have ideas you want to explore, please [open an issue](https://github.com/roostorg/coop/issues/new) or [join our Discord](https://discord.gg/5Csqnw2FSQ). Your feedback directly [shapes our roadmap](https://github.com/roostorg/community/blob/main/roadmap.md).

### Thank you!

A huge thank you to everyone who contributed to this release, and a special welcome to our five new contributors making their first contributions to Coop: @serendipty01, @samidh, @calebmcquaid, and @mac-df alongside returning contributors @juanmrad, @julietshen, @pawiecz, and @vinaysrao1. This release is a testament to what an open, collaborative community can build together. Thank you all. 🎉

**Full Changelog**: https://github.com/roostorg/coop/compare/0.0...0.1

---

## Coop v0

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

### Get Involved

We're developing Coop in the open and want to hear from you. Whether you're testing it out, running into issues, or have ideas for improvements, please [open an issue](https://github.com/roostorg/coop/issues/new/choose) or [join our Discord](https://discord.gg/5Csqnw2FSQ). Your feedback directly shapes our [roadmap](https://roostorg.github.io/community/roadmap.html).

### Thank You

This release was possible because of the efforts of contributors who worked through complex redesign, partners who believed in the vision of open source safety tools, and the broader trust and safety community who provided feedback and guidance. Thank you especially to @juanmrad, @pawiecz, @kbicevski, Sjoerd Simons, @emanueleaina, @dom-notion, @cassidyjames, @vinaysrao1, @wayjaywang, and @julietshen.
