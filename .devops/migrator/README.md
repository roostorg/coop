# Database Migrator CLI

A Node.js CLI for running database migrations and seeds.

## Quick Start

```
npm install
node --loader ts-node/esm --require dotenv/config index.ts
```

This displays available commands and arguments.

## Environment Variables

Copy `.env.example` and configure your database connection settings. These match the variables used by the API server.

## Creating New Migrations

```shell
# Generate a new migration file 
  node --loader ts-node/esm index.ts generate:migration --db api-server-pg --name "add_users_table"
```

See `migrator/README.md` for concepts on migrations vs seeds.