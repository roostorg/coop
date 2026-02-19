import type { ColumnType, GeneratedAlways } from 'kysely';

import type { UserRole } from '../../models/types/permissioning.js';
import type {
  DecisionCountsInput,
  JobCreationsInput,
} from '../manualReviewToolService/modules/DecisionAnalytics.js';
import { type OrgSettingsPg } from '../orgSettingsService/index.js';

export type MrtChartConfig = {
  title: string;
} & (
  | ({
      metric: 'DECISIONS';
    } & Omit<DecisionCountsInput, 'orgId' | 'timeZone'>)
  | (
      | {
          metric: 'JOBS';
        }
      | Omit<JobCreationsInput, 'orgId' | 'timeZone'>
    )
);

export type UserManagementPg = {
  'user_management_service.user_interface_settings': {
    user_id: string;
    moderator_safety_mute_video: boolean | null;
    moderator_safety_grayscale: boolean | null;
    moderator_safety_sepia: boolean | null;
    moderator_safety_blur_level: number | null;
    mrt_chart_configurations: MrtChartConfig[] | null;
  };
  // We use ColumnType in this table because all the moderator_safety columns
  // are non-null and have default values, so we can provide null values on
  // INSERT and UPDATE operations, but not on SELECT queries.
  'user_management_service.org_default_user_interface_settings': {
    org_id: string;
    moderator_safety_mute_video: ColumnType<
      boolean,
      boolean | undefined,
      boolean | undefined
    >;
    moderator_safety_grayscale: ColumnType<
      boolean,
      boolean | undefined,
      boolean | undefined
    >;
    moderator_safety_sepia: ColumnType<
      boolean,
      boolean | undefined,
      boolean | undefined
    >;
    moderator_safety_blur_level: ColumnType<
      number,
      number | undefined,
      number | undefined
    >;
  };
  'user_management_service.password_reset_tokens': {
    hashed_token: string;
    user_id: string;
    org_id: string;
    created_at: Date;
  };
  'public.users': {
    id: GeneratedAlways<string>;
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    role: UserRole;
    approved_by_admin: boolean;
    rejected_by_admin: boolean;
    created_at: GeneratedAlways<Date>;
    updated_at: GeneratedAlways<Date>;
    org_id: string;
  };
  'public.invite_user_tokens': {
    id: GeneratedAlways<string>;
    token: string;
    email: string;
    role: UserRole;
    created_at: GeneratedAlways<Date>;
    updated_at: GeneratedAlways<Date>;
    org_id: string;
  };
  'public.org_settings': Pick<
    OrgSettingsPg['public.org_settings'],
    'org_id' | 'saml_enabled'
  >;
};
