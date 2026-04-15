import { type ApiKeyServicePg } from './apiKeyService/dbTypes.js';
import { type CoreAppTablesPg } from './coreAppTables.js';
import { type ModerationConfigServicePg } from './moderationConfigService/dbTypes.js';
import { type SigningKeyPairServicePg } from './signingKeyPairService/dbTypes.js';
import { type UserManagementPg } from './userManagementService/dbTypes.js';

export type CombinedPg = ModerationConfigServicePg &
  ApiKeyServicePg &
  SigningKeyPairServicePg &
  UserManagementPg &
  CoreAppTablesPg;
