# Osprey 101

A plain-language primer. No engineering background needed.

## What Osprey is

Osprey is a **real-time rules engine** for Trust & Safety. It watches a stream
of events as they happen, extracts useful values from each one, runs your rules
against them in real time, and fires actions the moment a rule matches. Where
Coop is about human review of individual items, Osprey is about spotting
patterns in a live firehose and reacting instantly.

Think of Osprey as the always-on watcher: as content and behavior flow past, it
flags, labels, and acts the instant something matches.

## The core ideas

- **Event.** Something happening on your platform, streamed in: a post created,
  an account signing up, a link shared. In this workshop the events come from
  the live Bluesky feed.
- **Feature.** A value pulled out of an event so a rule can use it: the post's
  text, the account's age, how fast an account is posting.
- **Rule.** A set of conditions over features and signals. When they all match,
  the rule fires. Rules are written in SML, a small, restricted, Python-like
  language, in plain text files you can edit and reload.
- **Label.** An annotation Osprey applies to an entity (a user, a piece of
  content) when a rule fires, for example marking an account for investigation.
- **Action / effect.** What the rule does on a match: apply a label, rate-limit
  or ban an account, or emit a result to a downstream system.
- **UDF.** A user-defined function, a plugin that adds a capability a rule can
  call, like "does this text contain a phrase" or "does this image match a hash."

## How it flows

```
events stream in  ->  features extracted  ->  rules evaluate in real time  ->  labels and actions fire  ->  results to your systems
```

Because it works on a live stream, Osprey is strong at **behavioral** patterns
that only appear over time or across accounts: sudden spikes in posting,
coordinated re-uploads, bursts of new accounts, brigading.

## What you see in the UI

- **Event stream:** events and their rule hits arriving live.
- **Rules visualizer:** a graph of how a rule is put together.
- **Rules registry and features:** the rules that exist and the values they use.

## How it plugs into your stack

- **Input streams:** point Osprey at your own event source; the Bluesky Jetstream
  feed here is one example of an existing stream it consumes.
- **Output sinks:** send results wherever you need, including into your own
  systems or a labeling service.
- **UDFs:** add your own detection logic as a plugin.
