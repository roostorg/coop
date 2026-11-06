# Backend CodeQL analysis

This query reports paths from untrusted input to Coop's outbound HTTP URLs. Findings are review prompts, not confirmed SSRF vulnerabilities. It does not change request handling. Whether findings block PRs depends on the repository's code scanning merge-protection settings.

## Run

Use the official [CodeQL CLI](https://github.com/github/codeql-cli-binaries/releases/tag/v2.27.4) 2.27.4 on `PATH`. From the repository root:

```sh
codeql pack ci scripts/codeql
codeql pack ci scripts/codeql/tests
codeql query compile scripts/codeql/ExternalHttpUrl.ql --check-only --threads=2 --ram=4096
codeql test run scripts/codeql/tests --threads=2 --ram=4096
```

The native CodeQL runner checks the shared analysis using CodeQL's `InlineExpectationsTest` library. A `// $ hasUrlFlow` comment beside a URL expression means that untrusted input must reach it. An unmarked URL must not have a flow. Both missing and unexpected flows fail the test. No application services or credentials are needed.

The self-contained fixtures cover direct calls, aliases, cross-file helpers, route factories, worker payloads, HTTP responses, URL validation, caching, and constructor-injected bound callbacks. Eleven destinations have expected flows. Five negative controls cover request bodies at fixed destinations, overwritten URLs, and pre-bound destinations. These are static-analysis inputs, not a runnable application.

`ExternalHttpUrl.expected` stays empty: the test query reports only expectation failures. Change the fixture comments when intentionally changing expected behavior; do not accept failures into the expected file. The tests check flow presence, not the internal graph or diagnostic wording. The report query exports full paths for review. See [GitHub's query testing guide](https://docs.github.com/en/code-security/how-tos/scan-code-for-vulnerabilities/scan-from-the-command-line/testing-custom-queries).

## Analyze the backend

Fixture tests check the rules on small examples. A backend scan checks how those rules apply to Coop's actual code. Google Content Safety and Whisper signal inputs reaching their media downloads are useful examples to inspect when changing the models. Such a path establishes input influence, not a vulnerability.

Use a new database path outside the repository, with `server/` as its source root:

```sh
codeql database create /path/to/backend-db --language=javascript-typescript --source-root=server --threads=2 --ram=4096
codeql database analyze /path/to/backend-db scripts/codeql/ExternalHttpUrl.ql --format=sarif-latest --output=/path/to/report.sarif --threads=2 --ram=4096
```

## Scope

- Sources: Express input, Coop handler factories, typed GraphQL arguments, signal inputs, queue payloads, NCMEC media, and HTTP response bodies. Signal and queue inputs are independent trust boundaries; the query does not prove provenance across storage or queues.
- Sinks: URL properties passed to the `fetchHTTP` contract. Recognition uses property/type names and local aliases, not complete BottleJS service registration or import resolution. Request-object mutation and spreads are not comprehensively modeled.
- Propagation: cache misses preserve the wrapped callable; recognized bound callbacks map arguments to parameters after the pre-bound arguments. The callback rule excludes ambiguous bound targets, spreads, and rest parameters. It approximates calling context and can produce spurious paths.
- Policy: URL validation does not suppress findings. Encoded path/query influence under a fixed host is reported alongside whole-URL influence. This is not a complete SSRF policy or a substitute for dependency vulnerability scanning.

The cache and callback rules use internal CodeQL APIs. The query library and its transitive dependencies are locked; rerun the checks when upgrading the CLI or packs. CodeQL's QL libraries use the MIT license. The CLI has separate terms permitting analysis of open-source codebases; it is not bundled here.

## GitHub integration

`.github/workflows/codeql-tests.yml` compiles the report query and runs the native fixture tests when the query tooling or configuration changes. It verifies the CLI download against a pinned checksum and installs the locked query dependencies. The workflow needs no secrets or write permissions and supports fork and stacked pull requests. It does not scan application code or upload alerts.

`.github/codeql/codeql-config.yml` adds the report query to GitHub's managed CodeQL scan without disabling the standard queries or restricting analysis to the backend. It excludes the fixture directory from application analysis. Committing this file alone does not activate it.

To activate the configuration, an organization administrator must create the text repository property `github-codeql-config-file` if needed, then set its value for `roostorg/coop` to `.github/codeql/codeql-config.yml`. Leave the organization-wide default unset to avoid affecting other repositories. See [GitHub's repository-property documentation](https://docs.github.com/en/code-security/concepts/code-scanning/repository-properties#custom-configuration-files).

On the first scan after activation, verify that the JavaScript/TypeScript analysis includes `coop/external-http-url`, retains the standard queries, and excludes fixture results. GitHub's managed scan uses its own CodeQL version, so this run also checks compatibility beyond the pinned local test version. Check merge-protection settings to keep these recommendation-level findings advisory; they do not distinguish destination control from harmless URL-component influence or establish exploitability.
