FROM node:20-bullseye-slim AS builder

WORKDIR /app

ARG NPM_TOKEN

COPY .npmrc .

COPY package*.json .

# Install dependencies
RUN --mount=type=cache,target=/root/.npm NPM_TOKEN=$NPM_TOKEN npm ci

COPY . .

RUN npm run build

RUN npm prune --omit=dev

FROM node:20-bullseye-slim AS base

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
