# TrustCon workshop: participant guide

You will run an end-to-end Trust & Safety workflow against real Bluesky content
using two open-source ROOST tools. No engineering background needed. Everything
runs in your browser through GitHub Codespaces.

## The two tools

- **Osprey** is a real-time rules engine. It watches a live Bluesky feed and
  fires rules as content streams in.
- **Coop** is a review tool. It turns signals into review queues, policies,
  rules, and actions, so a person can make and act on decisions.

They run as two separate Codespaces. You can work either one, in any order.

## Getting started: open your Codespace

Nothing to install. Each tool runs in a GitHub Codespace in your browser.

1. Open the Codespace link your facilitator shares (or, on the repo page,
   **Code -> Codespaces -> create a codespace on the workshop branch**).
2. Wait for it to finish setting up. The first open runs a one-time setup that
   takes a few minutes: it starts the services, seeds the demo, and launches the
   app. You can watch progress in the terminal; it is ready when it prints
   **"Setup complete."**
3. When a "port forwarded" notice appears, open the app in your browser:
   - **Coop:** port **3000**. Sign in as `admin@trustcon.local` with the
     password `trustcon`.
   - **Osprey:** port **5002** (the UI).
4. If the page is not ready yet, wait a minute (the server compiles on first
   start) and refresh. You can reopen any forwarded port from the **Ports** tab.

## Your two case studies

Both are from the Christchurch Call Foundation's CTVE 101 Toolkit, and they act
as step-by-step guides:

- **Coop, "Identifying References to the Christchurch Attack"**: detect and act
  on terrorist and violent extremist content (TVEC) using hashes, keywords, and
  a classifier, and route it to review or action.
- **Osprey, "Monitoring Harm Amplification After a TVE Incident"**: use
  behavioral signals (velocity, account age, coordination) to catch post-incident
  amplification in real time.

## In Coop

Your Codespace opens signed in, with review queues already populated with real,
benign Bluesky posts.

1. **Review.** Open a TVEC queue and triage a few items. Each shows the author's
   account and their other recent posts as context, the way a real reviewer works.
2. **Add a policy.** Create a policy in a couple of fields; it is what reviewers
   decide against.
3. **Build a rule.** Assemble a rule from a ready-made signal (keyword, hash, or
   classifier) and route matches to a queue. Watch an item land in it.
4. **Take an action.** Attach an action to a decision and run it.

## Actions: mock or real

- **Mock action:** posts to a local receiver that shows you what would have
  happened. Safe for following the guide with no outside effect.
- **Real Ozone action:** places a real, benign **Bleep** or **Bloop** label on
  the reviewed Bluesky post, through the workshop's live labeler.

## See real labels: subscribe to the labeler

In the Bluesky app or bsky.app, open
**bsky.app/profile/trustcon-labeler.bsky.social** and press **Subscribe**. Bleep
and Bloop labels you emit will show up in your app. New labels can take a few
minutes to appear while Bluesky syncs the labeler.

## In Osprey

Your Codespace opens with a live Bluesky feed flowing.

1. **Watch the stream.** See events and rule hits arrive in real time.
2. **See the graph.** Open the rules visualizer to see how a rule fits together.
3. **Author a rule.** Edit a rule file to add a watch phrase, reload, and watch
   matching posts light up. That is writing a detection in under a minute.

## Take it further (after the session)

- Run either tool locally; the Codespace is a portable starting point.
- Point Osprey at your own event stream instead of Bluesky.
- Bring your own model into Coop as a custom signal, no rewrite of the model.
