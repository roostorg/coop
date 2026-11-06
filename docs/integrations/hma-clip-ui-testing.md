# Testing CLIP through the Coop UI

This guide walks through the whole CLIP feature as an organization admin would use it: create a bank, add images to it, write a rule, submit images, and see the matching one arrive in the review queue. It takes about 20 minutes, most of it waiting for HMA to index the bank. For a quick terminal-only check of HMA with CLIP, use `hma/clip/smoke-test.sh` instead (see [HMA with CLIP](hma-clip.md#check-that-it-works)).

## Before you start

- HMA is running the CLIP-enabled image and `HMA_CLIP_ENABLED=true` is set in `server/.env` (see [HMA with CLIP](hma-clip.md#build-and-run)). The seed script in step 3 reads the same file, so setting the variable only on the command that starts the server is not enough. The UI is at `http://localhost:3000` and the API at `http://localhost:8080` in a local setup.
- You can sign in as an admin of an organization.
- You have this repository checked out. The fixture images are in `hma/clip/fixtures/`: `bank/scene.jpg` (a red house with a sun) goes into the bank. Five images in `probe/` are submitted to test it: three edited copies of the house that should match (`scene-resized.jpg`, `scene-desaturated.jpg`, `scene-blurred.jpg`, scoring about 0.985, 0.959 and 0.936), and two images that should not (`other-building.jpg`, a lit tower at night, and `other.jpg`, coloured dots).
- The server is built (`server/transpiled/` exists after `pnpm start`), because the seed script is run from it.

## 1. Check that CLIP is on

There is nothing to switch on in the UI. With `HMA_CLIP_ENABLED=true`, the **Image similarity (CLIP)** signal is usable in the rule builder (step 5). If it shows as disabled, the server was started without the variable.

## 2. Create a bank

1. Go to **Automated Enforcement, Matching Banks** and create a new hash bank.
2. Name it `CLIP UI test`, leave **Enabled Ratio** at 1, and save. Enabled Ratio is the share of lookups that actually search the bank: a lower value skips the bank for the rest, so some matches are silently missed and nothing is logged.

## 3. Add the fixture image to the bank

The script needs your organization id, which the UI does not show. In a local setup, read it from the database (the container is named for your Compose project, so `docker compose exec postgres` also works):

```bash
docker exec <postgres container> psql -U postgres -c "select id, name from public.orgs"
```

Then, from the `server` directory:

```bash
node --env-file-if-exists=.env transpiled/bin/seed-clip-bank.js \
  --org <orgId> --bank "CLIP UI test" --dir ../hma/clip/fixtures/bank --dry-run
```

`--dry-run` lists what would be added: `scene.jpg  would add`. Run it again without `--dry-run` to add the image. Expected output:

```
Bank "CLIP UI test" (COOP_..._CLIP_UI_TEST)
  scene.jpg  added (HMA content id 1)
1 added, 0 failed
```

If you prefer `pnpm run seed-clip-bank` with the same arguments, that works where ts-node starts. HMA builds its search index on a timer, so matching starts working within about 3 minutes.

## 4. Create an item type with an image field

1. Go to **Settings, Item Types** and create an item type.
2. Name it `clip_ui_test`, make it a **Content** type, and add one field named `image` of type **Image**.
3. Save, and note the item type's id (shown in the list or in the URL of its edit page).

## 5. Create a rule

1. Go to **Automated Enforcement, Proactive Rules** and create a rule.
2. Name it `CLIP UI test rule` and choose the item type `clip_ui_test`.
3. Add a condition on the `image` field: the signal **Image similarity (CLIP)**, comparator **is greater than or equal to**, threshold **0.95**, with the bank `CLIP UI test`. The bank picker is the dropdown with the placeholder "Select media bank(s)". It only appears once you have chosen both an image input and the CLIP signal.
4. Set the action to **Enqueue Item to Manual Review**, and set the rule to **Live**. Rules are cached, so wait about 30 seconds before you submit images in step 7. Images submitted sooner can be checked against the old version of the rule.

## 6. Make sure a review queue exists

The rule's action sends items to the organization's default review queue, and the item is dropped if there is none. Open **Review Console, Queues**. If there is no queue, create one (the first queue is the default). Admins already see every queue, so nothing more is needed. If you review as a non-admin user, make sure that user is a reviewer on the queue (under Manage Access).

## 7. Submit the images

Create an API key under **Settings, API Keys** if you do not have one. Serve the probe images from this machine. This command works from any directory:

```bash
python3 -m http.server 8765 --bind 0.0.0.0 --directory "$(git rev-parse --show-toplevel)/hma/clip/fixtures/probe"
```

Leave it running and watch its log: each image should be requested with `200`. A `404` means it is serving the wrong directory.

**Pick an image host that three things can reach.** The image URL is fetched by the HMA containers (to hash the image), and later loaded by your browser when you open the item in the review console. `host.docker.internal` resolves inside Docker containers, but often not in your browser or shell on the host. Check before submitting: open `http://<host>:8765/scene-resized.jpg` in your browser. If it loads, use that host. If not, use your machine's address (on a Mac, `ipconfig getifaddr en0`), or add `127.0.0.1 host.docker.internal` to `/etc/hosts` (this changes a system file, so only do it if you are comfortable with that). If the browser cannot load the URL, matching still works, but the review console shows "Image failed to load".

In a second terminal, set the host and submit all five images. Each call prints the HTTP status:

```bash
IMAGE_HOST=host.docker.internal   # or your machine's address
RUN=1                             # change this number to submit the images again
for NAME in scene-resized scene-desaturated scene-blurred other-building other; do
  curl -s -o /dev/null -w "$NAME: %{http_code}\n" -X POST http://localhost:8080/api/v1/items/async/ \
    -H "X-API-KEY: <your key>" -H 'Content-Type: application/json' \
    -d "{\"items\":[{\"id\":\"clip-ui-$NAME-$RUN\",\"typeId\":\"<item type id>\",\"data\":{\"image\":\"http://$IMAGE_HOST:8765/$NAME.jpg\"}}]}"
done
```

`202` means Coop accepted the items for processing, nothing more. The hashing and the rule run afterwards in the background, so a problem such as an unreachable image never shows up in this response. It shows up in the file server's log and in what arrives in the queue. To submit the images again, change `RUN` so the item ids are new (`clip-ui-scene-resized-2`, and so on). Resubmitting the same ids is a resubmission of the same items, not new ones.

## 8. Check the result

Sign in as a user of the same organization that owns the API key, then open **Review Console, Queues**. A queue cannot be opened from the Queues table. The **Pending Jobs** column shows how many items are waiting, and **Start Reviewing** opens them one at a time. To see the whole list without reviewing, turn on **Enable Preview Jobs View** under Settings, Settings, Review Console, and then use **Preview Jobs** on the queue. (If your instance has several organizations, a different one may have old jobs of its own.) After a few seconds you should see exactly two items: `clip-ui-scene-resized-1` and `clip-ui-scene-desaturated-1` (with `RUN=1`). Open an item to see its image. The queue does not show scores. The expected scores are about 0.985 and 0.959, measured on a CPU instance; scores can differ by a few thousandths on other hardware, so the desaturated copy (0.959 against the 0.95 threshold) is the closest call. The table printed by `hma/clip/smoke-test.sh` shows the scores on your machine.

Three images should not be there:

- `clip-ui-scene-blurred-1` is a match, but its expected score of about 0.936 is below the rule's threshold of 0.95.
- `clip-ui-other-building-1` and `clip-ui-other-1` are not close enough to the bank image for any score.

To see the threshold at work, edit the rule and lower it to 0.90, then submit the blurred copy again with a new item id (`clip-ui-scene-blurred-2`). It now arrives in the queue. A threshold can only tighten the match, not loosen it, so lowering it below 0.90 changes nothing.

If nothing arrives after a minute, see "If it does not work" below.

## Other things worth checking

- **A bank works with other image signals too.** In the rule editor, change the condition's signal to a PDQ image signal. The bank stays selected, because HMA hashed the fixture image with PDQ as well as CLIP.
- **Turning CLIP off.** Remove `HMA_CLIP_ENABLED` from `server/.env` and restart the server. The **Image similarity (CLIP)** signal shows as disabled in the rule builder, and `CLIP UI test rule` keeps running but reports "CLIP is not available" for each item, so move it to Draft first. Submitted images no longer get an embedding.
- **Only a CLIP deployment can use it.** Without `HMA_CLIP_ENABLED`, the CLIP signal is shown as disabled, with a pointer to the guide.

## If it does not work

- **Nothing arrives in the queue.** Check that the organization has a review queue and, for a non-admin user, that the user is a reviewer on it (step 6), that `HMA_CLIP_ENABLED=true` is set and the server was restarted, that the rule is Live (a rule left in Draft fails silently: nothing is logged and nothing is enqueued), and that it uses a threshold at or below the 0.985 the resized image scores, and that the bank was seeded (step 3 printed `1 added`). HMA needs up to 3 minutes after seeding before it can match. A lookup before then finds nothing.
- **The images were never fetched, or the queue shows only items without a CLIP match.** An item whose image could not be fetched is still processed, but it has no CLIP embedding, so the rule cannot match it. The file server's log shows whether each image was requested and with what status (`404` means wrong directory, no request at all means the HMA containers cannot reach your image host). Fix the host, then submit again with a new `RUN` number.
- **The review console says "Image failed to load".** Your browser cannot load the image URL. See "Pick an image host" in step 7. This does not affect matching.

## Clean up

Stop the `python3 -m http.server` process. In the UI, set the rule to Draft or delete it, delete the item type if you made it only for this test, and delete the bank `CLIP UI test` (this removes its images from HMA). Items already in the review queue can be decided or ignored.
