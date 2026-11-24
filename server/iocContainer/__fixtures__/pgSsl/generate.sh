#!/bin/sh
# Regenerates the TLS fixtures for pgSsl.test.ts: a throwaway CA (ca.pem) and a
# certificate for IP 127.0.0.1 that it signs (server.pem, server.key). They are
# used only by tests. The CA's private key is discarded, so nothing else can be
# signed by it.
set -eu
cd "$(dirname "$0")"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

serial() { echo "0x$(openssl rand -hex 16)"; }

openssl req -new -newkey rsa:2048 -nodes -subj '/CN=Coop test CA' \
  -keyout "$tmp/ca.key" -out "$tmp/ca.csr"
printf '%s\n' 'basicConstraints=critical,CA:TRUE' \
  'subjectKeyIdentifier=hash' 'authorityKeyIdentifier=keyid:always' \
  >"$tmp/ca.ext"
openssl x509 -req -in "$tmp/ca.csr" -signkey "$tmp/ca.key" -sha256 \
  -days 36500 -set_serial "$(serial)" -extfile "$tmp/ca.ext" -out ca.pem

openssl req -new -newkey rsa:2048 -nodes -subj '/CN=127.0.0.1' \
  -keyout server.key -out "$tmp/server.csr"
printf '%s\n' 'subjectAltName=IP:127.0.0.1' 'basicConstraints=CA:FALSE' \
  'subjectKeyIdentifier=hash' 'authorityKeyIdentifier=keyid' >"$tmp/server.ext"
openssl x509 -req -in "$tmp/server.csr" -CA ca.pem -CAkey "$tmp/ca.key" \
  -sha256 -days 36500 -set_serial "$(serial)" -extfile "$tmp/server.ext" \
  -out server.pem
