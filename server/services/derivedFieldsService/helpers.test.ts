import {
  ContainerTypes,
  ScalarTypes,
  type ContainerType,
  type Field,
  type TaggedScalar,
} from '@roostorg/types';
import fc from 'fast-check';

import { DerivedFieldSpecArbitrary } from '../../test/arbitraries/ContentType.js';
import { makeTestWithFixture } from '../../test/utils.js';
import { instantiateOpaqueType } from '../../utils/typescript-types.js';
import {
  toNormalizedItemDataOrErrors,
  type ItemSubmission,
  type RawItemData,
  type SubmissionId,
} from '../itemProcessingService/index.js';
import { type ItemSchema } from '../moderationConfigService/index.js';
import { type TransientRunSignalWithCache } from '../orgAwareSignalExecutionService/signalExecutionService.js';
import { SignalType } from '../signalsService/index.js';
import {
  getDerivedFieldValue,
  parseDerivedFieldSpec,
  serializeDerivedFieldSpec,
} from './helpers.js';

describe('Item type schemas', () => {
  describe('Derived Field handling', () => {
    describe('getDerivedContentFieldValue', () => {
      const testWithMockRunSignal = makeTestWithFixture(() => ({
        mockRunSignal: jest.fn<TransientRunSignalWithCache>(
          async ({ signal, value }) => {
            if (signal.type !== SignalType.OPEN_AI_WHISPER_TRANSCRIPTION) {
              throw new Error('expected type to match our derivation recipe.');
            }

            return {
              outputType: { scalarType: ScalarTypes.STRING },
              score:
                'Transcription of url ' +
                (value as TaggedScalar<ScalarTypes['VIDEO']>).value.url,
            };
          },
        ),
      }));

      const sclarVideoField = {
        name: 'hello' as const,
        type: ScalarTypes.VIDEO,
        required: false,
        container: null,
      };

      const objectVideoField: Field<ContainerType> = {
        name: 'hello' as const,
        type: ContainerTypes.MAP,
        required: false,
        container: {
          containerType: ContainerTypes.MAP,
          valueScalarType: ScalarTypes.VIDEO,
          keyScalarType: ScalarTypes.STRING,
        },
      };

      const derivedFieldSpec = {
        derivationType: 'VIDEO_TRANSCRIPTION',
        source: {
          type: 'CONTENT_FIELD',
          name: 'hello',
          contentTypeId: 'some-content-type',
        },
      } as const;

      testWithMockRunSignal(
        'should return the value according to the spec + content submission',
        async ({ mockRunSignal }) => {
          const schema = [sclarVideoField] as const;
          const res = await getDerivedFieldValue(
            mockRunSignal,
            'org-123',
            instantiateOpaqueType<ItemSubmission>({
              submissionId: instantiateOpaqueType<SubmissionId>(
                'content-submission-123',
              ),
              submissionTime: new Date(),
              itemId: 'content-123',
              creator: { id: 'user-456', typeId: 'type-123' },
              data: toNormalizedContent(schema, {
                hello: 'https://my-dummy-video.com/',
              }),
              itemType: {
                id: 'some-content-type',
                name: 'Some Content Type',
                schema,
                kind: 'CONTENT',
                description: null,
                version: 'some version',
                schemaVariant: 'original',
                orgId: 'org-123',
                schemaFieldRoles: {},
              },
            }),
            derivedFieldSpec,
          );

          expect(mockRunSignal.mock.calls.length).toBe(1);
          expect(mockRunSignal.mock.calls[0]).toMatchInlineSnapshot(`
            [
              {
                "orgId": "org-123",
                "signal": {
                  "type": "OPEN_AI_WHISPER_TRANSCRIPTION",
                },
                "subcategory": undefined,
                "userId": "user-456",
                "value": {
                  "type": "VIDEO",
                  "value": {
                    "url": "https://my-dummy-video.com/",
                  },
                },
              },
            ]
          `);
          expect(res).toEqual({
            type: ScalarTypes.STRING,
            value: 'Transcription of url https://my-dummy-video.com/',
          });
        },
      );

      testWithMockRunSignal(
        'should properly handle non-scalar inputs',
        async ({ mockRunSignal }) => {
          const schema = [objectVideoField] as const;
          const res = await getDerivedFieldValue(
            mockRunSignal,
            'org-123',
            instantiateOpaqueType<ItemSubmission>({
              submissionId: instantiateOpaqueType<SubmissionId>(
                'content-submission-123',
              ),
              itemId: 'content-123',
              creator: { id: 'user-456', typeId: 'type-123' },
              data: toNormalizedContent(schema, {
                hello: {
                  first_video: 'https://my-dummy-video.com/',
                  second_video: 'https://my-second-video.com/',
                },
              }),
              itemType: {
                id: 'some-content-type',
                name: 'Some Content Type',
                schema,
                kind: 'CONTENT',
                description: null,
                version: 'some version',
                schemaVariant: 'original',
                orgId: 'org-123',
                schemaFieldRoles: {},
              },
            }),
            derivedFieldSpec,
          );

          expect(mockRunSignal.mock.calls.length).toBe(2);
          expect(mockRunSignal.mock.calls).toMatchInlineSnapshot(`
            [
              [
                {
                  "orgId": "org-123",
                  "signal": {
                    "type": "OPEN_AI_WHISPER_TRANSCRIPTION",
                  },
                  "subcategory": undefined,
                  "userId": "user-456",
                  "value": {
                    "type": "VIDEO",
                    "value": {
                      "url": "https://my-dummy-video.com/",
                    },
                  },
                },
              ],
              [
                {
                  "orgId": "org-123",
                  "signal": {
                    "type": "OPEN_AI_WHISPER_TRANSCRIPTION",
                  },
                  "subcategory": undefined,
                  "userId": "user-456",
                  "value": {
                    "type": "VIDEO",
                    "value": {
                      "url": "https://my-second-video.com/",
                    },
                  },
                },
              ],
            ]
          `);
          expect(res).toEqual([
            {
              type: ScalarTypes.STRING,
              value: 'Transcription of url https://my-dummy-video.com/',
            },
            {
              type: ScalarTypes.STRING,
              value: 'Transcription of url https://my-second-video.com/',
            },
          ]);
        },
      );

      testWithMockRunSignal(
        "should return undefined if there's no proper field to source from",
        async ({ mockRunSignal }) => {
          const schema = [sclarVideoField] as const;
          const fieldVal = await getDerivedFieldValue(
            mockRunSignal,
            'org-123',
            instantiateOpaqueType<ItemSubmission>({
              submissionId: instantiateOpaqueType<SubmissionId>(
                'content-submission-123',
              ),
              itemId: 'content-123',
              creator: { id: 'user-456', typeId: 'type-123' },
              data: toNormalizedContent(schema, {}), // hello field missing
              itemType: {
                id: 'some-content-type',
                name: 'Some Content Type',
                schema,
                kind: 'CONTENT',
                description: null,
                version: 'some version',
                schemaVariant: 'original',
                orgId: 'org-123',
                schemaFieldRoles: {},
              },
            }),
            derivedFieldSpec,
          );

          expect(mockRunSignal.mock.calls.length).toBe(0);
          expect(fieldVal).toBe(undefined);
        },
      );
    });

    describe('parseDerivedFieldSpec/serializeDerivedFieldSpec', () => {
      test('should losslessly round-trip derived field specs', () => {
        fc.assert(
          fc.property(DerivedFieldSpecArbitrary, (spec) => {
            expect(
              parseDerivedFieldSpec(serializeDerivedFieldSpec(spec)),
            ).toEqual(spec);
          }),
        );
      });

      test('should reject invalid specs', () => {
        expect(() => {
          parseDerivedFieldSpec(
            serializeDerivedFieldSpec({
              source: { type: 'CONTENT_FIELD', name: 'hi', contentTypeId: '1' },
              derivationType: 'hasOwnProperty' as any, // invalid, hacking attempt.
            }),
          );
        }).toThrowErrorMatchingInlineSnapshot(`"Invalid derived field spec"`);

        expect(() => {
          parseDerivedFieldSpec(
            serializeDerivedFieldSpec({
              // extra `name` prop should make parsing fail.
              // we use the cast so ts doesn't complain about that prop.
              // prettier-ignore
              // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
              source: { type: 'FULL_ITEM', name: 'hi' } as { type: 'FULL_ITEM'; },
              derivationType: 'VIDEO_TRANSCRIPTION',
            }),
          );
        }).toThrowErrorMatchingInlineSnapshot(`"Invalid derived field spec"`);

        expect(() => {
          parseDerivedFieldSpec(
            serializeDerivedFieldSpec({
              source: { type: 'CONTENT_COOP_INPUT', name: 'hi' as any }, // unknown input name.
              derivationType: 'VIDEO_TRANSCRIPTION',
            }),
          );
        }).toThrowErrorMatchingInlineSnapshot(`"Invalid derived field spec"`);

        expect(() => {
          parseDerivedFieldSpec(
            serializeDerivedFieldSpec({
              source: { type: 'CONTENT_COOP_INPUT' } as any, // missing name.
              derivationType: 'VIDEO_TRANSCRIPTION',
            }),
          );
        }).toThrowErrorMatchingInlineSnapshot(`"Invalid derived field spec"`);

        expect(() => {
          parseDerivedFieldSpec(
            serializeDerivedFieldSpec({
              source: { type: '__proto__' } as any, // invalid type.
              derivationType: 'VIDEO_TRANSCRIPTION',
            }),
          );
        }).toThrowErrorMatchingInlineSnapshot(`"Invalid derived field spec"`);
      });
    });
  });
});

function toNormalizedContent(schema: ItemSchema, it: RawItemData) {
  const dataOrErrors = toNormalizedItemDataOrErrors(
    [],
    {
      id: 'test',
      kind: 'CONTENT',
      name: 'test',
      description: 'test',
      version: 'test',
      schemaVariant: 'original',
      orgId: 'test orgId',
      schemaFieldRoles: {},
      schema,
    },
    it,
  );

  if (Array.isArray(dataOrErrors)) {
    throw new Error('Unexpected errors');
  }

  return dataOrErrors;
}
