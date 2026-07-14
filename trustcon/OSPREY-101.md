# Osprey 101

A plain-language primer. No engineering background needed.

## What Osprey is

Osprey is a **real-time rules engine and investigation console** for Trust &
Safety. It watches a stream of events as they happen, extracts useful values
from each one, runs your rules against them in real time, and applies labels or
fires effects the moment a rule matches. It is also where safety teams query and
investigate what happened.

Think of Osprey as an always-on watcher plus an investigation workbench: as
content and behavior flow past, it flags, labels, and acts, and people use it to
search, label, and dig into what is going on.

## The core ideas

- **Event.** Something happening on your platform, streamed in: a post created,
  an account signing up, a link shared. In this workshop the events come from
  the live Bluesky feed.
- **Feature.** A named value pulled out of an event so rules can use it and you
  can query against it: the post's text, the account's age, how fast an account
  is posting.
- **Rule.** A set of conditions (its `when_all`) over features and signals.
  Rules are written in SML, a subset of Python with extra restrictions, in plain
  text files you can edit and reload. A rule by itself only creates variables;
  what it does on a match is wired separately (see Effect).
- **Label.** An annotation on an entity (a user, a piece of content). Labels are
  applied both automatically when rules fire and manually by people. They are
  the bridge between human judgment and the automated rules, and they persist as
  state Osprey can act on later.
- **Effect.** What happens when rules fire, wired via `WhenRules`: apply a label,
  rate-limit or ban an account, or send a result to an output sink.
- **UDF.** A user-defined function, a plugin that adds a capability a rule can
  call, like "does this text contain a phrase" or "does this image match a hash."

## How it flows

```
events stream in  ->  features extracted  ->  rules evaluate in real time  ->  labels and effects fire  ->  results to output sinks and the console
```

Because it works on a live stream and keeps label state, Osprey is strong at
**behavioral** patterns that only appear over time or across accounts: sudden
spikes in posting, coordinated re-uploads, bursts of new accounts, brigading.

## What you see in the UI

- **Event stream:** events and their rule hits arriving live (under Investigate).
- **Rules visualizer:** a dependency graph of how labels and rules relate, so you
  can see what will fire when a given label is applied.
- **Rules and Features pages:** the rules loaded in your deployment and the values
  they use. (The UDF Registry lists the UDFs rules can call.)

## How it plugs into your stack

- **Input:** point Osprey at your own event source; the Bluesky Jetstream feed
  here is one example of an existing stream it consumes.
- **Output sinks:** send results wherever you need, including into your own
  systems or a labeling service.
- **UDFs:** add your own detection logic as a plugin.
