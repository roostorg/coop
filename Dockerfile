FROM node:24-bullseye-slim AS server_base
WORKDIR /app

RUN npm install -g pnpm@10.32.0

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
FROM node:24-bullseye-slim AS backend_base
WORKDIR /app
RUN npm install -g pnpm@10.32.0
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