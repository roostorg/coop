# Sentinel (Rare Class Affinity)

[Sentinel](https://github.com/Roblox/sentinel) is Roblox's open-source contrastive-learning system for detecting rare harmful text patterns (for example, grooming) that off-the-shelf classifiers tend to miss. Instead of a fixed taxonomy, you curate your own labeled **positive** (rare/harmful) and **negative** (common/normal) example banks; Sentinel measures semantic affinity between submitted content and those banks and returns a score between 0 and 1.

Coop talks to Sentinel through a thin, self-hosted FastAPI layer — [UMass-Rescue/sentinel-api](https://github.com/UMass-Rescue/sentinel-api) — which wraps the upstream `sentinel` library. That service is deployed and versioned independently of Coop; this page covers the Coop-side integration.

## Requirements

1. **A running `sentinel-api` instance** accessible from your Coop server. See [UMass-Rescue/sentinel-api](https://github.com/UMass-Rescue/sentinel-api) for how to build and run it.
2. **Positive and negative example banks**, curated by you and loaded into that instance via its `/banks/create` or `/banks/load` endpoints. Sentinel ships with no pretrained banks of its own.
3. **A Sentinel API URL**, set per org under **Settings → Integrations → Sentinel**. The signal stays off for an org until it saves a URL.

Once connected, the **Sentinel Rare Class Affinity** signal is available in Coop's signal library for use in proactive rules.

## Configuration

In Coop, go to **Settings → Integrations → Sentinel**. Only the API URL is required; the other fields are optional.

| Field                           | If unset               |
| ------------------------------- | ---------------------- |
| API URL (`http` or `https`)     | Signal is disabled     |
| Top K                           | Sentinel's own default |
| Minimum score to consider       | Sentinel's own default |
| Thread context window (minutes) | Last 3 months          |
| Thread context limit            | `10` (at most `100`)   |

The URL must be an `http` or `https` URL. Anything else is treated as not configured. Saving a config enables Sentinel for that organization only. Each org points at its own Sentinel instance.

## Signals

**Sentinel Rare Class Affinity** scores submitted text against your configured banks:

- **0** = no meaningful affinity to the positive (rare/harmful) bank
- **Higher values** = stronger affinity. How high counts as a real signal depends on your own banks; the score is not universally calibrated.

When the submitted item has a thread, Sentinel scores the conversation rather than a single message — the patterns it is designed to catch typically span multiple messages. Prior messages in the same thread (bounded by `threadContextLimit` and/or `threadContextWindowMinutes`) are included alongside the triggering message.

Sentinel's default aggregation (skewness) needs **at least 5 non-empty text observations** before it produces a non-zero score. A single message, or a thread with fewer than 5 messages, always scores `0.0`.

## Limitations

- **No pretrained banks**: you must build and maintain your own positive/negative example banks. Detection quality depends entirely on their coverage.
- **Needs 5+ messages for conversational patterns**: single messages or short threads always score `0.0`, regardless of content.
- **Self-hosted**: there is no managed/SaaS version. You run, scale, and update the `sentinel-api` service yourself.

## Getting Sentinel running locally

This assumes Coop is already running locally — see [Getting Started](../development/README.md) if not.

1. Clone [UMass-Rescue/sentinel-api](https://github.com/UMass-Rescue/sentinel-api) next to Coop, then, from inside the clone, build and run it with a `data` folder mounted so the next step can load banks from it:

   ```bash
   mkdir -p data
   docker build -t sentinel-api .
   docker run --rm -p 8000:8000 --user "$(id -u):$(id -g)" -v "$PWD/data:/data" sentinel-api
   ```

   The first build pulls `torch` and `sentence-transformers`, so expect several minutes. See the `sentinel-api` README for configuration options.

2. Back in the Coop repo, load a bank. `/banks/create` can build one from plain text files, which is enough to verify the plumbing:

   ```bash
   mkdir -p ../sentinel-api/data/texts/{positive,negative}
   printf "can you keep this between us\n" > ../sentinel-api/data/texts/positive/1.txt
   printf "what time is the game tonight\n" > ../sentinel-api/data/texts/negative/1.txt

   curl -sX POST http://localhost:8000/banks/create -H 'Content-Type: application/json' -d '{
     "positive_folder": "/data/texts/positive",
     "negative_folder": "/data/texts/negative",
     "output_path": "/data/banks/smoke_test",
     "model_name": "all-MiniLM-L6-v2"
   }'
   ```

3. In Coop, go to **Settings → Integrations → Sentinel** and save a config with the API URL (for example `http://localhost:8000`). Coop blocks `localhost` and `127.0.0.1` in org-supplied URLs unless `ALLOW_USER_INPUT_LOCALHOST_URIS=true` is set for the server, which `server/.env.example` does for local development. If Coop itself runs in Docker, use `http://host.docker.internal:8000` instead.

## Testing the integration

Submitting test content needs an item type with text and thread fields. If you do not have one, create a `ChatMessage` content type under **Settings → Item Types → Content**, with a `message` (String), `threadId` (Related Item, role **Thread**), and `createdAt` (Datetime, role **Created At**) field.

1. Create a [proactive rule](../user/automated-enforcement.md#proactive-rules) on that item type: condition input **message** (the String field), signal **Sentinel Rare Class Affinity**, comparison **is greater than** a small threshold (for example `0.05`), and a review action of your choice. Do not use **Any text in item**. That input does not name a field, so thread history scores the first stored string, which is `createdAt`, and the score stays `0.0`.
2. Submit content via the [items API](../api/items.md) (`typeId` is the item type's ID and `data` holds its fields) or **Investigation → Submit test item**. A message resembling your positive bank should score higher than a benign one.
3. Check the result in **Investigation** by searching the submitted item's ID — the signal's raw score is shown there.

Because aggregation needs at least 5 observations, a single submission always scores `0.0`. To see a non-zero score, submit 5+ messages under the same `threadId` (a Related Item, sent as `{ "id": "...", "typeId": "..." }` with the thread's item type ID), with `createdAt` timestamps at or before the real current time. Future timestamps get filtered out of the thread-context query and silently reproduce the same `0.0` result.

If a conversation still scores `0.0`, call `sentinel-api`'s `/score` endpoint directly with the same texts. A non-zero score there points at Coop's wiring (thread field roles, org config); `0.0` there too points at the bank.

## See also

- [Automated Enforcement & Routing](../user/automated-enforcement.md)
- [UMass-Rescue/sentinel-api](https://github.com/UMass-Rescue/sentinel-api)
- [Roblox/sentinel](https://github.com/Roblox/sentinel)
