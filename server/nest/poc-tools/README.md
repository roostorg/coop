# NestJS PoC tools

Scripts behind the numbers in the NestJS proof-of-concept PR. Not part of the app.

- `codemod.mjs`: moves a GraphQL module's resolver maps into NestJS resolver classes (used for `manualReviewTool.resolvers.ts`).
- `compare.mjs <serverDir> <port> <outPrefix>`: starts a built server (`transpiled/bin/www.js`). It records startup time (`STARTS` runs, default 5), RSS after boot and after 100 GraphQL requests, the introspected SDL (`<outPrefix>.sdl.graphql`), and status, headers and body for 20 HTTP cases (`<outPrefix>.golden.json`). Run it for main and for this branch, then diff the outputs.
- `startup.mjs <mainServerDir> <branchServerDir>`: interleaved startup timing, 7 runs each.
- `bench.sh <label>`: `autocannon -c 10 -d 20` against `/ready`, an authenticated GraphQL query and `POST /items/async`, on :8080.
- `profsum.mjs <cpuProfileDir>`: CPU self-time by package from a `node --cpu-prof` profile.
