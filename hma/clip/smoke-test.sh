#!/usr/bin/env bash
# Happy-path smoke test for an HMA with the optional CLIP signal.
#
# Adds one image to a temporary bank, then checks that edited copies of it match
# (with a score between 0.90 and 1.00) and that different images do not. The
# images are the fixtures in hma/clip/fixtures, uploaded as files, so the test
# needs no internet access and gives the same scores every run. Prints each
# command it runs and a results table, exits nonzero on failure, and deletes the
# temporary bank on exit.
#
# A score is 1 minus the cosine distance between the two CLIP embeddings.
# HMA only reports a match within distance 0.10, so a match always scores 0.90
# or more, and anything farther away has no score.
#
# Usage: hma/clip/smoke-test.sh
#   HMA_URL   default http://localhost:9876
set -euo pipefail

BASE="${HMA_URL:-http://localhost:9876}"
FIXTURES="$(cd "$(dirname "$0")" && pwd)/fixtures"
BANK="CLIP_SMOKE_TEST_$$"
JSON='Content-Type: application/json'
# name:expectation, where a match must score at least the number given.
PROBES="scene-resized.jpg:match:0.95 scene-desaturated.jpg:match:0.93 scene-blurred.jpg:match:0.90 other-building.jpg:none other.jpg:none"

run() { echo "+ $*" >&2; "$@"; }
hash_of() { curl -fsS --max-time 900 -F "photo=@$1" "$BASE/h/hash" | python3 -c "import json,sys; print(json.load(sys.stdin)['clip_float'])"; }
# Restricted to the temporary bank so other banks holding the same image cannot satisfy the check.
# The 4 KB hash goes in the query string, which HMA accepts.
# lookup_raw prints the response body, then the HTTP status on its own last line.
lookup_raw() { curl -sS --max-time 30 -G "$BASE/m/lookup" --data-urlencode "signal_type=clip_float" --data-urlencode "signal=$1" --data-urlencode "banks=$BANK" -w '\n%{http_code}'; }
fail() { echo "FAIL: $*" >&2; exit 1; }

# lookup prints the body of a successful lookup; any other status fails the test.
lookup() {
  local out code
  out=$(lookup_raw "$1") || fail "the lookup request to $BASE failed"
  code=${out##*$'\n'}
  [ "$code" = 200 ] || fail "the lookup returned HTTP $code: ${out%$'\n'*}"
  printf '%s' "${out%$'\n'*}"
}

cleanup() { curl -fsS -X DELETE "$BASE/c/bank/$BANK" >/dev/null 2>&1 || true; }
trap cleanup EXIT

run curl -fsS "$BASE/c/signal_type" | grep -q clip_float || fail "HMA is not reachable at $BASE, or it has no clip_float signal (is it built from hma/clip/Dockerfile?)"

echo "+ hash bank/scene.jpg (first run downloads the model; this can take a while)" >&2
HASH=$(hash_of "$FIXTURES/bank/scene.jpg")
[ "${#HASH}" -eq 4096 ] || fail "expected a 4096-character clip_float hash, got ${#HASH}"
echo "  clip_float hash: ${#HASH} characters, starting ${HASH:0:16}..." >&2

run curl -fsS -X POST "$BASE/c/banks" -H "$JSON" -d "{\"name\":\"$BANK\",\"enabled_ratio\":\"1.0\"}" >/dev/null
run curl -fsS -X POST -F "photo=@$FIXTURES/bank/scene.jpg" "$BASE/c/bank/$BANK/content" >/dev/null

echo "+ GET $BASE/m/lookup (retrying until HMA has indexed the bank, up to 5 minutes)" >&2
ATTEMPTS=0
RESULT="{}"
for _ in $(seq 1 30); do
  ATTEMPTS=$((ATTEMPTS + 1))
  OUT=$(lookup_raw "$HASH") || fail "the lookup request to $BASE failed"
  CODE=${OUT##*$'\n'}
  RESULT=$(printf '%s' "${OUT%$'\n'*}" | tr -d ' \n')
  # HMA answers 503 until its first index is built, and {} until the bank is in
  # it. Both mean "not yet"; any other status is a real failure.
  case "$CODE" in
    200) [ "$RESULT" != "{}" ] && break ;;
    503) RESULT="{}" ;;
    *) fail "the lookup returned HTTP $CODE: $RESULT" ;;
  esac
  # One dot per retry, on a single line.
  [ "$ATTEMPTS" -eq 1 ] && printf '  waiting for HMA to index the bank (a dot per 10 seconds)' >&2
  printf '.' >&2
  sleep 10
done
[ "$ATTEMPTS" -gt 1 ] && echo >&2
[ "$RESULT" != "{}" ] || fail "the bank was not indexed within 5 minutes"
echo "  indexed after $ATTEMPTS attempt(s)" >&2

echo "+ hash each image in fixtures/probe and look it up in the bank" >&2
printf '\n  %-24s %-9s %-7s %-9s %s\n' image expected score distance result >&2
FAILED=0
for probe in $PROBES; do
  IFS=: read -r name expect min <<<"$probe"
  PROBE_HASH=$(hash_of "$FIXTURES/probe/$name")
  # HMA reports the cosine distance of the closest match; the score is 1 minus it.
  PROBE_RESULT=$(lookup "$PROBE_HASH") || exit 1  # lookup has already said why
  OUTCOME=$(echo "$PROBE_RESULT" | python3 -c "
import json,sys
m=json.load(sys.stdin).get('$BANK')
expect,minimum='$expect',float('${min:-0}')
if not m:
    score,distance,matched='-','-',False
else:
    distance=min(float(x['distance']) for x in m); score=1-distance; matched=True
ok = (matched and score >= minimum) if expect == 'match' else not matched
print('%s|%s|%s|%s' % (('%.3f' % score) if matched else '0', ('%.3f' % distance) if matched else '-', 'match' if matched else 'no match', 'ok' if ok else 'FAIL'))
")
  IFS='|' read -r score distance _ verdict <<<"$OUTCOME"
  [ "$expect" = "match" ] && expected="match" || expected="no match"
  printf '  %-24s %-9s %-7s %-9s %s\n' "$name" "$expected" "$score" "$distance" "$verdict" >&2
  [ "$verdict" = "ok" ] || FAILED=1
done
echo >&2
[ "$FAILED" -eq 0 ] || fail "at least one image did not behave as expected (see the table)"

echo "PASS: HMA hashes, indexes and matches with CLIP as expected"
