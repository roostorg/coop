# TrustCon workshop: pre-workshop prep runbook

Everything that has to be true before participants arrive. Owners are marked
[you] for ROOST ops and [auto] for things the Codespace or a script handles.

The demo runs as one shared Coop Codespace (partitioned into per-table orgs) and
one shared Osprey Codespace, plus one shared, persistent Ozone labeler.
Participants follow the two CCF case studies as guides. The hosted room is
~37 non-technical participants; a separate ~13 run Coop or Osprey locally.

## Status (workshop is 2026-07-21)

Done: Ozone labeler and relay deployed and verified (A); Coop Codespace multi-org
provisioning wired and dry-run on a fresh Codespace end to end (B, E); Osprey
Codespace devcontainer plus in-app rule authoring on the `trustcon` branch,
booted as an integrated whole and proven draft to validate to deploy to
rule-fires against live Jetstream (C); both shared Codespaces load-tested at ~37
concurrent and cleared it (D); participant guide, both 101s, and this runbook
written (F).

Remaining before the day, highest-impact first:

- [ ] **Distribute the per-table Coop logins** and decide HMA hash population (B).
- [ ] **On the day: set the Osprey Codespace's 5002 + 5004 ports to Public**, and
      confirm Kafka + the worker are healthy so recent events are flowing (C).
- [ ] **Turn on Codespaces prebuilds** once the setup is stable (D).
- [ ] Finalize the CCF case-study handouts and the labeler one-pager (F).

## Day-of bring-up (quick reference)

Both shared Codespaces open from the `trustcon` branch and self-provision via
their devcontainer. Open each about 30 minutes before the room so images pull and
seeds run in advance.

**Coop** (roostorg/coop, `trustcon`, 4-core / 16 GB):

1. Open the Codespace. `setup.sh` runs migrations, seeds 6 orgs with the CCF
   config, backfills every queue with sample posts, and starts the server plus the
   client. First open takes several minutes.
2. The client is served on port 3000 (via `vite preview`) and the API on 8080.
   Open the port-3000 URL.
3. Copy `server/workshop-credentials.md` out and give each table its org's logins.
   Shared password is `trustcon`; emails are `<role>.team<N>@trustcon.local`
   (roles `admin`, `moderator`, `analyst`, `rules-manager`, `moderator-manager`;
   teams 1 to 6).

**Osprey** (roostorg/osprey, `trustcon`, 16 GB):

1. Open the Codespace. `setup.sh` brings up the full Druid, Kafka, worker, and UI
   stack against live Jetstream. First open takes several minutes (Druid is slow).
2. **Set ports 5002 (UI) and 5004 (UI API) to Public** in the Ports panel
   (right-click the port, Port Visibility, Public), so attendees' browsers reach
   them.
3. Open the port-5002 URL. The Event stream should show live posts and the Rules
   page should load. There is no login (shared super-user).
4. If the UI shows "Failed to load initial application config", or Kafka is
   unhealthy, see section C.

## A. Ozone labeler (shared, persistent): DEPLOYED and verified

Live and subscribable; no steps to run. Verified end to end: a Coop action to
relay to Ozone `emitEvent` to a real signed label, served publicly.

- Labeler account: `trustcon-labeler.bsky.social` (`did:plc:5jv4bzk2pitgnypnqjdcgpom`)
- Ozone: https://trustcon-labeler.fly.dev (Fly, `sjc`) with Fly Postgres `trustcon-labeler-db`
- Labels: `bleep`, `bloop` (severity `inform`, blurs `none`); the DID doc advertises the labeler service and signing key
- Relay: `trustcon/relay` (Node), points `OZONE_URL` at the Fly labeler and only ever emits `bleep`/`bloop`, on the specific post (strong ref), never the account

Attendees subscribe by adding `trustcon-labeler.bsky.social` as a labeler in the
Bluesky app; then any Bleep/Bloop label appears in their app in real time.

**One shared relay, deployed** (`trustcon/relay`, has a Dockerfile + fly.toml).
Both the Coop action and the Osprey label sink post to it, so the labeler admin
secret lives in one place (Fly), not in every Codespace, and the callback URL is
a realistic hosted one. Deploy + wire it once: [you]

1. `cd trustcon/relay && fly deploy` (app `trustcon-relay`).
2. `fly secrets set -a trustcon-relay OZONE_URL=https://trustcon-labeler.fly.dev`
   `OZONE_SERVER_DID=did:plc:5jv4bzk2pitgnypnqjdcgpom ADMIN_IDENTIFIER=<admin>`
   `ADMIN_APP_PASSWORD=<secret> ADMIN_DID=<admin did> RELAY_TOKEN=<random>`
3. Set Codespaces secrets so fresh Codespaces pick them up:
   - roostorg/coop: `RELAY_URL=https://trustcon-relay.fly.dev`, `RELAY_TOKEN=<same>`
   - roostorg/osprey: `OZONE_RELAY_URL=https://trustcon-relay.fly.dev`, `OZONE_RELAY_TOKEN=<same>`

The relay's `/label` requires `Authorization: Bearer <RELAY_TOKEN>`; Coop sends it
via the action's callbackUrlHeaders and Osprey via the sink, so all three share
the one token. A local relay with no `RELAY_TOKEN` stays open for dev.

Teardown after the workshop: `fly apps destroy trustcon-labeler trustcon-labeler-db trustcon-relay`,
revoke the Fly token, and negate any labels left on real posts (section D).

## B. Coop Codespace (one shared, multi-org)

One shared Coop Codespace serves the hosted room, partitioned into per-table orgs
so teams don't clobber each other's config. The devcontainer does the full
bring-up on open, with no manual create-org/seed steps anymore: [auto]

- env files, backing services, staging migrations, production client build;
- `seed-orgs` creates the orgs (default 6; set `WORKSHOP_ORGS` to change), each
  with a 5-person team across the built-in roles (`ADMIN`, `RULES_MANAGER`,
  `MODERATOR_MANAGER`, `MODERATOR`, `ANALYST`), and seeds the CCF config into each;
- Team 1 gets the live Jetstream connector; `start.sh` runs a one-time backfill of
  sample posts (some crafted to trip the seeded scam rules) into every org once
  the server is up, so every table opens to populated queues with rule hits.

Everything the seed creates is attributed to the Christchurch Call Foundation.

Still to do by hand: [you]

- [ ] **Distribute logins by table.** The run writes `server/workshop-credentials.md`
      (and `.csv`) with each org's ID, API key, and per-user logins (shared password
      `trustcon`). It is gitignored, so copy it out and give each table its own org.
- [ ] **Populate the HMA hash bank (optional, per-org).** The seed creates the
      benign bank empty; there is no in-app image upload. Fill it with the bundled
      pigeon photos (`trustcon/benign images/`) via
      `npm run seed-hash-bank-images -- --all` (or `--org-id <id>` for just Team 1),
      with the HMA service up. This is the stand-in for a shared TVEC hash set;
      the scam text rules already produce queue hits from the backfill, so
      hash-match hits are a bonus. Decide whether to populate all, one, or none.
- [ ] **Start the relay** if using the real Ozone action (needs the labeler admin
      secret; see A).

## C. Osprey Codespace (one shared)

One shared Osprey Codespace serves the hosted room, ingesting live Bluesky
Jetstream so participants watch rules fire against real content. The devcontainer
lives on the `trustcon` branch of roostorg/osprey and wraps Osprey's docker stack
plus the Jetstream input plugin (auto-detects Jetstream vs synthetic). The branch
also carries in-app rule authoring (PRs #402 + #403, merged in): participants
draft a rule in the browser, validate it against the live engine, and save it. [auto]

Facilitator facts:

- **No login.** Osprey's demo build has no accounts; every browser session is the
  same shared super-user, so all rule drafts and saved queries are shared.
- **Facilitator deploys.** Participants draft + validate + save freely; the
  facilitator does the single Deploy (it writes a shared file, so simultaneous
  deploys collide). Ask people to use distinct rule names.

Proven end to end: the full stack boots as an integrated whole, the event stream
flows live, and draft to validate to save to (facilitator) deploy to rule-fires
works. Two config fixes are on the branch so a fresh Codespace serves ~37
concurrent authors: the UI API runs 4 gunicorn workers (a single worker
serialized the room into errors under load), and the UI points at the forwarded
API URL automatically when it detects a Codespace.

Still to do by hand: [you]

- [ ] **Set ports 5002 + 5004 to Public** on the shared Codespace (Ports panel,
      right-click, Port Visibility, Public). The browser reaches the API
      cross-origin this way; without it the UI shows "Failed to load initial
      application config".
- [ ] **Confirm Kafka and the worker are healthy** so recent events are flowing
      (the Event stream defaults to a recent window, which is empty if ingestion
      stopped). Kafka has no persistent volume, so after a Codespace restart it can
      come up unhealthy and block the worker and UI API. Recover with:
      `docker compose up -d --force-recreate --no-deps osprey-kafka`, wait for it
      to report healthy, then `bash run-atproto.sh up -d`.
- [ ] Keep attendees on **recent, short time windows** in the Event stream. The
      raw event-list scan over very large windows is the one slow path under heavy
      concurrency (see D); recent windows are fast.
- [ ] The CCF harm-amplification rules are deferred, so the Osprey case study
      isn't demonstrated yet; the demo currently runs a generic example rule.

## D. Capacity and logistics [you]

- **Audience split:** ~37 hosted (non-technical), ~13 local (technical). The two
  tools run sequentially, so each shared Codespace peaks at ~37 concurrent during
  its own segment (Coop, then Osprey), never both at once.
- **Load-test done: one box is enough for each tool, no second instance needed.**
  At ~37 concurrent on a 4-core / 16 GB Codespace:
  - **Coop** cleared it with wide margin (37 users browsing queues plus concurrent
    policy and rule writes; p95 well under a second, no errors), including a 2x
    stress run.
  - **Osprey** cleared the real workshop load (37 people authoring and validating
    rules and queries, p95 under 400ms, no timeouts) once the UI API runs 4
    gunicorn workers. The one slow path is the raw event-list scan over very large
    time windows under heavy concurrency, which is a property of the single
    embedded Druid, not the box; it is not the workshop activity, so keep
    attendees on recent windows.
- **Machine size:** 4-core / 16 GB minimum per Coop Codespace. The Coop stack
  (Postgres, ClickHouse, Scylla, Redis, HMA) is memory-heavy; a 2-core / 8 GB
  machine will thrash. Confirm your org allows the 16 GB machine type.
- **Prebuilds:** enable Codespaces prebuilds on the `trustcon` branch so first
  open is fast for a room. Without it, the initial `npm install` + client build
  runs live per participant.
- **Quota and billing:** a full room launching at once consumes Codespaces core
  hours and storage against the org. Confirm the quota and who is billed before
  the session.
- **Teardown:** after the workshop, negate the labels applied to real posts
  (emit `#modEventLabel` with `negateLabelVals`) so no stranger keeps a demo
  label. A teardown script is a TODO in `trustcon/README.md`.

## E. Dry run [you + me]

Ran on a fresh Codespace from a cold open; results below.

Coop (dry run passed 2026-07-16):

- [x] Devcontainer + `setup.sh` complete without manual fixups (caught and fixed
      one bug: the built client is now served on port 3000 via `vite preview`).
- [x] `seed-orgs` creates the orgs and writes `workshop-credentials.{md,csv,json}`.
- [x] Each org has the CCF policies, queues (Default Queue first), the "Enqueue for
      NCMEC Review" action, and the scam rules.
- [x] `start.sh` backfills every org's queues; scam-keyword posts show rule hits.
- [x] Team 1 also receives live Jetstream posts, with author + other-posts context.
- [x] The real Ozone action places a Bleep/Bloop label (verified end to end via the
      relay and `queryLabels`; the Bluesky app AppView may lag a few minutes).

Osprey (proven end to end, see C):

- [x] The full stack boots as an integrated whole; the event stream flows live.
- [x] A rule drafted in the UI validates, saves, and (once deployed) fires on live
      Bluesky posts.

Capacity:

- [x] Both boxes stay responsive at ~37 concurrent for their own tool (see D).

## F. Participant materials

Done: the participant guide (`PARTICIPANT.md`, with a come-prepared checklist),
the Coop and Osprey 101s, and the facilitator runbook.

Remaining: [you]

- [ ] Finalize the two CCF case studies as the participant handout.
- [ ] Confirm the one-pager: "add an action (mock vs real Ozone)" and "subscribe
      to the workshop labeler in Bluesky."
