import { type GeneratedAlways } from 'kysely';

import { type NonEmptyArray } from '../../utils/typescript-types.js';
import {
  type NcmecAdditionalFile,
  type NcmecMediaReport,
  type NcmecMessagesReport,
} from './ncmecReporting.js';

export type NcmecReportingServicePg = {
  'ncmec_reporting.ncmec_org_settings': {
    org_id: string;
    username: string;
    password: string;
    contact_email?: string;
    more_info_url?: string;
    company_template?: string;
    legal_url?: string;
    ncmec_preservation_endpoint?: string;
    ncmec_additional_info_endpoint?: string;
    default_ncmec_queue_id?: string | null;
    default_internet_detail_type?: string | null;
    terms_of_service?: string | null;
    contact_person_email?: string | null;
    contact_person_first_name?: string | null;
    contact_person_last_name?: string | null;
    contact_person_phone?: string | null;
    created_at: GeneratedAlways<Date>;
    updated_at: GeneratedAlways<Date>;
  } & (
    | {
        actions_to_run_upon_report_creation: NonEmptyArray<string>;
        policies_applied_to_actions_run_on_report_creation: NonEmptyArray<string>;
      }
    | {
        actions_to_run_upon_report_creation: null;
        policies_applied_to_actions_run_on_report_creation: null;
      }
  );
  'ncmec_reporting.ncmec_reports': {
    org_id: string;
    report_id: string;
    user_id: string;
    user_item_type_id: string;
    reported_media: NonEmptyArray<NcmecMediaReport>;
    reviewer_id?: string;
    created_at: GeneratedAlways<Date>;
    updated_at: GeneratedAlways<Date>;
    report_xml: string;
    additional_files: Array<NcmecAdditionalFile> | null;
    reported_messages: Array<NcmecMessagesReport> | null;
    incident_type?: string;
    // This value is undefined for the rows where we aren't sure if it's test or
    // not, before the column was added
    is_test?: boolean;
  };
  'ncmec_reporting.ncmec_reports_errors': {
    job_id: string;
    user_id: string;
    user_type_id: string;
    status: 'RETRYABLE_ERROR' | 'PERMANENT_ERROR';
    retry_count: number;
    last_error: string;
  };
};
