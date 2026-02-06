# Database Migrator

This package handles database schema migrations and seed data.

## Concepts

### Migrations vs Seeds

| Type | Purpose | When it runs |
| :---- | :---- | :---- |
| **Migration** | Schema changes (tables, columns, indexes) | All environments |
| **Seed** | Test fixtures and environment-specific data | Single environment only |

### How Seeds Work

Seeds are timestamped and run interspersed with migrations (not after). This ensures each seed script runs against the exact schema it was written for, preventing breakage from future schema changes.

## Usage

See `.devops/migrator/README.md` for CLI commands and setup instructions.