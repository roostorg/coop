/* eslint-disable max-lines */
import type { Exception } from '@opentelemetry/api';
import { makeEnumLike, type ItemIdentifier } from '@roostorg/types';
import _Ajv from 'ajv';
import { type Kysely } from 'kysely';
import _ from 'lodash';
import { type FormData as FormDataType } from 'undici';
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
    industryClassification?: NCMECIndustryClassificationType;
    ipCaptureEvent?: IPNCMECEvent[];
    deviceId?: DeviceId[];
    details?: Detail[];
    additionalInfo?: string[];
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
  ipCaptureEvent?: IPNCMECEvent;
  deviceId?: DeviceNCMECEvent[];
};

type NCMECUserParams = {
  id: string;
  typeId: string;
  profilePicture?: string;
  displayName?: string;
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
};

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
            url: string;
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

export function buildInternetDetailsFromOrgSetting(
  defaultInternetDetailType: string | null | undefined,
  moreInfoUrl: string | null | undefined,
): Report['report']['internetDetails'] {
  if (!defaultInternetDetailType?.trim()) {
    return undefined;
  }
  const type = defaultInternetDetailType.trim() as NcmecInternetDetailTypeSetting;
  if (!NCMEC_INTERNET_DETAIL_TYPES.includes(type)) {
    return undefined;
  }
  const webPageUrl = moreInfoUrl?.trim() ?? 'Not specified';
  switch (type) {
    case 'WEB_PAGE':
      return [{ webPageIncident: { url: webPageUrl } }];
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

  async getNCMECConfig(orgId: string): Promise<NcmecReportingServicePg['ncmec_reporting.ncmec_org_settings'] | undefined>  {
    const row = await this.pgQuery
      .selectFrom('ncmec_reporting.ncmec_org_settings')
      .where('org_id', '=', orgId)
      .executeTakeFirst();
    if (!row) {
      return undefined;
    }

    return row as NcmecReportingServicePg['ncmec_reporting.ncmec_org_settings'];
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
    const additionalInfoEndpoint = await this.ncmecAdditionalInfoEndpoint(
      orgId,
    );
    
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
          fileDetails: {
            ipCaptureEvent: [],
          },
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
    const ncmecPreservationEndpoint = await this.ncmecPreservationEndpoint(
      orgId,
    );

    if (ncmecPreservationEndpoint == null) {
      throw new Error('Organization does not have a NCMEC preservation endpoint');
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
        span.setAttribute(`ncmecReportParams`, jsonStringify(reportParams));

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
            return 'UNSUPPORTED_ORG';
          }

          const maxCreatedAt = _.maxBy(reportParams.media, 'createdAt')
            ?.createdAt;

          if (!maxCreatedAt) {
            throw new Error('No media in report');
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
            return 'ALL_MEDIA_MISSING';
          }
          // This should be validated in getNCMECAdditionalInfo so the ! is safe
          const userAdditionalInfo = additionalInfo.users.find(
            (it) =>
              it.id === reportParams.reportedUser.id &&
              it.typeId === reportParams.reportedUser.typeId,
          )!;
          const emailStringToNCMECEmail = (email: string) => ({ _text: email });
          const ncmecConfig = await this.getNCMECConfig(reportParams.orgId);

          // Use the incident type from the report params
          const incidentType = NCMECIncidentType[reportParams.incidentType as NCMECIncidentType];

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

          const internetDetails = buildInternetDetailsFromOrgSetting(
            queryResponse.defaultInternetDetailType,
            ncmecConfig?.more_info_url,
          );

          const report: Report = {
            report: {
              incidentSummary: {
                incidentType,
                incidentDateTime: maxCreatedAt,
                ...(escalateToHighPriority
                  ? { escalateToHighPriority }
                  : {}),
              },
              ...(internetDetails ? { internetDetails } : {}),
              reporter: {
                reportingPerson: {
                  email: [emailStringToNCMECEmail(ncmecConfig?.contact_email ?? '')],
                },
                companyTemplate: queryResponse.companyTemplate,
                legalURL: queryResponse.legalURL,
                ...(queryResponse.termsOfService != null &&
                queryResponse.termsOfService.trim() !== '' &&
                queryResponse.termsOfService.length <= 3000
                  ? { termsOfService: queryResponse.termsOfService.trim() }
                  : {}),
                ...(queryResponse.contactPersonEmail?.trim() ??
                queryResponse.contactPersonFirstName?.trim() ??
                queryResponse.contactPersonLastName?.trim() ??
                queryResponse.contactPersonPhone?.trim()
                  ? {
                      contactPerson: {
                        ...(queryResponse.contactPersonEmail?.trim()
                          ? {
                              email: [
                                emailStringToNCMECEmail(
                                  queryResponse.contactPersonEmail.trim(),
                                ),
                              ],
                            }
                          : {}),
                        ...(queryResponse.contactPersonFirstName?.trim()
                          ? {
                              firstName: queryResponse.contactPersonFirstName.trim(),
                            }
                          : {}),
                        ...(queryResponse.contactPersonLastName?.trim()
                          ? {
                              lastName: queryResponse.contactPersonLastName.trim(),
                            }
                          : {}),
                        ...(queryResponse.contactPersonPhone?.trim()
                          ? {
                              phone: {
                                _text: queryResponse.contactPersonPhone.trim(),
                              },
                            }
                          : {}),
                      },
                    }
                  : {}),
              },
              personOrUserReported: {
                personOrUserReportedPerson: {
                  email: userAdditionalInfo.email,
                },
                espIdentifier: reportParams.reportedUser.id,
                espService: queryResponse.companyTemplate,
                screenName: userAdditionalInfo.screenName,
                ...(reportParams.reportedUser.displayName
                  ? {
                      displayName: [reportParams.reportedUser.displayName],
                    }
                  : {}),
                ...(userAdditionalInfo.ipCaptureEvent &&
                userAdditionalInfo.ipCaptureEvent.length > 0
                  ? { ipCaptureEvent: userAdditionalInfo.ipCaptureEvent }
                  : {}),
              },
            },
          };

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
              return this.#upload(
                reportId,
                media,
                cybertipAuthenticationCredentials,
                mediaAdditionalInfo,
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
          // able to see the logs
          
          // eslint-disable-next-line no-console
          console.error('[NCMEC] ❌ Error during report submission:', e);
          // eslint-disable-next-line no-console
          console.error('[NCMEC] Error details:', {
            message: e instanceof Error ? e.message : String(e),
            stack: e instanceof Error ? e.stack : undefined,
          });
          
          // eslint-disable-next-line no-restricted-syntax
          logErrorJson({
            error: e,
            message: jsonStringify({ reportParams, isTest }),
          });
          span.recordException(e as Exception);
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
    
    // Save XML to file for review (development only)
    if (process.env.NODE_ENV === 'development') {
      try {
        const fs = await import('fs/promises');
        const path = await import('path');
        
        // Create ncmec-reports directory if it doesn't exist
        const reportsDir = path.join(process.cwd(), 'ncmec-reports');
        await fs.mkdir(reportsDir, { recursive: true });
        
        // Generate filename with timestamp and test indicator
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const testPrefix = isTest ? 'TEST-' : 'PROD-';
        const filename = `${testPrefix}${timestamp}.xml`;
        const filepath = path.join(reportsDir, filename);
        
        // Write XML to file
        await fs.writeFile(filepath, reportXML, 'utf-8');
        
      } catch (e) {
        // Silent fail - don't let file saving break the submission
      }
    }
    
    const response = await this.#sendCyberTipRequest({
      cybertipAuthenticationCredentials,
      body: reportXML,
      route: '/submit',
      isTest,
    });

    const responseJson = response.body as CyberTipSubmitResponse;
    if (responseJson.reportResponse.responseCode._text !== '0') {
      throw new Error('NCMEC report submission failed.');
    }
    
    // eslint-disable-next-line no-console
    console.log('[NCMEC] ✅ Report submitted successfully! Report ID:', responseJson.reportResponse.reportId._text);
    
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
    const xml = await this.#uploadFileDetails(
      {
        fileDetails: {
          reportId: parseInt(reportId),
          fileId,
          // All reported content is reviewed by the ESP before submission.
          fileViewedByEsp: true,
          exifViewedByEsp: true,
          fileAnnotations: this.#fileAnnotationArrayToNCMECFileAnnotation(
            media.fileAnnotations,
          ),
          industryClassification: media.industryClassification,
          ...(additionalInfo.publiclyAvailable !== undefined
            ? { publiclyAvailable: additionalInfo.publiclyAvailable }
            : {}),
          // Annoyingly, NCMEC only accepts IP Address XML in order so unwrap it
          // in the correct order in case it was passed in incorrectly
          ...(additionalInfo.ipCaptureEvent &&
          additionalInfo.ipCaptureEvent.length > 0
            ? {
                ipCaptureEvent: additionalInfo.ipCaptureEvent.map((it) => ({
                  ipAddress: it.ipAddress,
                  eventName: it.eventName,
                  dateTime: it.dateTime,
                  ...(it.possibleProxy
                    ? { possibleProxy: it.possibleProxy }
                    : {}),
                  ...(it.port ? { port: it.port } : {}),
                })),
              }
            : {}),
          ...(additionalInfo.additionalInfo
            ? { additionalInfo: additionalInfo.additionalInfo }
            : {}),
        },
      },
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

  #fileAnnotationArrayToNCMECFileAnnotation(
    fileAnnotations?: readonly NCMECFileAnnotationType[],
  ): FileAnnotations {
    return {
      ...(fileAnnotations?.includes(
        NCMECFileAnnotation.ANIME_DRAWING_VIRTUAL_HENTAI,
      )
        ? {
            animeDrawingVirtualHentai: undefined,
          }
        : {}),
      ...(fileAnnotations?.includes(NCMECFileAnnotation.POTENTIAL_MEME)
        ? {
            potentialMeme: undefined,
          }
        : {}),
      ...(fileAnnotations?.includes(NCMECFileAnnotation.VIRAL)
        ? {
            viral: undefined,
          }
        : {}),
      ...(fileAnnotations?.includes(
        NCMECFileAnnotation.POSSIBLE_SELF_PRODUCTION,
      )
        ? {
            possibleSelfProduction: undefined,
          }
        : {}),
      ...(fileAnnotations?.includes(NCMECFileAnnotation.PHYSICAL_HARM)
        ? {
            physicalHarm: undefined,
          }
        : {}),
      ...(fileAnnotations?.includes(NCMECFileAnnotation.VIOLENCE_GORE)
        ? {
            violenceGore: undefined,
          }
        : {}),
      ...(fileAnnotations?.includes(NCMECFileAnnotation.BESTIALITY)
        ? {
            bestiality: undefined,
          }
        : {}),
      ...(fileAnnotations?.includes(NCMECFileAnnotation.LIVE_STREAMING)
        ? {
            liveStreaming: undefined,
          }
        : {}),
      ...(fileAnnotations?.includes(NCMECFileAnnotation.INFANT)
        ? {
            infant: undefined,
          }
        : {}),
      ...(fileAnnotations?.includes(NCMECFileAnnotation.GENERATIVE_AI)
        ? {
            generativeAi: undefined,
          }
        : {}),
    };
  }

  async #uploadFileDetails(
    fileDetails: FileDetails,
    cybertipAuthenticationCredentials: CyberTipAuth,
    isTest: boolean,
  ) {
    const fileDetailsXML = js2xml(fileDetails, { compact: true });
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
          body: requestBody as FormDataType,
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
    const requestBody = new FormData();
    requestBody.append('id', reportId);

    const response = await this.#sendCyberTipRequest({
      cybertipAuthenticationCredentials,
      body: requestBody as FormDataType,
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

  async #sendCyberTipRequest(input: {
    cybertipAuthenticationCredentials: CyberTipAuth;
    body: string | FormDataType | FormDataLikeWithStreams;
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
        const response = await this.fetchHTTP({
          url: isTest
            ? `https://exttest.cybertip.org/ispws${route}`
            : `https://report.cybertip.org/ispws${route}`,
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

        if (!response.ok) {
          throw new Error('CyberTip Request Failed');
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
