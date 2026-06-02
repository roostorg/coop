# To build one auto-instrumentation image for Node.js, please:
# - Ensure the packages are installed in the `/autoinstrumentation` directory. This is required as when instrumenting the pod,
#   one init container will be created to copy all the content in `/autoinstrumentation` directory to your app's container. Then
#   update the `NODE_OPTIONS` environment variable accordingly. To achieve this, you can mimic the one in `autoinstrumentation/nodejs/Dockerfile`
#   by using multi-stage builds. In the first stage, install all the required packages in one custom directory.
#   Then in the second stage, copy the directory to `/autoinstrumentation`.
# - Ensure you have `@opentelemetry/api`, `@opentelemetry/auto-instrumentations-node`, and `@opentelemetry/sdk-node` or your customized
#   alternatives installed.
# - Grant the necessary access to `/autoinstrumentation` directory. `chmod -R go+r /autoinstrumentation`
# - For auto-instrumentation by container injection, the Linux command cp is
#   used and must be availabe in the image.
FROM node:24.21.0 AS build

WORKDIR /operator-build

RUN npm install -g pnpm@10.34.5

# The lockfile and workspace config live at the repo root, so this image builds
# with the repo root as its context and installs only this package.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY nodejs-instrumentation/package.json ./nodejs-instrumentation/

RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --filter nodejs-instrumentation --frozen-lockfile --ignore-scripts && \
    pnpm rebuild --filter nodejs-instrumentation

COPY nodejs-instrumentation/ ./nodejs-instrumentation/

RUN pnpm --filter nodejs-instrumentation run build

# The operator copies /autoinstrumentation into the app container, so its
# node_modules must be real directories, not pnpm's symlinks into a store.
RUN pnpm --filter nodejs-instrumentation deploy --legacy --prod --config.node-linker=hoisted /deploy

FROM busybox:1.38.0

COPY --from=build /deploy/node_modules /autoinstrumentation/node_modules
COPY --from=build /operator-build/nodejs-instrumentation/transpiled/ /autoinstrumentation

RUN chmod -R go+r /autoinstrumentation

# RUN adduser -D -u 1001 coop
# RUN chown -R coop:coop /autoinstrumentation

# USER 1001
