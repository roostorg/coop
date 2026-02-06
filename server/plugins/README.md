# Plugin Architecture

This directory contains the contracts and utilities that power Coop's pluggable
infrastructure story. Adapters implement small TypeScript interfaces and are
loaded dynamically at runtime, which keeps the core service independent from
any particular warehouse or analytics vendor.

The goals of this layout are:

- Allow first-party adapters (Snowflake, Clickhouse, Postgres, etc.) to live
  alongside community-provided ones without touching core code
- Make it trivial for deployers to publish and consume custom adapters via NPM
- Keep the contracts minimal so the abstractions do not leak complex
  vendor-specific behaviour

## Directory Layout

```
server/plugins/
├── analytics/         # Analytics logging/querying contracts
│   ├── IAnalyticsAdapter.ts
│   ├── types.ts
│   └── examples/
├── warehouse/         # OLTP warehouse interfaces
│   ├── IWarehouseAdapter.ts
│   ├── types.ts
│   └── examples/
└── utils/             # Shared helper utilities for adapter authors
```

The `examples` folders intentionally ship tiny reference implementations (for
instance a no-op adapter) so that authors can copy/paste a starting point.