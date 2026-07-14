# Coop 101

## What Coop is

Coop is a **configurable review tool** for Trust & Safety. It takes signals
(user reports, hash matches, classifier scores, and more), routes
what matters to a manual review queue or to an automated action, and records the
decision. It is agnostic of policy and sector: you configure it to your rules,
whatever they are.

Think of Coop as the place where "something might be wrong with this"
becomes "here is the decision, and here is what we did about it."

## The core ideas

- **Item.** The thing being reviewed. Every item is one of three types: content
  (a post), a user, or a thread. Coop can show it alongside context, like the
  author's account and their other posts.
- **Signal.** An automated read on an item. Examples: this text contains a term
  from a list, this image matches a known hash, a classifier scored it high, or
  your own model returned a score. Signals vary in precision, so you route them
  differently.
- **Report.** When a user or trusted flagger flags an item, Coop creates a
  report and sends it into review. Reports are the reactive way content enters.
- **Policy.** What your platform disallows, written down. It is what a reviewer
  decides against.
- **Rule.** Conditions over signals that decide what happens. Proactive rules
  act on submitted items (for example, auto-enforce or enqueue for review on a
  hash match); routing rules send incoming reports to the right queue.
- **Review queue.** Where jobs land for a person to work through.
- **Job.** When a report or a rule routes an item to a queue, it becomes a job,
  the unit a reviewer decides on. The reviewer sees the item, its context, and
  the relevant policy, then makes a call.
- **Action.** What happens on a decision: enqueue to review, submit to NCMEC, or
  call your platform's webhook to remove or restrict the content.

You get to decide the split of manual/automated actions. For example,
high-precision signals (like a confirmed hash match) can route straight to an
automated action. Lower-precision or nuanced signals (like a borderline
classifier verdict) route to a human, who applies policy in context.

## How it plugs into your stack

- **Hash matching** via an HMA integration, so you can plug into NCMEC/StopNCII/ThreatExchange with your credentials or use your own hash sets.
- **Novel CSAM detection** via an integration with Google's Content Safety API (if you have API credentials)
- **Classifiers** as signals, including policy-steerable ones like gpt-oss-safeguard or Zentropi.
- **Custom signals**, where Coop calls a model you already run and reads back a
  score.

## Words we use

Coop is about **review** and **reviewers**. A reviewer makes a decision on an
item against a policy. Reviewers look at **jobs**.
