# TrustCon workshop: pre-workshop prep runbook

Everything that has to be true before participants arrive. Owners are marked
[you] for ROOST ops and [auto] for things the Codespace or a script handles.

The demo runs as one shared Coop Codespace (partitioned into per-table orgs) and
one shared Osprey Codespace, plus one shared, persistent Ozone labeler.
Participants follow the two CCF case studies as guides. The hosted room is
~37 non-technical participants; a separate ~13 run Coop or Osprey locally.

## Status (workshop is 2026-07-21)

Done: Ozone labeler deployed and verified (A); Coop Codespace multi-org
provisioning wired end to end (B); Osprey Codespace devcontainer plus in-app rule
authoring on the branch (C); participant guide, both 101s, and the facilitator
runbook written (F).

Remaining before the day, highest-impact first:

- [ ] **Boot the Osprey stack as an integrated whole** and prove draft to deploy to
      rule-fires (C). Biggest unproven piece.
- [ ] **Fresh-Codespace dry run of the whole Coop flow** (E); doubles as the
      capacity baseline.
- [ ] **Load-test each shared Codespace** at ~room scale (D).
- [ ] **Distribute the per-table Coop logins** and decide HMA hash population (B).
- [ ] **Turn on Codespaces prebuilds** once the setup is stable (D).
- [ ] Finalize the CCF case-study handouts and the labeler one-pager (F).

## A. Ozone labeler (shared, persistent) — DEPLOYED and verified

Live and subscribable; no steps to run. Verified end to end: a Coop action to
relay to Ozone `emitEvent` to a real signed label, served publicly.

- Labeler account: `trustcon-labeler.bsky.social` (`did:plc:5jv4bzk2pitgnypnqjdcgpom`)
- Ozone: https://trustcon-labeler.fly.dev (Fly, `sjc`) with Fly Postgres `trustcon-labeler-db`
- Labels: `bleep`, `bloop` (severity `inform`, blurs `none`); the DID doc advertises the labeler service and signing key
- Relay: `trustcon/relay` (Node), points `OZONE_URL` at the Fly labeler and only ever emits `bleep`/`bloop`, on the specific post (strong ref), never the account

Attendees subscribe by adding `trustcon-labeler.bsky.social` as a labeler in the
Bluesky app; then any Bleep/Bloop label appears in their app in real time.

The relay runs inside each Coop Codespace (Coop action to `localhost` relay to the
Fly Ozone); the seed's Bleep/Bloop actions target that local relay. The relay
needs `OZONE_URL`, `OZONE_SERVER_DID`, and the labeler admin app password in its
`.env` (a secret to distribute to facilitators, not commit).

Teardown after the workshop: `fly apps destroy trustcon-labeler trustcon-labeler-db`,
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
- [ ] **HMA hash bank is manual and per-org.** Populating it with benign images
      (chicken photos from Wikimedia Commons, via Settings then Matching Banks) is
      the stand-in for a shared TVEC hash set, but it is per-org and tedious across
      6 orgs. Optional: the scam text rules already produce queue hits from the
      backfill, so hash-match hits are a bonus. Decide whether to populate all,
      one (Team 1 for the demo), or none.
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

Still to do by hand: [you]

- [ ] **Boot the whole stack once and prove the loop.** The branch merges the rule
      authoring + enrichment cleanly and typechecks, but the full stack has never
      been started as an integrated whole. Confirm: stack comes up, event stream
      flows, and draft to validate to save to (facilitator) deploy to rule-fires
      works end to end. This is the biggest open technical risk.
- [ ] The CCF harm-amplification rules are deferred, so the Osprey case study
      isn't demonstrated yet; the demo currently runs a generic example rule.

## D. Capacity and logistics [you]

- **Audience split:** ~37 hosted (non-technical), ~13 local (technical). The two
  tools run sequentially, so each shared Codespace peaks at ~37 concurrent during
  its own segment (Coop, then Osprey), never both at once.
- **Load-test before the day (top logistics risk):** confirm one Codespace stays
  responsive with ~37 concurrent sessions of a single tool. If it thrashes, keep a
  second warm instance of that tool ready to split the room.
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

On a fresh Codespace, from a cold open, confirm:

Coop:

- [ ] Devcontainer + `setup.sh` complete without manual fixups.
- [ ] `seed-orgs` creates the orgs and writes `workshop-credentials.{md,csv,json}`.
- [ ] Each org has the CCF policies, queues (Default Queue first), the "Enqueue for
      NCMEC Review" action, and the scam rules.
- [ ] `start.sh` backfills every org's queues; scam-keyword posts show rule hits.
- [ ] Team 1 also receives live Jetstream posts, with author + other-posts context.
- [ ] The mock action path shows a call in the relay page.
- [ ] The real Ozone action places a Bleep/Bloop label visible via the Ozone UI
      (the Bluesky app may lag).

Osprey (this is the biggest unproven piece, see C):

- [ ] The full stack boots as an integrated whole; the event stream flows.
- [ ] A rule drafted in the UI validates, saves, and (once deployed) fires.

Capacity:

- [ ] The box stays responsive under concurrent use (approximate the room load).

## F. Participant materials

Done: the participant guide (`PARTICIPANT.md`, with a come-prepared checklist),
the Coop and Osprey 101s, and the facilitator runbook.

Remaining: [you]

- [ ] Finalize the two CCF case studies as the participant handout.
- [ ] Confirm the one-pager: "add an action (mock vs real Ozone)" and "subscribe
      to the workshop labeler in Bluesky."
