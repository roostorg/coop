# User Guide

Coop enables you to protect your users from harm with remarkable ease.

![Overview](../images/coop-overview.png)

Coop is a trust and safety platform built around two functional areas that can be used independently or together:

- **Automated Enforcement**: rules that evaluate every submitted item and automatically take action or route it to a review queue
- **Review Console**: a human review queue where moderators examine flagged content and make enforcement decisions

This simplified diagram can help you better understand how data flows between a platform and Coop:

[![Simple Diagram](../images/diagram-simple.svg)](../images/diagram-simple.svg)

## Getting started as an admin

We recommend beginning by familiarizing yourself with Coop's [basic concepts](concepts.md). Once you're up to speed:

1. Ensure you have an account and API key for your Coop instance (find or generate one under **Settings** → **API Keys**)

2. Define your [Item Types](administration.md#item-types); the kinds of content or users on your platform (posts, comments, profiles, etc.)

3. Define your [Actions](administration.md#actions) and expose callback endpoints so Coop can trigger enforcement on your platform; see [Handling Actions](../api/actions.md) for the webhook format

4. Begin submitting items to Coop via the [Items API](../api/items.md) so they run through your proactive rules

5. Submit user reports via the [Report API](../api/report.md) to route them into review queues for your moderators
