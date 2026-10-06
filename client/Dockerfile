FROM node:24.21.0-bookworm-slim AS client_base
WORKDIR /app

# ARG is used to get the release id into the ENV from the command line, and then
# the ENV command makes the release id available to webpack to bundle the JS,
# which can make it available to sentry etc. Must be set before building.
ARG BUILD_ID
ENV BUILD_ID=$BUILD_ID

RUN npm install -g pnpm@12.9.1

# The lockfile and workspace config live at the repo root, so this image builds
# with the repo root as its context and installs only the client package.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY client/package.json ./client/
# client/eslint is a local file: dependency, so it must exist before install.
COPY client/eslint/ ./client/eslint/
RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --filter client --frozen-lockfile --ignore-scripts

COPY client/ ./client/
WORKDIR /app/client
FROM client_base AS build
ARG VITE_OTEL_EXPORTER_OTLP_TRACES_ENDPOINT

# Don't run eslint over the frontend code when building the image, b/c we should
# assume that it'll be run by CRA during local dev, and on Github as a PR hook,
# before we ever deploy. So no need to do it again here.
ENV DISABLE_ESLINT_PLUGIN=true
RUN NODE_OPTIONS="--max-old-space-size=5250" VITE_OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=$VITE_OTEL_EXPORTER_OTLP_TRACES_ENDPOINT pnpm run build

FROM nginx:1.29.1-bookworm AS serve
COPY --from=build /app/client/build /usr/share/nginx/html
ENV NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1
ENV NGINX_ENVSUBST_FILTER=NGINX_
COPY client/nginx.conf /etc/nginx/templates/default.conf.template
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
