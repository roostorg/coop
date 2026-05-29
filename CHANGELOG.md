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

<summary of reducing databases and moving off Kysley and to BullMQ>

<list of related PRs>

#### Rewritten documentation

Before Coop 1.0, our documentation was a combination of SaaS-oriented docs that we'd acquired, technical architecture notes from our assessment of the original codebase, and several attempts to expand the level of detail. While it served its purpose of getting the project off the ground, we spent a significant amount of time completely reworking the documentation. The new structure more clearly separates the docs into four distinct sections, better separating concerns:

- User guide
- Development guide
- API reference
- Integrations

We also implemented versioning for the docs meaning the latest docs for the `main` branch will always live at [roostorg.github.io/coop/latest](https://roostorg.github.io/coop/latest), while docs for version 1.0 will live at [roostorg.github.io/coop/1.0](https://roostorg.github.io/coop/1.0).

<list of related PRs>

#### Admin settings

As a SaaS product, several features for organizations were hidden behind database-only toggles. To make it easier to customize Coop for your platform and deployment, we've moved these settings directly into the Coop front-end for administrators.

<list of related PRs>

### Expanded features & capability

We were extremely fortunate to have multiple platforms adopt Coop during the 1.0 development cycle; this meant we had real-world users sharing invaluable feedback. As a result, Coop 1.0 is now a better product—not just for these adopters, but for everyone.

#### Review console features

<list of related PRs>

#### Child safety improvements

<list of related PRs>

### Reliability & sustainability

As a critical open source project that empowers platforms to keep their users safe, it's crucial that Coop is reliable, sustainable, and secure. We focused on ensuring Coop 1.0 met these goals and will continue to meet them going forward.

#### Fixes

<list of related PRs>

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
