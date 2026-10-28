# This is a fairly-standard multi-stage Dockerfile. We build
# backend in a Node image, and then we copy the built files
# (but not the devDependencies [like typescript, etc.] or the raw source
# files) to final images that we'll actually run. This makes the final image a
# bit lighter and more secure. When building the backend, we always
# copy in package.json and pnpm-lock.yaml first, as a distinct layer, so that
# Docker's cache will let us skip installs when the dependencies haven't changed.
# We build on debian because it has fewer dependency issues than Alpine for our
# native modules, and we don't really care about the larger image size.
FROM node:24.22.1-bookworm-slim AS server_base
WORKDIR /app

RUN npm install -g pnpm@11.28.2

# The lockfile and workspace config live at the repo root, so install from
# there and filter to the server package.
# --ignore-scripts skips the root `prepare` script (husky, a devDependency);
# `pnpm rebuild` then runs the dependency builds pnpm-workspace.yaml allows.
COPY ["pnpm-lock.yaml", "pnpm-workspace.yaml", "package.json", "./"]
COPY ["server/package.json", "./server/"]
RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --filter server --frozen-lockfile --ignore-scripts && \
    pnpm rebuild --filter server
COPY ["server", "./server/"]
WORKDIR /app/server

FROM server_base AS build_backend
RUN pnpm run build

FROM node:24.22.1-bookworm-slim AS backend_prod_deps
WORKDIR /app
RUN npm install -g pnpm@11.28.2
COPY ["pnpm-lock.yaml", "pnpm-workspace.yaml", "package.json", "./"]
COPY ["server/package.json", "./server/"]
RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --filter server --prod --frozen-lockfile --ignore-scripts && \
    pnpm rebuild --filter server

# make a shared layer that can be the base for worker and api images.
FROM node:24.22.1-bookworm-slim AS backend_base
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends dumb-init && rm -rf /var/lib/apt/lists/*
# The server and worker run with plain `node`, so drop the package managers
# the node image bundles (npm, npx, corepack) along with their dependencies.
RUN rm -rf /usr/local/lib/node_modules /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack
# pnpm links server/node_modules into the root node_modules/.pnpm store, so both
# are copied to keep the relative symlinks valid.
COPY --from=backend_prod_deps /app/package.json ./
COPY --from=backend_prod_deps /app/node_modules ./node_modules
COPY --from=backend_prod_deps /app/server/package.json ./server/
COPY --from=backend_prod_deps /app/server/node_modules ./server/node_modules
COPY --from=build_backend /app/server/transpiled ./server/
WORKDIR /app/server

# See https://github.com/Yelp/dumb-init
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# ARG is used to get the release id into the ENV from the command line, and then
# the ENV command exposes the release id to the API app at runtime for logging.
# We put this after pnpm installs so it doesn't invalidate cache of prior steps,
# as it always changes.
ARG BUILD_ID
ENV BUILD_ID=$BUILD_ID

# Expose 8080 because the backend will run on this port absent a
# process.env.PORT to the contrary.
FROM backend_base AS build_server
EXPOSE 8080
CMD ["node", "bin/www.js"]

FROM backend_base AS build_worker_runner
CMD ["node", "bin/run-worker-or-job.js"]
