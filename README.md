# ![Coop](https://roostorg.github.io/brand/projects/coop-lockup.svg)

**Review and moderation, your way.**

![Coop overview with key operational metrics such as total actions taken, jobs pending review, percentage breakdown of automated vs manual actions, and top policy violations](./docs/images/overview.png)

Coop is the open source review and moderation tool from [ROOST](https://roost.tools) that provides a comprehensive solution for online safety:

- **Review Console**: Human review interface for complex moderation decisions
- **Content Processing**: Support for posts, comments, media, and custom content types
- **Analytics**: Detailed insights into moderation effectiveness and trends
- **Rules Engine**: Automated content evaluation against customizable policies
- **API Integration**: Simple REST and GraphQL APIs for seamless platform integration

## Who Coop is for

Coop is for anyone who needs to make online safety decisions: platforms of all sizes, solo developers, and community teams without dedicated trust and safety staff.

Most moderation tooling is proprietary and priced for platforms that can already afford it. Coop is free and open source so your data stays within your infrastructure, and you can customize it for your community's needs.

A few things that shape how we build it:

- **The platform owns its policy.** Coop is the plumbing to implement and enforce your own rules.
- **Child safety is a prioritized workflow.** As the first free end-to-end online child safety system, it is one of the reasons Coop exists.
- **The codebase is auditable**, with no hidden logic and no vendor lock-in.

## Used in production

Coop is used by:

| ![Kyodo](docs/images/adopters/kyodo.png) | ![Notion](docs/images/adopters/notion.png) | ![Musubi](docs/images/adopters/musubi.png) |
| ---------------------------------------- | ------------------------------------------ | ------------------------------------------ |

Using Coop and want to add your project/organization to this list? [Open a pull request!](https://github.com/roostorg/coop/edit/main/README.md)

## Built in the open

Coop is an open source project undergoing active development. Features and documentation will evolve based on community feedback.

We want to hear from you! Whether you're testing it out, running into issues, or have ideas for improvements, please [open an issue](https://github.com/roostorg/coop/issues), [join or start a discussion](https://github.com/roostorg/coop/discussions), or join our [Discord](https://discord.gg/5Csqnw2FSQ).

Your feedback directly shapes our [roadmap](https://roostorg.github.io/community/roadmap).

## Quick start

Run Coop with a single command using Docker Compose. See the [Docker guide](docs/development/docker.md) for setup instructions and published image details.

## Learn more

See our comprehensive [documentation](https://roostorg.github.io/coop/latest) covering both functional and technical information including a user guide, development guide, API reference, and integration details.

The docs are also available [directly in this repo](docs/) for your convenience.
