/**
 * Centralized URL configuration for the Coop client.
 *
 * Coop is open source and self-hosted, so any deployment-specific URL must come
 * from the deployment's environment rather than being hardcoded. Add new URL
 * constants here (sourced from `import.meta.env.VITE_*`) instead of inlining
 * literals at call sites.
 */

/**
 * Base URL of this Coop instance, used to construct user-facing links such as
 * password reset / invite links, dashboard deep-links, and API code samples.
 *
 * Configure with `VITE_UI_URL` at build time to override the runtime origin
 * (useful when the client is served from a different host than its public
 * URL, e.g. behind a reverse proxy). Falls back to the browser's current
 * origin when unset.
 */
export const HOST_URL: string =
  import.meta.env.VITE_UI_URL ?? window.location.origin;

/**
 * Base URL of the published Coop documentation site.
 *
 * Configure with `VITE_DOCS_URL` at build time to point at a fork's or
 * mirror's docs. The default value lives in `client/.env.example` and is
 * applied via the standard `.env` copy step; this code-level fallback only
 * kicks in if the variable is missing entirely from the build environment.
 */
export const DOCS_URL: string =
  import.meta.env.VITE_DOCS_URL ?? 'https://roostorg.github.io/coop/latest';
