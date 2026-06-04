# Changelog

## Coop 1.0 (unreleased)

As our first major release, Coop 1.0 is ready for self-hosted deployment by platforms of all sizes.

Coop v0 was our initial open source release, while v0.1 focused on strengthening the foundation with better integrations, improved stability, and feature additions driven by early feedback. Since then, we've been focused on three major areas for Coop 1.0:

- **Making it easier to get started** for developers, contributors, and self-hosters including both significant simplification and completely rewritten documentation

- **Expanded features & capability** in response to adopters' production usage, including review console features and child safety reporting

- **Reliability & sustainability** including several fixes, improvements, and security hardening to ensure Coop is production-ready and well-positioned as a critical open source project

> [!NOTE]
> _Italicized items_ are open issues assigned to the 1.0 milestone that have not yet been merged.

### Making it easier to get started

We focused a _ton_ of time and effort on making it faster, easier, and lighter-weight to get up and running with Coop.

#### Simplification & modernization

With Coop 1.0, we now build and publish Docker images for easier testing and deployment. We also migrated from Sequelize to Kysely, making Coop lighter-weight, simpler to run, and easier to keep secure with fewer dependencies. Similarly, we replaced Kafka with BullMQ and the existing Redis instance for item submission processing—further simplifying deployment by removing one of the most operationally demanding dependencies. We also cleaned up SaaS-era remnants that were never meant for self-hosted deployments.

- Sequelize → Kysely migration (#225, #260, #261, #271, #275, #290, #292, #349, #350, #354, #390)
- Kafka → BullMQ for item submission processing (#137)
- Docker images published for deployment (#665)
- Added `create-org` script for provisioning new organizations from the command line (#537)
- Express upgraded to v5 (#283)
- Migrated to Apollo v5 (#67, #119)
- Client now always uses a relative GraphQL URL (#455)
- SSL/TLS and body schema validation added (#326)
- Moved NCMEC routing from hardcoded values to environment config (#474)
- Stripped Cove marketing and tracking from the client (#509)
- Removed hardcoded SaaS host URLs; replaced with relative or configurable equivalents (#527)
- Removed legacy SaaS AI risk model (#293)
- Removed legacy cloud infrastructure reference (`.devops`); moved migrations to `db/` (#141)
- Removed Snowflake from codebase (#133)
- Removed unused Content Proxy reference (#176)
- Dropped unmaintained `graphql-passport` dependency (#462)
- Renamed published package to `@roostorg/coop-types` (#602)
- Refactored `package.json` dependencies across packages (#549)
- _Scylla made optional for deployments that don't need it (#190)_
- _Simplified getting-started experience for new evaluators (#219)_

#### Rewritten documentation

Before Coop 1.0, our documentation was a combination of SaaS-oriented docs that we'd acquired, technical architecture notes from our assessment of the original codebase, and several attempts to expand the level of detail. While it served its purpose of getting the project off the ground, we spent a significant amount of time completely reworking, validating, and expanding the project documentation. The README is simpler to skim and understand, while the new docs site structure more clearly separates the docs into four distinct sections to better separate concerns:

- User guide
- Development & deployment
- API reference
- Integrations

The documentation rewrite better aligns on consistent terminology, links between sections instead of duplicating information, and makes it much, much easier to both get started with and dive deep into Coop. We also implemented versioning for the docs meaning the latest docs for the `main` branch will always live at [roostorg.github.io/coop/latest](https://roostorg.github.io/coop/latest), while docs for version 1.0 will live at [roostorg.github.io/coop/1.0](https://roostorg.github.io/coop/1.0).

- Complete documentation rework for Coop 1.0 (#338)
- Added deployment guide (#627, #675)
- Versioned docs site (#417)
- Added model card for Zentropi integration (#200)
- Improved NCMEC docs (#169, #172, #526)
- Added cost and requirements for third-party integrations (#595)
- Added Partial Items API reference (#501, #523)
- Added intention statement to README (#287, #680)
- Added known Coop adopters to README (#54, #693)
- Improved SAML/SSO documentation (#587, #693)
- Corrected API key scoping in architecture doc (#594)
- Updated minimum memory requirements for deployment (#371)
- Improved docs site typography (#525)
- Various docs fixes (#147, #149, #510, #511, #515)
- _Model card for OpenAI Moderation API (#126)_
- _Model card for Google Content Safety API (#127)_
- _Deployment and hosting guide (#207)_
- _Document user strikes feature (#503)_

#### Admin settings

For Coop 1.0, we built out a new granular capability-based permissions system that makes it easier to customize what roles and permissions are available for your team. As a SaaS product, several features for organizations were also hidden behind database-only toggles; to make it easier to customize Coop for your platform and deployment, we've moved these settings directly into the Coop front-end for administrators.

- Granular capability-based permissions (#528, #560, #582)
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
- _GDPR delete requests execute rather than only persisting (#336)_

### Expanded features & capability

We were extremely fortunate to have multiple platforms adopt Coop during the 1.0 development cycle; this meant we had real-world users sharing invaluable feedback. As a result, Coop 1.0 is now a better product—not just for these adopters, but for everyone.

#### Review & moderation improvements

Most moderators spend the majority of their time in the review console, working review jobs and making decisions. We focused on improving this experience and adding new capabilities based on adopter feedback; for example, we added parameterized actions to accept extra information when a moderator makes a decision. We completed work on user strikes, enabling platforms to handle them directly within Coop. And we made several fixes and improvements to the UI thanks to issue reports from testers and adopters.

- Added parameterized actions that accept runtime values when executing (#400, #408)
- Thread-kind items now surface in user submission history (#284)
- Recent actions list refreshes automatically after submitting an action (#285)
- Investigation tool now surfaces users even when no submitted item is available (#444)
- Report information now shown on other reports table (#475)
- Comments from deleted users are now visible on manual review jobs (#407)
- Gracefully disabled Point of Interest (Google Maps) when no API key is configured (#584)
- Added horizontal scrollbar and increased max width for wide tables (#162)
- Changed permission required to view policies in sidebar (#405)
- Fixed hidden inputs in proactive rule form (#368)
- Fixed Submit button being cut off when content overflows (#463)
- Fixed CoopButton links not respecting disabled state (#472)
- User Strikes dashboard and UI (#597, #600)
- Server-side enforcement of policy selection requirement (#533)
- Fixed MEDIA fields rendering as links instead of images in manual review (#679)
- _Remove deprecated User Score in favor of User Strikes (#156, #596)_
- _Queue custom prioritization (#409)_
- _Invalidate reports from a specific user to address spam reporting (#404)_

#### Additional platform needs

- OpenAI image moderation support via `omni-moderation-latest` (#534)
- HMA exchanges can now be configured directly from Coop (#115)
- IP address schema field role added for tagging items with source IP data (#559, #583)
- MEDIA content type added end-to-end through server and Review Console (#605, #606, #632)

#### Child safety improvements

- Ensured built-in NCMEC enqueue actions are available to all orgs (#393)
- NCMEC and Review Console enqueue actions now work for users with no prior submission record (#494)
- Added `additionalInfo` field to NCMEC reports and fixed XML element ordering (#477)
- Fixed NCMEC wellness permission check (#505)
- Failed NCMEC submissions persisted and surfaced with retry in the Reports dashboard (#491, #492)
- Reviewer-friendly error messages for NCMEC jobs (#513)
- IP address automatically added to NCMEC reports (#592, #641)
- Fixed NCMEC Review Console gallery display for MEDIA scalar fields (#694)

### Reliability & sustainability

As a critical open source project that empowers platforms to keep their users safe, it's crucial that Coop is reliable, sustainable, and secure. We focused on ensuring Coop 1.0 meets these goals and will continue to meet them going forward.

#### Fixes

- Postgres idle-client errors no longer crash the server process (#542)
- ClickHouse outages no longer crash all dashboard pages (#151)
- Fixed server crashes from transient ClickHouse errors; capped Scylla memory prevent OOM (#412)
- Scylla connection failures stopped; connection errors now surfaced visibly (#395)
- Unbounded queries in review queues fixed (#160)
- GraphQL depth limit set and depth-limit crashes resolved (#109, #401)
- Review Console crash when `partialItems` returns an empty array fixed (#645)
- Server now fails fast on Redis outage during async item submission rather than hanging (#653)
- Partial item rejects of extra top-level items fixed (#601)
- Job fragment circular dependency resolved (#372)
- Dashboard routes lazy-loaded to prevent cascading failures (#334)
- Apollo retry behavior and org metadata cache improved (#184)
- `createOrg` FK ordering and built-in action seeding fixed (#604)
- Review Console backfill job added (#347)
- Demo request emails can now be disabled via env var (#352)
- Coop SVG export fixed (#346)
- Sidebar flickering and space shifting when navigating from settings to dashboard fixed (#140)
- Jaeger URL now opens correctly cross-platform (#367)
- Env example updated with missing PostgreSQL variables (#413)
- `create-org` command fixed and README updated (#328)

#### Security & dependencies

When we first released Coop's source code, we knew there was a lot of work to be done around dependencies and security. In addition to code simplification (which also removed a substantial number of dependencies), we've ensured that Coop 1.0 addresses every known critical and high severity alert by removing unnecessary dependencies and updating to newer and patched dependency versions across the entire project. We also hardened our security practices, including by pinning Docker images and GitHub Actions to prevent certain classes of substitution attacks. Finally, we performed an audit of dependency licenses to ensure compatibility with Coop's Apache-2.0 license, and set up automated license scanning to enforce this in CI.

- Automated license scanning added to CI (#611, #692)
- Sequelize and undici patched for high-severity vulnerabilities (#138)
- Axios updated to mitigate supply chain risk (#170)
- AWS SDK upgraded to fix fast-xml-parser vulnerabilities (#154)
- lodash and jsonpath vulnerabilities fixed; lodash removed in favor of `plugin-functional` (#186, #216)
- `@xmldom/xmldom` security update applied (#295)
- `ajv` vulnerability patched (#229, #276)
- `ws`, `protobufjs`, UUID, postcss, and other dependency vulnerabilities patched (#177, #262, #263, #264, #322, #449, #459, #514)
- Helmet upgraded from v4 to v8 (#289)
- Busybox Docker image pinned by digest to prevent silent image substitution (#311)
- GitHub Actions SHA-pinned; `--ignore-scripts` added to npm CI installs (#439)
- Various security-motivated dependency patches applied (#132, #158)
- Routine dependency updates across all packages (#135, #136, #175, #179, #180, #181, #182, #183, #214, #215, #218, #258, #272, #273, #274, #282, #286, #300, #302, #304, #305, #351, #359, #425, #460, #554, #568)
- Dependabot configured and grouped; major version bumps excluded (#294, #299, #358)
- Fuzzball bumped to v2.2.6 (now MIT-licensed; resolves GPL licensing concern) (#642)

#### Other improvements

- Integration tests for item submission, report flow, and rule changes (#488, #637, #640)
- Recovery script provided for accidental queue cleanup (#479)
- CI checks moved into Docker Compose services for consistency with local dev (#314)
- Husky pre-commit hooks wired up with lint-staged (#391)
- Storybook migrated from CRA to Vite (#150)
- Betterer removed; ESLint upgraded to v9 (#152)
- Issue forms added to guide bug reports and feature requests (#673, #674)
- `AGENTS.md` added with Coop-specific guidance for AI coding assistants (#296)
- AI code review configuration and instructions added (#445)
- `CODEOWNERS` cleaned up (#443)
- ESLint warnings fixed in server (#331)
- ESLint ignores added for postcss and storybook config (#456)
- Dummy `package.json` added for ESLint custom rules in client (#281)
- Postgres settings adjusted for development environments (#376)
- README and AGENTS.md CI commands aligned after CI restructure (#330)
- _SDLC checklist P0s and P1s addressed (#213)_

### New contributors

- @TomHawk123 made their first contribution in https://github.com/roostorg/coop/pull/109
- @dom-notion made their first contribution in https://github.com/roostorg/coop/pull/328
- @vinaysrao1 made their first contribution in https://github.com/roostorg/coop/pull/314
- @samuelralak made their first contribution in https://github.com/roostorg/coop/pull/368
- @ThatKoffe made their first contribution in https://github.com/roostorg/coop/pull/405
- @haileyok made their first contribution in https://github.com/roostorg/coop/pull/439
- @davidyshin made their first contribution in https://github.com/roostorg/coop/pull/472
- @ded-furby made their first contribution in https://github.com/roostorg/coop/pull/675
- @JagadeeshChandra12 made their first contribution in https://github.com/roostorg/coop/pull/702

**Full Changelog**: https://github.com/roostorg/coop/compare/0.1...1.0

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
