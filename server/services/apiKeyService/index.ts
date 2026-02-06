import type { ApiKeyMetadata } from './apiKeyService.js';

export {
  type ApiKeyMetadata,
  type ApiKeyService,
  default as makeApiKeyService,
} from './apiKeyService.js';
export { type ApiKeyServicePg } from './dbTypes.js';

export interface ApiKeyStorage {
  store(key: string, orgId: string, meta: ApiKeyMetadata): Promise<{ keyId: string }>;
  fetch(orgId: string): Promise<{ key: string; metadata: ApiKeyMetadata } | false>;
}
