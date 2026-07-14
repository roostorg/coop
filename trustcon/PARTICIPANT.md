# TrustCon workshop: participant guide

Two open-source ROOST tools, one end-to-end Trust & Safety workflow, run against
real Bluesky content.

- **Coop** is a review tool: it turns signals about content into review queues,
  policies, rules, and actions, so a person can make and act on decisions.
- **Osprey** is a real-time rules engine: it watches a live feed and reacts as
  content streams in.

Two Christchurch Call Foundation (CCF) case studies are your step-by-step guides
throughout:

- **Coop, "Identifying References to the Christchurch Attack"** — detect and act
  on terrorist and violent extremist content (TVEC) with hashes, keywords, and a
  classifier.
- **Osprey, "Monitoring Harm Amplification After a TVE Incident"** — use
  behavioral signals (posting spikes, account age, coordination) to catch
  post-incident amplification.

## Two ways to take part

Pick the path that fits you:

- **No engineering background? Use the hosted environment (Path A).** ROOST runs
  everything for you; you work in your browser. Your goal is to **add your own
  policies and create rules.**
- **Comfortable running code? Run it on your own computer (Path B).** Your goal
  is to **get your own data flowing into Coop or Osprey, or add your own plugin
  or rule function.**

---

## Path A — Hosted, no setup

ROOST provides a ready-to-use environment. Open the **link your facilitator
shares** and you are in, nothing to install. The demo is already running: Coop's
queues are filled with real Bluesky posts, and Osprey shows a live stream.

Your goal is to **add a policy and create a rule.** Use the case studies as your
guide.

### In Coop

1. **Look at the review queue.** Open a queue and step through a few posts. Each
   shows the author's account and their other recent posts as context, the way a
   real reviewer works.
2. **Add a policy.** Create one in a couple of fields, it is what a reviewer
   decides against.
3. **Create a rule.** Assemble a rule from a ready-made signal (a keyword list, a
   hash match, or the classifier) and send matches to a queue. Watch a post land
   in it.
4. **Take an action.** Attach an action to a decision:
   - **Practice action:** shows what would have happened, with no outside effect.
   - **Real action:** places a harmless **Bleep** or **Bloop** label on the
     actual Bluesky post. To see it, subscribe to the labeler (below).

### In Osprey

1. **Watch the live stream** of posts and the rules firing on them.
2. **Open the rules picture** (the visualizer) to see how a rule fits together.
3. **Create or tweak a rule**, add a phrase to watch for, reload, and see
   matching posts light up. That is writing a detection in under a minute.

### See the real labels

In the Bluesky app or bsky.app, open
**bsky.app/profile/trustcon-labeler.bsky.social** and press **Subscribe**. Bleep
and Bloop labels you emit show up in your app. New labels can take a few minutes
to appear while Bluesky catches up.

---

## Path B — On your own computer

Run Coop or Osprey locally and connect it to your own world. Each repo has setup
instructions in its README:

- **Coop:** github.com/roostorg/coop
- **Osprey:** github.com/roostorg/osprey

The workshop's Bluesky wiring is a worked example you can learn from, on the
`trustcon` branch of Coop and the `juliet/trustcon-devcontainer` branch of Osprey.

Your goal is to **bring your own data in, or add your own logic.**

### Get your own data flowing

- **Osprey:** point it at your own event source instead of Bluesky. An input
  plugin turns your stream into events Osprey processes.
- **Coop:** send your own content and reports in through Coop's API so they show
  up as items to review, or wire your own model in as a signal.

### Add your own logic

- **Osprey:** write your own rule function (a UDF), a small plugin a rule can
  call, like "does this text match my pattern" or "does this image match my hash
  set."
- **Coop:** add a custom signal or plug-in integration, so Coop calls a model or
  service you already run and reads back a score.

The two case studies work here too: use them as a template, then swap in your own
data, policies, and detections.
