import { type Generated, type GeneratedAlways } from 'kysely';

export type GDPRServicePg = {
  gdpr_delete_requests: {
    request_id: string;
    org_id: string;
    item_id: string;
    item_type_id: string;
    created_at: GeneratedAlways<Date>;
    fulfilled: Generated<boolean>;
  };
};
