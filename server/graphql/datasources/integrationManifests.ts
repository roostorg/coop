/**
 * Re-export built-in manifests and types from the integration registry
 * so GraphQL datasources can use them without the registry depending on graphql.
 */
export {
  BUILD_IN_MANIFESTS,
  type AvailableIntegration,
  type IntegrationManifestEntry,
  type ModelCard,
  type ModelCardField,
  type ModelCardSection,
  type ModelCardSubsection,
} from '../../services/integrationRegistry/index.js';
