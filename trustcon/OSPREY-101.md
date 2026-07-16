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

## In the workshop: create and edit a rule in the UI

This workshop build lets you author rules in the browser, no file editing
needed. In the dashboard, open **Rules** and choose **New rule**.

1. **Draft** it in the builder, or switch to the code editor to write SML
   directly.
2. **Validate.** Osprey checks your draft against the live engine and shows any
   errors inline, so you fix them before anything goes live.
3. **Save** it as a draft. Drafts show up on the Rules page for the whole group
   to see and refine.

Everyone shares one super-user login for the workshop, so all drafts land in one
shared list. Draft and validate as much as you like; leave the single **Deploy**
to the facilitator, since deploying writes the rule to disk and can edit the
shared `main.sml`, so two people deploying at once would collide. Once it is
deployed and the worker reloads, watch your rule start matching in the Event
stream.

## In the workshop: run a query in the console

The Event stream is also an investigation console. Use the **query filter** to
narrow it, written as conditions over rules and features, for example:

- `PostContainsTestRule == True` to show only posts that tripped that rule.
- a condition on a feature value to find, say, posts from very new accounts.

Save a query you will reuse from the **saved queries** list, and open any entity
(a user, a post) to see the labels and past events attached to it. This is the
"dig into what happened" half of Osprey, the same surface a safety team uses to
investigate.

## In the workshop: label an entity by hand

Rules apply labels automatically, but people apply them too, and that human
judgment is a first-class part of Osprey. From a query result or the event
stream, open an entity (a user or a post) to see its labels and history, then:

- **Add a label:** open the label form, pick a label, add a short **reason**, and
  choose whether it is **permanent** or **expires** (say, in two weeks). Submit,
  and it shows as manually added, next to any labels the rules applied.
- **Remove a label:** on the entity's label list, click the **remove** (trash)
  button next to a label and give a reason. It is marked **manually removed**
  rather than deleted, so the record of who added and removed it is kept.

Labels are the bridge between human decisions and the automated rules: a label a
person adds (or a rule applies) becomes state other rules can act on later.

## For technical participants: write a UDF or an SML rule

Two ways to bring your own logic. Both use the workshop's
`example_atproto_plugins` and `example_atproto_rules` as copy-me templates.

**Add a UDF (a Python plugin a rule can call).** A UDF is a small class that
takes typed arguments and returns a value:

```python
class DidArguments(ArgumentsBase):
    did: str

class AtprotoHandle(UDFBase[DidArguments, str]):
    category = 'atproto'
    execute_async = True  # optional: runs in the gevent pool
    def execute(self, execution_context, arguments: DidArguments) -> str:
        ...
        return handle
```

Register it so rules can see it, in `register_plugins.py`:

```python
@hookimpl_osprey
def register_udfs():
    return [AtprotoHandle, AtprotoDisplayName]
```

Restart the worker and your UDF is callable from SML. The same file's
`register_input_stream` hook is how you swap in your own event source.

**Write an SML rule.** SML is a subset of Python. A rule reads *features* and
matches *conditions*:

```python
# models/record/post.sml  (define a feature pulled from the event)
PostText: str = JsonData(path='$.commit.record.text', required=False)

# rules/record/post/my_rule.sml  (match on it, then act)
MyRule = Rule(
  when_all=[TextContains(text=PostText, phrase='your phrase')],
  description='what this catches',
)
WhenRules(rules_any=[MyRule], then=[LabelAdd(entity=UserId, label='your-label')])
```

Import the models your rule depends on, add the file under the tree that
`main.sml` requires, then either push it with
`osprey-cli push_rules example_atproto_rules` (which validates first) or restart
the worker to reload. The UI's code editor produces exactly this SML, so a rule
you draft in the browser and one you write in a file are the same thing.
