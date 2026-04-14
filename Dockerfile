# This is a fairly-standard multi-stage Dockerfile. We build
# backend in a Node image, and then we copy the built files
# (but not the devDependencies [like typescript, etc.] or the raw source
# files) to final images that we'll actually run. This makes the final image a
# bit lighter and more secure. When building the backend, we always
# copy in package.json and pnpm-lock.yaml first, as a distinct layer, so that
# Docker's cache will let us skip installs when the dependencies haven't changed.
# We build on debian because it has fewer dependency issues than Alpine for our
# native modules, and we don't really care about the larger image size.
FROM node:24.14.1-bullseye-slim AS server_base
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm@10.22.0

# Append "--build-arg OMIT_SNOWFLAKE='true'" to your call to avoid installing
# optional snowflake-promise dependency
ARG OMIT_SNOWFLAKE

# Copy root lockfile + workspace config, then server package.json
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY server/package.json ./server/
RUN if [ "$OMIT_SNOWFLAKE" = "true" ]; then \
      cd server && npm pkg set pnpm.overrides.snowflake-promise='npm:empty-module@^1.0.0'; \
    fi
RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --filter server --frozen-lockfile --ignore-scripts && \
    pnpm rebuild --filter server
COPY server/ ./server/

FROM server_base AS build_backend
RUN cd server && pnpm run build

# make a shared layer that can be the base for worker and api images.
FROM node:24.14.1-bullseye-slim AS backend_base
WORKDIR /app
RUN npm install -g pnpm@10.22.0
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY server/package.json ./server/
RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --filter server --prod --frozen-lockfile --ignore-scripts && \
    pnpm rebuild --filter server
COPY --from=build_backend /app/server/transpiled ./server/

# Use `init: true` in docker-compose for proper signal handling (replaces dumb-init)

ARG BUILD_ID
ENV BUILD_ID=$BUILD_ID

FROM backend_base AS build_server
EXPOSE 8080
CMD ["node", "server/bin/www.js"]

FROM backend_base AS build_worker_runner
CMD ["node", "server/bin/run-worker-or-job.js"]