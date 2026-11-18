#!/usr/bin/env bash
# Compares the schema built by the Umzug migrations with what Prisma knows.
#
#   prisma/check/schema-check.sh <umzug-db-url> <scratch-db-url> <shadow-db-url>
#
# <umzug-db-url>   a database built by `pnpm run db:update --db api-server-pg`
# <scratch-db-url> an EMPTY database; receives `prisma migrate deploy`
# <shadow-db-url>  an EMPTY database for Prisma's shadow replays
#
# Fails if
#  1. the Prisma model and the Umzug-built database differ in anything Prisma
#     models (beyond the known duplicate reporting_rules FKs and
#     SequelizeMeta, which Prisma doesn't model), or
#  2. replaying prisma/migrations onto an empty database does not reproduce the
#     Umzug-built database object for object (ignoring _prisma_migrations,
#     SequelizeMeta, and CHECK expressions pg_dump re-renders equivalently).
set -euo pipefail
cd "$(dirname "$0")/../.."
umzug_url=$1 scratch_url=$2 shadow_url=$3
work=$(mktemp -d)

PRISMA_DATABASE_URL=$umzug_url npx prisma migrate diff \
  --from-config-datasource --to-schema prisma/schema.prisma --script \
  > "$work/model-diff.sql"
grep -vE '^(-- DropForeignKey|-- DropTable|DROP TABLE "SequelizeMeta";|ALTER TABLE "reporting_rules"\."reporting_rules_to_(actions|item_types|policies)" DROP CONSTRAINT "reporting_rules_to_\w+_reporting_rule_id_fkey";)?$' \
  "$work/model-diff.sql" > "$work/model-drift.sql" || true
if [ -s "$work/model-drift.sql" ]; then
  echo "Prisma model differs from the Umzug-built database:" >&2
  cat "$work/model-drift.sql" >&2
  exit 1
fi

PRISMA_DATABASE_URL=$scratch_url PRISMA_SHADOW_DATABASE_URL=$shadow_url \
  npx prisma migrate deploy

normalise() {
  ${PSQL:-psql} "$1" -q < prisma/check/catalog.sql \
    | grep -vE '\b(_prisma_migrations|SequelizeMeta)\b' \
    | sed -E "s/\('([^']*)'::character varying\)::text/'\1'::character varying/g; s/ANY \(\(ARRAY\[(.*)\]\)::text\[\]\)/ANY (ARRAY[\1])/; s/ANY \(ARRAY\[/ANY (ARRAY[/"
}
normalise "$umzug_url" > "$work/umzug.txt"
normalise "$scratch_url" > "$work/prisma.txt"
if ! diff -u "$work/umzug.txt" "$work/prisma.txt"; then
  echo "prisma/migrations does not reproduce the Umzug-built schema" >&2
  exit 1
fi
echo "Schema check passed."
