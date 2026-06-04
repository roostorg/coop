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

/**
 * Google Maps Places API key used for the "Points of Interest" location
 * search experience (Location Banks, rule location conditions, etc.).
 *
 * Configure with `VITE_GOOGLE_PLACES_API_KEY` at build time. The key is
 * sent in client-side requests to Google's Places API; lock it down via
 * HTTP referrer + API allowlists in the Google Cloud Console rather than
 * relying on it being secret. Adopters who don't want to integrate
 * Google Maps can leave this unset — the Points of Interest tab will be
 * disabled in the UI and the rest of Location Banks (geohashes, banks)
 * keeps working.
 */
export const GOOGLE_PLACES_API_KEY: string =
  import.meta.env.VITE_GOOGLE_PLACES_API_KEY ?? '';

/**
 * Whether this Coop build has a Google Maps Places API key configured.
 *
 * UI surfaces that depend on Google Places (e.g. the Points of Interest
 * tab in `LocationInputModal`) should disable themselves when this is
 * false rather than silently failing at request time.
 */
export const IS_GOOGLE_PLACES_API_CONFIGURED: boolean =
  GOOGLE_PLACES_API_KEY.length > 0;
