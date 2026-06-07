FROM node:24.14.1-bullseye-slim AS builder

WORKDIR /app

COPY package*.json .

# Install dependencies
RUN --mount=type=cache,target=/root/.npm npm ci

COPY . .

RUN npm run build

RUN npm prune --omit=dev

FROM node:24.14.1-bullseye-slim AS base

WORKDIR /app

# Keep output under ./build (not flattened) so the `db:*` scripts resolve
# `build/index.js` both here and locally after `npm run build`.
COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules

# I create a separate stage for these steps because they are not needed for
# development and chown can take a long time to run
FROM base

# -m creates a home dir for `coop` so `npm run` has a writable HOME for its
# cache/logs (the container runs `npm run db:*` as this non-root user).
RUN groupadd -r coop && useradd -r -g coop -u 1001 -m coop

RUN chown -R coop:coop /app

# kubernetes requires us to use a numeric id for the user
USER 1001

# One-shot migrations task; override the command at runtime, e.g.
#   npm run db:update -- --db api-server-pg --env prod
CMD ["node", "build/index.js"]
