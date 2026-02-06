import {
  type ApiKeyMetadata,
  type ApiKeyStorage,
} from '../../services/apiKeyService/index.js';

// Simple, in memory implementation of the ApiKeyStorage contract.
// State of stored keys lives in each instance, so it can be wiped between tests.
export default class StubApiKeyStorage implements ApiKeyStorage {
  private _store = new Map<string, [apiKey: string, meta: ApiKeyMetadata]>();

  async store(key: string, orgId: string, metadata: ApiKeyMetadata) {
    this._store.set(orgId, [key, metadata]);
    return { keyId: String(Math.random()) };
  }

  async fetch(orgId: string) {
    const storedData = this._store.get(orgId);
    return storedData == null
      ? false
      : { key: storedData[0], metadata: storedData[1] };
  }
}
