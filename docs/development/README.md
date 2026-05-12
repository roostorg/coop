# Getting Started

This guide walks through setting up Coop for the first time. See [Local Development](local.md) for prerequisites, configuration details, troubleshooting, and more. You may also want to familiarize yourself with Coop's [Basic Concepts](../user/concepts.md) for additional context.

To get Coop running:

1. **Start all backing services** (see [Docker Services](local.md#docker-services) for ports and health-check commands):

   ```bash
   npm run up
   ```

   Wait for PostgreSQL, ClickHouse, ScyllaDB, and Redis to be healthy before continuing.

2. **Install dependencies**:

   ```bash
   npm install
   (cd client && npm install)
   (cd server && npm install)
   (cd db && npm install)
   ```

3. **Copy `.env.example` files to `.env`** in `server/` and `client/`. The defaults work with the Docker Compose services out of the box. See [Environment Setup](local.md#environment-setup) for a full breakdown of available options.

4. **Create databases** and run migrations:

   ```bash
   npm run db:create -- --env staging --db api-server-pg
   npm run db:create -- --env staging --db scylla
   npm run db:create -- --env staging --db clickhouse

   npm run db:update -- --env staging --db api-server-pg
   npm run db:update -- --env staging --db scylla
   npm run db:update -- --env staging --db clickhouse
   ```

5. **Create an organization** and admin user:

   ```bash
   npm run create-org
   ```

6. **Copy static assets**:

   ```bash
   cd server && npm run copy-assets
   ```

7. **Start the application** (see [Running the Application](local.md#running-the-application) for additional options):

   ```bash
   npm run client:start   # Terminal 1
   npm run server:start   # Terminal 2
   npm run generate:watch # Terminal 3 (optional; keeps GraphQL types in sync)
   ```

Log in at [localhost:3000](http://localhost:3000) using the credentials printed by `create-org`. The initial page load may take a moment.
