#!/usr/bin/env python3
"""List repository security advisories in triage or draft not yet posted.

Run by .github/workflows/security-advisory-notify.yml, which posts the result
with roostorg/discord-bot. Writes PAYLOAD_FILE with one repository_advisory
payload per line, holding only the GHSA ID, title, severity and link, and
updates STATE_FILE to include them. The workflow saves the state only after
posting succeeds.

Workflow logs and caches on this repository are public, so the script never
prints anything about an advisory, and the state holds keyed hashes of GHSA
IDs, never the IDs.

Environment:
  GITHUB_REPOSITORY    owner/repo whose advisories are listed
  ADVISORY_READ_TOKEN  token that can read unpublished advisories
  STATE_KEY            secret key for the state hashes (the webhook URL)
  STATE_FILE           JSON file of advisories already posted
  PAYLOAD_FILE         where to write the payloads to post
  GITHUB_OUTPUT        set by Actions; receives post= and changed=

Local check with advisories from a file instead of the API (refused under
GitHub Actions):
  STATE_FILE=state.json PAYLOAD_FILE=payload.jsonl \\
      python3 list_new_security_advisories.py --advisories-file advisories.json
"""

from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import os
import re
import sys
import urllib.error
import urllib.request
from collections.abc import Iterable

STATES = ("triage", "draft")
SEVERITIES = {"critical", "high", "medium", "low"}
GHSA_ID = re.compile(r"^GHSA(-[23456789cfghjmpqrvwx]{4}){3}$")
LINK_NEXT = re.compile(r'<([^>]+)>;\s*rel="next"')
LOCAL_KEY = "local"


class ListError(Exception):
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
        raise ListError("state file is unreadable") from e
    posted = data.get("posted") if isinstance(data, dict) else None
    if not isinstance(posted, list):
        raise ListError("state file has an unexpected format")
    return {d for d in posted if isinstance(d, str)}


def write_file(path: str, text: str) -> None:
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    tmp = f"{path}.tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(text)
    os.replace(tmp, path)


def save_state(path: str, posted: Iterable[str]) -> None:
    write_file(path, json.dumps({"version": 1, "posted": sorted(posted)}))


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
                raise ListError(
                    f"listing {state} advisories failed with HTTP {e.code}"
                ) from None
            except (urllib.error.URLError, TimeoutError, ValueError):
                raise ListError(f"listing {state} advisories failed") from None
            if not isinstance(page, list):
                raise ListError(f"listing {state} advisories returned non-list")
            advisories.extend(a for a in page if isinstance(a, dict))
            match = LINK_NEXT.search(link)
            url = match.group(1) if match else None
    return advisories


def payload(advisory: dict, server_url: str, repo: str) -> dict:
    """The repository_advisory payload for discord-bot, with only what it posts."""
    ghsa_id = advisory["ghsa_id"]
    severity = advisory.get("severity")
    return {
        "repository_advisory": {
            "ghsa_id": ghsa_id,
            "summary": str(advisory.get("summary") or ""),
            "severity": severity if severity in SEVERITIES else None,
            "html_url": f"{server_url}/{repo}/security/advisories/{ghsa_id}",
        }
    }


def select_new(
    advisories: list[dict], posted: set[str], key: str
) -> tuple[list[dict], set[str]]:
    """Return advisories not yet posted, oldest first, and the state after
    posting them. The state keeps only advisories still in triage or draft, so
    it stays small."""
    current: dict[str, dict] = {}
    for advisory in advisories:
        ghsa_id = advisory.get("ghsa_id")
        if isinstance(ghsa_id, str) and GHSA_ID.match(ghsa_id):
            current.setdefault(ghsa_id, advisory)
    digests = {ghsa_id: state_digest(key, ghsa_id) for ghsa_id in current}
    new = sorted(
        (a for i, a in current.items() if digests[i] not in posted),
        key=lambda a: (str(a.get("created_at") or ""), a["ghsa_id"]),
    )
    return new, set(digests.values())


def write_output(**values: bool) -> None:
    path = os.environ.get("GITHUB_OUTPUT")
    if path:
        with open(path, "a", encoding="utf-8") as f:
            f.writelines(
                f"{name}={'true' if value else 'false'}\n"
                for name, value in values.items()
            )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument(
        "--advisories-file",
        help="read advisories from this JSON list instead of the API (local runs only)",
    )
    args = parser.parse_args(argv)

    if os.environ.get("GITHUB_ACTIONS") == "true" and args.advisories_file:
        print("--advisories-file is for local runs only", file=sys.stderr)
        return 2
    state_file = os.environ.get("STATE_FILE")
    payload_file = os.environ.get("PAYLOAD_FILE")
    if not state_file or not payload_file:
        print("set STATE_FILE and PAYLOAD_FILE", file=sys.stderr)
        return 2

    repo = os.environ.get("GITHUB_REPOSITORY", "roostorg/coop")
    server_url = os.environ.get("GITHUB_SERVER_URL", "https://github.com")
    api_url = os.environ.get("GITHUB_API_URL", "https://api.github.com")
    key = os.environ.get("STATE_KEY", "")
    token = os.environ.get("ADVISORY_READ_TOKEN", "")
    if args.advisories_file:
        key = key or LOCAL_KEY
    elif not key or not token:
        print("set STATE_KEY and ADVISORY_READ_TOKEN", file=sys.stderr)
        return 2

    try:
        posted = load_state(state_file)
        if args.advisories_file:
            with open(args.advisories_file, encoding="utf-8") as f:
                advisories = json.load(f)
        else:
            advisories = fetch_advisories(api_url, repo, token)
        new, new_state = select_new(advisories, posted, key)
    except ListError as e:
        print(f"::error::{e}", file=sys.stderr)
        return 1

    write_file(
        payload_file,
        "".join(json.dumps(payload(a, server_url, repo)) + "\n" for a in new),
    )
    changed = new_state != posted
    if changed:
        save_state(state_file, new_state)
    write_output(post=bool(new), changed=changed)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:  # noqa: BLE001
        # A traceback could include advisory data.
        print(f"::error::unexpected {type(e).__name__}", file=sys.stderr)
        sys.exit(1)
