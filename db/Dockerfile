FROM node:24.21.0-bookworm-slim AS pnpm_base

WORKDIR /app

RUN npm install -g pnpm@10.34.5

# The lockfile and workspace config live at the repo root, so this image builds
# with the repo root as its context and installs only the db package.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY db/package.json ./db/

FROM pnpm_base AS builder

# Install dependencies. --ignore-scripts skips the root `prepare` script (husky,
# a devDependency); `pnpm rebuild` then runs the allowed dependency builds.
RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --filter coop-data-migrator --frozen-lockfile --ignore-scripts && \
    pnpm rebuild --filter coop-data-migrator

COPY db/ ./db/

RUN cd db && pnpm run build

FROM pnpm_base AS prod_deps

RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --filter coop-data-migrator --prod --frozen-lockfile --ignore-scripts && \
    pnpm rebuild --filter coop-data-migrator

FROM node:24.21.0-bookworm-slim AS base

WORKDIR /app

# pnpm links db/node_modules into the root node_modules/.pnpm store, so both
# are copied to keep the relative symlinks valid.
COPY --from=prod_deps /app/node_modules ./node_modules
COPY --from=prod_deps /app/db/node_modules ./db/node_modules

# Keep output under ./build (not flattened) so the `db:*` scripts resolve
# `build/index.js` both here and locally after `pnpm run build`.
COPY --from=builder /app/db/build ./db/build
COPY --from=builder /app/db/package.json ./db/package.json

WORKDIR /app/db

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
