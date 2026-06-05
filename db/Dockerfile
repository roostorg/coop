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

COPY --from=builder /app/build ./
COPY --from=builder /app/node_modules ./node_modules

# I create a separate stage for these steps because they are not needed for
# development and chown can take a long time to run
FROM base

RUN groupadd -r coop && useradd -r -g coop -u 1001 coop

RUN chown -R coop:coop /app

# kubernetes requires us to use a numeric id for the user
USER 1001

# Meant to run as a one-shot task (e.g. an ECS RunTask on deploy). The entrypoint
# is empty so the runtime can supply the command (and the DB connection env vars),
#   npm run db:update -- --db api-server-pg --env prod
#   npm run db:create -- --db api-server-pg --env prod
CMD ["node", "index.js"]
