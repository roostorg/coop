import {
  buildFileDetailsObject,
  fileAnnotationArrayToNCMECFileAnnotation,
  NCMECEvent,
  NCMECFileAnnotation,
} from './ncmecReporting.js';

const INCIDENT_DATE_TIME = '2026-05-27T18:00:00.000Z';

describe('fileAnnotationArrayToNCMECFileAnnotation', () => {
  it('returns undefined for empty or missing input', () => {
    expect(fileAnnotationArrayToNCMECFileAnnotation(undefined)).toBeUndefined();
    expect(fileAnnotationArrayToNCMECFileAnnotation([])).toBeUndefined();
  });

  it('maps each annotation enum value to the XSD child element name', () => {
    // The XSD names each annotation as a self-closing child element; js2xml
    // emits one element per key, so the resulting `Record` keys are the
    // ground truth for what NCMEC sees.
    expect(
      fileAnnotationArrayToNCMECFileAnnotation([
        NCMECFileAnnotation.GENERATIVE_AI,
        NCMECFileAnnotation.INFANT,
        NCMECFileAnnotation.ANIME_DRAWING_VIRTUAL_HENTAI,
      ]),
    ).toEqual({
      generativeAi: undefined,
      infant: undefined,
      animeDrawingVirtualHentai: undefined,
    });
  });

  it('dedupes repeated annotations into a single key', () => {
    const result = fileAnnotationArrayToNCMECFileAnnotation([
      NCMECFileAnnotation.VIRAL,
      NCMECFileAnnotation.VIRAL,
    ]);
    expect(result).toEqual({ viral: undefined });
  });
});

describe('buildFileDetailsObject', () => {
  const baseInput = {
    reportId: 1234,
    fileId: 'ncmec-file-1',
    media: {
      industryClassification: 'A1' as const,
      fileAnnotations: undefined,
    },
    additionalInfo: {},
  };

  it('builds the minimum fileDetails envelope with viewed-by-esp flags on', () => {
    // NCMEC defaults: coop has reviewed both the file and any EXIF metadata
    // before submitting, so these flags are always true.
    expect(buildFileDetailsObject(baseInput)).toEqual({
      fileDetails: {
        reportId: 1234,
        fileId: 'ncmec-file-1',
        fileViewedByEsp: true,
        exifViewedByEsp: true,
        industryClassification: 'A1',
      },
    });
  });

  it('preserves XSD insertion order (Appendix C)', () => {
    // js2xml emits children in insertion order; NCMEC rejects out-of-order
    // submissions with responseCode=4100. Anchoring the key order here
    // catches a regression that integration tests would only catch when
    // exttest rejects the report.
    const result = buildFileDetailsObject({
      ...baseInput,
      media: {
        industryClassification: 'A1' as const,
        fileAnnotations: [NCMECFileAnnotation.GENERATIVE_AI],
      },
      additionalInfo: {
        publiclyAvailable: true,
        ipCaptureEvent: [
          {
            ipAddress: '203.0.113.1',
            eventName: NCMECEvent.Upload,
            dateTime: INCIDENT_DATE_TIME,
          },
        ],
        additionalInfo: ['from webhook'],
      },
      originalFileHash: [{ _text: 'abc123', _attributes: { hashType: 'MD5' } }],
    });
    expect(Object.keys(result.fileDetails)).toEqual([
      'reportId',
      'fileId',
      'fileViewedByEsp',
      'exifViewedByEsp',
      'publiclyAvailable',
      'fileAnnotations',
      'industryClassification',
      'originalFileHash',
      'ipCaptureEvent',
      'additionalInfo',
    ]);
  });

  it('emits originalFileHash when supplied, omits when empty or unset', () => {
    const withHash = buildFileDetailsObject({
      ...baseInput,
      originalFileHash: [
        { _text: 'abc123', _attributes: { hashType: 'MD5' } },
        { _text: 'def456', _attributes: { hashType: 'SHA1' } },
      ],
    });
    expect(withHash.fileDetails.originalFileHash).toEqual([
      { _text: 'abc123', _attributes: { hashType: 'MD5' } },
      { _text: 'def456', _attributes: { hashType: 'SHA1' } },
    ]);
    const empty = buildFileDetailsObject({
      ...baseInput,
      originalFileHash: [],
    });
    expect(empty.fileDetails).not.toHaveProperty('originalFileHash');
    expect(buildFileDetailsObject(baseInput).fileDetails).not.toHaveProperty(
      'originalFileHash',
    );
  });

  it('emits publiclyAvailable when set to true or false, omits when undefined', () => {
    const truthy = buildFileDetailsObject({
      ...baseInput,
      additionalInfo: { publiclyAvailable: true },
    });
    const falsy = buildFileDetailsObject({
      ...baseInput,
      additionalInfo: { publiclyAvailable: false },
    });
    expect(truthy.fileDetails.publiclyAvailable).toBe(true);
    expect(falsy.fileDetails.publiclyAvailable).toBe(false);
    expect(baseInput.additionalInfo).not.toHaveProperty('publiclyAvailable');
    expect(buildFileDetailsObject(baseInput).fileDetails).not.toHaveProperty(
      'publiclyAvailable',
    );
  });

  it('omits ipCaptureEvent when array is empty', () => {
    const result = buildFileDetailsObject({
      ...baseInput,
      additionalInfo: { ipCaptureEvent: [] },
    });
    expect(result.fileDetails).not.toHaveProperty('ipCaptureEvent');
  });

  it('omits optional ipCaptureEvent fields (possibleProxy, port) when falsy', () => {
    // NCMEC accepts a bare ipAddress + eventName + dateTime; sending
    // `possibleProxy: false` or `port: 0` would be technically valid but
    // adds noise. Only emit when explicitly truthy.
    const result = buildFileDetailsObject({
      ...baseInput,
      additionalInfo: {
        ipCaptureEvent: [
          {
            ipAddress: '203.0.113.1',
            eventName: NCMECEvent.Upload,
            dateTime: INCIDENT_DATE_TIME,
            possibleProxy: false,
            port: 0,
          },
        ],
      },
    });
    expect(result.fileDetails.ipCaptureEvent).toEqual([
      {
        ipAddress: '203.0.113.1',
        eventName: 'Upload',
        dateTime: INCIDENT_DATE_TIME,
      },
    ]);
  });
});
