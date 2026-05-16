# Basic Concepts

These are the core building blocks of Coop. Understanding these will help you get started quickly and get your workflow up and running. Once you understand these, you should be able to complete your Coop setup and get started interacting with various features.

**These concepts are listed in the same order in which you should build your Coop setup.** Some concepts build on previous ones, so we recommend that you read all of them in order.

## Item

An **Item** is any entity on your platform. This can include individual pieces of content (e.g. posts, comments, direct messages, product listings, product reviews, etc.), threads of content (e.g. comment threads, group chats, etc.), or users and their profiles. Any individual entity can be considered an Item, even if it contains other Items within it.

### Item Type

Item Types represent the different types of Items on your platform. For example, if you've built a social network that allows users to create profiles, upload posts, and comment on other users' posts, then your Item Types might be Profile, Post, Comment, and Comment Thread. If you've built a marketplace or eCommerce platform, your Item Types might be Buyer, Seller, Product Listing, Product Review, Direct Message, Transaction, and more. Every Item you send Coop needs to be an instance of exactly one of these Item Types.

The first step in your setup process will be defining these Item Types in the Coop dashboard.

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

In Coop, to uniquely identify a particular Item, use an (Item ID, Item Type ID) pair. Some platforms may not be able to guarantee that a comment ID and a user ID won't clash. Some other customers may have multiple platforms they own and operate, with no guarantee that Item IDs across platforms won't clash with each other.

In those circumstances, the (Item ID, Item Type ID) pair is needed to uniquely identify the correct Item. It’s recommended to send your Items in the following shape:

```ts
item: {
  id: string;
  typeId: string;
}
```

The id field will be your unique identifier for the Item, and the typeId field will be Coop’s ID for the corresponding Item Type. Once you create an Item Type in your Coop dashboard, you'll see its generated ID, which you can then use to populate the typeId field when you send API requests to Coop.

## Actions

Actions in Coop represent any action you can perform on Items. Some common Trust & Safety-related examples include _Delete_, _Ban_, _Mute_, and _Send to Moderator_. If you want to add non-T&S-related actions as well, such as _Promote_, _Add to Trending_, _Mark as Trustworthy_, or _Approve Transaction_, you absolutely can! You can add any automated action to Coop.

In the Review Console, available Actions are exposed as _Decisions_ to be made on each Job.

Each Action must map to an API endpoint that you expose to Coop. For example, if you create a _Delete_ Action in Coop, you must provide an API endpoint (i.e. a URL and ideally an authentication scheme) to which Coop can send POST requests. That way, when any of these Actions is triggered through Coop (either through the Review Console or Automated Rules), Coop will send you the corresponding POST request, at which point the Action will actually get executed on your servers.

The second step in your setup process will be defining these Actions in the Coop dashboard.

For details on the webhook payload Coop sends to your Action API endpoints, see [Action webhooks](../development/architecture.md#actions) in the Development Guide.

## Policy

[Policies are the set of rules and guidelines that a platform uses to govern the conduct of its users.](https://www.tspa.org/curriculum/ts-fundamentals/policy/policy-development/) Some typical examples include Spam, Hate Speech, Harassment, Violence, etc.

Policies can have sub-policies underneath them, so the Violence policy could have sub-policies Graphic Violence, Threats of Violence, Encouragement and Glorification of Violence, etc., all of which are specific sub-types of Violence that could occur on your platform.

It is often useful (and in some cases, required by the EU's Digital Services Act) to tie every Action you take to one or more specific Policies. For example, you could Delete a comment under your Hate Speech policy, or you could Delete it under your Spam policy. Coop allows you to track those differences and measure how many Actions you've taken for each Policy. That way, you can see how effectively you're enforcing each Policy over time, identify Policies for which your enforcement is poor or degrading, and report performance metrics to your leadership (or to regulators in the form of a DSA Transparency Report).

You can create and manage your Policies in the Policies Dashboard, and you can fetch them programmatically through the Policies API.

## Jobs

Jobs are created when a Report is routed to a Queue in the Review Console. Each Job displays information about the Report, the reported Item, and the Item's Author. Jobs can be skipped (leaving them in the queue), or a Decision can be made by the reviewer. Decisions include _Ignore_ (do not action) _Enqueue to NCMEC_ (if configured), _Move_ to another queue, and all available Actions for the queue.

## Reports

Reports are created when a user on your platform flags an Item as potentially harmful. The Report API is used for manual review, whether it’s in response to a user flag or just to trigger manual labeling. When a user flags an Item on your platform and you send it to the Report API, Coop adds it to a Review Queue so that your moderators can review it and decide what to do with it. Those items will automatically be added to Review Queues and users will be able to claim them in the Review Console.

Read more about [reports](reports.md).

## Appeals

When a user on your platform disagrees with a moderation decision you've made, they may want to "appeal" your decision - in other words, they want you to take another look and determine whether your initial moderation decision was correct. If you support this functionality (which is required for some platforms under the EU's Digital Services Act), then Coop can facilitate the entire appeal process.

You can create an Appeal in Coop when a user on your platform requests that a moderation decision be re-reviewed by your team. When the user appeals a decision on your platform, you can send that appeal request to the Appeal API, and we'll add it to a Review Queue so that your moderators can review it and decide whether to uphold or overturn the original moderation decision. Read more about [Appeals](appeals.md).

## Users

### User Score

The User Score is calculated based on the ratio of penalties to submissions:

`weightedPenaltyRate = sum(penalties) / numSubmissions`

#### Score Thresholds

| Penalty Rate | Score     |
| :----------- | :-------- |
| ≤ 1%         | 5 (Best)  |
| ≤ 5%         | 4         |
| ≤ 10%        | 3         |
| ≤ 25%        | 2         |
| \> 25%       | 1 (Worst) |

#### How Penalties Work

- Each action has a penalty weight (configured per action+policy):
  - Small: 1 point
  - Medium: 3 points
  - Large: 9 points
  - Extreme: 27 points
- Penalties accumulate with "strikes" (repeat offenses can have escalating penalties)

#### Example

- User has 100 submissions
- 2 actions taken with "medium" penalty (3 points each) \= 6 penalty points
- Penalty rate = 6/100 = 6% → Score: 3
