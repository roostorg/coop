import { type ModerationConfigServicePg } from './moderationConfigService/dbTypes.js';
import { type ApiKeyServicePg } from './apiKeyService/dbTypes.js';
import { type SigningKeyPairServicePg } from './signingKeyPairService/dbTypes.js';

export type CombinedPg = ModerationConfigServicePg & ApiKeyServicePg & SigningKeyPairServicePg;
