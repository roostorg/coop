"""Tests for notify_security_advisories.py.

Run: python3 -m unittest discover -s .github/scripts -p 'test_*.py'
"""

from __future__ import annotations

import contextlib
import io
import json
import os
import sys
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import ClassVar
from unittest import mock
from urllib.parse import parse_qs, urlparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import notify_security_advisories as notifier

SECRET_TEXT = "SECRET-DESCRIPTION-DO-NOT-LEAK"


def advisory(ghsa_id, state="triage", created="2026-10-01T00:00:00Z", **extra):
    return {
        "ghsa_id": ghsa_id,
        "state": state,
        "summary": f"Summary of {ghsa_id}",
        "severity": "high",
        "created_at": created,
        "description": SECRET_TEXT,
        "html_url": f"https://github.com/roostorg/coop/security/advisories/{ghsa_id}",
        "submission": {"accepted": False},
        "credits": [{"login": "reporter"}],
        "vulnerabilities": [{"package": {"name": SECRET_TEXT}}],
        **extra,
    }


A1 = "GHSA-2222-3333-4444"
A2 = "GHSA-cfgh-jmpq-rvwx"
A3 = "GHSA-5678-9cfg-hjmp"


class FakeGitHubAndDiscord(BaseHTTPRequestHandler):
    """Serves the advisories API (2 per page) and records Discord posts."""

    advisories: ClassVar[dict[str, list[dict]]] = {}
    posts: ClassVar[list[dict]] = []
    discord_status = 204

    def log_message(self, *args):
        pass

    def do_GET(self):
        url = urlparse(self.path)
        query = parse_qs(url.query)
        if url.path != "/repos/roostorg/coop/security-advisories":
            self.send_response(404)
            self.end_headers()
            return
        if self.headers.get("Authorization") != "Bearer test-token":
            self.send_response(401)
            self.end_headers()
            return
        items = self.advisories.get(query["state"][0], [])
        start = int(query.get("after", ["0"])[0])
        page = items[start : start + 2]
        self.send_response(200)
        if start + 2 < len(items):
            host = f"http://{self.headers['Host']}"
            nxt = f"{host}{url.path}?state={query['state'][0]}&after={start + 2}"
            self.send_header("Link", f'<{nxt}>; rel="next"')
        self.end_headers()
        self.wfile.write(json.dumps(page).encode())

    def do_POST(self):
        body = self.rfile.read(int(self.headers["Content-Length"]))
        if urlparse(self.path).path != "/webhook":
            self.send_response(404)
            self.end_headers()
            return
        status = type(self).discord_status
        if status == 204:
            type(self).posts.append(json.loads(body))
        self.send_response(status)
        self.end_headers()


class NotifierTest(unittest.TestCase):
    def setUp(self):
        FakeGitHubAndDiscord.advisories = {}
        FakeGitHubAndDiscord.posts = []
        FakeGitHubAndDiscord.discord_status = 204
        self.server = HTTPServer(("127.0.0.1", 0), FakeGitHubAndDiscord)
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        base = f"http://127.0.0.1:{self.server.server_port}"
        self.tmp = tempfile.TemporaryDirectory()
        self.state_file = os.path.join(self.tmp.name, "state", "state.json")
        self.output_file = os.path.join(self.tmp.name, "output")
        self.env = {
            "GITHUB_ACTIONS": "true",
            "GITHUB_REPOSITORY": "roostorg/coop",
            "GITHUB_SERVER_URL": "https://github.com",
            "GITHUB_API_URL": base,
            "GITHUB_OUTPUT": self.output_file,
            "SECURITY_DISCORD_WEBHOOK": f"{base}/webhook",
            "ADVISORY_READ_TOKEN": "test-token",
            "STATE_FILE": self.state_file,
        }
        sleep = mock.patch.object(notifier.time, "sleep")
        sleep.start()
        self.addCleanup(sleep.stop)

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.tmp.cleanup()

    def run_ci(self, env=None):
        """Run main() as the workflow does; return (exit code, stdout+stderr)."""
        out = io.StringIO()
        with (
            mock.patch.dict(os.environ, env or self.env, clear=True),
            contextlib.redirect_stdout(out),
            contextlib.redirect_stderr(out),
        ):
            code = notifier.main([])
        return code, out.getvalue()

    def output(self):
        with open(self.output_file) as f:
            return f.read()

    def test_posts_triage_and_draft_once_oldest_first_and_prints_nothing(self):
        FakeGitHubAndDiscord.advisories = {
            "triage": [
                advisory(A2, created="2026-10-03T00:00:00Z"),
                advisory(A1, created="2026-10-01T00:00:00Z"),
                advisory(A3, created="2026-10-04T00:00:00Z"),
            ],
            "draft": [advisory("GHSA-wxwx-wxwx-wxwx", "draft", "2026-10-02T00:00:00Z")],
        }
        code, logs = self.run_ci()
        self.assertEqual((code, logs), (0, ""))
        self.assertEqual(
            [
                p["embeds"][0]["url"].rsplit("/", 1)[1]
                for p in FakeGitHubAndDiscord.posts
            ],
            [A1, "GHSA-wxwx-wxwx-wxwx", A2, A3],
        )
        self.assertIn("changed=true", self.output())

        code, logs = self.run_ci()
        self.assertEqual((code, logs), (0, ""))
        self.assertEqual(len(FakeGitHubAndDiscord.posts), 4)
        self.assertTrue(self.output().endswith("changed=false\n"))

    def test_payload_contains_only_id_title_severity_and_link(self):
        FakeGitHubAndDiscord.advisories = {"triage": [advisory(A1)]}
        self.run_ci()
        (payload,) = FakeGitHubAndDiscord.posts
        self.assertEqual(
            payload,
            {
                "content": f"New security advisory {A1}",
                "allowed_mentions": {"parse": []},
                "embeds": [
                    {
                        "title": f"{A1}: Summary of {A1}",
                        "url": f"https://github.com/roostorg/coop/security/advisories/{A1}",
                        "fields": [
                            {"name": "Severity", "value": "high", "inline": True}
                        ],
                    }
                ],
            },
        )

    def test_state_file_does_not_contain_ghsa_ids(self):
        FakeGitHubAndDiscord.advisories = {"triage": [advisory(A1)]}
        self.run_ci()
        with open(self.state_file) as f:
            state = f.read()
        self.assertNotIn(A1, state)
        self.assertNotIn(A1.lower(), state)

    def test_advisory_moving_from_triage_to_draft_is_not_reposted(self):
        FakeGitHubAndDiscord.advisories = {"triage": [advisory(A1)]}
        self.run_ci()
        FakeGitHubAndDiscord.advisories = {"draft": [advisory(A1, "draft")]}
        self.run_ci()
        self.assertEqual(len(FakeGitHubAndDiscord.posts), 1)

    def test_state_drops_advisories_no_longer_in_triage_or_draft(self):
        FakeGitHubAndDiscord.advisories = {"triage": [advisory(A1), advisory(A2)]}
        self.run_ci()
        FakeGitHubAndDiscord.advisories = {"triage": [advisory(A2)]}
        self.run_ci()
        self.assertIn("changed=true", self.output().splitlines()[-1])
        with open(self.state_file) as f:
            self.assertEqual(len(json.load(f)["posted"]), 1)

    def test_failed_post_keeps_earlier_posts_and_retries_the_rest(self):
        FakeGitHubAndDiscord.advisories = {
            "triage": [
                advisory(A1, created="2026-10-01T00:00:00Z"),
                advisory(A2, created="2026-10-02T00:00:00Z"),
            ]
        }
        real_post = notifier.post_to_discord
        calls = []

        def flaky(url, payload):
            calls.append(payload)
            if len(calls) == 2:
                raise notifier.NotifyError("Discord webhook returned HTTP 500")
            real_post(url, payload)

        with mock.patch.object(notifier, "post_to_discord", flaky):
            code, logs = self.run_ci()
        self.assertEqual(code, 1)
        self.assertEqual(logs, "::error::Discord webhook returned HTTP 500\n")
        self.assertIn("changed=true", self.output())

        code, _ = self.run_ci()
        self.assertEqual(code, 0)
        self.assertEqual(
            [p["content"] for p in FakeGitHubAndDiscord.posts],
            [f"New security advisory {A1}", f"New security advisory {A2}"],
        )

    def test_discord_error_does_not_log_webhook_or_advisory(self):
        FakeGitHubAndDiscord.advisories = {"triage": [advisory(A1)]}
        FakeGitHubAndDiscord.discord_status = 400
        code, logs = self.run_ci()
        self.assertEqual(code, 1)
        self.assertEqual(logs, "::error::Discord webhook returned HTTP 400\n")

    def test_api_error_fails_without_touching_state(self):
        env = {**self.env, "ADVISORY_READ_TOKEN": "wrong"}
        code, logs = self.run_ci(env)
        self.assertEqual(code, 1)
        self.assertEqual(
            logs, "::error::listing triage advisories failed with HTTP 401\n"
        )
        self.assertFalse(os.path.exists(self.state_file))

    def test_skips_silently_without_secrets(self):
        for missing in ("SECURITY_DISCORD_WEBHOOK", "ADVISORY_READ_TOKEN"):
            env = {k: v for k, v in self.env.items() if k != missing}
            self.assertEqual(self.run_ci(env), (0, ""))
        self.assertEqual(FakeGitHubAndDiscord.posts, [])

    def test_rotating_the_webhook_reposts_open_advisories(self):
        FakeGitHubAndDiscord.advisories = {"triage": [advisory(A1)]}
        self.run_ci()
        self.run_ci(
            {
                **self.env,
                "SECURITY_DISCORD_WEBHOOK": self.env["SECURITY_DISCORD_WEBHOOK"]
                + "?v=2",
            }
        )
        self.assertEqual(len(FakeGitHubAndDiscord.posts), 2)

    def test_ignores_malformed_ids_and_severities_and_truncates_titles(self):
        FakeGitHubAndDiscord.advisories = {
            "triage": [
                advisory("not-a-ghsa"),
                advisory("GHSA-aaaa-bbbb-cccc"),
                advisory(A1, severity="@everyone", summary="x\n" * 400),
            ]
        }
        self.run_ci()
        (payload,) = FakeGitHubAndDiscord.posts
        embed = payload["embeds"][0]
        self.assertEqual(len(embed["title"]), notifier.EMBED_TITLE_MAX)
        self.assertNotIn("\n", embed["title"])
        self.assertEqual(embed["fields"][0]["value"], "unknown")

    def test_local_only_flags_are_refused_in_actions(self):
        with (
            mock.patch.dict(os.environ, self.env, clear=True),
            contextlib.redirect_stderr(io.StringIO()),
        ):
            self.assertEqual(notifier.main(["--dry-run"]), 2)
            self.assertEqual(notifier.main(["--advisories-file", "x.json"]), 2)

    def test_local_dry_run_prints_payloads_without_posting(self):
        fixture = os.path.join(self.tmp.name, "advisories.json")
        with open(fixture, "w") as f:
            json.dump([advisory(A1)], f)
        env = {"STATE_FILE": self.state_file}
        out = io.StringIO()
        with (
            mock.patch.dict(os.environ, env, clear=True),
            contextlib.redirect_stdout(out),
        ):
            code = notifier.main(["--dry-run", "--advisories-file", fixture])
        self.assertEqual(code, 0)
        self.assertEqual(
            json.loads(out.getvalue())["content"], f"New security advisory {A1}"
        )
        self.assertNotIn(SECRET_TEXT, out.getvalue())
        self.assertEqual(FakeGitHubAndDiscord.posts, [])


if __name__ == "__main__":
    unittest.main()
