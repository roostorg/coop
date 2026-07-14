# Coop 101

A plain-language primer. No engineering background needed.

## What Coop is

Coop is a **configurable review tool** for Trust & Safety. It takes signals
about content (user reports, hash matches, classifier scores, and more), routes
what matters to a human review queue or to an automated action, and records the
decision. It is agnostic of policy and sector: you configure it to your rules,
whatever they are.

Think of Coop as the place where "something might be wrong with this content"
becomes "here is the decision, and here is what we did about it."

## The core ideas

- **Item.** The thing being reviewed: a post, a user, an image. Coop can show
  the item alongside context, like the author's account and their other posts.
- **Signal.** An automated read on an item. Examples: this text contains a term
  from a list, this image matches a known hash, a classifier scored it high, or
  your own model returned a score. Signals vary in precision, so you route them
  differently.
- **Policy.** What your platform disallows, written down. It is what a reviewer
  decides against.
- **Rule.** A signal plus a condition plus an outcome. For example: "if this
  image matches the hash bank, route it to the priority queue." Rules turn
  signals into routing and enforcement.
- **Review queue.** Where items land for a person to decide. The reviewer sees
  the item, its context, and the relevant policy, then makes a call.
- **Action.** What happens on a decision: route to a queue, apply a label, or
  call your platform's webhook to remove or restrict the content.

## How it flows

```
content in  ->  signals evaluate  ->  rules route  ->  human review or auto-action  ->  decision  ->  action out
```

High-precision signals (like a confirmed hash match) can route straight to an
automated action. Lower-precision or nuanced signals (like a borderline
classifier verdict) route to a human, who applies policy in context.

## How it plugs into your stack

- **Hash matching** via an HMA integration, so you can reuse shared hash sets.
- **Classifiers** as signals, including policy-steerable ones.
- **Custom signals**, where Coop calls a model you already run and reads back a
  score. Your model stays where it is; Coop just asks it.

## Words we use

Coop is about **review** and **reviewers**. A reviewer makes a decision on an
item against a policy. The tool routes, records, and acts, the person judges.
