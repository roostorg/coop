# Content Proxy Service Dockerfile
# Generic content proxy for iframe rendering with safety controls

# Stage 1: Build the application
FROM node:24-bullseye-slim AS builder

WORKDIR /app

COPY package*.json ./

RUN --mount=type=cache,target=/root/.npm npm ci --prefer-offline

COPY . .

RUN npm run build

RUN npm prune --omit=dev

FROM node:24-bullseye-slim

WORKDIR /app

COPY --from=builder /app/transpiled ./
COPY --from=builder /app/node_modules ./node_modules

RUN npx playwright install --with-deps

EXPOSE 4000
# commenting this out because playwright needs to be installed as the user that
# is running the container.
# TODO: figure out how to install playwright as a non-root user

# RUN groupadd -r coop && useradd -r -g coop -u 1001 -m coop

# RUN chown -R coop:coop /app

# # kubernetes requires us to use a numeric id for the user
# USER 1001

CMD [ "node", "index.js" ]
