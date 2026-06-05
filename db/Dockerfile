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

RUN groupadd -r coop && useradd -r -g coop -u 1001 coop

RUN chown -R coop:coop /app

# kubernetes requires us to use a numeric id for the user
USER 1001

# One-shot migrations task; override the command at runtime, e.g.
#   npm run db:update -- --db api-server-pg --env prod
CMD ["node", "build/index.js"]
