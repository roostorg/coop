# Fixtures

Shared Playwright fixtures and helpers go here — e.g. an authenticated-session
fixture that logs in once and reuses storage state across specs, or factory
helpers that seed item types / rules via the GraphQL API before a UI flow.

Import them by extending the base `test`:

```ts
// fixtures/auth.ts
import { test as base } from '@playwright/test';

export const test = base.extend({
  // ...login once, expose an authenticated page
});
```

Then in a spec: `import { test, expect } from "../fixtures/auth";`
