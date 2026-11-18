#!/bin/bash
# bench.sh <label> ; server on :8080, cookies.txt + apikey.txt in $S
S=${S:?set S to a directory holding cookies.txt (curl cookie jar) and apikey.txt}
SID=$(awk '/connect.sid/ {print $NF}' $S/cookies.txt)
K=$(cat $S/apikey.txt)
AC="npx -y autocannon@8.0.0 -c 10 -d 20 -j"
run() { $AC "$@" 2>/dev/null | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);console.log(process.argv[1].padEnd(10), process.argv[2].padEnd(16),'p50',j.latency.p50,'p97.5',j.latency.p97_5,'p99',j.latency.p99,'req/s',j.requests.average,'non2xx',j.non2xx,'errors',j.errors)})" "$LABEL" "$NAME"; }
LABEL=$1
NAME=ready run http://127.0.0.1:8080/api/v1/ready
NAME=gql-authed run -m POST -H content-type=application/json -H "cookie=connect.sid=$SID" -b '{"query":"{ me { id } myOrg { id } }"}' http://127.0.0.1:8080/api/v1/graphql
NAME=items-async run -m POST -H content-type=application/json -H "x-api-key=$K" -b '{"items":[]}' http://127.0.0.1:8080/api/v1/items/async
