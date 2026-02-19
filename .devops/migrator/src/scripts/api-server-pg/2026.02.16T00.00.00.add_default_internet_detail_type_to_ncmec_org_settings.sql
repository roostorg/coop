-- Add default internet detail type for NCMEC reports (channel/medium: web page, chat/IM, etc.).
ALTER TABLE ncmec_reporting.ncmec_org_settings
  ADD COLUMN IF NOT EXISTS default_internet_detail_type character varying(50) NULL;

COMMENT ON COLUMN ncmec_reporting.ncmec_org_settings.default_internet_detail_type IS
  'Default incident context for CyberTip reports: WEB_PAGE, EMAIL, NEWSGROUP, CHAT_IM, ONLINE_GAMING, CELL_PHONE, NON_INTERNET, PEER_TO_PEER. When set, report.internetDetails is populated.';

-- Terms of Service line for CyberTip reporter (e.g. child abuse/CSAM not allowed). Max 3000 chars.
ALTER TABLE ncmec_reporting.ncmec_org_settings
  ADD COLUMN IF NOT EXISTS terms_of_service text NULL;

COMMENT ON COLUMN ncmec_reporting.ncmec_org_settings.terms_of_service IS
  'Optional TOS line included in CyberTip reporter (e.g. child abuse/CSAM not allowed). Max 3000 characters.';

-- Contact person for law enforcement (other than submitter).
ALTER TABLE ncmec_reporting.ncmec_org_settings
  ADD COLUMN IF NOT EXISTS contact_person_email character varying(255) NULL;
ALTER TABLE ncmec_reporting.ncmec_org_settings
  ADD COLUMN IF NOT EXISTS contact_person_first_name character varying(255) NULL;
ALTER TABLE ncmec_reporting.ncmec_org_settings
  ADD COLUMN IF NOT EXISTS contact_person_last_name character varying(255) NULL;
ALTER TABLE ncmec_reporting.ncmec_org_settings
  ADD COLUMN IF NOT EXISTS contact_person_phone character varying(50) NULL;

COMMENT ON COLUMN ncmec_reporting.ncmec_org_settings.contact_person_email IS
  'Email for the person law enforcement should contact (other than the reporting person).';
COMMENT ON COLUMN ncmec_reporting.ncmec_org_settings.contact_person_first_name IS
  'First name of the law enforcement contact person.';
COMMENT ON COLUMN ncmec_reporting.ncmec_org_settings.contact_person_last_name IS
  'Last name of the law enforcement contact person.';
COMMENT ON COLUMN ncmec_reporting.ncmec_org_settings.contact_person_phone IS
  'Phone number for the law enforcement contact person.';
