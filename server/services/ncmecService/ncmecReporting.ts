/* eslint-disable max-lines */
import type { Exception } from '@opentelemetry/api';
import { makeEnumLike, type ItemIdentifier } from '@roostorg/coop-types';
import _Ajv from 'ajv';
import { sql, type Kysely } from 'kysely';
import _ from 'lodash';
import { FormData } from 'undici';
import { js2xml } from 'xml-js';

import { type Dependencies } from '../../iocContainer/index.js';
import { jsonStringify } from '../../utils/encoding.js';
import { type JSONSchemaV4 } from '../../utils/json-schema-types.js';
import { type FixKyselyRowCorrelation } from '../../utils/kysely.js';
import { logErrorJson } from '../../utils/logging.js';
import { assertUnreachable, withRetries } from '../../utils/misc.js';
import {
  type CollapseCases,
  type NonEmptyArray,
} from '../../utils/typescript-types.js';
import { rawItemSubmissionToItemSubmission } from '../itemProcessingService/makeItemSubmission.js';
import { type RawItemData } from '../itemProcessingService/toNormalizedItemDataOrErrors.js';
import {
  rawItemSubmissionSchema,
  type RawItemSubmission,
} from '../itemProcessingService/types.js';
import type {
  NCMECReportedContentInThread,
  NCMECThreadReport,
} from '../manualReviewToolService/modules/JobDecisioning.js';
import {
  makeFormDataLikeWithStreams,
  type FormDataLikeWithStreams,
} from '../networkingService/index.js';
import { type NcmecReportingServicePg } from './dbTypes.js';
import {
  ncmecDebugDump,
  ncmecDebugEnabled,
  ncmecDebugLog,
} from './ncmecDebug.js';
import { summarizeNcmecErrorForReviewer } from './ncmecReviewerErrors.js';

export const NCMECEvent = makeEnumLike([
  'Login',
  'Registration',
  'Purchase',
  'Upload',
  'Other',
  'Unknown',
]);
export type NCMECEventType = keyof typeof NCMECEvent;

export const NCMECIndustryClassification = makeEnumLike([
  'A1',
  'A2',
  'B1',
  'B2',
]);
export type NCMECIndustryClassificationType =
  keyof typeof NCMECIndustryClassification;

export const NCMECFileAnnotation = makeEnumLike([
  'ANIME_DRAWING_VIRTUAL_HENTAI',
  'POTENTIAL_MEME',
  'VIRAL',
  'POSSIBLE_SELF_PRODUCTION',
  'PHYSICAL_HARM',
  'VIOLENCE_GORE',
  'BESTIALITY',
  'LIVE_STREAMING',
  'INFANT',
  'GENERATIVE_AI',
]);
export type NCMECFileAnnotationType = keyof typeof NCMECFileAnnotation;

export const NCMECIncidentType = makeEnumLike([
  'Child Pornography (possession, manufacture, and distribution)',
  'Child Sex Trafficking',
  'Child Sex Tourism',
  'Child Sexual Molestation',
  'Misleading Domain Name',
  'Misleading Words or Digital Images on the Internet',
  'Online Enticement of Children for Sexual Acts',
  'Unsolicited Obscene Material Sent to a Child',
]);
export type NCMECIncidentType = keyof typeof NCMECIncidentType;

export const NCMECEmailType = makeEnumLike(['Home', 'Work', 'Business']);
export type NCMECEmailType = keyof typeof NCMECEmailType;

export type NCMECMediaReport = {
  id: string;
  typeId: string;
  url: string;
  fileAnnotations: readonly NCMECFileAnnotationType[];
  industryClassification: NCMECIndustryClassificationType;
};

type NCMECEventInfo = {
  eventName: NCMECEventType;
  dateTime: string;
};

type IPNCMECEvent = NCMECEventInfo & {
  ipAddress: string;
  port?: number;
  possibleProxy?: boolean;
};

type DeviceNCMECEvent = NCMECEventInfo & {
  idType: string;
  idValue: string;
};

type NCMECPerson = {
  phone?: Phone;
  email?: Email[];
  firstName?: string;
  lastName?: string;
  deviceId?: DeviceNCMECEvent[];
};

// Key insertion order must match the NCMEC XSD `<fileDetails>` sequence
// (Appendix C); see the `Report` type comment for why this matters.
type FileDetails = {
  fileDetails: {
    reportId: number;
    fileId: string;
    originalFileName?: string;
    locationOfFile?: string;
    fileViewedByEsp?: boolean;
    exifViewedByEsp?: boolean;
    publiclyAvailable?: boolean;
    fileRelevance?: 'Reported' | 'Supplemental Reported';
    fileAnnotations?: FileAnnotations;
    ipCaptureEvent?: IPNCMECEvent[];
    industryClassification?: NCMECIndustryClassificationType;
    originalFileHash?: OriginalFileHash[];
    deviceId?: DeviceId[];
    details?: Detail[];
    additionalInfo?: string[];
  };
};

type OriginalFileHash = {
  _text: string;
  _attributes: {
    hashType: string;
  };
};

type FileAnnotations = {
  animeDrawingVirtualHentai?: undefined;
  potentialMeme?: undefined;
  viral?: undefined;
  possibleSelfProduction?: undefined;
  physicalHarm?: undefined;
  violenceGore?: undefined;
  bestiality?: undefined;
  liveStreaming?: undefined;
  infant?: undefined;
  generativeAi?: undefined;
};

type Detail = {
  nameValuePair: {
    name: string;
    value: string;
  };
  type?: 'EXIF' | 'HASH';
};

type Media = {
  id: string;
  typeId: string;
  url: string;
  createdAt: string;
  industryClassification: NCMECIndustryClassificationType;
  fileAnnotations?: readonly NCMECFileAnnotationType[];
  /** Pre-built IP event(s); accepts a single event or an array. */
  ipCaptureEvent?: IPNCMECEvent | readonly IPNCMECEvent[];
  /** Bare IP from the `ipAddress` field role; appended as a synthesised
   * `Upload` event. */
  ipAddress?: string;
  deviceId?: DeviceNCMECEvent[];
  /** Hashes computed for this URL (typically by HMA at item submission
   * time). Keyed by hash algorithm name (e.g. `md5`, `pdq`); the value is
   * the hex-encoded hash. Forwarded to NCMEC as `originalFileHash`
   * entries with the algorithm name uppercased into the `hashType`
   * attribute. */
  hashes?: Record<string, string>;
};

type NCMECUserParams = {
  id: string;
  typeId: string;
  profilePicture?: string;
  displayName?: string;
  /** Pre-built IP event(s); accepts a single event or an array. */
  ipCaptureEvent?: IPNCMECEvent | readonly IPNCMECEvent[];
  /** Bare IP from the `ipAddress` field role; appended as a synthesised
   * `Unknown` event. */
  ipAddress?: string;
  /** Bare email from the `email` field role. Used as the
   * `personOrUserReportedPerson.email` when no external additional-info
   * endpoint provided one. */
  email?: string;
};

export type NCMECReportParams = {
  reportedUser: NCMECUserParams;
  orgId: string;
  media: Media[];
  threads: readonly NCMECThreadReport[];
  reviewerId: string;
  incidentType: string;
  /** Optional reason for higher urgency; if present must be non-blank and max 3000 chars. */
  escalateToHighPriority?: string;
  /** Optional free-text notes; if present must be non-blank and max 3000 chars. */
  additionalInfo?: string;
  /** MRT decision id; when set, failures are recorded to `ncmec_reports_errors`. */
  jobId?: string;
};

// Key insertion order in these object literals must match the NCMEC XSD
// sequence (Appendix B): js2xml emits children in insertion order, and NCMEC
// rejects out-of-order submissions with responseCode=4100.
type Report = {
  report: {
    incidentSummary: {
      incidentType: NCMECIncidentType;
      escalateToHighPriority?: string;
      incidentDateTime: string;
      incidentDateTimeDescription?: string;
    };
    internetDetails?: (
      | {
          webPageIncident: {
            url?: string;
            additionalInfo?: string;
            thirdPartyHostedContent?: boolean;
          };
        }
      | {
          emailIncident: {
            emailAddress?: string[];
            content?: string;
            additionalInfo?: string;
          };
        }
      | {
          newsgroupIncident: {
            name?: string;
            emailAddress?: string[];
            content?: string;
            additionalInfo?: string;
          };
        }
      | {
          chatImIncident: {
            chatClient?: string;
            chatRoomName?: string;
            content?: string;
            additionalInfo?: string;
          };
        }
      | {
          onlineGamingIncident: {
            gameName?: string;
            console?: string;
            content?: string;
            additionalInfo?: string;
          };
        }
      | {
          cellPhoneIncident: {
            phoneNumber?: Phone;
            latitude?: number;
            longitude?: number;
            additionalInfo?: string;
          };
        }
      | {
          nonInternetIncident: {
            locationName?: string;
            incidentAddress?: Address[];
            additionalInfo?: string;
          };
        }
      | {
          peer2peerIncident: {
            client?: string;
            ipCaptureEvent?: IpCaptureEvent[];
            additionalInfo?: string;
          };
        }
    )[];
    lawEnforcement?: {
      agencyName: string;
      caseNumber?: string;
      officerContact: NCMECPerson;
      reportedToLe?: boolean;
      servedLegalProcessDomestic?: boolean;
      servedLegalPorcessInternational?: boolean;
    };
    reporter: {
      reportingPerson: NCMECPerson;
      contactPerson?: NCMECPerson;
      companyTemplate?: string;
      termsOfService?: string;
      legalURL?: string;
    };
    personOrUserReported?: {
      personOrUserReportedPerson?: NCMECPerson;
      vehicleDescription?: string;
      espIdentifier?: string;
      espService?: string;
      screenName?: string;
      displayName?: string[];
      profileUrl?: string[];
      ipCaptureEvent?: IpCaptureEvent[];
      deviceId?: DeviceId[];
      thirdPartyUserReported?: boolean;
      priorCTReports?: number[];
      groupIdentifier?: string;
      estimatedLocation?: EstimatedLocation;
      additionalInfo?: string;
    };
    intendedRecipient?: {
      intendedRecipientPerson: NCMECPerson;
      espIdentifier?: string;
      espService?: string;
      screenName?: string;
      displayName?: string[];
      profileUrl?: string[];
      ipCaptureEvent?: IpCaptureEvent[];
      deviceId?: DeviceId[];
      priorCTReports?: number[];
      accountTemporarilyDisabled?: boolean;
      accountPermanentlyDisabled?: boolean;
      estimatedLocation?: EstimatedLocation;
      additionalInfo?: string;
    }[];
    victim?: {
      victimPerson: NCMECPerson;
      espIdentifier?: string;
      espService?: string;
      screenName?: string;
      displayName?: string[];
      profileUrl?: string[];
      ipCaptureEvent?: IpCaptureEvent[];
      deviceId?: DeviceId[];
      schoolName?: string;
      priorCTReports?: number[];
      estimatedLocation?: EstimatedLocation;
      additionalInfo?: string;
    }[];
    additionalInfo?: string;
  };
};

type EstimatedLocation = {
  city?: string;
  region?: string;
  countryCode: string;
  verified?: boolean;
  timestamp?: string;
};

type DeviceId = (
  | { idType: string; idValue: string }
  | { idType: undefined; idValue: undefined }
) & {
  eventName?: NCMECEventType;
  dateTime?: string;
};

type Phone = {
  // _text should be the phone number
  _text: string;
  type?: 'Mobile' | 'Home' | 'Business' | 'Work' | 'Fax' | 'Internet';
  verified?: boolean;
  verificationDate?: string;
  countryCallingCode?: string;
  extension?: string;
};

type Email = {
  // _text should be the email
  _text: string;
  _attributes?: {
    type?: NCMECEmailType;
    verified?: boolean;
    verificationDate?: string;
  };
};

type Address = {
  address?: string;
  city?: string;
  zipCode?: string;
  state?: string;
  nonUsaState?: string;
  country?: string;
  type?: string;
};

type IpCaptureEvent = {
  ipAddress: string;
  eventName?: NCMECEventType;
  dateTime?: string;
  possibleProxy?: boolean;
  port?: number;
};

const NCMEC_INTERNET_DETAIL_TYPES = [
  'WEB_PAGE',
  'EMAIL',
  'NEWSGROUP',
  'CHAT_IM',
  'ONLINE_GAMING',
  'CELL_PHONE',
  'NON_INTERNET',
  'PEER_TO_PEER',
] as const;
type NcmecInternetDetailTypeSetting =
  (typeof NCMEC_INTERNET_DETAIL_TYPES)[number];

/** Extract NCMEC's `responseCode`/`responseDescription` from any wrapper
 * element (`reportResponse`, `uploadResponse`, ...). Either field may be
 * `undefined` when not present. */
function extractNcmecResponseStatus(body: unknown): {
  responseCode?: string;
  responseDescription?: string;
} {
  if (!body || typeof body !== 'object') {
    return {};
  }
  const readText = (value: unknown): string | undefined => {
    if (typeof value === 'string') {
      return value;
    }
    if (
      value &&
      typeof value === 'object' &&
      '_text' in (value as Record<string, unknown>)
    ) {
      const inner = (value as { _text: unknown })._text;
      return typeof inner === 'string' ? inner : undefined;
    }
    return undefined;
  };
  const truncate = (value: string | undefined): string | undefined =>
    value && value.length > 200 ? `${value.slice(0, 200)}…` : value;

  for (const wrapper of Object.values(body as Record<string, unknown>)) {
    if (!wrapper || typeof wrapper !== 'object') {
      continue;
    }
    const obj = wrapper as Record<string, unknown>;
    const responseCode = readText(obj.responseCode);
    const responseDescription = readText(obj.responseDescription);
    if (responseCode != null || responseDescription != null) {
      return {
        responseCode,
        responseDescription: truncate(responseDescription),
      };
    }
  }
  return {};
}

/** Error message for a failed CyberTip response. In production only NCMEC's
 * documented codes are surfaced (the body may echo reportable content); the
 * full truncated body is appended only with `NCMEC_DEBUG=1`. */
export function summarizeCyberTipFailure(
  route: string,
  status: number,
  body: unknown,
): string {
  const { responseCode, responseDescription } =
    extractNcmecResponseStatus(body);
  const parts: string[] = [
    `CyberTip request to ${route} failed: status=${status}`,
  ];
  if (responseCode != null) {
    parts.push(`responseCode=${responseCode}`);
  }
  if (responseDescription != null) {
    parts.push(`responseDescription=${responseDescription}`);
  }
  if (ncmecDebugEnabled()) {
    let snippet: string;
    try {
      const serialized = jsonStringify(body ?? null);
      snippet =
        serialized.length > 500 ? `${serialized.slice(0, 500)}…` : serialized;
    } catch {
      snippet = '<unserializable>';
    }
    parts.push(`body=${snippet}`);
  }
  return parts.join(', ');
}

/** Clamp a `createdAt` ISO to "now - 1s" if it's ahead of our clock — NCMEC
 * rejects `<incidentDateTime>` in the future. `value` is always canonicalized
 * to UTC ISO; `wasClamped` reflects the numeric (not string) comparison so
 * callers don't misreport plain UTC normalization as a clamp. */
export function clampIncidentDateTimeToPast(
  maxCreatedAt: string,
  nowMs: number = Date.now(),
): { value: string; wasClamped: boolean } {
  const maxCreatedAtMs = new Date(maxCreatedAt).getTime();
  if (Number.isNaN(maxCreatedAtMs)) {
    throw new Error(
      `Invalid media createdAt timestamp for incidentDateTime: ${maxCreatedAt}`,
    );
  }
  const ceilingMs = nowMs - 1000;
  const wasClamped = maxCreatedAtMs > ceilingMs;
  const finalMs = wasClamped ? ceilingMs : maxCreatedAtMs;
  return {
    value: new Date(finalMs).toISOString(),
    wasClamped,
  };
}

/** Build the `ipCaptureEvent` array for an NCMEC person or media block:
 * webhook events + caller-supplied events + role-IP-synthesised event, in
 * that order. Returns `undefined` when all sources are empty. */
export function mergeFieldRoleIpIntoEvents(
  webhookEvents: readonly IPNCMECEvent[] | undefined,
  paramEvents: IPNCMECEvent | readonly IPNCMECEvent[] | undefined,
  roleIpAddress: string | undefined | null,
  synthesisedEvent: { eventName: NCMECEventType; dateTime: string },
): IPNCMECEvent[] | undefined {
  const isEventArray = (
    v: IPNCMECEvent | readonly IPNCMECEvent[],
  ): v is readonly IPNCMECEvent[] => Array.isArray(v);
  const paramEventsArray: readonly IPNCMECEvent[] =
    paramEvents == null
      ? []
      : isEventArray(paramEvents)
        ? paramEvents
        : [paramEvents];
  const trimmedRoleIp =
    typeof roleIpAddress === 'string' ? roleIpAddress.trim() : '';
  const events: IPNCMECEvent[] = [
    ...(webhookEvents ?? []),
    ...paramEventsArray,
    ...(trimmedRoleIp !== ''
      ? [
          {
            ipAddress: trimmedRoleIp,
            eventName: synthesisedEvent.eventName,
            dateTime: synthesisedEvent.dateTime,
          },
        ]
      : []),
  ];
  return events.length > 0 ? events : undefined;
}

/** Build the NCMEC `originalFileHash[]` shape from both hash sources Coop
 * has: HMA-computed hashes stored on the item data (keyed by algorithm),
 * and any single `{ hash, hashType }` returned by the additional-info
 * webhook for this media. Trims blanks, uppercases the algorithm name into
 * the `hashType` attribute, drops empty entries, and dedupes on
 * (`hashType`, hash value) so a webhook that returns the same algorithm as
 * HMA doesn't produce duplicate entries. Returns undefined when no usable
 * hashes survive filtering; callers should branch on that to omit the key
 * entirely rather than serialise an empty array. */
export function toOriginalFileHashes(opts: {
  hmaHashes?: Record<string, string>;
  webhookFileDetails?: { hash: string; hashType: string };
}): OriginalFileHash[] | undefined {
  const result: OriginalFileHash[] = [];
  const seen = new Set<string>();
  const push = (algorithm: string, hash: string) => {
    const trimmedHash = typeof hash === 'string' ? hash.trim() : '';
    const trimmedAlgorithm = algorithm.trim();
    if (trimmedHash === '' || trimmedAlgorithm === '') return;
    const hashType = trimmedAlgorithm.toUpperCase();
    const key = `${hashType} ${trimmedHash}`;
    if (seen.has(key)) return;
    seen.add(key);
    result.push({ _text: trimmedHash, _attributes: { hashType } });
  };
  if (opts.hmaHashes) {
    for (const [algorithm, hash] of Object.entries(opts.hmaHashes)) {
      push(algorithm, hash);
    }
  }
  if (opts.webhookFileDetails) {
    push(opts.webhookFileDetails.hashType, opts.webhookFileDetails.hash);
  }
  return result.length > 0 ? result : undefined;
}

/** Resolve the email(s) for `personOrUserReportedPerson`. Prefers the
 * webhook's enriched response (carries NCMEC `type` / `verified` attributes);
 * falls back to a bare field-role email otherwise. Returns undefined when
 * neither source has data. */
export function resolveReportedPersonEmail(
  webhookEmails: Email[] | undefined,
  fieldRoleEmail: string | undefined,
): Email[] | undefined {
  if (webhookEmails && webhookEmails.length > 0) return webhookEmails;
  const trimmed = fieldRoleEmail?.trim();
  if (trimmed) return [{ _text: trimmed }];
  return undefined;
}

/** Maps a list of `NCMECFileAnnotationType` enum values to the
 * `FileAnnotations` element shape expected by the NCMEC `<fileDetails>` XSD
 * (each annotation becomes an empty self-closing child element).
 *
 * Lives at module scope so the `buildFileDetailsObject` helper and the
 * dry-run dump script can both build file-details XML without instantiating
 * `NcmecReportingService`. */
export function fileAnnotationArrayToNCMECFileAnnotation(
  fileAnnotations?: readonly NCMECFileAnnotationType[],
): FileAnnotations | undefined {
  if (!fileAnnotations || fileAnnotations.length === 0) {
    return undefined;
  }
  // Iterating through a table avoids one branch per annotation, which
  // previously pushed cyclomatic complexity over the configured ESLint limit
  // and made the function hard to extend when new annotation types are added.
  const annotationFieldByType: Record<
    NCMECFileAnnotationType,
    keyof FileAnnotations
  > = {
    [NCMECFileAnnotation.ANIME_DRAWING_VIRTUAL_HENTAI]:
      'animeDrawingVirtualHentai',
    [NCMECFileAnnotation.POTENTIAL_MEME]: 'potentialMeme',
    [NCMECFileAnnotation.VIRAL]: 'viral',
    [NCMECFileAnnotation.POSSIBLE_SELF_PRODUCTION]: 'possibleSelfProduction',
    [NCMECFileAnnotation.PHYSICAL_HARM]: 'physicalHarm',
    [NCMECFileAnnotation.VIOLENCE_GORE]: 'violenceGore',
    [NCMECFileAnnotation.BESTIALITY]: 'bestiality',
    [NCMECFileAnnotation.LIVE_STREAMING]: 'liveStreaming',
    [NCMECFileAnnotation.INFANT]: 'infant',
    [NCMECFileAnnotation.GENERATIVE_AI]: 'generativeAi',
  };
  const result: FileAnnotations = {};
  for (const annotation of fileAnnotations) {
    const field = annotationFieldByType[annotation];
    result[field] = undefined;
  }
  return result;
}

export type BuildSubmitReportObjectInput = {
  reportParams: NCMECReportParams;
  /** Reported user's webhook-derived additional info, from the
   * `ncmec_additional_info_endpoint` webhook (or defaulted to empty when no
   * endpoint is configured). */
  userAdditionalInfo: {
    email?: Email[];
    screenName?: string;
    ipCaptureEvent?: IPNCMECEvent[];
  };
  /** Slice of `ncmec_reporting.ncmec_org_settings` needed to build the
   * report envelope. `companyTemplate`, `legalURL` and `reportingPersonEmail`
   * are required (the caller validated them). */
  orgSettings: {
    companyTemplate: string;
    legalURL: string;
    defaultInternetDetailType?: string | null;
    termsOfService?: string | null;
    contactPersonEmail?: string | null;
    contactPersonFirstName?: string | null;
    contactPersonLastName?: string | null;
    contactPersonPhone?: string | null;
    /** From `ncmec_org_settings.contact_email`. */
    reportingPersonEmail: string;
    /** Optional URL used to populate `webPageIncident.url` when the org's
     * `defaultInternetDetailType` is WEB_PAGE. */
    moreInfoUrl?: string | null;
  };
  /** Latest media `createdAt`, already clamped to the past. */
  clampedIncidentDateTime: string;
  /** Prior accepted NCMEC report IDs for the reported user; renders as `<priorCTReports>`. */
  priorCTReports?: readonly number[];
};

/** Build the `Report` envelope NCMEC's `/submit` endpoint expects. Pure: no
 * DB or HTTP. The caller is responsible for resolving org settings and
 * webhook-sourced additional info; this function only assembles them in the
 * XSD-mandated order. Used by `submitReport` and by audit/dump tooling. */

// further decomposition would obscure the XSD-mandated insertion order (see
// the `Report` type comment) that NCMEC validates against.
export function buildSubmitReportObject(
  input: BuildSubmitReportObjectInput,
): Report {
  const {
    reportParams,
    userAdditionalInfo,
    orgSettings,
    clampedIncidentDateTime,
    priorCTReports,
  } = input;
  const emailStringToNCMECEmail = (email: string) => ({ _text: email });

  const incidentType =
    NCMECIncidentType[reportParams.incidentType as NCMECIncidentType];

  const escalateToHighPriority =
    reportParams.escalateToHighPriority != null
      ? reportParams.escalateToHighPriority.trim()
      : undefined;
  if (
    escalateToHighPriority !== undefined &&
    (escalateToHighPriority === '' || escalateToHighPriority.length > 3000)
  ) {
    throw new Error(
      'escalateToHighPriority must be non-blank when supplied and at most 3000 characters',
    );
  }

  const reportAdditionalInfo =
    reportParams.additionalInfo != null
      ? reportParams.additionalInfo.trim()
      : undefined;
  if (
    reportAdditionalInfo !== undefined &&
    (reportAdditionalInfo === '' || reportAdditionalInfo.length > 3000)
  ) {
    throw new Error(
      'additionalInfo must be non-blank when supplied and at most 3000 characters',
    );
  }

  const internetDetails = buildInternetDetailsFromOrgSetting(
    orgSettings.defaultInternetDetailType,
    orgSettings.moreInfoUrl,
  );

  const contactPersonEmail = orgSettings.contactPersonEmail?.trim();
  const contactPersonFirstName = orgSettings.contactPersonFirstName?.trim();
  const contactPersonLastName = orgSettings.contactPersonLastName?.trim();
  const contactPersonPhone = orgSettings.contactPersonPhone?.trim();
  const contactPerson =
    contactPersonEmail ||
    contactPersonFirstName ||
    contactPersonLastName ||
    contactPersonPhone
      ? {
          ...(contactPersonFirstName
            ? { firstName: contactPersonFirstName }
            : {}),
          ...(contactPersonLastName ? { lastName: contactPersonLastName } : {}),
          ...(contactPersonPhone
            ? { phone: { _text: contactPersonPhone } }
            : {}),
          ...(contactPersonEmail
            ? { email: [emailStringToNCMECEmail(contactPersonEmail)] }
            : {}),
        }
      : undefined;

  const termsOfService =
    orgSettings.termsOfService != null &&
    orgSettings.termsOfService.trim() !== '' &&
    orgSettings.termsOfService.length <= 3000
      ? orgSettings.termsOfService.trim()
      : undefined;

  const reportedPersonEmail = resolveReportedPersonEmail(
    userAdditionalInfo.email,
    reportParams.reportedUser.email,
  );
  const personOrUserReportedPerson = reportedPersonEmail
    ? { email: reportedPersonEmail }
    : undefined;

  // The role IP is a bare string, not a login/upload signal, so `Unknown` is
  // the safest event-name claim.
  const reportedUserIpCaptureEvents = mergeFieldRoleIpIntoEvents(
    userAdditionalInfo.ipCaptureEvent,
    reportParams.reportedUser.ipCaptureEvent,
    reportParams.reportedUser.ipAddress,
    {
      eventName: NCMECEvent.Unknown,
      dateTime: clampedIncidentDateTime,
    },
  );

  return {
    report: {
      incidentSummary: {
        incidentType,
        ...(escalateToHighPriority ? { escalateToHighPriority } : {}),
        incidentDateTime: clampedIncidentDateTime,
      },
      ...(internetDetails ? { internetDetails } : {}),
      reporter: {
        reportingPerson: {
          email: [emailStringToNCMECEmail(orgSettings.reportingPersonEmail)],
        },
        ...(contactPerson ? { contactPerson } : {}),
        companyTemplate: orgSettings.companyTemplate,
        ...(termsOfService ? { termsOfService } : {}),
        legalURL: orgSettings.legalURL,
      },
      personOrUserReported: {
        ...(personOrUserReportedPerson ? { personOrUserReportedPerson } : {}),
        espIdentifier: reportParams.reportedUser.id,
        espService: orgSettings.companyTemplate,
        screenName: userAdditionalInfo.screenName,
        ...(reportParams.reportedUser.displayName
          ? { displayName: [reportParams.reportedUser.displayName] }
          : {}),
        ...(reportedUserIpCaptureEvents &&
        reportedUserIpCaptureEvents.length > 0
          ? { ipCaptureEvent: reportedUserIpCaptureEvents }
          : {}),
        ...(priorCTReports && priorCTReports.length > 0
          ? { priorCTReports: [...priorCTReports] }
          : {}),
      },
      ...(reportAdditionalInfo !== undefined
        ? { additionalInfo: reportAdditionalInfo }
        : {}),
    },
  };
}

export type BuildFileDetailsObjectInput = {
  reportId: number;
  fileId: string;
  /** Optional `<originalFileName>`. Usually derived via `deriveOriginalFileNameFromUrl`. */
  originalFileName?: string;
  /** `<fileRelevance>`. Defaults to `'Reported'`. */
  fileRelevance?: 'Reported' | 'Supplemental Reported';
  media: Pick<Media, 'industryClassification'> & {
    fileAnnotations?: readonly NCMECFileAnnotationType[];
  };
  additionalInfo: Pick<
    MediaAdditionalInfo,
    'publiclyAvailable' | 'ipCaptureEvent' | 'additionalInfo'
  >;
  /** Combined HMA + webhook hashes as built by `toOriginalFileHashes`.
   * Rendered in the `<originalFileHash>` element(s) after
   * `industryClassification` per the XSD. */
  originalFileHash?: readonly OriginalFileHash[];
};

/** Decoded last path segment of `url`, or `undefined` if unavailable.
 * Logs each fallback path via `ncmecDebugLog` so operators can triage
 * unexpected URL shapes when `NCMEC_DEBUG=1` is enabled. */
export function deriveOriginalFileNameFromUrl(url: string): string | undefined {
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    ncmecDebugLog('deriveOriginalFileName.urlParseFailed', { url });
    return undefined;
  }
  const last = pathname
    .split('/')
    .filter((s) => s !== '')
    .pop();
  if (!last) {
    ncmecDebugLog('deriveOriginalFileName.emptyPath', { url });
    return undefined;
  }
  try {
    const decoded = decodeURIComponent(last);
    if (decoded.length === 0) {
      ncmecDebugLog('deriveOriginalFileName.emptySegment', { url });
      return undefined;
    }
    return decoded;
  } catch {
    // Malformed percent-encoding: keep the raw segment.
    ncmecDebugLog('deriveOriginalFileName.decodeFailed', { url, raw: last });
    return last;
  }
}

/** Pure builder for the `FileDetails` envelope NCMEC's `/fileinfo`
 * endpoint expects. Used by `submitReport`'s `#upload` step and by
 * dry-run tooling that needs to serialize per-media XML without
 * performing the upload. No DB or HTTP calls. */
export function buildFileDetailsObject(
  input: BuildFileDetailsObjectInput,
): FileDetails {
  const {
    reportId,
    fileId,
    media,
    additionalInfo,
    originalFileHash,
    originalFileName,
  } = input;
  const fileRelevance = input.fileRelevance ?? 'Reported';
  const fileAnnotations = fileAnnotationArrayToNCMECFileAnnotation(
    media.fileAnnotations,
  );
  return {
    fileDetails: {
      reportId,
      fileId,
      ...(originalFileName ? { originalFileName } : {}),
      fileViewedByEsp: true,
      exifViewedByEsp: true,
      ...(additionalInfo.publiclyAvailable !== undefined
        ? { publiclyAvailable: additionalInfo.publiclyAvailable }
        : {}),
      fileRelevance,
      ...(fileAnnotations ? { fileAnnotations } : {}),
      ...(additionalInfo.ipCaptureEvent &&
      additionalInfo.ipCaptureEvent.length > 0
        ? {
            ipCaptureEvent: additionalInfo.ipCaptureEvent.map((it) => ({
              ipAddress: it.ipAddress,
              eventName: it.eventName,
              dateTime: it.dateTime,
              ...(it.possibleProxy ? { possibleProxy: it.possibleProxy } : {}),
              ...(it.port ? { port: it.port } : {}),
            })),
          }
        : {}),
      industryClassification: media.industryClassification,
      ...(originalFileHash && originalFileHash.length > 0
        ? { originalFileHash: [...originalFileHash] }
        : {}),
      ...(additionalInfo.additionalInfo
        ? { additionalInfo: additionalInfo.additionalInfo }
        : {}),
    },
  };
}

export function buildInternetDetailsFromOrgSetting(
  defaultInternetDetailType: string | null | undefined,
  moreInfoUrl: string | null | undefined,
): Report['report']['internetDetails'] {
  if (!defaultInternetDetailType?.trim()) {
    return undefined;
  }
  const type =
    defaultInternetDetailType.trim() as NcmecInternetDetailTypeSetting;
  if (!NCMEC_INTERNET_DETAIL_TYPES.includes(type)) {
    return undefined;
  }
  // NCMEC returns 4100 if `<url>` contains whitespace or control chars; since
  // the element is optional per the XSD, omit it unless we have a clean value.
  // eslint-disable-next-line no-control-regex
  const URL_INVALID_CHARS = /[\s\u0000-\u001f\u007f]/;
  const trimmedUrl = moreInfoUrl?.trim();
  const webPageUrl =
    trimmedUrl && !URL_INVALID_CHARS.test(trimmedUrl) ? trimmedUrl : undefined;
  switch (type) {
    case 'WEB_PAGE':
      return [
        {
          webPageIncident: webPageUrl ? { url: webPageUrl } : {},
        },
      ];
    case 'EMAIL':
      return [{ emailIncident: {} }];
    case 'NEWSGROUP':
      return [{ newsgroupIncident: {} }];
    case 'CHAT_IM':
      return [{ chatImIncident: {} }];
    case 'ONLINE_GAMING':
      return [{ onlineGamingIncident: {} }];
    case 'CELL_PHONE':
      return [{ cellPhoneIncident: {} }];
    case 'NON_INTERNET':
      return [{ nonInternetIncident: {} }];
    case 'PEER_TO_PEER':
      return [{ peer2peerIncident: {} }];
    default:
      return assertUnreachable(type);
  }
}

// Because CyberTip always responds with XML and how xml2js works, all of the
// objects returned by it are objects with _text keys
type CyberTipSubmitResponse = {
  reportResponse: {
    responseCode: { _text: string };
    responseDescription: { _text: string };
    reportId: { _text: string };
  };
};

type CyberTipUploadResponse = {
  reportResponse: {
    responseCode: { _text: string };
    responseDescription: { _text: string };
    reportId: { _text: string };
    fileId: { _text: string };
    hash: { _text: string };
  };
};

type CyberTipFileDetailsResponse = {
  reportResponse: {
    responseCode: { _text: string };
    responseDescription: { _text: string };
    reportId: { _text: string };
  };
};

type CyberTipFinishResponse = {
  reportDoneResponse: {
    responseCode: { _text: string };
    reportId: { _text: string };
    files: {
      fileId: { _text: string };
    }[];
  };
};

type CyberTipAuth = {
  username: string;
  password: string;
};

type EmailResponse = {
  email: string;
  type?: NCMECEmailType;
  verified?: boolean;
  verificationDate?: string;
};

type NcmecAdditionalInfoResponse = {
  users: {
    id: string;
    typeId: string;
    email?: EmailResponse[];
    screenName?: string;
    ipCaptureEvent?: IPNCMECEvent[];
    data?: RawItemData;
  }[];
  media?: {
    id: string;
    typeId: string;
    ipCaptureEvent?: IPNCMECEvent[];
    additionalInfo?: string[];
    fileName?: string;
    missing?: boolean;
    publiclyAvailable?: boolean;
    fileDetails?: {
      hash: string;
      hashType: string;
    };
  }[];
  messages?: {
    id: string;
    typeId: string;
    ipAddress: string;
  }[];
  additionalFiles?: {
    fileUrl: string;
    additionalInfo?: string[];
    fileName?: string;
  }[];
  additionalInfo?: string;
};

type NcmecAdditionalInfo = {
  users: {
    id: string;
    typeId: string;
    email?: Email[];
    screenName?: string;
    ipCaptureEvent?: IPNCMECEvent[];
    data?: RawItemData;
  }[];
  media: MediaAdditionalInfo[];
  additionalFiles?: FileAdditionalInfo[];
  additionalInfo?: string;
};

type MediaAdditionalInfo = {
  id: string;
  typeId: string;
  ipCaptureEvent?: IPNCMECEvent[];
  additionalInfo?: string[];
  fileName?: string;
  /** When set, sent to NCMEC in file details (whether the content was publicly viewable). */
  publiclyAvailable?: boolean;
  /** Optional single hash from the additional-info webhook response.
   * Merged with HMA-sourced hashes (see `toOriginalFileHashes`); deduped
   * on (`hashType` uppercase, trimmed hash value) so a webhook that
   * returns the same algorithm as HMA doesn't produce duplicate entries
   * in the outgoing `originalFileHash[]` list. */
  fileDetails?: {
    hash: string;
    hashType: string;
  };
};

type FileAdditionalInfo = {
  fileUrl: string;
  additionalInfo?: string[];
  fileName?: string;
};

const Ajv = _Ajv as unknown as typeof _Ajv.default;
const ajv = new Ajv();

const validateIpAddressEvent = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      ipAddress: { type: 'string' },
      eventName: {
        type: 'string',
        enum: [
          'Login',
          'Registration',
          'Purchase',
          'Upload',
          'Other',
          'Unknown',
        ],
      },
      dateTime: { type: 'string' },
      possibleProxy: { type: 'boolean' },
      port: { type: 'integer' },
    },
    required: ['ipAddress'],
  },
} as const;

type NcmecMessageResponse = {
  conversations: {
    threadId: string;
    typeId: string;
    messages: (RawItemSubmission & {
      ipAddress: {
        ip: string;
        port: number;
      };
    })[];
  }[];
};

const validateNcmecMessages = ajv.compile<NcmecMessageResponse>({
  type: 'object',
  properties: {
    conversations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          threadId: { type: 'string' },
          typeId: { type: 'string' },
          messages: {
            type: 'array',
            items: {
              type: 'object',
              oneOf: [
                {
                  ...rawItemSubmissionSchema.oneOf[0],
                  properties: {
                    ...rawItemSubmissionSchema.oneOf[0].properties,
                    ipAddress: {
                      type: 'object',
                      properties: {
                        ip: { type: 'string' },
                        port: { type: 'integer' },
                      },
                      required: ['ip', 'port'],
                    },
                  },
                  required: [
                    ...rawItemSubmissionSchema.oneOf[0].required,
                    'ipAddress',
                  ],
                },
                {
                  ...rawItemSubmissionSchema.oneOf[1],
                  properties: {
                    ...rawItemSubmissionSchema.oneOf[1].properties,
                    ipAddress: {
                      type: 'object',
                      properties: {
                        ip: { type: 'string' },
                        port: { type: 'integer' },
                      },
                      required: ['ip', 'port'],
                    },
                  },
                  required: [
                    ...rawItemSubmissionSchema.oneOf[1].required,
                    'ipAddress',
                  ],
                },
              ],
            },
          },
        },
        required: ['threadId', 'typeId', 'messages'],
      },
    },
  },
  required: ['conversations'],
} as const satisfies JSONSchemaV4<NcmecMessageResponse>);

const validateNcmecAdditionalInfo = ajv.compile<NcmecAdditionalInfoResponse>({
  type: 'object',
  properties: {
    users: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          typeId: { type: 'string' },
          screenName: { type: 'string' },
          email: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                email: { type: 'string' },
                verified: { type: 'boolean' },
                verificationDate: { type: 'string' },
                type: { type: 'string', enum: ['Business', 'Home', 'Work'] },
              },
              required: ['email'],
            },
          },
          ipCaptureEvent: validateIpAddressEvent,
          // NB: the typings break here if we don't have { required: [] },
          // but actually putting an empty array for `required` in the runtime
          // value breaks request handling, so we just use a cast.
          data: { type: 'object' } as unknown as {
            type: 'object';
            required: [];
          },
        },
        required: ['id', 'typeId'],
      },
    },
    media: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          typeId: { type: 'string' },
          ipCaptureEvent: validateIpAddressEvent,
          additionalInfo: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
          fileName: { type: 'string' },
          missing: { type: 'boolean' },
          publiclyAvailable: { type: 'boolean' },
          fileDetails: {
            type: 'object',
            properties: {
              hash: { type: 'string' },
              hashType: { type: 'string' },
            },
            required: ['hash', 'hashType'],
          },
        },
        required: ['id', 'typeId'],
      },
    },
    additionalFiles: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          fileUrl: { type: 'string' },
          additionalInfo: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
          fileName: { type: 'string' },
        },
        required: ['fileUrl'],
      },
    },
    messages: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          typeId: { type: 'string' },
          ipAddress: { type: 'string' },
        },
        required: ['id', 'typeId', 'ipAddress'],
      },
    },
    additionalInfo: {
      type: 'string',
    },
  },
  additionalProperties: true,
  required: ['users'],
} as const satisfies JSONSchemaV4<NcmecAdditionalInfoResponse>);

export type NcmecMediaReport = {
  id: string;
  typeId: string;
  xml: string;
  ncmecFileId: string;
};

export type NcmecAdditionalFile = {
  xml: string;
  ncmecFileId: string;
  url: string;
};

export type NcmecMessagesReport = {
  csv: string;
  ncmecFileId: string;
  fileName: string;
};

type NcmecReportResult =
  | 'ALL_MEDIA_MISSING'
  | 'SUCCESS'
  | 'UNSUPPORTED_ORG'
  | 'FAILURE';

const actionsOnReportCreationAndPoliciesSelection = [
  'actions_to_run_upon_report_creation as actionsToRunIds',
  'policies_applied_to_actions_run_on_report_creation as policyIds',
] as const;

type ActionsOnReportCreationAndPoliciesSelectionResult =
  FixKyselyRowCorrelation<
    NcmecReportingServicePg['ncmec_reporting.ncmec_org_settings'],
    typeof actionsOnReportCreationAndPoliciesSelection
  >;

export default class NcmecReporting {
  constructor(
    private pgQuery: Kysely<NcmecReportingServicePg>,
    private pqQueryReadReplica: Kysely<NcmecReportingServicePg>,
    private fetchHTTP: Dependencies['fetchHTTP'],
    private signingKeyPairService: Dependencies['SigningKeyPairService'],
    private moderationConfigService: Dependencies['ModerationConfigService'],
    private getItemTypeEventuallyConsistent: Dependencies['getItemTypeEventuallyConsistent'],
    private readonly tracer: Dependencies['Tracer'],
  ) {}
  async hasNCMECReportingEnabled(orgId: string) {
    const ncmecOrgSettings = await this.pgQuery
      .selectFrom('ncmec_reporting.ncmec_org_settings')
      .select(['org_id'])
      .where('org_id', '=', orgId)
      .executeTakeFirst();
    return ncmecOrgSettings?.org_id != null;
  }

  async getNCMECConfig(
    orgId: string,
  ): Promise<
    NcmecReportingServicePg['ncmec_reporting.ncmec_org_settings'] | undefined
  > {
    const row = await this.pgQuery
      .selectFrom('ncmec_reporting.ncmec_org_settings')
      .selectAll()
      .where('org_id', '=', orgId)
      .executeTakeFirst();
    return row as
      | NcmecReportingServicePg['ncmec_reporting.ncmec_org_settings']
      | undefined;
  }

  async getNCMECActionsToRunAndPolicies(
    orgId: string,
  ): Promise<ActionsOnReportCreationAndPoliciesSelectionResult | undefined> {
    const row = await this.pgQuery
      .selectFrom('ncmec_reporting.ncmec_org_settings')
      .select(actionsOnReportCreationAndPoliciesSelection)
      .where('org_id', '=', orgId)
      .executeTakeFirst();

    return row
      ? (row satisfies CollapseCases<ActionsOnReportCreationAndPoliciesSelectionResult> as ActionsOnReportCreationAndPoliciesSelectionResult)
      : undefined;
  }

  async getNcmecMessages(
    orgId: string,
    userId: ItemIdentifier,
    reportedMedia: readonly ItemIdentifier[],
  ) {
    const fetchWithRetries = withRetries(
      {
        maxRetries: 5,
        initialTimeMsBetweenRetries: 5,
        maxTimeMsBetweenRetries: 500,
        jitter: true,
      },
      async () => {
        const response = await this.fetchHTTP({
          url: 'https://tas-infra-ml.net/data/coop/content/pre-preserve/get',
          method: 'post',
          body: jsonStringify({
            userId: userId.id,
            typeId: userId.typeId,
            reported_messages: reportedMedia,
          }),
          handleResponseBody: 'as-json',
          signWith: this.signingKeyPairService.sign.bind(
            this.signingKeyPairService,
            orgId,
          ),
        });
        if (!response.ok) {
          throw new Error();
        }
        const responseBody = response.body;
        if (!validateNcmecMessages(responseBody)) {
          throw new Error(`NCMEC Messages failed validation`);
        }
        return responseBody;
      },
    );
    const body = await fetchWithRetries();

    return Promise.all(
      body.conversations.map(async (conversation) => {
        const messages = await Promise.all(
          conversation.messages.map(async (message) => {
            const { error, itemSubmission } =
              await rawItemSubmissionToItemSubmission(
                await this.moderationConfigService.getItemTypes({
                  orgId,
                  directives: { maxAge: 10 },
                }),
                orgId,
                this.getItemTypeEventuallyConsistent,
                message,
              );
            if (error) {
              throw error;
            }
            return {
              message: itemSubmission,
              ipAddress: message.ipAddress,
            };
          }),
        );
        return {
          messages: messages.slice(-50), // Get the last 50 items
          threadId: conversation.threadId,
          threadTypeId: conversation.typeId,
        };
      }),
    );
  }

  async getNCMECAdditionalInfo(
    orgId: string,
    reportedUsers: ItemIdentifier[],
    reportedMedia: readonly ItemIdentifier[],
  ): Promise<NcmecAdditionalInfo | 'ALL_MEDIA_MISSING'> {
    const additionalInfoEndpoint =
      await this.ncmecAdditionalInfoEndpoint(orgId);

    // If no additional info endpoint is configured, return minimal default data
    if (!additionalInfoEndpoint) {
      return {
        users: reportedUsers.map((user) => ({
          id: user.id,
          typeId: user.typeId,
          email: [],
          screenName: user.id, // Use ID as fallback
          ipCaptureEvent: [],
        })),
        media: reportedMedia.map((media) => ({
          id: media.id,
          typeId: media.typeId,
        })),
      };
    }

    const response = await this.fetchHTTP({
      url: additionalInfoEndpoint,
      method: 'post',
      body: jsonStringify({
        users: reportedUsers,
        media: reportedMedia,
      }),
      handleResponseBody: 'as-json',
      signWith: this.signingKeyPairService.sign.bind(
        this.signingKeyPairService,
        orgId,
      ),
    });

    if (!response.ok) {
      throw new Error(
        `NCMEC Additional info failed with status: ${response.status}`,
      );
    }

    const responseBody = response.body;
    if (!validateNcmecAdditionalInfo(responseBody)) {
      throw new Error(`NCMEC Additional info failed validation`);
    }

    // Validate that we received information from every piece of content we
    // requested it for
    if (
      reportedMedia.some(
        (inputMedia) =>
          responseBody.media?.find(
            (responseMedia) =>
              inputMedia.id === responseMedia.id &&
              inputMedia.typeId === responseMedia.typeId,
          ) === undefined,
      ) ||
      reportedUsers.some(
        (inputUser) =>
          responseBody.users.find(
            (responseUser) =>
              inputUser.id === responseUser.id &&
              inputUser.typeId === responseUser.typeId,
          ) === undefined,
      )
    ) {
      throw new Error(
        `Did not receive additional info back for every user and media`,
      );
    }

    if (
      responseBody.media?.filter(
        (it) => it.missing === false || it.missing === undefined,
      ).length === 0
    ) {
      return 'ALL_MEDIA_MISSING';
    }

    // Convert email to the type expected by js2xml
    return {
      // We shouldn't have to do this omit since it gets overwritten later, but
      // the data in users makes this think this could be a JSON
      ..._.omit(responseBody, 'users'),
      media: responseBody.media?.filter((it) => it.missing !== true) ?? [],
      users: responseBody.users.map((user) => ({
        ...user,
        email: user.email?.map((it) => ({
          _text: it.email,
          _attributes: {
            ..._.omit(it, 'email'),
          },
        })),
      })),
    };
  }

  async getNcmecReports(opts: { orgId: string; reviewerId: string }) {
    const { orgId, reviewerId } = opts;
    return (
      this.pqQueryReadReplica
        .selectFrom('ncmec_reporting.ncmec_reports')
        .select([
          'created_at as ts',
          'report_id as reportId',
          'user_id as userId',
          'user_item_type_id as userItemTypeId',
          'reviewer_id as reviewerId',
          'reported_media as reportedMedia',
          'report_xml as reportXml',
          'additional_files as additionalFiles',
          'reported_messages as reportedMessages',
          'is_test as isTest',
        ])
        .where('org_id', '=', orgId)
        .where((eb) =>
          eb.or([
            eb('is_test', '=', false),
            eb('reviewer_id', '=', reviewerId),
          ]),
        )
        .orderBy('ts', 'desc')
        // TODO: Paginate the NCMEC Reports page and make the search function
        // issue a new query.
        .limit(300)
        .execute()
    );
  }

  // Retrieves a list of all users with a valid NCMEC decision, in the trio of
  // (user_id, user_item_type_id, org_id) for uniqueness, before an hour before
  // it executes, to allow for concurrent decisions to finish executing. Only
  // meant to be used in the NCMEC retry script.
  async getUsersWithNcmecDecision(opts: { startDate: Date }) {
    const { startDate } = opts;
    return this.pqQueryReadReplica
      .selectFrom('ncmec_reporting.ncmec_reports')
      .select([
        'user_id as userId',
        'user_item_type_id as userItemTypeId',
        'org_id as orgId',
      ])
      .where('created_at', '>=', startDate)
      .where((eb) =>
        eb.or([eb('is_test', '=', null), eb('is_test', '=', false)]),
      )
      .groupBy(['user_id', 'user_item_type_id', 'org_id'])
      .execute();
  }

  async getNcmecReportById(opts: { orgId: string; reportId: string }) {
    const { orgId, reportId } = opts;
    return this.pqQueryReadReplica
      .selectFrom('ncmec_reporting.ncmec_reports')
      .select([
        'created_at as ts',
        'report_id as reportId',
        'user_id as userId',
        'user_item_type_id as userItemTypeId',
        'reviewer_id as reviewerId',
        'reported_media as reportedMedia',
        'report_xml as reportXml',
        'additional_files as additionalFiles',
        'reported_messages as reportedMessages',
      ])
      .where('org_id', '=', orgId)
      .where('report_id', '=', reportId)
      .executeTakeFirst();
  }

  async #sendUserPreservationRequest(input: {
    orgId: string;
    user: ItemIdentifier;
    reportedMedia: ItemIdentifier[];
    reportId: number;
  }) {
    const { orgId, user, reportedMedia, reportId } = input;
    const ncmecPreservationEndpoint =
      await this.ncmecPreservationEndpoint(orgId);

    if (ncmecPreservationEndpoint == null) {
      throw new Error(
        'Organization does not have a NCMEC preservation endpoint',
      );
    }

    const fetchWithRetries = withRetries(
      {
        maxRetries: 5,
        initialTimeMsBetweenRetries: 5,
        maxTimeMsBetweenRetries: 500,
        jitter: true,
      },
      async () => {
        const response = await this.fetchHTTP({
          url: ncmecPreservationEndpoint,
          method: 'post',
          body: jsonStringify({
            user,
            reportedMedia,
            reportId: reportId.toString(),
          }),
          handleResponseBody: 'discard',
          signWith: this.signingKeyPairService.sign.bind(
            this.signingKeyPairService,
            orgId,
          ),
        });
        if (!response.ok) {
          throw new Error();
        }
      },
    );

    await fetchWithRetries();
  }

  async ncmecPreservationEndpoint(orgId: string): Promise<string | undefined> {
    const rows = await this.pgQuery
      .selectFrom('ncmec_reporting.ncmec_org_settings')
      .select(['ncmec_preservation_endpoint'])
      .where('org_id', '=', orgId)
      .executeTakeFirst();
    return rows?.ncmec_preservation_endpoint;
  }

  async ncmecAdditionalInfoEndpoint(
    orgId: string,
  ): Promise<string | undefined> {
    const rows = await this.pgQuery
      .selectFrom('ncmec_reporting.ncmec_org_settings')
      .select(['ncmec_additional_info_endpoint'])
      .where('org_id', '=', orgId)
      .executeTakeFirst();
    return rows?.ncmec_additional_info_endpoint;
  }

  async getUserHasExistingNcmeReport(params: {
    orgId: string;
    userId: string;
    userItemTypeId: string;
  }) {
    const { orgId, userId, userItemTypeId } = params;
    const firstReport = await this.pgQuery
      .selectFrom('ncmec_reporting.ncmec_reports')
      .select(['report_id'])
      .where('org_id', '=', orgId)
      .where('user_id', '=', userId)
      .where('user_item_type_id', '=', userItemTypeId)
      .where('is_test', '=', false)
      .executeTakeFirst();
    return firstReport != null;
  }

  /** Prior accepted NCMEC report IDs for the user, most recent first.
   * Non-numeric `report_id`s are skipped (XSD requires `xs:integer`). */
  async getPriorCTReportIds(params: {
    orgId: string;
    userId: string;
    userItemTypeId: string;
  }): Promise<number[]> {
    const { orgId, userId, userItemTypeId } = params;
    const rows = await this.pgQuery
      .selectFrom('ncmec_reporting.ncmec_reports')
      .select(['report_id'])
      .where('org_id', '=', orgId)
      .where('user_id', '=', userId)
      .where('user_item_type_id', '=', userItemTypeId)
      .where('is_test', '=', false)
      .orderBy('created_at', 'desc')
      .execute();
    return rows
      .map((r) => parseInt(r.report_id, 10))
      .filter((n) => Number.isFinite(n));
  }

  async submitReport(
    reportParams: NCMECReportParams,
    isTest: boolean,
  ): Promise<NcmecReportResult> {
    return this.tracer.addSpan(
      {
        resource: 'ncmecReportinService',
        operation: 'submitReport',
      },
      // eslint-disable-next-line complexity
      async (span) => {
        const logSafeReportParams = {
          orgId: reportParams.orgId,
          reviewerId: reportParams.reviewerId,
          reportedUserId: reportParams.reportedUser.id,
          reportedUserTypeId: reportParams.reportedUser.typeId,
          mediaCount: reportParams.media.length,
          threadsCount: reportParams.threads.length,
          incidentType: reportParams.incidentType,
          hasEscalation: Boolean(reportParams.escalateToHighPriority?.trim()),
          hasAdditionalInfo: Boolean(reportParams.additionalInfo?.trim()),
          jobId: reportParams.jobId,
        };
        span.setAttribute(
          `ncmecReportParams`,
          jsonStringify(logSafeReportParams),
        );
        ncmecDebugLog('submitReport.start', {
          isTest,
          ...logSafeReportParams,
        });

        // We try/catch this whole process in order to do custom logging on
        // failure, since we can't guarantee all traces with exceptions are
        // sampled in DD
        try {
          // These are test accounts that we send to prospective users, and
          // they should be able to click "Send to NCMEC" in the UI, but no
          // NCMEC report should actually be created.
          const testOrgs = ['4def6a77d6a', 'acc701627cb'];

          if (!(await this.hasNCMECReportingEnabled(reportParams.orgId))) {
            throw new Error(
              `NCMEC reports are not enabled for org ${reportParams.orgId}`,
            );
          }

          if (testOrgs.includes(reportParams.orgId)) {
            if (reportParams.jobId !== undefined) {
              await this.#recordSubmissionError({
                jobId: reportParams.jobId,
                userId: reportParams.reportedUser.id,
                userTypeId: reportParams.reportedUser.typeId,
                status: 'PERMANENT_ERROR',
                error:
                  'Org is on the NCMEC test allowlist; reports are suppressed.',
              });
            }
            return 'UNSUPPORTED_ORG';
          }

          if (reportParams.media.length === 0) {
            throw new Error('No media in report');
          }
          const latestMedia = _.maxBy(reportParams.media, (m) => {
            const ms = Date.parse(m.createdAt);
            if (Number.isNaN(ms)) {
              throw new Error(
                `Invalid media createdAt timestamp for incidentDateTime: ${m.createdAt}`,
              );
            }
            return ms;
          });
          if (latestMedia === undefined) {
            throw new Error('No media in report');
          }
          const maxCreatedAt = latestMedia.createdAt;

          const { value: clampedIncidentDateTime, wasClamped } =
            clampIncidentDateTimeToPast(maxCreatedAt);
          if (wasClamped) {
            ncmecDebugLog('incidentDateTime.clamped', {
              originalCreatedAt: maxCreatedAt,
              clampedTo: clampedIncidentDateTime,
            });
          }

          const cybertipAuthenticationCredentials =
            await this.getCybertipAuthenticationCredentials(reportParams.orgId);
          if (!cybertipAuthenticationCredentials) {
            throw new Error('org id not found');
          }

          const queryResponse = await this.pgQuery
            .selectFrom('ncmec_reporting.ncmec_org_settings')
            .select([
              'company_template as companyTemplate',
              'legal_url as legalURL',
              'default_internet_detail_type as defaultInternetDetailType',
              'terms_of_service as termsOfService',
              'contact_person_email as contactPersonEmail',
              'contact_person_first_name as contactPersonFirstName',
              'contact_person_last_name as contactPersonLastName',
              'contact_person_phone as contactPersonPhone',
            ])
            .where('org_id', '=', reportParams.orgId)
            .executeTakeFirst();

          if (
            !queryResponse ||
            !queryResponse.companyTemplate ||
            !queryResponse.legalURL
          ) {
            throw new Error('Insufficient settings');
          }

          if (isTest === false) {
            const hasExistingReport = await this.getUserHasExistingNcmeReport({
              orgId: reportParams.orgId,
              userId: reportParams.reportedUser.id,
              userItemTypeId: reportParams.reportedUser.typeId,
            });
            if (hasExistingReport) {
              throw new Error(
                `User with ID: ${reportParams.reportedUser.id} has existing report`,
              );
            }
          }

          const additionalInfo = await this.getNCMECAdditionalInfo(
            reportParams.orgId,
            [
              {
                id: reportParams.reportedUser.id,
                typeId: reportParams.reportedUser.typeId,
              },
            ],
            reportParams.media
              .map((media) => ({
                id: media.id,
                typeId: media.typeId,
              }))
              // If the user's profile picture or any other media on the user is
              // reported, it will manifest as the report. Filter this out and
              // assume that there are no IP events/additional info.
              .filter(
                (media) =>
                  !(
                    media.id === reportParams.reportedUser.id &&
                    media.typeId === reportParams.reportedUser.typeId
                  ),
              ),
          );
          if (additionalInfo === 'ALL_MEDIA_MISSING') {
            if (reportParams.jobId !== undefined) {
              await this.#recordSubmissionError({
                jobId: reportParams.jobId,
                userId: reportParams.reportedUser.id,
                userTypeId: reportParams.reportedUser.typeId,
                status: 'PERMANENT_ERROR',
                error:
                  'All reportable media is missing from storage; nothing to submit.',
              });
            }
            return 'ALL_MEDIA_MISSING';
          }
          // This should be validated in getNCMECAdditionalInfo so the ! is safe
          const userAdditionalInfo = additionalInfo.users.find(
            (it) =>
              it.id === reportParams.reportedUser.id &&
              it.typeId === reportParams.reportedUser.typeId,
          )!;
          const ncmecConfig = await this.getNCMECConfig(reportParams.orgId);

          const reportingPersonEmail = ncmecConfig?.contact_email?.trim();
          if (!reportingPersonEmail) {
            throw new Error(
              'NCMEC report requires a non-empty reporter contact email; configure it in Settings → NCMEC.',
            );
          }

          // Skip for test submissions: prod and exttest report IDs don't
          // cross-reference.
          const priorCTReports = isTest
            ? []
            : await this.getPriorCTReportIds({
                orgId: reportParams.orgId,
                userId: reportParams.reportedUser.id,
                userItemTypeId: reportParams.reportedUser.typeId,
              });

          const report = buildSubmitReportObject({
            reportParams,
            userAdditionalInfo,
            orgSettings: {
              companyTemplate: queryResponse.companyTemplate,
              legalURL: queryResponse.legalURL,
              defaultInternetDetailType:
                queryResponse.defaultInternetDetailType,
              termsOfService: queryResponse.termsOfService,
              contactPersonEmail: queryResponse.contactPersonEmail,
              contactPersonFirstName: queryResponse.contactPersonFirstName,
              contactPersonLastName: queryResponse.contactPersonLastName,
              contactPersonPhone: queryResponse.contactPersonPhone,
              reportingPersonEmail,
              moreInfoUrl: ncmecConfig?.more_info_url,
            },
            clampedIncidentDateTime,
            priorCTReports,
          });

          // For the five actions here
          // 1. #submit
          // 2. #upload
          // 3. #uploadAdditionalFile
          // 4. #finish
          // 5. #sendUserPreservationRequest
          // we should error and mark the span as failed if any single
          // call fails.
          // These 3 functions utilize #sendCyberTipRequest, which retries
          // each request in the event of an initial error to lower the
          // likelihood that network or other transient errors blow the
          // whole process up.

          const { reportId, xml } = await this.#submit(
            report,
            cybertipAuthenticationCredentials,
            isTest,
          );

          const reportedMedia = await Promise.all(
            reportParams.media.map(async (media) => {
              const mediaAdditionalInfo = additionalInfo.media.find(
                (it) => it.id === media.id && it.typeId === media.typeId,
              ) ?? {
                id: media.id,
                typeId: media.typeId,
                additionalInfo: [],
                ipCaptureEvent: [],
              };
              const mergedMediaInfo = {
                ...mediaAdditionalInfo,
                ipCaptureEvent: mergeFieldRoleIpIntoEvents(
                  mediaAdditionalInfo.ipCaptureEvent,
                  media.ipCaptureEvent,
                  media.ipAddress,
                  {
                    eventName: NCMECEvent.Upload,
                    dateTime: media.createdAt,
                  },
                ),
              };
              return this.#upload(
                reportId,
                media,
                cybertipAuthenticationCredentials,
                mergedMediaInfo,
                isTest,
              );
            }),
          );

          const additionalFiles = (
            additionalInfo.additionalFiles
              ? await Promise.all(
                  additionalInfo.additionalFiles.map(async (additionalFile) =>
                    this.#uploadAdditionalFile(
                      reportId,
                      cybertipAuthenticationCredentials,
                      additionalFile,
                      isTest,
                    ),
                  ),
                )
              : []
          ).flat();

          const threadCsvs = await this.#uploadThreadCsvs(
            reportId,
            reportParams.threads,
            cybertipAuthenticationCredentials,
            isTest,
          );

          await this.#finish(
            reportId,
            cybertipAuthenticationCredentials,
            isTest,
          );

          await this.pgQuery
            .insertInto('ncmec_reporting.ncmec_reports')
            .values({
              org_id: reportParams.orgId,
              report_id: reportId,
              user_id: reportParams.reportedUser.id,

              user_item_type_id: reportParams.reportedUser.typeId,
              reviewer_id: reportParams.reviewerId,
              // Safe to cast as a non empty array because of the createdAt check above
              reported_media: reportedMedia as NonEmptyArray<NcmecMediaReport>,
              report_xml: xml,
              additional_files: additionalFiles,
              reported_messages: threadCsvs,
              incident_type: reportParams.incidentType,
              is_test: isTest,
            })
            .execute();

          if (ncmecConfig?.ncmec_preservation_endpoint && isTest === false) {
            await this.#sendUserPreservationRequest({
              orgId: reportParams.orgId,
              user: {
                id: reportParams.reportedUser.id,
                typeId: reportParams.reportedUser.typeId,
              },
              reportedMedia: reportParams.media.map((media) => ({
                id: media.id,
                typeId: media.typeId,
              })),
              reportId: parseInt(reportId),
            });
          }
          return 'SUCCESS';
        } catch (e) {
          // We are intentionally using logErrorJson instead of relying on
          // safeTracer's logging because those logs are sampled in DD. For
          // NCMEC submission errors we need to record all failures and be
          // able to see the logs.
          // eslint-disable-next-line no-restricted-syntax
          logErrorJson({
            error: e,
            message: jsonStringify({
              reportParams: logSafeReportParams,
              isTest,
            }),
          });
          span.recordException(e as Exception);
          if (reportParams.jobId !== undefined) {
            await this.#recordSubmissionError({
              jobId: reportParams.jobId,
              userId: reportParams.reportedUser.id,
              userTypeId: reportParams.reportedUser.typeId,
              error: summarizeNcmecErrorForReviewer(e),
            });
          }
          return 'FAILURE';
        }
      },
    );
  }

  async #uploadAdditionalFile(
    reportId: string,
    cybertipAuthenticationCredentials: CyberTipAuth,
    additionalFileInfo: {
      fileUrl: string;
      additionalInfo?: string[] | undefined;
      fileName?: string;
    },
    isTest: boolean,
  ): Promise<NcmecAdditionalFile> {
    const downloadWithRetries = withRetries(
      {
        maxRetries: 5,
        initialTimeMsBetweenRetries: 5,
        maxTimeMsBetweenRetries: 500,
        jitter: true,
      },
      async () => {
        // TODO: Handle when this fails because of Unidici's memory limit
        const response = await this.fetchHTTP({
          url: additionalFileInfo.fileUrl,
          method: 'get',
          handleResponseBody: 'as-readable-stream',
          maxResponseSize: 'unlimited',
          iWillConsumeTheResponseBodyStreamQuicklyToAvoidACrash: true,
        });

        if (!response.ok || !response.body) {
          throw new Error(
            `Cannot download media from ${additionalFileInfo.fileUrl}`,
          );
        }

        return this.#sendCyberTipRequest({
          cybertipAuthenticationCredentials,
          body: makeFormDataLikeWithStreams({
            id: reportId,
            file: {
              data: response.body,
              fileName: additionalFileInfo.fileName,
            },
          }),
          route: '/upload',
          includeContentType: false, // remove ContentType header
          isTest,
        });
      },
    );
    const response = await downloadWithRetries();

    const responseJson = response.body as CyberTipUploadResponse;
    if (responseJson.reportResponse.responseCode._text !== '0') {
      throw new Error('NCMEC file upload failed.');
    }
    const fileId = responseJson.reportResponse.fileId._text;
    const fileXml = await this.#uploadFileDetails(
      {
        fileDetails: {
          reportId: parseInt(reportId),
          fileId,
          fileViewedByEsp: true,
          fileRelevance: 'Supplemental Reported',
          additionalInfo: additionalFileInfo.additionalInfo,
        },
      },
      cybertipAuthenticationCredentials,
      isTest,
    );
    return {
      ncmecFileId: fileId,
      xml: fileXml,
      url: additionalFileInfo.fileUrl,
    };
  }

  async #submit(
    report: Report,
    cybertipAuthenticationCredentials: CyberTipAuth,
    isTest: boolean,
  ) {
    const reportXML = js2xml(report, { compact: true });

    ncmecDebugLog('submit.xml', { isTest, length: reportXML.length });
    await ncmecDebugDump(
      `${isTest ? 'TEST-' : 'PROD-'}${new Date()
        .toISOString()
        .replace(/[:.]/g, '-')}-submit.xml`,
      reportXML,
    );

    const response = await this.#sendCyberTipRequest({
      cybertipAuthenticationCredentials,
      body: reportXML,
      route: '/submit',
      isTest,
    });

    const responseJson = response.body as CyberTipSubmitResponse;
    if (responseJson.reportResponse.responseCode._text !== '0') {
      throw new Error(
        `NCMEC report submission failed: responseCode=${responseJson.reportResponse.responseCode._text}`,
      );
    }

    return {
      reportId: responseJson.reportResponse.reportId._text,
      xml: reportXML,
    };
  }

  async #upload(
    reportId: string,
    media: Media,
    cybertipAuthenticationCredentials: CyberTipAuth,
    additionalInfo: MediaAdditionalInfo,
    isTest: boolean,
  ) {
    // TODO: Handle when this fails because of Unidici's memory limit
    const downloadWithRetries = withRetries(
      {
        maxRetries: 5,
        initialTimeMsBetweenRetries: 5,
        maxTimeMsBetweenRetries: 500,
        jitter: true,
      },
      async () => {
        const response = await this.fetchHTTP({
          url: media.url,
          method: 'get',
          handleResponseBody: 'as-readable-stream',
          maxResponseSize: 'unlimited',
          iWillConsumeTheResponseBodyStreamQuicklyToAvoidACrash: true,
        });

        if (!response.ok || !response.body) {
          throw new Error(`Cannot download media from ${media.url}`);
        }

        return this.#sendCyberTipRequest({
          cybertipAuthenticationCredentials,
          body: makeFormDataLikeWithStreams({
            id: reportId,
            file: {
              data: response.body,
              fileName: additionalInfo.fileName,
            },
          }),
          route: '/upload',
          includeContentType: false,
          isTest,
        });
      },
    );

    const response = await downloadWithRetries();
    const responseJson = response.body as CyberTipUploadResponse;
    if (responseJson.reportResponse.responseCode._text !== '0') {
      throw new Error('NCMEC file upload failed.');
    }
    const fileId = responseJson.reportResponse.fileId._text;
    const originalFileHash = toOriginalFileHashes({
      hmaHashes: media.hashes,
      webhookFileDetails: additionalInfo.fileDetails,
    });
    const originalFileName =
      additionalInfo.fileName ?? deriveOriginalFileNameFromUrl(media.url);
    const fileDetailsObject = buildFileDetailsObject({
      reportId: parseInt(reportId),
      fileId,
      ...(originalFileName ? { originalFileName } : {}),
      media,
      additionalInfo,
      ...(originalFileHash ? { originalFileHash } : {}),
    });
    const xml = await this.#uploadFileDetails(
      fileDetailsObject,
      cybertipAuthenticationCredentials,
      isTest,
    );
    return {
      ncmecFileId: fileId,
      id: media.id,
      typeId: media.typeId,
      xml,
    };
  }

  async #uploadFileDetails(
    fileDetails: FileDetails,
    cybertipAuthenticationCredentials: CyberTipAuth,
    isTest: boolean,
  ) {
    const fileDetailsXML = js2xml(fileDetails, { compact: true });
    ncmecDebugLog('fileinfo.xml', {
      isTest,
      reportId: fileDetails.fileDetails.reportId,
      fileId: fileDetails.fileDetails.fileId,
      length: fileDetailsXML.length,
    });
    await ncmecDebugDump(
      `${isTest ? 'TEST-' : 'PROD-'}${new Date()
        .toISOString()
        .replace(/[:.]/g, '-')}-fileinfo-${fileDetails.fileDetails.fileId}.xml`,
      fileDetailsXML,
    );
    const response = await this.#sendCyberTipRequest({
      cybertipAuthenticationCredentials,
      body: fileDetailsXML,
      route: '/fileinfo',
      isTest,
    });

    const responseJson = response.body as CyberTipFileDetailsResponse;
    if (responseJson.reportResponse.responseCode._text !== '0') {
      throw new Error('NCMEC file upload failed.');
    }
    return fileDetailsXML;
  }

  async #uploadThreadCsvs(
    reportId: string,
    reportedMedia: readonly NCMECThreadReport[],
    cybertipAuthenticationCredentials: CyberTipAuth,
    isTest: boolean,
  ) {
    const escapeCSVField = (field: string | undefined | null): string => {
      if (field == null) {
        return '';
      }
      const escapedField = field.replace(/"/g, '""');
      return `"${escapedField}"`;
    };

    const transformToCSV = (
      reportedContent: readonly NCMECReportedContentInThread[],
      threadId: string,
    ) => {
      const headers = [
        'content',
        'src',
        'target',
        'thread',
        'type',
        'contentId',
        'chat_type',
        'ip',
      ];
      const rows = reportedContent.map((content) => [
        escapeCSVField(content.content),
        escapeCSVField(content.creatorId),
        escapeCSVField(content.targetId),
        escapeCSVField(threadId),
        escapeCSVField(content.type),
        // Only send the content ID if it's not text
        content.type !== 'text' ? escapeCSVField(content.contentId) : undefined,
        escapeCSVField(content.chatType),
        escapeCSVField(content.ipAddress.ip),
      ]);

      // Join headers and rows
      return [headers.join(','), ...rows.map((row) => row.join(','))].join(
        '\n',
      );
    };

    return Promise.all(
      reportedMedia.map(async (thread) => {
        const csvContent = transformToCSV(
          thread.reportedContent,
          thread.threadId,
        );
        const csvBlob = new Blob([csvContent], { type: 'text/csv' });
        const requestBody = new FormData();
        requestBody.append('id', reportId);
        requestBody.append('file', csvBlob, `${thread.threadId}.csv`);

        const response = await this.#sendCyberTipRequest({
          cybertipAuthenticationCredentials,
          body: requestBody,
          route: '/upload',
          includeContentType: false,
          isTest,
        });

        if (!response.ok || response.body == null) {
          throw new Error('NCMEC thread CSV upload failed.');
        }

        const responseJson = response.body as CyberTipUploadResponse;
        if (responseJson.reportResponse.responseCode._text !== '0') {
          throw new Error('NCMEC thread csv failed.');
        }
        const fileId = responseJson.reportResponse.fileId._text;
        await this.#uploadFileDetails(
          {
            fileDetails: {
              reportId: parseInt(reportId),
              fileId,
              fileViewedByEsp: true,
              additionalInfo: [
                thread.threadTypeId === 'c01a3f28dfa'
                  ? 'File contains transcript of a private message conversation involving suspect.'
                  : 'File contains transcript of a group message conversation involving suspect.',
              ],
            },
          },
          cybertipAuthenticationCredentials,
          isTest,
        );

        return {
          csv: csvContent,
          ncmecFileId: responseJson.reportResponse.fileId._text,
          fileName: `${thread.threadId}.csv`,
        };
      }),
    );
  }

  async #finish(
    reportId: string,
    cybertipAuthenticationCredentials: CyberTipAuth,
    isTest: boolean,
  ) {
    ncmecDebugLog('finish.request', { reportId, isTest });
    const requestBody = new FormData();
    requestBody.append('id', reportId);

    const response = await this.#sendCyberTipRequest({
      cybertipAuthenticationCredentials,
      body: requestBody,
      route: '/finish',
      includeContentType: false,
      isTest,
    });

    if (!response.ok) {
      throw new Error('NCMEC report finish failed.');
    }

    const responseJson = response.body as CyberTipFinishResponse;
    return responseJson.reportDoneResponse.reportId;
  }

  /** Best-effort write of a failed-submission row. Swallows its own DB errors
   * so a follow-on failure can't turn a NCMEC FAILURE into an unhandled
   * exception. */
  async #recordSubmissionError(opts: {
    jobId: string;
    userId: string;
    userTypeId: string;
    error: string;
    status?: 'RETRYABLE_ERROR' | 'PERMANENT_ERROR';
  }) {
    try {
      const status = opts.status ?? 'RETRYABLE_ERROR';
      // Atomic increment in `doUpdateSet` avoids the read-modify-write race
      // when two retries land on the same job_id concurrently.
      await this.pgQuery
        .insertInto('ncmec_reporting.ncmec_reports_errors')
        .values({
          job_id: opts.jobId,
          user_id: opts.userId,
          user_type_id: opts.userTypeId,
          status,
          last_error: opts.error,
          retry_count: 1,
        })
        .onConflict((oc) =>
          oc.columns(['job_id']).doUpdateSet({
            retry_count: sql`ncmec_reporting.ncmec_reports_errors.retry_count + 1`,
            last_error: opts.error,
            status,
          }),
        )
        .execute();
    } catch (e: unknown) {
      // eslint-disable-next-line no-restricted-syntax
      logErrorJson({
        error: e,
        message: jsonStringify({
          context: 'recordSubmissionError',
          jobId: opts.jobId,
        }),
      });
    }
  }

  async #sendCyberTipRequest(input: {
    cybertipAuthenticationCredentials: CyberTipAuth;
    body: string | FormData | FormDataLikeWithStreams;
    route: `/${string}`;
    isTest: boolean;
    includeContentType?: boolean;
  }) {
    const {
      cybertipAuthenticationCredentials,
      body,
      route,
      isTest,
      includeContentType = true,
    } = input;
    const username = cybertipAuthenticationCredentials.username;
    const password = cybertipAuthenticationCredentials.password;

    // TODO: update this to https://report.cybertip.org/ispws when we want to submit
    // real reports

    const sendCyberTipRequestWithRetries = withRetries(
      {
        maxRetries: 5,
        initialTimeMsBetweenRetries: 5,
        maxTimeMsBetweenRetries: 500,
        jitter: true,
      },
      async () => {
        const url = isTest
          ? `https://exttest.cybertip.org/ispws${route}`
          : `https://report.cybertip.org/ispws${route}`;
        ncmecDebugLog('cybertip.request', {
          route,
          isTest,
          bodyKind: typeof body === 'string' ? 'xml' : 'formData',
          bodyLength: typeof body === 'string' ? body.length : undefined,
        });
        const response = await this.fetchHTTP({
          url,
          method: 'post',
          headers: {
            ...(includeContentType ? { 'Content-Type': 'text/xml' } : {}),
            Authorization:
              'Basic ' +
              Buffer.from(`${username}:${password}`).toString('base64'),
          },
          body,
          handleResponseBody: 'as-json-from-xml',
        });

        ncmecDebugLog('cybertip.response', {
          route,
          status: response.status,
          ok: response.ok,
          body: response.body ?? null,
        });

        if (!response.ok) {
          throw new Error(
            summarizeCyberTipFailure(route, response.status, response.body),
          );
        }
        return response;
      },
    );
    return sendCyberTipRequestWithRetries();
  }

  async getCybertipAuthenticationCredentials(orgId: string) {
    return this.pgQuery
      .selectFrom('ncmec_reporting.ncmec_org_settings')
      .select(['username', 'password'])
      .where('org_id', '=', orgId)
      .executeTakeFirst();
  }
}
