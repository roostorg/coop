FROM node:20-bullseye-slim AS client_base
WORKDIR /app

# ARG is used to get the release id into the ENV from the command line, and then
# the ENV command makes the release id available to webpack to bundle the JS,
# which can make it available to sentry etc. Must be set before building.
ARG BUILD_ID
ENV BUILD_ID=$BUILD_ID

ARG NPM_TOKEN

COPY .npmrc .
COPY package*.json .
RUN --mount=type=cache,target=/root/.npm NPM_TOKEN=$NPM_TOKEN npm ci

COPY . .
FROM client_base

ARG REACT_APP_OTEL_EXPORTER_OTLP_TRACES_ENDPOINT

# Don't run eslint over the frontend code when building the image, b/c we should
# assume that it'll be run by CRA during local dev, and on Github as a PR hook,
# before we ever deploy. So no need to do it again here.
ENV DISABLE_ESLINT_PLUGIN=true
RUN NODE_OPTIONS="--max-old-space-size=5250" REACT_APP_OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=$REACT_APP_OTEL_EXPORTER_OTLP_TRACES_ENDPOINT npm run build
