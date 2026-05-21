# Basic Concepts

These are the core building blocks of Coop. Understanding these will help you get started quickly and get your workflow up and running. Once you understand these, you should be able to complete your Coop setup and get started interacting with various features.

**These concepts are listed in the same order in which you should build your Coop setup.** Some concepts build on previous ones, so we recommend that you read all of them in order.

## Item

An **Item** is any entity on your platform. This can include individual pieces of content (e.g. posts, comments, direct messages, product listings, product reviews, etc.), threads of content (e.g. comment threads, group chats, etc.), or users and their profiles. Any individual entity can be considered an Item, even if it contains other Items within it.

### Item Type

Item Types represent the different types of Items on your platform. For example, a social network might have _Profile_, _Post_, _Comment_, and _Comment Thread_. A marketplace platform might include _Buyer_, _Seller_, _Product Listing_, _Product Review_, _Direct Message_, _Transaction_, etc. Every Item you send Coop needs to be an instance of exactly one of these Item Types.

The first step in your setup process will be [defining these Item Types](administration.md#item-types) in Coop under **Settings** → **Item Types**.

### Flavors of Item Types

The idea of Item Types is a useful, generic concept that can represent any item on your platform, from isolated pieces of content, to users and their profiles, to threads containing multiple pieces of related content.

In order for Coop to enable more useful functionality for different kinds of Item Types, Coop has three categories into which Item Types can fall:

1. **Content**: an individual piece of content, such as messages, comments, posts, product listings, reviews, etc.

2. **User**: an individual user on your platform. Some platforms just have one User Item Type, but others might have more. For example, a marketplace might have buyers and sellers as different User Item Types, a ride-sharing app might have drivers and passengers as different User Item Types, etc.

3. **Thread**: an ordered list of content. Examples include a group chat with lots of messages, a chatboard with lots of posts, a comment thread with lots of comments; these are all threads that contain individual pieces of content, in a specified order.

Coop processes and renders these different kinds of Item Types in different ways, so for each Item Type you create, Coop needs to know in which of the three buckets it belongs.

### Item Type Schema

A Schema represents the shape of the data in your Item Type. For example, if a Profile on your platform contains a username, a profile picture, a short bio, and a list of interests, Coop needs to know that information so that it can reference that data in your Rules and render it properly in the Coop UI.

Every Item Type Schema consists of a list of Fields, where each Field represents one piece of data in the Schema. In the previous example, the Profile Item Type's Schema might include the following Fields:

- "username" (`string`)
- "profile_picture" (`image`)
- "bio" (`string`)
- "interests" (`Array<string>`)

You may add as many Fields as you'd like, and then you can utilize them in your Rules.

#### Important note on how Coop uniquely identifies an Item

In Coop, to uniquely identify a particular Item, use an (Item ID, Item Type ID) pair. Some platforms may not be able to guarantee that a comment ID and a user ID won't clash. Some other platform operators may have multiple platforms they own and operate, with no guarantee that Item IDs across platforms won't clash with each other.

In those circumstances, the (Item ID, Item Type ID) pair is needed to uniquely identify the correct Item. In API requests, these are represented as sibling fields: `id` and `typeId`. It’s recommended to send your Items in the following shape:

```ts
item: {
  id: string;
  typeId: string;
}
```

The id field will be your unique identifier for the Item, and the typeId field will be Coop’s ID for the corresponding Item Type. Once you create an Item Type in your Coop dashboard, you'll see its generated ID, which you can then use to populate the typeId field when you send API requests to Coop.

## Actions

Actions in Coop represent any action that can be performed on Items. Some common Trust & Safety-related examples include _Delete_, _Ban_, _Mute_, and _Send to Moderator_. If you want to add non-T&S-related actions as well, such as _Promote_, _Add to Trending_, _Mark as Trustworthy_, or _Approve Transaction_, you absolutely can! You can add any automated action to Coop.

Actions are exposed on Proactive Rules for matching items. In the Review Console, available Actions are exposed as _Decisions_ to be made on each Job by a moderator.

Each Action maps to an API endpoint that your organization exposes to Coop. For example, if you create a _Delete_ Action in Coop, you must provide an API endpoint (i.e. a URL and ideally an authentication scheme) to which Coop can send POST requests. That way, when any of these Actions is triggered through Coop (whether from proactive rules or moderator decisions), Coop will send the corresponding POST request, at which point the Action will actually get executed on your platform's server.

The second step in your setup process will be defining these Actions in Coop under **Settings** → **Actions**.

For details on the webhook payload Coop sends to your Action API endpoints, see [Handling Actions](../api/actions.md).

## Policy

Policies are the set of rules and guidelines that a platform uses to govern the conduct of its users. Some typical examples include _Spam_, _Nudity_, _Fraud_, _Harassment_, _Violence_, etc. Learn more from from the [Trust & Safety Professional Association](https://www.tspa.org/curriculum/ts-fundamentals/policy/policy-development/).

Policies can have sub-policies; for example, a _Spam_ policy could have sub-policies like _Commercial Spam_, _Repetitive Content_, _Fake Engagement_, and _Scams & Phishing_.

It is often useful (and in some cases required, i.e. by the EU's Digital Services Act) to tie every Action you take to one or more specific Policies. For example, you could _Delete_ a comment under your _Hate Speech_ policy, or you could _Delete_ it under your _Spam_ policy. Coop allows you to track those differences and measure how many Actions you've taken for each Policy. That way, you can see how effectively you're enforcing each Policy over time, identify Policies for which your enforcement is poor or degrading, and report performance metrics to your leadership (or to regulators, i.e. in the form of a DSA Transparency Report).

You can create and manage your Policies in the **Policies** dashboard, and you can fetch them programmatically through the [Policies API](../api/policies.md). Policies added in Coop's UI are also visible to reviewers directly in the [Job view](review-console.md#job-view) of the Review Console.

## Jobs

Jobs are created when a Report is routed to a Queue in the Review Console. Each Job displays information about the Report, the reported Item, and the Item's Author. Jobs can be skipped (leaving them in the queue), or a Decision can be made by the reviewer. Decisions include _Ignore_ (do not action) _Enqueue to NCMEC_ (if configured), _Move_ to another queue, and all available Actions for the queue.

## Reports

Reports are created when a user on your platform flags an Item. The Report API is used for manual review, whether it’s in response to a user flag or just to trigger manual labeling. When a user flags an Item on your platform and you send it to the Report API, Coop sends it to the Review Console so that your moderators can review it and decide what to do with it.

Read more about [reports](reports.md).

## Appeals

When a user on your platform disagrees with a moderation decision you've made, they may want to "appeal" your decision; in other words, they want you to take another look and determine whether your initial moderation decision was correct. If you support this functionality (which is required for some platforms under the EU's Digital Services Act), then Coop can facilitate the entire appeal process.

You can create an Appeal in Coop when a user on your platform requests that a moderation decision be re-reviewed by your team. When the user appeals a decision on your platform, you can send that appeal request to the [Appeal API](../api/appeal.md), and we'll add it to a Review Queue so that your moderators can review it and decide whether to uphold or overturn the original moderation decision.

Read more about [Appeals](appeals.md).
