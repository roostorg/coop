import { ScalarTypes, type DateString, type Field } from '@roostorg/coop-types';

import { type NormalizedItemData } from '../itemProcessingService/index.js';
import {
  type ContentItemType,
  type UserItemType,
} from '../moderationConfigService/types/itemTypes.js';
import {
  buildSubmitReportParamsFromDecision,
  type BuildSubmitReportParamsInput,
} from './buildSubmitReportParamsFromDecision.js';

const FIXED_NOW_ISO = '2026-05-27T18:00:00.000Z';
// `makeDateString` returns `DateString | undefined`; we know our literal is a
// well-formed ISO string, so this skips the runtime branch in tests.
const FIXED_NOW = FIXED_NOW_ISO as DateString;
// `NormalizedItemData` is an Opaque<RawItemData> type produced by the items
// pipeline; tests need to bypass the brand to construct fixtures.
const asNormalizedData = (data: Record<string, unknown>): NormalizedItemData =>
  data as unknown as NormalizedItemData;

// Minimal Field factories for the test fixtures below; these match the shape
// that the items API would store after normalising an `IP_ADDRESS`-typed
// field, so we don't need to plug in fieldTypeHandlers here.
const stringField = (name: string): Field => ({
  name,
  type: ScalarTypes.STRING,
  required: false,
  container: null,
});

const ipAddressField = (name: string): Field => ({
  name,
  type: ScalarTypes.IP_ADDRESS,
  required: false,
  container: null,
});

const datetimeField = (name: string): Field => ({
  name,
  type: ScalarTypes.DATETIME,
  required: false,
  container: null,
});

function makeUserItemType(overrides: {
  ipAddressField?: string;
  ipAddressFieldName?: string;
  emailField?: string;
  data?: NormalizedItemData;
}): UserItemType {
  const ipFieldName = overrides.ipAddressFieldName ?? 'client_ip';
  // The schema is built immutably (no .push) to satisfy
  // functional/immutable-data; we then cast to the non-empty `ItemSchema`
  // brand because the constructor is internal.
  const fields: readonly Field[] = [
    stringField('display_name'),
    ...(overrides.ipAddressField !== undefined
      ? [ipAddressField(ipFieldName)]
      : []),
    ...(overrides.emailField !== undefined
      ? [stringField(overrides.emailField)]
      : []),
  ];
  return {
    id: 'user-type-1',
    kind: 'USER',
    name: 'User',
    description: null,
    schema: fields as unknown as UserItemType['schema'],
    version: 'v1',
    schemaVariant: 'original',
    orgId: 'org-1',
    isDefaultUserType: true,
    schemaFieldRoles: {
      displayName: 'display_name',
      ...(overrides.ipAddressField !== undefined
        ? { ipAddress: overrides.ipAddressField }
        : {}),
      ...(overrides.emailField !== undefined
        ? { email: overrides.emailField }
        : {}),
    },
  };
}

function makeContentItemType(overrides: {
  ipAddressField?: string;
}): ContentItemType {
  const fields: readonly Field[] =
    overrides.ipAddressField !== undefined
      ? [
          datetimeField('created_at'),
          stringField('caption'),
          ipAddressField(overrides.ipAddressField),
        ]
      : [datetimeField('created_at'), stringField('caption')];
  // `ContentSchemaFieldRoles` is a discriminated union; setting `createdAt`
  // narrows it to the variant that also requires `threadId`. The fixture
  // doesn't model threads, so we widen via `unknown` to keep the rest of the
  // schema-role plumbing exercised without dragging thread fields in.
  const schemaFieldRoles = {
    createdAt: 'created_at',
    ...(overrides.ipAddressField !== undefined
      ? { ipAddress: overrides.ipAddressField }
      : {}),
  } as unknown as ContentItemType['schemaFieldRoles'];
  return {
    id: 'content-type-1',
    kind: 'CONTENT',
    name: 'Photo',
    description: null,
    schema: fields as unknown as ContentItemType['schema'],
    version: 'v1',
    schemaVariant: 'original',
    orgId: 'org-1',
    schemaFieldRoles,
  };
}

/** Build a `BuildSubmitReportParamsInput` with sensible defaults; tests
 * override only the bits relevant to what they exercise. */
function makeInput(opts: {
  reportedUserItemType: UserItemType;
  reportedUserData: NormalizedItemData;
  contentItemType: ContentItemType;
  contentData: NormalizedItemData;
}): BuildSubmitReportParamsInput {
  const mediaItem = {
    contentItem: {
      itemId: 'media-1',
      itemTypeIdentifier: { id: 'content-type-1' },
      data: opts.contentData,
    },
  };

  return {
    orgId: 'org-1',
    reviewerId: 'reviewer-1',
    reportedItemId: 'user-1',
    reportedItemTypeId: 'user-type-1',
    reportedUserItemType: opts.reportedUserItemType,
    reportedUserData: opts.reportedUserData,
    allMediaItems: [mediaItem],
    decisionComponent: {
      reportedMedia: [
        {
          id: 'media-1',
          typeId: 'content-type-1',
          url: 'https://example.com/m1.png',
          industryClassification: 'A1',
          fileAnnotations: [],
        },
      ],
      reportedMessages: [],
      incidentType:
        'Child Pornography (possession, manufacture, and distribution)',
    },
    getItemTypeEventuallyConsistent: async () => opts.contentItemType,
  };
}

describe('buildSubmitReportParamsFromDecision', () => {
  describe('ipAddress field-role propagation', () => {
    it('reads the user IP from the schema field role and surfaces it on `reportedUser.ipAddress`', async () => {
      const userItemType = makeUserItemType({
        ipAddressField: 'client_ip',
      });
      const result = await buildSubmitReportParamsFromDecision(
        makeInput({
          reportedUserItemType: userItemType,
          reportedUserData: asNormalizedData({
            display_name: 'Alice',
            client_ip: '192.0.2.10',
          }),
          contentItemType: makeContentItemType({}),
          contentData: asNormalizedData({ created_at: FIXED_NOW }),
        }),
      );

      expect(result.reportedUser).toMatchObject({
        id: 'user-1',
        typeId: 'user-type-1',
        displayName: 'Alice',
        ipAddress: '192.0.2.10',
      });
    });

    it('omits `reportedUser.ipAddress` when the role is not mapped (legacy item types)', async () => {
      const userItemType = makeUserItemType({});
      const result = await buildSubmitReportParamsFromDecision(
        makeInput({
          reportedUserItemType: userItemType,
          reportedUserData: asNormalizedData({ display_name: 'Alice' }),
          contentItemType: makeContentItemType({}),
          contentData: asNormalizedData({ created_at: FIXED_NOW }),
        }),
      );

      // SECURITY-ish: missing role must produce a missing key, not an empty
      // string. NCMEC's ipAddress validator requires a non-empty string, so an
      // empty string would silently produce an invalid CyberTip payload.
      expect(result.reportedUser).not.toHaveProperty('ipAddress');
    });

    it('omits `reportedUser.ipAddress` when the field is mapped but absent in the data', async () => {
      const userItemType = makeUserItemType({
        ipAddressField: 'client_ip',
      });
      const result = await buildSubmitReportParamsFromDecision(
        makeInput({
          reportedUserItemType: userItemType,
          reportedUserData: asNormalizedData({ display_name: 'Alice' }),
          contentItemType: makeContentItemType({}),
          contentData: asNormalizedData({ created_at: FIXED_NOW }),
        }),
      );

      expect(result.reportedUser).not.toHaveProperty('ipAddress');
    });

    it('reads the per-media IP from the content item type role', async () => {
      const userItemType = makeUserItemType({});
      const contentItemType = makeContentItemType({
        ipAddressField: 'upload_ip',
      });

      const result = await buildSubmitReportParamsFromDecision(
        makeInput({
          reportedUserItemType: userItemType,
          reportedUserData: asNormalizedData({ display_name: 'Alice' }),
          contentItemType,
          contentData: asNormalizedData({
            created_at: FIXED_NOW,
            upload_ip: '203.0.113.42',
          }),
        }),
      );

      expect(result.media).toHaveLength(1);
      expect(result.media[0]).toMatchObject({
        id: 'media-1',
        typeId: 'content-type-1',
        ipAddress: '203.0.113.42',
      });
    });

    it('omits per-media `ipAddress` when role is not mapped', async () => {
      const result = await buildSubmitReportParamsFromDecision(
        makeInput({
          reportedUserItemType: makeUserItemType({}),
          reportedUserData: asNormalizedData({ display_name: 'Alice' }),
          contentItemType: makeContentItemType({}),
          contentData: asNormalizedData({ created_at: FIXED_NOW }),
        }),
      );

      expect(result.media[0]).not.toHaveProperty('ipAddress');
    });

    it('falls back to "now" when the role-derived `createdAt` is unparseable', async () => {
      const userItemType = makeUserItemType({});
      const contentItemType = makeContentItemType({});
      const before = Date.now();
      const result = await buildSubmitReportParamsFromDecision(
        makeInput({
          reportedUserItemType: userItemType,
          reportedUserData: asNormalizedData({ display_name: 'Alice' }),
          contentItemType,
          contentData: asNormalizedData({
            created_at: 'not-a-real-date',
          }),
        }),
      );
      const after = Date.now();

      expect(result.media).toHaveLength(1);
      const fallbackMs = Date.parse(result.media[0].createdAt);
      expect(Number.isNaN(fallbackMs)).toBe(false);
      expect(fallbackMs).toBeGreaterThanOrEqual(before);
      expect(fallbackMs).toBeLessThanOrEqual(after);
    });

    it('preserves a valid role-derived `createdAt` unchanged', async () => {
      const userItemType = makeUserItemType({});
      const contentItemType = makeContentItemType({});
      const result = await buildSubmitReportParamsFromDecision(
        makeInput({
          reportedUserItemType: userItemType,
          reportedUserData: asNormalizedData({ display_name: 'Alice' }),
          contentItemType,
          contentData: asNormalizedData({ created_at: FIXED_NOW }),
        }),
      );

      expect(result.media[0].createdAt).toBe(FIXED_NOW);
    });

    it('propagates IPv6 addresses unchanged', async () => {
      const userItemType = makeUserItemType({
        ipAddressField: 'client_ip',
      });
      const result = await buildSubmitReportParamsFromDecision(
        makeInput({
          reportedUserItemType: userItemType,
          reportedUserData: asNormalizedData({
            display_name: 'Alice',
            client_ip: '2001:db8::1',
          }),
          contentItemType: makeContentItemType({}),
          contentData: asNormalizedData({ created_at: FIXED_NOW }),
        }),
      );

      expect(result.reportedUser.ipAddress).toBe('2001:db8::1');
    });
  });

  // Regression: without this, adopters who don't run an external
  // additional-info endpoint submit NCMEC reports with empty email, which
  // NCMEC rejects as "incomplete."
  describe('email field-role propagation', () => {
    it('reads the user email from the schema field role and surfaces it on `reportedUser.email`', async () => {
      const userItemType = makeUserItemType({
        emailField: 'user_email',
      });
      const result = await buildSubmitReportParamsFromDecision(
        makeInput({
          reportedUserItemType: userItemType,
          reportedUserData: asNormalizedData({
            display_name: 'Alice',
            user_email: 'alice@example.com',
          }),
          contentItemType: makeContentItemType({}),
          contentData: asNormalizedData({ created_at: FIXED_NOW }),
        }),
      );

      expect(result.reportedUser).toMatchObject({
        id: 'user-1',
        typeId: 'user-type-1',
        displayName: 'Alice',
        email: 'alice@example.com',
      });
    });

    it('omits `reportedUser.email` when the role is not mapped', async () => {
      const result = await buildSubmitReportParamsFromDecision(
        makeInput({
          reportedUserItemType: makeUserItemType({}),
          reportedUserData: asNormalizedData({ display_name: 'Alice' }),
          contentItemType: makeContentItemType({}),
          contentData: asNormalizedData({ created_at: FIXED_NOW }),
        }),
      );

      // NCMEC validates email shape on receipt; an empty string here would
      // produce the same "incomplete" rejection the bug repros. Missing key
      // is the only safe encoding.
      expect(result.reportedUser).not.toHaveProperty('email');
    });

    it('omits `reportedUser.email` when the field is mapped but absent in the data', async () => {
      const userItemType = makeUserItemType({
        emailField: 'user_email',
      });
      const result = await buildSubmitReportParamsFromDecision(
        makeInput({
          reportedUserItemType: userItemType,
          reportedUserData: asNormalizedData({ display_name: 'Alice' }),
          contentItemType: makeContentItemType({}),
          contentData: asNormalizedData({ created_at: FIXED_NOW }),
        }),
      );

      expect(result.reportedUser).not.toHaveProperty('email');
    });
  });

  describe('HMA hash extraction on media', () => {
    it('attaches hashes from the matching image in item data', async () => {
      const result = await buildSubmitReportParamsFromDecision(
        makeInput({
          reportedUserItemType: makeUserItemType({}),
          reportedUserData: asNormalizedData({ display_name: 'Alice' }),
          contentItemType: makeContentItemType({}),
          contentData: asNormalizedData({
            created_at: FIXED_NOW,
            image: {
              url: 'https://example.com/m1.png',
              hashes: { md5: 'abc123', pdq: 'def456' },
            },
          }),
        }),
      );

      expect(result.media[0]).toMatchObject({
        url: 'https://example.com/m1.png',
        hashes: { md5: 'abc123', pdq: 'def456' },
      });
    });

    it('finds the matching image inside an ARRAY-of-IMAGE container', async () => {
      const result = await buildSubmitReportParamsFromDecision(
        makeInput({
          reportedUserItemType: makeUserItemType({}),
          reportedUserData: asNormalizedData({ display_name: 'Alice' }),
          contentItemType: makeContentItemType({}),
          contentData: asNormalizedData({
            created_at: FIXED_NOW,
            images: [
              {
                url: 'https://example.com/other.png',
                hashes: { md5: 'wrong' },
              },
              {
                url: 'https://example.com/m1.png',
                hashes: { md5: 'right' },
              },
            ],
          }),
        }),
      );

      expect(result.media[0].hashes).toEqual({ md5: 'right' });
    });

    it('omits `hashes` when no image in the data matches the reported URL', async () => {
      const result = await buildSubmitReportParamsFromDecision(
        makeInput({
          reportedUserItemType: makeUserItemType({}),
          reportedUserData: asNormalizedData({ display_name: 'Alice' }),
          contentItemType: makeContentItemType({}),
          contentData: asNormalizedData({
            created_at: FIXED_NOW,
            image: {
              url: 'https://example.com/different.png',
              hashes: { md5: 'abc' },
            },
          }),
        }),
      );

      expect(result.media[0]).not.toHaveProperty('hashes');
    });

    it('omits `hashes` when the matching image has no hashes attached', async () => {
      const result = await buildSubmitReportParamsFromDecision(
        makeInput({
          reportedUserItemType: makeUserItemType({}),
          reportedUserData: asNormalizedData({ display_name: 'Alice' }),
          contentItemType: makeContentItemType({}),
          contentData: asNormalizedData({
            created_at: FIXED_NOW,
            image: { url: 'https://example.com/m1.png' },
          }),
        }),
      );

      expect(result.media[0]).not.toHaveProperty('hashes');
    });
  });
});
