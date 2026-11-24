# HMA with CLIP (semantic image matching)

[HMA](hma.md) hashes images with PDQ, which finds near-duplicates of a known image: the same picture, resized, cropped or re-encoded. [CLIP](https://github.com/mlfoundations/open_clip) embeddings instead capture what an image depicts, so visually different images of the same subject can be close to each other. This guide shows how to run HMA with the CLIP signal and how to turn on the matching signal in Coop.

CLIP is optional and is not part of the default setup. It makes HMA much heavier (a vision model in memory, a larger image, and slower hashing), so Coop's `docker-compose.yaml` still runs the stock HMA, and nothing changes for you unless you follow this guide.

> [!NOTE]
> This page covers building and running HMA with CLIP, pointing Coop at it, and what Coop does with it when images are submitted. The CLIP-enabled image is built from `hma/clip/` and is used only by this guide.

## How it fits together

There is one HMA. The CLIP image is the stock HMA image plus the CLIP signal, so it keeps hashing with PDQ and MD5 and hashes each photo with CLIP too. HMA's banks are not tied to a signal type: when an image is added to a bank, HMA hashes it with every signal it has enabled, so a bank holds PDQ and CLIP hashes side by side, and the signal a rule uses decides which one is compared.

On the Coop side, an operator setting, `HMA_CLIP_ENABLED`, says that the HMA Coop talks to computes CLIP embeddings. Without it Coop ignores CLIP entirely, even if HMA returns it.

## System requirements

HMA with CLIP loads a vision model into memory, which is much heavier than stock HMA.

| Resource | Guidance                                                                                                                                                                                                                                                                                           |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Memory   | Plan for 4 GiB or more for the HMA container. One CPU container used about 2.5 GiB after hashing a few images (measured on Docker Desktop with Apple silicon); treat it as a floor, not a sizing guide.                                                                                            |
| Disk     | The image is about 3.9 GB (as built), against about 1.3 GB for stock HMA, because PyTorch and the CLIP model weights (about 1.4 GB) are large. The weights are built into the image.                                                                                                               |
| Network  | Outbound access to GitHub, the PyTorch wheel index and Hugging Face at build time. The CLIP model is fetched at a pinned revision during the build, and the running container needs no access to Hugging Face.                                                                                     |
| GPU      | Optional. Hashing is much faster on an NVIDIA GPU; CPU works and is fine for development. GPU needs Linux with an NVIDIA driver and the [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html). macOS can't pass a GPU to Docker. |

Because every photo is hashed with CLIP too, hashing is slower for every image your deployment receives, whether or not a rule uses CLIP.

## Build and run

Build the image from the repository root. It is the stock HMA image (the same digest-pinned release as `hma/Dockerfile`) with PyTorch and the CLIP signal added:

```bash
docker build -f hma/clip/Dockerfile -t hma-clip hma
```

The first build downloads PyTorch and takes several minutes. Run `hma-clip` in place of the stock `hma` service, with the same environment and database. With Coop's Compose file, an override does this:

```bash
docker compose -f docker-compose.yaml -f hma/clip/docker-compose.clip.yaml up -d --build hma
```

The override only swaps the image (built as `coop-hma-clip`, so the stock `hma` image is untouched); HMA stays on port 9876 and keeps its database, so existing banks are kept. If you later run `docker compose up hma` without the override, Compose goes back to the stock image. Check that the CLIP signal is enabled:

```bash
curl -s http://localhost:9876/c/signal_type
```

The list should include `{"enabled_ratio": 1.0, "name": "clip_float"}`.

### Before using it in production

The image uses the same entrypoint and configuration as the stock `hma` service, which are set up for local development. For a real deployment:

- **Keep HMA on a private network.** HMA has no authentication, and one HMA holds the banks of every organization and the credentials of any exchange you connected (for example NCMEC), so anyone who can reach it can read or delete the banks and read or replace the credentials. Only Coop's servers should be able to connect. The stock Compose file publishes HMA's port 9876 on all interfaces and the entrypoint runs Flask's development server in debug mode, so on a shared machine bind the port to `127.0.0.1` or remove the `ports` mapping.
- **Set `HMA_ALLOWED_HOSTNAMES`** to the hosts your images are served from. HMA fetches whatever URL it is given (including following redirects), so without it anything that can reach HMA can make it request internal addresses. The value is a comma-separated list of hostnames, subdomains included, for example `HMA_ALLOWED_HOSTNAMES=images.example.com`. When empty, any http(s) URL is allowed. The list is checked against the initial URL only, so an allowed host that redirects elsewhere is still followed, and `github.com` and `raw.githubusercontent.com` are always allowed.
- **Change the database password.** The compose files use the development password.
- **Treat embeddings like the images they came from.** An embedding stored with an item (about 4 KB per image) is derived from the image, so give it the same retention and access rules.

### Enable a GPU

1. Check your driver and CUDA version with `nvidia-smi`.
2. Uncomment the `deploy` block under `hma` in `hma/clip/docker-compose.clip.yaml`.
3. Rebuild with the PyTorch build for your CUDA version. Each CUDA index carries different PyTorch versions, so pass all three values. These are the newest versions available on each index; GPU builds have not been tested, only the CPU default, and the CUDA wheels in this table are for x86_64 Linux:

   | CUDA      | `PYTORCH_CUDA` | `TORCH_VERSION` | `TORCHVISION_VERSION` |
   | --------- | -------------- | --------------- | --------------------- |
   | 12.8+     | `cu128`        | `2.11.0`        | `0.26.0`              |
   | 12.6-12.7 | `cu126`        | `2.14.1`        | `0.29.1`              |
   | 12.4-12.5 | `cu124`        | `2.6.0`         | `0.21.0`              |
   | 11.x      | `cu118`        | `2.7.1`         | `0.22.1`              |

   ```bash
   PYTORCH_CUDA=cu128 TORCH_VERSION=2.11.0 TORCHVISION_VERSION=0.26.0 \
     docker compose -f docker-compose.yaml -f hma/clip/docker-compose.clip.yaml build --no-cache hma
   docker compose -f docker-compose.yaml -f hma/clip/docker-compose.clip.yaml up -d hma
   ```

4. Confirm the container sees the GPU:

   ```bash
   docker compose -f docker-compose.yaml -f hma/clip/docker-compose.clip.yaml exec hma python -c "import torch; print(torch.cuda.is_available())"
   ```

   To go back to CPU, comment the `deploy` block out again and rebuild without those three variables.

## Point Coop at it

Coop keeps using `HMA_SERVICE_URL` to reach HMA. Tell it that this HMA computes CLIP by setting `HMA_CLIP_ENABLED` in `server/.env`, then restart the Coop server:

```bash
HMA_CLIP_ENABLED=true
```

Set it only if you deployed the CLIP-enabled image. With the flag on, Coop stores a CLIP embedding on each submitted image and the **Image similarity (CLIP)** signal can be used in rules. With it unset, CLIP is ignored, and the signal still appears in the rule builder but is disabled, with a pointer to this guide.

## How images are hashed

When an item with images is submitted, or an item is reported, Coop asks HMA to hash each image. A CLIP-enabled HMA answers with the PDQ hash and the CLIP embedding in the same response. Coop keeps the PDQ hashes under `hashes` as before, and stores the embedding under `embeddings`, next to them:

```json
{
  "url": "https://example.com/a.jpg",
  "hashes": { "pdq": "…" },
  "embeddings": { "clip_float": "…" },
  "matchedBanks": ["Known images"]
}
```

The embedding is kept under `embeddings`, apart from `hashes`, because everything in `hashes` is treated as an exact file hash and included in NCMEC reports. Coop removes `clip_float` from `hashes` whenever HMA returns it, whether or not `HMA_CLIP_ENABLED` is set, so it cannot reach NCMEC. `matchedBanks` lists only the banks that a hash matched, and reviewers see it in the review console as a match. Images that are merely similar are never listed there; the **Image similarity (CLIP)** signal scores them, and rules act on that score.

This happens while the submission request is handled, so the request waits for it. Things to know:

- **Hashing is slower.** CLIP adds roughly 0.3 seconds per image on a CPU (measured on small test images; real photos and a GPU will differ). Coop retries a failed hash a few times, as it did before.
- **Each embedding adds about 4 KB per image** to the stored item data, against 64 bytes for a PDQ hash. It is stored with the item, logged with the submission, and sent to the review console with a review job. NCMEC reports and custom-action callbacks do not include it.
- **Only newly submitted items get embeddings.** Items stored before CLIP was enabled, and items re-evaluated later, have none.
- **A client cannot supply an embedding.** Any `embeddings` in a submission is removed; only HMA's answer is stored.

## Use it in rules

With `HMA_CLIP_ENABLED` set, rules and routing rules can use the **Image similarity (CLIP)** signal.

1. Add images to a bank. Any hash bank works with any image signal: the CLIP signal compares embeddings and the PDQ signals compare PDQ hashes, so a bank filled while CLIP was enabled can serve both. See [Add images to a bank](#add-images-to-a-bank).
2. Add the signal to a condition and pick one or more banks. The signal scores the closest image in those banks from 0 to 1, and 0 when nothing is close enough.
3. Compare the score with a threshold. HMA only reports matches that are at least 0.90 similar, so a threshold below 0.90 behaves like 0.90.

Things to know:

- **A bank only holds CLIP embeddings for images added while CLIP was enabled.** HMA does not re-hash images already in a bank. To use an existing bank with the CLIP signal, add its images again after enabling CLIP (see the note about duplicates below). Banks synced from an exchange such as NCMEC hold only the hashes the exchange provides, so they never match the CLIP signal.
- **Only images submitted while CLIP was enabled** have a CLIP embedding. Older images, and images that failed to hash, cannot be scored, so such a condition does not match them.
- **A rule that uses the signal while CLIP is not enabled reports an error for each item** it evaluates ("CLIP is not available"). It is an expected outcome and is not counted as a failure, but the rule cannot match anything, so draft such rules when you turn CLIP off.

## Turning CLIP off

Unset `HMA_CLIP_ENABLED` and restart the Coop server. Coop stops storing embeddings, and the signal shows as disabled in the rule builder. Nothing is deleted: embeddings already stored with items and in HMA's banks stay.

Rules and routing rules that use the CLIP signal are not changed. They keep running and report "CLIP is not available" for each item, so move them to Draft (or remove the condition) first. To go back to the stock HMA image, run the stock `hma` service again. On a database that already holds CLIP hashes, the stock image starts normally and keeps hashing and matching with PDQ; the CLIP hashes stay in the database, ignored (tested once, on a small database).

## Check that it works

The first hash request loads the model into memory, so it can take a few seconds. Use any publicly reachable image URL.

1. **Hash an image.** The response has a `pdq` key and a `clip_float` key, a 4096-character hex string:

   ```bash
   curl -s "http://localhost:9876/h/hash?url=https://httpbin.org/image/jpeg" | head -c 200
   ```

2. **Create a bank and add the image:**

   ```bash
   curl -s -X POST http://localhost:9876/c/banks -H 'Content-Type: application/json' \
     -d '{"name":"CLIP_TEST_BANK","enabled_ratio":"1.0"}'
   curl -s -X POST "http://localhost:9876/c/bank/CLIP_TEST_BANK/content?url=https://httpbin.org/image/jpeg"
   ```

3. **Look it up.** HMA builds its search index on timers (up to about 3 minutes), so a lookup right after adding content can return `{}`, or a 503 "index not yet ready" right after a restart. Retry until the bank appears. The hash goes in the query string, which HMA accepts at this length:

   ```bash
   HASH=$(curl -s "http://localhost:9876/h/hash?url=https://httpbin.org/image/jpeg&types=clip_float" | python3 -c "import json,sys; print(json.load(sys.stdin)['clip_float'])")
   curl -s -G http://localhost:9876/m/lookup --data-urlencode "signal_type=clip_float" --data-urlencode "signal=$HASH"
   ```

   Expected: the bank with a distance near 0, such as `{"CLIP_TEST_BANK":[{"bank_content_id":1,"distance":"1.19e-07"}]}`. A distance near 0 is an identical image. A different image returns `{}`.

The HMA web UI at `http://localhost:9876/ui/` can also add images to a bank.

To run the same kind of check automatically, use the smoke test. It adds one fixture image to a temporary bank and checks that three edited copies of it match, with scores between 0.90 and 1.00, and that two different images do not. It needs no internet access. It prints each command and a results table, exits nonzero on failure, and deletes its temporary bank. HMA indexes a new bank on a timer, so it waits about 2 to 3 minutes before the lookups. A score is 1 minus the cosine distance between the two embeddings. It uses `http://localhost:9876` unless you set `HMA_URL`.

```bash
hma/clip/smoke-test.sh
```

## Add images to a bank

Create the bank under Automated Enforcement, Matching Banks, then add images from a directory with the seed script. From the `server` directory:

```bash
pnpm run seed-clip-bank --org <orgId> --bank "<bank name>" --dir <directory of images> [--dry-run]
```

It reads the `.env` in `server/`, and reaches HMA through `HMA_SERVICE_URL` there (a run that fails with `fetch failed` usually has the wrong URL), adds every `.jpg`, `.jpeg`, `.png`, `.gif` and `.webp` file directly inside the directory (subfolders and symbolic links are skipped, and files over 20 MiB are skipped and reported) to the bank, and prints one line per image. HMA hashes each image with every signal it has enabled, so with CLIP enabled the bank gets CLIP embeddings too. `--dry-run` lists the images without adding them. The script stops with a message if the bank does not exist, and exits nonzero if any image fails.

HMA cannot list a bank's contents, and adding the same image twice stores it twice (observed even with the same content id), so the script cannot tell which images are already there: running it twice on the same directory adds the images twice. This does not change matching, but it wastes space. To start over, delete the bank and create it again.

## Test it through the Coop UI

`hma/clip/smoke-test.sh` (above) checks HMA from the terminal. This walkthrough tries the whole feature as an organization admin would: create a bank, add images to it, write a rule, submit images, and see the matching one arrive in the review queue. It takes about 20 minutes, most of it waiting for HMA to index the bank, and uses the fixture images in `hma/clip/fixtures/`.

### Before you start

- HMA is running the CLIP-enabled image and `HMA_CLIP_ENABLED=true` is set in `server/.env` (see [Build and run](#build-and-run)). The seed script in step 3 reads the same file, so setting the variable only on the command that starts the server is not enough. The UI is at `http://localhost:3000` and the API at `http://localhost:8080` in a local setup.
- You can sign in as an admin of an organization.
- You have this repository checked out. The fixture images are in `hma/clip/fixtures/`: `bank/scene.jpg` (a red house with a sun) goes into the bank. Five images in `probe/` are submitted to test it: three edited copies of the house that should match (`scene-resized.jpg`, `scene-desaturated.jpg`, `scene-blurred.jpg`, scoring about 0.985, 0.959 and 0.936), and two images that should not (`other-building.jpg`, a lit tower at night, and `other.jpg`, coloured dots).

### 1. Check that CLIP is on

There is nothing to switch on in the UI. With `HMA_CLIP_ENABLED=true`, the **Image similarity (CLIP)** signal is usable in the rule builder (step 5). If it shows as disabled, the server was started without the variable.

### 2. Create a bank

1. Go to **Automated Enforcement, Matching Banks** and create a new hash bank.
2. Name it `CLIP UI test`, leave **Enabled Ratio** at 1, and save. Enabled Ratio is the share of lookups that actually search the bank: a lower value skips the bank for the rest, so some matches are silently missed and nothing is logged.

### 3. Add the fixture image to the bank

The script needs your organization id, which the UI does not show. In a local setup, read it from the database (the container is named for your Compose project, so `docker compose exec postgres` also works):

```bash
docker exec <postgres container> psql -U postgres -c "select id, name from public.orgs"
```

Then, from the `server` directory:

```bash
pnpm run seed-clip-bank \
  --org <orgId> --bank "CLIP UI test" --dir ../hma/clip/fixtures/bank --dry-run
```

`--dry-run` lists what would be added: `scene.jpg  would add`. Run it again without `--dry-run` to add the image. Expected output:

```
Bank "CLIP UI test" (COOP_..._CLIP_UI_TEST)
  scene.jpg  added (HMA content id 1)
1 added, 0 failed
```

The script reaches HMA through `HMA_SERVICE_URL` in `server/.env`, which must point at your HMA (`http://localhost:9876` in a local setup). If a run fails with `fetch failed`, that URL is wrong; you can set it for one run by putting `HMA_SERVICE_URL=http://localhost:9876` in front of the `pnpm` command.

HMA builds its search index on a timer, so matching starts working within about 3 minutes. To wait until the bank is searchable, run this from the repository root (it stops with a message after about 5 minutes), with the HMA bank name that the seed script printed in parentheses. It prints a dot every 10 seconds and then `indexed`:

```bash
BANK=COOP_..._CLIP_UI_TEST
HASH=$(curl -s -F "photo=@hma/clip/fixtures/probe/scene-resized.jpg" http://localhost:9876/h/hash | python3 -c "import json,sys; print(json.load(sys.stdin)['clip_float'])")
for i in $(seq 30); do curl -s -G http://localhost:9876/m/lookup --data-urlencode signal_type=clip_float --data-urlencode "signal=$HASH" --data-urlencode "banks=$BANK" | grep -q "$BANK" && { echo indexed; break; }; printf .; sleep 10; [ "$i" = 30 ] && echo " not indexed, check HMA's logs"; done
```

### 4. Create an item type with an image field

1. Go to **Settings, Item Types** and create an item type.
2. Name it `clip_ui_test`, make it a **Content** type, and add one field named `image` of type **Image**.
3. Save, and note the item type's id (shown in the list or in the URL of its edit page).

### 5. Create a rule

1. Go to **Automated Enforcement, Proactive Rules** and create a rule.
2. Name it `CLIP UI test rule` and choose the item type `clip_ui_test`.
3. Add a condition on the `image` field: the signal **Image similarity (CLIP)**, comparator **is greater than or equal to**, threshold **0.95**, with the bank `CLIP UI test`. The bank picker is the dropdown with the placeholder "Select media bank(s)". It only appears once you have chosen both an image input and the CLIP signal. The picker lists the banks that existed when the page was loaded, so if a bank you just created is missing, refresh the page.
4. Set the action to **Enqueue Item to Manual Review**, and set the rule to **Live**. Rules are cached, so wait about 30 seconds before you submit images in step 7. Images submitted sooner can be checked against the old version of the rule.

### 6. Make sure a review queue exists

The rule's action sends items to the queue chosen by a matching routing rule, or to the organization's default review queue when no routing rule matches, and the item is dropped if there is no queue. This guide assumes no routing rules, so the items land in the default queue; if you have routing rules, look in the queue they route to. Open **Review Console, Queues**. If there is no queue, create one (the first queue is the default). Admins already see every queue, so nothing more is needed. If you review as a non-admin user, make sure that user is a reviewer on the queue (under Manage Access).

### 7. Submit the images

Create an API key under **Settings, API Keys** if you do not have one. Serve the probe images from this machine. Run it from inside this checkout:

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

`202` means Coop accepted the items for processing, nothing more. Coop hashes the images before it returns `202` (so slow hashing delays the response), and the rule runs afterwards in the background. A hashing failure is swallowed, so a problem such as an unreachable image never shows up in this response. It shows up in the file server's log and in what arrives in the queue. To submit the images again, change `RUN` every time so the item ids are new (`clip-ui-scene-resized-2`, and so on). Resubmitting the same ids is a resubmission of the same items, not new ones, and an item that is already waiting in the queue does not get a second job, so a rerun with the same `RUN` can queue only some of the images.

### 8. Check the result

Sign in as a user of the same organization that owns the API key, then open **Review Console, Queues**. A queue cannot be opened from the Queues table. The **Pending Jobs** column shows how many items are waiting, and **Start Reviewing** opens them one at a time. To see the whole list without reviewing, turn on **Enable Preview Jobs View** under Settings, Settings, Review Console, and then use **Preview Jobs** on the queue. (If your instance has several organizations, a different one may have old jobs of its own.) After a few seconds you should see these two new items (any older jobs already in the queue are not part of this test): `clip-ui-scene-resized-1` and `clip-ui-scene-desaturated-1` (with `RUN=1`). Open an item to see its image. The queue does not show scores. The expected scores are about 0.985 and 0.959, measured on a CPU instance; scores can differ by a few thousandths on other hardware, so the desaturated copy (0.959 against the 0.95 threshold) is the closest call. The table printed by `hma/clip/smoke-test.sh` shows the scores on your machine.

Three images should not be there:

- `clip-ui-scene-blurred-1` is a match, but its expected score of about 0.936 is below the rule's threshold of 0.95.
- `clip-ui-other-building-1` and `clip-ui-other-1` are not close enough to the bank image for any score.

To see the threshold at work, edit the rule and lower it to 0.90, then submit the blurred copy again with a new item id (`clip-ui-scene-blurred-2`). It now arrives in the queue. Lowering the threshold below 0.90 changes nothing, because HMA only reports matches with a similarity of 0.90 or more.

If nothing arrives after a minute, see "If it does not work" below.

### Other things worth checking

- **A bank works with other image signals too.** In the rule editor, change the condition's signal to a PDQ image signal. The bank stays selected, because HMA hashed the fixture image with PDQ as well as CLIP.
- **Turning CLIP off.** Remove `HMA_CLIP_ENABLED` from `server/.env` and restart the server. The **Image similarity (CLIP)** signal shows as disabled in the rule builder, and `CLIP UI test rule` keeps running but reports "CLIP is not available" for each item, so move it to Draft first. Submitted images no longer get an embedding.
- **Only a CLIP deployment can use it.** Without `HMA_CLIP_ENABLED`, the CLIP signal is shown as disabled, with a pointer to the guide.

### If it does not work

- **Nothing arrives in the queue.** Check that the organization has a review queue and, for a non-admin user, that the user is a reviewer on it (step 6), that `HMA_CLIP_ENABLED=true` is set and the server was restarted, that the rule is Live (a rule left in Draft fails silently: nothing is logged and nothing is enqueued), and that it uses a threshold at or below the 0.985 the resized image scores, and that the bank was seeded (step 3 printed `1 added`). HMA needs up to 3 minutes after seeding before it can match. A lookup before then finds nothing.
- **Only some of the expected images arrive.** Check that every submission used a new `RUN` number. Then check the rule's threshold: the images score about 0.985, 0.959 and 0.936, so a threshold of 0.95 queues two of them and 0.91 queues all three.
- **The images were never fetched, or the queue shows only items without a CLIP match.** An item whose image could not be fetched is still processed, but it has no CLIP embedding, so the rule cannot match it. The file server's log shows whether each image was requested and with what status (`404` means wrong directory, no request at all means the HMA containers cannot reach your image host). Fix the host, then submit again with a new `RUN` number.
- **The review console says "Image failed to load".** Your browser cannot load the image URL. See "Pick an image host" in step 7. This does not affect matching.

### Clean up the UI test

Stop the `python3 -m http.server` process. In the UI, set the rule to Draft or delete it, delete the item type if you made it only for this test, and delete the bank `CLIP UI test` (this removes its images from HMA). Items already in the review queue can be decided or ignored.

## Clean up

To go back to the stock HMA, run the stock service again:

```bash
docker compose up -d --build hma
```

This keeps the data.

## How it's built

`hma/clip/Dockerfile` starts from the same digest-pinned HMA release as `hma/Dockerfile`, installs PyTorch (CPU by default) and the [tx-extension-clip](https://github.com/UMass-Rescue/tx-extension-clip) extension (pinned to a commit), and swaps in `hma/clip/omm_config.py`, which is the stock configuration with the `clip_float` signal added and an optional hostname allowlist (`HMA_ALLOWED_HOSTNAMES`, which HMA applies when it fetches an image URL). It uses the stock entrypoint. The HMA release and the extension are pinned; the CLIP model weights and tokenizer files are fetched at build time at pinned Hugging Face revisions and built into the image, so the running container does not download anything. The extension's own Python requirements are installed from PyPI at build time and can differ between builds. Keep the `FROM` line in step with `hma/Dockerfile` when you update HMA.

## See also

- [Hasher-Matcher-Actioner (HMA)](hma.md)
