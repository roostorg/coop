# TrustCon workshop: Ozone labeler and Coop action relay

Workshop scaffolding, not production code. It lets a Coop reviewer's decision place a
real, benign label (`bleep` or `bloop`) on the reviewed Bluesky post, so participants
see a Coop action reach the live network.

This directory is separate from the Coop app. Nothing here runs inside the Coop server.

## How it fits together

```
reviewer decides in Coop
        │  Coop fires a CUSTOM_ACTION webhook (signed, coop-signature header)
        ▼
  relay/  (index.mjs)
        │  reads item.id (at:// uri) + custom.labelVal (bleep|bloop)
        │  resolves the post CID from the public AppView
        │  calls tools.ozone.moderation.emitEvent (#modEventLabel) as an admin
        ▼
  Ozone labeler  (self-hosted)
        │  signs and serves the label
        ▼
  attendee subscribed to the labeler DID sees Bleep/Bloop in the Bluesky app
```

Only `item.id` survives Coop's webhook body, so the seed sets each item's id to the
post's `at://` URI. The label value rides in the action's `callbackUrlBody` as
`labelVal`. The relay labels the specific post (strong ref), not the whole account.

## Contents

- `relay/index.mjs` — the relay service (Node, ESM). Also serves a page at `/` listing
  the last few actions it received, as an in-Codespace confirmation.
- `relay/package.json`, `relay/.env.example` — relay deps and config.
- `ozone/publish-labeler-record.mjs` — declares the `bleep`/`bloop` label values on the
  labeler account (run once).
- `ozone/.env.example` — Ozone service env and the service-account creds for the publish script.

## Dependency approval

`relay/package.json` adds `@atproto/api`. Per Coop's AGENTS.md, a new dependency needs
human approval (license and CVE check) before install. Do not `npm install` here until
that is signed off. `@atproto/api` is MIT.

## One-time deploy checklist (manual, requires accounts and a host)

1. Create a dedicated Bluesky **labeler service account** (not a personal account). Note
   its DID and handle.
2. Stand up a host with a public IPv4, DNS name, and ports 80/443 (2 GB RAM, 2 CPU,
   40 GB SSD is enough).
3. Generate the secp256k1 signing key (command is in `ozone/.env.example`).
4. Deploy Ozone with its official `compose.yaml`
   (https://github.com/bluesky-social/ozone, HOSTING.md), filling in `ozone/.env`.
5. Announce the service from the Ozone UI (registers the DID doc and labeler record).
6. Run the label declaration once:
   `SERVICE_IDENTIFIER=... SERVICE_APP_PASSWORD=... node ozone/publish-labeler-record.mjs`
7. Create an **app password** for the admin account and fill `relay/.env`.
8. Deploy the relay (`cd relay && npm install && npm start`) at a URL Coop can reach.
9. Publish the labeler DID/handle so attendees can subscribe in the Bluesky app before
   the session.

Steps marked VERIFY-AT-DEPLOY in `relay/index.mjs` (login and proxy wiring) should be
confirmed against the live Ozone once it is up.

## Coop seed wiring (done by the seed, listed here for reference)

- Item type `BlueskyPost`; each seeded item's `id` is the post's `at://` URI.
- Two `CUSTOM_ACTION` webhook actions, `Emit Bleep` and `Emit Bloop`, each with
  `callbackUrl = <relay>/label` and `callbackUrlBody = { "labelVal": "bleep" }` (or
  `bloop`). Their `itemTypeIds` include `BlueskyPost` and they are not in the queue's
  `hiddenActionIds`, so reviewers can pick them.

## Guardrails

- The relay only ever emits values in `ALLOWED_LABELS` (default `bleep,bloop`). Anything
  else is rejected.
- Labels declare `severity: inform`, `blurs: none`, so they hide nothing and carry no
  warning.
- Labels target the specific post, not the account.
- Teardown: after the workshop, negate the labels (emit `#modEventLabel` with
  `negateLabelVals`) on the labeled subjects. A teardown script is a TODO.
