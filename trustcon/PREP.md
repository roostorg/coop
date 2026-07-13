# TrustCon workshop: pre-workshop prep runbook

Everything that has to be true before participants arrive. Owners are marked
[you] for ROOST ops and [auto] for things the Codespace or a script handles.

The demo runs as two independent Codespaces (Coop and Osprey) plus one shared,
persistent Ozone labeler. Participants follow the two CCF case studies as guides.

## Timeline

- Days 1-2: deploy the Ozone labeler; confirm the labeler DID is subscribable.
- Days 2-4: Coop Codespace end to end (devcontainer, org, CCF seed, HMA bank).
- Days 3-5: Osprey Codespace on Jetstream.
- Days 5-6: participant one-pager, capacity check.
- Day 7: full dry run on fresh Codespaces.

## A. Ozone labeler (shared, persistent) [you]

The labeler emits benign Bleep/Bloop labels on real Bluesky posts when a Coop
reviewer takes the real-action path. It is hosted once, ahead of time, not
inside the ephemeral Codespaces. Scripts and env templates live in
`trustcon/ozone/` and `trustcon/relay/`; the full deploy checklist is in
`trustcon/README.md`. Summary:

1. Create a dedicated Bluesky **service account** for the labeler. Note its DID.
2. Stand up a host with a public IP, DNS name, and TLS (2 GB RAM is enough).
3. Generate the secp256k1 signing key (command in `trustcon/ozone/.env.example`).
4. Deploy Ozone with its official compose (github.com/bluesky-social/ozone).
5. Announce the service from the Ozone UI (publishes the labeler record).
6. Declare the two label values once:
   `SERVICE_IDENTIFIER=... SERVICE_APP_PASSWORD=... node trustcon/ozone/publish-labeler-record.mjs`
7. Deploy the relay (`cd trustcon/relay && npm install && npm start`) at a URL
   the Coop Codespaces can reach; fill `trustcon/relay/.env` with the admin
   app password and the labeler DID.
8. **Publish the labeler DID/handle to attendees** a few days early so they can
   subscribe in the Bluesky app and watch labels land live.

Guardrail: the relay only ever emits `bleep`/`bloop`, and only on the specific
post (strong ref), never the account. Plan the post-event teardown (section D).

## B. Coop Codespace

The devcontainer (`.devcontainer/`) handles the deterministic bring-up on open:
env files, backing services, dependency installs, staging migrations (which
seed the atproto item types), and the production client build. [auto]

After it finishes, run the remaining steps once (they are printed by the setup
script too):

1. Create the demo org: `npm run create-org -- --name "TrustCon Demo" --email admin@trustcon.local --website https://example.com --firstName Demo --lastName Admin --password CHANGE_ME` [you]
2. Seed the CCF TVEC demo: `(cd server && npm run seed-trustcon -- --org-id <ORG_ID> --relay-url <RELAY_URL>)` [you]
3. Turn on ingestion: set `INGEST_ORG_ID=<ORG_ID>` (and `INGEST_API_KEY`) in `server/.env` [you]
4. Start the app: `npm run server:start` (client on :3000, GraphQL on :8080) [auto/you]
5. Populate the HMA hash bank with benign images (chicken photos from Wikimedia
   Commons) via Settings, then Matching Banks. This is the stand-in for a shared
   TVEC hash set. [you]

Everything the seed creates is attributed to the Christchurch Call Foundation.

## C. Osprey Codespace [you, next]

Osprey opens in its own Codespace, ingesting live Bluesky Jetstream, so
participants watch behavioral rules fire against real content. Devcontainer and
prebuild to be added next; it wraps Osprey's existing docker stack and the
Jetstream input plugin.

## D. Capacity and logistics [you]

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

## E. Dry run (day 7) [you + me]

On a fresh Codespace, from a cold open, confirm:

- [ ] Devcontainer completes without manual fixups.
- [ ] Org create + CCF seed succeed; the two TVEC queues and both label actions exist.
- [ ] Jetstream ingestion populates the queues with real posts.
- [ ] A review job shows the author account and the author's other posts.
- [ ] The mock action path shows a call in the relay page.
- [ ] The real Ozone action places a Bleep/Bloop label visible in the Bluesky app.
- [ ] Osprey Codespace shows rules firing on Jetstream.

## F. Participant materials [me, next]

- The two CCF case studies, finalized as the participant handout.
- A one-pager: "add an action (mock vs real Ozone)" and "subscribe to the
  workshop labeler in Bluesky."
