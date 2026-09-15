import { type Invoker } from '../../userManagementService/index.js';

export type ModerationConfigMutationActor =
  ({ type: 'user' } & Invoker) | { type: 'organizationApiKey'; orgId: string };
