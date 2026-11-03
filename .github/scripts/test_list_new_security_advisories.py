"""Tests for list_new_security_advisories.py.

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
import unittest.mock as mock
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import ClassVar
from urllib.parse import parse_qs, urlparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import list_new_security_advisories as lister

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
        "credits": [{"login": "reporter"}],
        "vulnerabilities": [{"package": {"name": SECRET_TEXT}}],
        **extra,
    }


A1 = "GHSA-2222-3333-4444"
A2 = "GHSA-cfgh-jmpq-rvwx"
A3 = "GHSA-5678-9cfg-hjmp"


class FakeGitHub(BaseHTTPRequestHandler):
    """Serves the advisories API, two per page."""

    advisories: ClassVar[dict[str, list[dict]]] = {}

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
        self.send_response(200)
        if start + 2 < len(items):
            host = f"http://{self.headers['Host']}"
            nxt = f"{host}{url.path}?state={query['state'][0]}&after={start + 2}"
            self.send_header("Link", f'<{nxt}>; rel="next"')
        self.end_headers()
        self.wfile.write(json.dumps(items[start : start + 2]).encode())


class ListerTest(unittest.TestCase):
    def setUp(self):
        FakeGitHub.advisories = {}
        self.server = HTTPServer(("127.0.0.1", 0), FakeGitHub)
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.tmp = tempfile.TemporaryDirectory()
        self.state_file = os.path.join(self.tmp.name, "state", "state.json")
        self.payload_file = os.path.join(self.tmp.name, "state", "advisories.jsonl")
        self.output_file = os.path.join(self.tmp.name, "output")
        self.env = {
            "GITHUB_ACTIONS": "true",
            "GITHUB_REPOSITORY": "roostorg/coop",
            "GITHUB_SERVER_URL": "https://github.com",
            "GITHUB_API_URL": f"http://127.0.0.1:{self.server.server_port}",
            "GITHUB_OUTPUT": self.output_file,
            "ADVISORY_READ_TOKEN": "test-token",
            "STATE_KEY": "https://discord.com/api/webhooks/1/secret",
            "STATE_FILE": self.state_file,
            "PAYLOAD_FILE": self.payload_file,
        }

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.tmp.cleanup()

    def run_ci(self, env=None, argv=()):
        """Run main() as the workflow does; return (exit code, stdout+stderr)."""
        out = io.StringIO()
        with (
            mock.patch.dict(os.environ, env or self.env, clear=True),
            contextlib.redirect_stdout(out),
            contextlib.redirect_stderr(out),
        ):
            code = lister.main(list(argv))
        return code, out.getvalue()

    def outputs(self):
        with open(self.output_file) as f:
            lines = f.read().splitlines()
        return dict(line.split("=", 1) for line in lines[-2:])

    def payloads(self):
        with open(self.payload_file) as f:
            return [json.loads(line) for line in f]

    def posted_ids(self):
        return [p["repository_advisory"]["ghsa_id"] for p in self.payloads()]

    def test_lists_triage_and_draft_oldest_first_and_prints_nothing(self):
        FakeGitHub.advisories = {
            "triage": [
                advisory(A2, created="2026-10-03T00:00:00Z"),
                advisory(A1, created="2026-10-01T00:00:00Z"),
                advisory(A3, created="2026-10-04T00:00:00Z"),
            ],
            "draft": [advisory("GHSA-wxwx-wxwx-wxwx", "draft", "2026-10-02T00:00:00Z")],
        }
        self.assertEqual(self.run_ci(), (0, ""))
        self.assertEqual(self.posted_ids(), [A1, "GHSA-wxwx-wxwx-wxwx", A2, A3])
        self.assertEqual(self.outputs(), {"post": "true", "changed": "true"})

    def test_lists_nothing_already_posted(self):
        FakeGitHub.advisories = {"triage": [advisory(A1)]}
        self.run_ci()
        self.assertEqual(self.run_ci(), (0, ""))
        self.assertEqual(self.payloads(), [])
        self.assertEqual(self.outputs(), {"post": "false", "changed": "false"})

    def test_payload_contains_only_id_title_severity_and_link(self):
        FakeGitHub.advisories = {"triage": [advisory(A1)]}
        self.run_ci()
        self.assertEqual(
            self.payloads(),
            [
                {
                    "repository_advisory": {
                        "ghsa_id": A1,
                        "summary": f"Summary of {A1}",
                        "severity": "high",
                        "html_url": f"https://github.com/roostorg/coop/security/advisories/{A1}",
                    }
                }
            ],
        )

    def test_state_file_does_not_contain_ghsa_ids(self):
        FakeGitHub.advisories = {"triage": [advisory(A1)]}
        self.run_ci()
        with open(self.state_file) as f:
            state = f.read()
        self.assertNotIn(A1, state)
        self.assertNotIn(A1.lower(), state)

    def test_advisory_moving_from_triage_to_draft_is_not_listed_again(self):
        FakeGitHub.advisories = {"triage": [advisory(A1)]}
        self.run_ci()
        FakeGitHub.advisories = {"draft": [advisory(A1, "draft")]}
        self.run_ci()
        self.assertEqual(self.payloads(), [])

    def test_state_drops_advisories_no_longer_in_triage_or_draft(self):
        FakeGitHub.advisories = {"triage": [advisory(A1), advisory(A2)]}
        self.run_ci()
        FakeGitHub.advisories = {"triage": [advisory(A2)]}
        self.run_ci()
        self.assertEqual(self.outputs(), {"post": "false", "changed": "true"})
        with open(self.state_file) as f:
            self.assertEqual(len(json.load(f)["posted"]), 1)

    def test_api_error_fails_without_touching_state_or_payload(self):
        code, logs = self.run_ci({**self.env, "ADVISORY_READ_TOKEN": "wrong"})
        self.assertEqual(code, 1)
        self.assertEqual(
            logs, "::error::listing triage advisories failed with HTTP 401\n"
        )
        self.assertFalse(os.path.exists(self.state_file))
        self.assertFalse(os.path.exists(self.payload_file))

    def test_changing_the_key_lists_open_advisories_again(self):
        FakeGitHub.advisories = {"triage": [advisory(A1)]}
        self.run_ci()
        self.run_ci({**self.env, "STATE_KEY": "https://discord.com/api/webhooks/2/x"})
        self.assertEqual(self.posted_ids(), [A1])

    def test_ignores_malformed_ids_and_severities(self):
        FakeGitHub.advisories = {
            "triage": [
                advisory("not-a-ghsa"),
                advisory("GHSA-aaaa-bbbb-cccc"),
                advisory(A1, severity="@everyone"),
            ]
        }
        self.run_ci()
        self.assertEqual(self.posted_ids(), [A1])
        self.assertIsNone(self.payloads()[0]["repository_advisory"]["severity"])

    def test_requires_token_and_key(self):
        for missing in ("STATE_KEY", "ADVISORY_READ_TOKEN"):
            env = {k: v for k, v in self.env.items() if k != missing}
            code, _ = self.run_ci(env)
            self.assertEqual(code, 2)

    def test_advisories_file_is_refused_in_actions(self):
        code, _ = self.run_ci(argv=["--advisories-file", "x.json"])
        self.assertEqual(code, 2)

    def test_local_run_from_advisories_file(self):
        fixture = os.path.join(self.tmp.name, "advisories.json")
        with open(fixture, "w") as f:
            json.dump([advisory(A1)], f)
        env = {"STATE_FILE": self.state_file, "PAYLOAD_FILE": self.payload_file}
        self.assertEqual(self.run_ci(env, ["--advisories-file", fixture]), (0, ""))
        self.assertEqual(self.posted_ids(), [A1])
        with open(self.payload_file) as f:
            self.assertNotIn(SECRET_TEXT, f.read())


if __name__ == "__main__":
    unittest.main()
