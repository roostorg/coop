import { type OrgSettingsPg } from '../orgSettingsService/index.js';
import { type UserManagementPg } from '../userManagementService/index.js';

export type SSOServicePg = {
  users: Pick<UserManagementPg['public.users'], 'email' | 'org_id'>;
  orgs: { id: string };
  org_settings: Pick<
    OrgSettingsPg['public.org_settings'],
    'saml_enabled' | 'org_id'
  >;
};
