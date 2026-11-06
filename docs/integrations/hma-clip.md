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
| Disk     | About 1.4 GB for the model weights (as measured), downloaded from Hugging Face on first use. The image is about 2.7 GB, against about 1.3 GB for stock HMA, because PyTorch is large.                                                                                                              |
| Network  | Outbound access to GitHub and the PyTorch wheel index at build time, and to Hugging Face on first use (the model revision is not pinned). The weights are kept in a Docker volume, so later starts and rebuilds don't download them again.                                                         |
| GPU      | Optional. Hashing is much faster on an NVIDIA GPU; CPU works and is fine for development. GPU needs Linux with an NVIDIA driver and the [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html). macOS can't pass a GPU to Docker. |

Because every photo is hashed with CLIP too, hashing is slower for every image your deployment receives, whether or not a rule uses CLIP.

## Build and run

Build the image from the `hma/` directory. It is the stock HMA image (the same digest-pinned release as `hma/Dockerfile`) with PyTorch and the CLIP signal added:

```bash
docker build -f hma/clip/Dockerfile -t hma-clip hma
```

The first build downloads PyTorch and takes several minutes. Run `hma-clip` in place of the stock `hma` service, with the same environment and database. With Coop's Compose file, an override does this:

```bash
docker compose -f docker-compose.yaml -f hma/clip/docker-compose.clip.yaml up -d --build hma
```

The override only swaps the build and adds a volume for the model weights; HMA stays on port 9876 and keeps its database, so existing banks are kept. HMA downloads the model on the first hash request. Check that the CLIP signal is enabled:

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
  "matchedBanks": ["Known images", "Similar to known images"]
}
```

The embedding is kept under `embeddings`, apart from `hashes`, because everything in `hashes` is treated as an exact file hash and included in NCMEC reports. Coop removes `clip_float` from `hashes` whenever HMA returns it, whether or not `HMA_CLIP_ENABLED` is set, so it cannot reach NCMEC. `matchedBanks` lists the banks that the PDQ hash or the embedding matched, and reviewers see it in the review console.

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

The first hash request downloads the model weights, so it can take a minute or two. Use any publicly reachable image URL.

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

If `pnpm run` cannot start the script, build the server (`pnpm run build`) and run the compiled file instead: `node --env-file-if-exists=.env transpiled/bin/seed-clip-bank.js --org ... --bank ... --dir ...`.

## Test it through the Coop UI

`hma/clip/smoke-test.sh` (above) checks HMA from the terminal. To try the whole feature as a user would, from adding a bank to seeing a matching image arrive in the review queue, follow the [CLIP testing guide](hma-clip-ui-testing.md). It uses the fixture images in `hma/clip/fixtures/`.

## Clean up

To go back to the stock HMA, run the stock service again:

```bash
docker compose up -d --build hma
```

This keeps the data. The model weights are cached in a Docker volume named for your Compose project, such as `<project>_hma_clip_model_cache`. Keep it to avoid downloading the weights again next time, or find and remove it:

```bash
docker volume ls --filter name=hma_clip
docker volume rm <the volume listed>
```

## How it's built

`hma/clip/Dockerfile` starts from the same digest-pinned HMA release as `hma/Dockerfile`, installs PyTorch (CPU by default) and the [tx-extension-clip](https://github.com/UMass-Rescue/tx-extension-clip) extension (pinned to a commit), and swaps in `hma/clip/omm_config.py`, which is the stock configuration with the `clip_float` signal added and an optional hostname allowlist (`HMA_ALLOWED_HOSTNAMES`, which HMA applies when it fetches an image URL). It uses the stock entrypoint. The HMA release and the extension are pinned; the extension's own Python requirements are installed from PyPI at build time and can differ between builds, and the CLIP model revision is not pinned. Keep the `FROM` line in step with `hma/Dockerfile` when you update HMA.

## See also

- [Hasher-Matcher-Actioner (HMA)](hma.md)
- [Testing CLIP through the Coop UI](hma-clip-ui-testing.md)
