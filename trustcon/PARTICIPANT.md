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

### How do I get my data into Coop?

Coop reviews "items" (a post, a user, a thread). To bring your own content in:

1. **Create an Item Type** that matches your data's shape, so Coop knows what
   your content looks like (see "Creating an Item Type" below).
2. **Send your data in** with a POST to Coop's ingestion API, authenticated with
   your org's API key (the `X-API-KEY` header):
   - `POST /api/v1/items/async/` submits items in a batch; they run through your
     rules and land in a review queue (returns 202; also does HMA image hashing
     if `data.images` has URLs).
   - `POST /api/v1/content/` is the legacy synchronous single-item version.
   - `POST /api/v1/report` files a report on an item (the reactive path).
     See `docs/api/` for the full request shapes and field types.
3. Optionally, **connect a model you already run** as a custom signal, so Coop
   scores your items with it (see "Add your own logic").

#### Creating an Item Type

Do this first, in **Settings -> Item Types -> New Item Type**:

1. **Name it** for what it is on your platform ("Post", "Profile", "Comment
   thread").
2. **Pick its category:** **Content** (a post, comment, listing, review),
   **User** (a profile), or **Thread** (an ordered list of content). Coop renders
   and processes each one differently.
3. **Add a field for each piece of your data**, giving each a name and a type:
   - `STRING`, `BOOLEAN`, `NUMBER`
   - `IMAGE`, audio, or video (you submit these as a URL)
   - `DATETIME` (ISO 8601), `GEOHASH`, `URL`
   - `RELATED_ITEM`, a link to another item as `{ id, typeId }` (for example a
     post's author, or its parent thread)
   - `ARRAY` of any of the above (for example a list of image URLs, or tags)
4. **Set field roles** where they apply, so Coop knows which field is the author,
   the created-at time, the display name, and the thread or parent. These roles
   are what let the review screen show the author and their surrounding context.
5. **Save.** Coop generates an **Item Type ID**. Copy it: that is the `typeId`
   you put on every item you send, and the `data` you send must use the field
   names and types you defined here.

The workshop's two demo item types are a worked example. `ATproto-post` is a
Content type (a `text` string, an `images` array, a `createdAt` datetime, and an
`authorDid` related-item pointing at the account); `ATproto-account` is a User
type (a `handle`, a `displayName`, an avatar image). The `trustcon` branch's
Bluesky connector reads a live feed and submits each post against these types.

### How do I get my data into Osprey?

Osprey processes a stream of **events** (it calls them actions), one per thing
that happens on your platform: a post, a login, a follow, a purchase. Each event
is a small record with:

- an **id** (unique per event),
- a **name** (the event type, for example `PostCreated` or `UserLogin`),
- a **data** object holding the fields your rules look at (the post text, the
  account's age, the IP, and so on).

Your rules read from `data`, so put whatever a rule needs to make its decision in
there. Two ways to feed events in:

- **Produce events to Osprey's input topic.** Osprey reads from a Kafka topic
  (`osprey.actions_input` by default); point your own producer at it, one event
  per action. The demo's synthetic producer does exactly this, so you can copy
  its event shape.
- **Or write an input plugin** for your source. Osprey's Bluesky example
  (`jetstream_input_stream.py`) subscribes to a live feed and yields events; swap
  in your source and Osprey runs your rules on it. This is the better route when
  your data is not already in Kafka.

Once events are flowing, your rules evaluate each one in real time and you watch
the hits in the event stream.

### Add your own logic

- **Osprey:** write your own rule function (a UDF), a small plugin a rule can
  call, like "does this text match my pattern" or "does this image match my hash
  set."
- **Coop:** add a custom signal or plug-in integration, so Coop calls a model or
  service you already run and reads back a score.

The two case studies work here too: use them as a template, then swap in your own
data, policies, and detections.
