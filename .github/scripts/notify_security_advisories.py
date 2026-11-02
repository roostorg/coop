#!/usr/bin/env python3
"""Post new triage and draft repository security advisories to Discord.

Run by .github/workflows/security-advisory-notify.yml. Each message carries only
the GHSA ID, title, severity and a link to the advisory. Workflow logs on this
repository are public, so in CI the script never prints anything about an
advisory, and the state file holds keyed hashes of GHSA IDs, never the IDs.

Environment:
  GITHUB_REPOSITORY         owner/repo whose advisories are listed
  ADVISORY_READ_TOKEN       token that can read unpublished advisories
  SECURITY_DISCORD_WEBHOOK  Discord webhook URL; also the key for state hashes
  STATE_FILE                JSON file of advisories already posted
  GITHUB_OUTPUT             set by Actions; receives changed=true|false

Local check without a webhook or token (refused under GitHub Actions):
  python3 notify_security_advisories.py --dry-run \\
      --advisories-file advisories.json --state-file state.json
"""

from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from collections.abc import Callable, Iterable

STATES = ("triage", "draft")
SEVERITIES = {"critical", "high", "medium", "low"}
GHSA_ID = re.compile(r"^GHSA(-[23456789cfghjmpqrvwx]{4}){3}$")
LINK_NEXT = re.compile(r'<([^>]+)>;\s*rel="next"')
EMBED_TITLE_MAX = 256
DRY_RUN_KEY = "local-dry-run"


class NotifyError(Exception):
    """An error whose message is safe to print in a public log."""


def state_digest(key: str, ghsa_id: str) -> str:
    return hmac.new(key.encode(), ghsa_id.encode(), hashlib.sha256).hexdigest()


def load_state(path: str) -> set[str]:
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        return set()
    except (OSError, ValueError) as e:
        raise NotifyError("state file is unreadable") from e
    posted = data.get("posted") if isinstance(data, dict) else None
    if not isinstance(posted, list):
        raise NotifyError("state file has an unexpected format")
    return {d for d in posted if isinstance(d, str)}


def save_state(path: str, posted: Iterable[str]) -> None:
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    tmp = f"{path}.tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump({"version": 1, "posted": sorted(posted)}, f)
    os.replace(tmp, path)


def fetch_advisories(api_url: str, repo: str, token: str) -> list[dict]:
    advisories: list[dict] = []
    for state in STATES:
        url: str | None = (
            f"{api_url}/repos/{repo}/security-advisories"
            f"?state={state}&per_page=100&sort=created&direction=asc"
        )
        while url:
            request = urllib.request.Request(
                url,
                headers={
                    "Accept": "application/vnd.github+json",
                    "Authorization": f"Bearer {token}",
                    "X-GitHub-Api-Version": "2022-11-28",
                    "User-Agent": "security-advisory-notify",
                },
            )
            try:
                with urllib.request.urlopen(request, timeout=30) as response:
                    page = json.load(response)
                    link = response.headers.get("Link", "")
            except urllib.error.HTTPError as e:
                e.close()
                raise NotifyError(
                    f"listing {state} advisories failed with HTTP {e.code}"
                ) from None
            except (urllib.error.URLError, TimeoutError, ValueError):
                raise NotifyError(f"listing {state} advisories failed") from None
            if not isinstance(page, list):
                raise NotifyError(f"listing {state} advisories returned non-list")
            advisories.extend(a for a in page if isinstance(a, dict))
            match = LINK_NEXT.search(link)
            url = match.group(1) if match else None
    return advisories


def discord_payload(advisory: dict, server_url: str, repo: str) -> dict:
    ghsa_id = advisory["ghsa_id"]
    summary = " ".join(str(advisory.get("summary") or "").split())
    title = f"{ghsa_id}: {summary}" if summary else ghsa_id
    if len(title) > EMBED_TITLE_MAX:
        title = title[: EMBED_TITLE_MAX - 1] + "…"
    severity = advisory.get("severity")
    return {
        "content": f"New security advisory {ghsa_id}",
        # Titles come from reporters; never let one ping anyone.
        "allowed_mentions": {"parse": []},
        "embeds": [
            {
                "title": title,
                "url": f"{server_url}/{repo}/security/advisories/{ghsa_id}",
                "fields": [
                    {
                        "name": "Severity",
                        "value": severity if severity in SEVERITIES else "unknown",
                        "inline": True,
                    }
                ],
            }
        ],
    }


def post_to_discord(webhook_url: str, payload: dict) -> None:
    body = json.dumps(payload).encode()
    for attempt in range(3):
        request = urllib.request.Request(
            webhook_url,
            data=body,
            method="POST",
            headers={
                "Content-Type": "application/json",
                "User-Agent": "security-advisory-notify",
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=30):
                return
        except urllib.error.HTTPError as e:
            with e:
                retry_body = e.read() if e.code == 429 else b""
            if e.code == 429 and attempt < 2:
                try:
                    retry_after = float(json.loads(retry_body).get("retry_after", 2))
                except (ValueError, AttributeError):
                    retry_after = 2.0
                time.sleep(min(retry_after, 30))
                continue
            # Don't print the response body or URL: the URL is the secret.
            raise NotifyError(f"Discord webhook returned HTTP {e.code}") from None
        except (urllib.error.URLError, TimeoutError):
            raise NotifyError("Discord webhook request failed") from None


def notify(
    advisories: list[dict],
    posted: set[str],
    key: str,
    send: Callable[[dict], None],
    server_url: str,
    repo: str,
) -> tuple[set[str], bool]:
    """Send each advisory not yet posted, oldest first.

    Returns the new state (only advisories still in triage or draft, so it
    stays small) and whether anything was sent. If a send fails, the state
    passed to the exception holds everything sent before it.
    """
    current = {}
    for advisory in advisories:
        ghsa_id = advisory.get("ghsa_id")
        if isinstance(ghsa_id, str) and GHSA_ID.match(ghsa_id):
            current.setdefault(ghsa_id, advisory)
    ordered = sorted(
        current.values(), key=lambda a: (str(a.get("created_at") or ""), a["ghsa_id"])
    )

    new_state = {d for d in (state_digest(key, i) for i in current) if d in posted}
    sent = False
    for advisory in ordered:
        digest = state_digest(key, advisory["ghsa_id"])
        if digest in new_state:
            continue
        if sent:
            time.sleep(1)  # stay under Discord's per-webhook rate limit
        try:
            send(discord_payload(advisory, server_url, repo))
        except NotifyError as e:
            e.partial_state = new_state  # type: ignore[attr-defined]
            raise
        new_state.add(digest)
        sent = True
    return new_state, sent


def write_output(changed: bool) -> None:
    path = os.environ.get("GITHUB_OUTPUT")
    if path:
        with open(path, "a", encoding="utf-8") as f:
            f.write(f"changed={'true' if changed else 'false'}\n")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--state-file", default=os.environ.get("STATE_FILE"))
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="print Discord payloads instead of posting (local runs only)",
    )
    parser.add_argument(
        "--advisories-file",
        help="read advisories from this JSON list instead of the API (local runs only)",
    )
    args = parser.parse_args(argv)

    in_actions = os.environ.get("GITHUB_ACTIONS") == "true"
    if in_actions and (args.dry_run or args.advisories_file):
        print(
            "--dry-run and --advisories-file are for local runs only", file=sys.stderr
        )
        return 2
    if not args.state_file:
        print("set STATE_FILE or --state-file", file=sys.stderr)
        return 2

    repo = os.environ.get("GITHUB_REPOSITORY", "roostorg/coop")
    server_url = os.environ.get("GITHUB_SERVER_URL", "https://github.com")
    api_url = os.environ.get("GITHUB_API_URL", "https://api.github.com")
    webhook = os.environ.get("SECURITY_DISCORD_WEBHOOK", "")
    token = os.environ.get("ADVISORY_READ_TOKEN", "")

    if args.dry_run:
        key = webhook or DRY_RUN_KEY

        def send(payload: dict) -> None:
            print(json.dumps(payload, indent=2, ensure_ascii=False))

    else:
        if not webhook or not token:
            # Not configured: skip without output.
            write_output(False)
            return 0
        key = webhook

        def send(payload: dict) -> None:
            post_to_discord(webhook, payload)

    try:
        posted = load_state(args.state_file)
        if args.advisories_file:
            with open(args.advisories_file, encoding="utf-8") as f:
                advisories = json.load(f)
        else:
            advisories = fetch_advisories(api_url, repo, token)
        try:
            new_state, _ = notify(advisories, posted, key, send, server_url, repo)
        except NotifyError as e:
            partial = getattr(e, "partial_state", None)
            if partial is not None and partial != posted:
                save_state(args.state_file, partial)
                write_output(True)
            raise
        changed = new_state != posted
        if changed:
            save_state(args.state_file, new_state)
        write_output(changed)
        return 0
    except NotifyError as e:
        print(f"::error::{e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:  # noqa: BLE001
        # A traceback could include advisory data or the webhook URL.
        print(f"::error::unexpected {type(e).__name__}", file=sys.stderr)
        sys.exit(1)
