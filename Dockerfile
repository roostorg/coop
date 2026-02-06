# This is a fairly-standard multi-stage Dockerfile. We build 
# backend in a Node image, and then we copy the built files
# (but not the devDependencies [like typescript, etc.] or the raw source
# files) to final images that we'll actually run. This makes the final image a
# bit lighter and more secure. When building the backend, we always
# copy in package.json and package-lock.json first, as a distinct layer, so that
# Docker's cache will let us skip installs when the dependencies haven't changed.
# We build on debian because it has fewer dependency issues than Alpine for our
# native modules, and we don't really care about the larger image size.
FROM node:20-bullseye-slim AS server_base
WORKDIR /app

ARG NPM_TOKEN
# Append "--build-arg OMIT_SNOWFLAKE='true'" to your call to avoid installing
# optional snowflake-promise dependency
ARG OMIT_SNOWFLAKE

COPY [".npmrc", "./"]
COPY ["server/package.json", "server/package-lock.json", "./"]
RUN if [ "$OMIT_SNOWFLAKE" = "true" ]; then \
      npm pkg set overrides.snowflake-promise='npm:empty-module@^1.0.0'; \
    fi
RUN NPM_TOKEN=$NPM_TOKEN npm ci
COPY ["server", "./"]

FROM server_base AS build_backend
RUN npm run build

# make a shared layer that can be the base for worker and api images.
FROM node:20-bullseye-slim AS backend_base
WORKDIR /app
RUN apt-get update && apt-get install dumb-init
COPY [".npmrc", "./"]
COPY --from=build_backend ["/app/package.json", "/app/package-lock.json", "./"]
ARG NPM_TOKEN
RUN NPM_TOKEN=$NPM_TOKEN npm ci --omit=dev
COPY --from=build_backend /app/transpiled ./

# See https://github.com/Yelp/dumb-init
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# ARG is used to get the release id into the ENV from the command line, and then
# the ENV command exposes the release id to the API app at runtime for logging.
# We put this after npm installs so it doesn't invalidate cache of prior steps,
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
