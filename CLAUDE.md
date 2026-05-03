# COOP (Content Operations & Oversight Platform)

ROOST's moderation review tool. Being evaluated for Divine's moderation review surface.

## Cross-Repo Coordination

This repo is **Layer 4** (review surface evaluation) in the auto-hide evolution plan. Read the coordination doc at session start:
`~/code/support-trust-safety/docs/moderation/auto-hide-evolution-plan.md`

When you make decisions or discover constraints that affect other layers, update that doc and flag it for the user.

## Evaluation Goals

1. Get COOP running locally
2. Define Divine Item Types: map Nostr events to COOP Content Items, pubkeys to User Items
3. Wire COOP Actions to relay-manager RPC endpoints (ban, restrict, allow)
4. Bridge Osprey verdicts into COOP item submissions (flag_for_review creates review job)
5. Assess NCMEC CyberTipline integration feasibility (requires ESP registration)

## Key capabilities to evaluate

- Manual Review Tool (queues, routing, job assignment, decisioning)
- NCMEC CyberTipline integration (hash matching, review queue, CyberTip submission)
- Signals framework (pluggable classifiers)
- Actions system (calls external APIs to execute decisions)
- User strike system and appeals
- Plugin architecture for custom integrations
