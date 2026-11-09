import { type ApiKeyService } from '../services/apiKeyService/index.js';

export async function createPrimaryApiKey(
  apiKeyService: Pick<ApiKeyService, 'createApiKey'>,
  orgId: string,
) {
  return apiKeyService.createApiKey(
    orgId,
    'Main API Key',
    'Primary API key for organization',
    null,
    [
      'items:read',
      'items:write',
      'reports:write',
      'appeals:write',
      'actions:execute',
      'config:read',
    ],
  );
}
