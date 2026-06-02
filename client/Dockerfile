FROM node:24.14.1-bullseye-slim AS client_base
WORKDIR /app

# ARG is used to get the release id into the ENV from the command line, and then
# the ENV command makes the release id available to vite to bundle the JS,
# which can make it available to sentry etc. Must be set before building.
ARG BUILD_ID
ENV BUILD_ID=$BUILD_ID

RUN npm install -g pnpm@10.22.0

# Copy root lockfile + workspace config, then client package.json
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY client/package.json ./client/
# client/eslint is a local file: dependency — must exist before pnpm install scans it
COPY client/eslint/ ./client/eslint/
RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --filter client --frozen-lockfile --ignore-scripts

COPY client/ ./client/

FROM client_base

ARG VITE_OTEL_EXPORTER_OTLP_TRACES_ENDPOINT

# Don't run eslint over the frontend code when building the image, b/c we should
# assume that it'll be run during local dev, and on Github as a PR hook,
# before we ever deploy. So no need to do it again here.
ENV DISABLE_ESLINT_PLUGIN=true
RUN cd client && NODE_OPTIONS="--max-old-space-size=5250" VITE_OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=$VITE_OTEL_EXPORTER_OTLP_TRACES_ENDPOINT pnpm run build
