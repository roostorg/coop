import { type JSONSchemaV4 } from '../../utils/json-schema-types.js';
import { type ItemTypeSchemaVariant } from '../moderationConfigService/index.js';
import { type RawItemData } from './toNormalizedItemDataOrErrors.js';

const rawItemSchemaVariants = ['original', 'partial'] as const;

export type RawItemTypeSelector = {
  id: string;
  version?: string;
  // We don't use ItemTypeSchemaVariant here because we want to keep the raw and
  // normalized item schema-variant values decoupled.
  schemaVariant?: (typeof rawItemSchemaVariants)[number];
};

export type RawItemSubmission =
  | {
      id: string;
      data: RawItemData;
      type: RawItemTypeSelector;
    }
  | {
      id: string;
      data: RawItemData;
      typeId: string;
      typeVersion?: string;
      typeSchemaVariant?: ItemTypeSchemaVariant;
    };

export const rawItemTypeSelectorSchema = {
  type: 'object',
  properties: {
    id: { type: ['string'] },
    version: { type: ['string'] },
    schemaVariant: {
      type: ['string'],
      enum: rawItemSchemaVariants,
    },
  },
  required: ['id'],
} as const satisfies JSONSchemaV4<RawItemTypeSelector>;

export const rawItemSubmissionSchema = {
  oneOf: [
    {
      type: 'object',
      properties: {
        id: { type: 'string' },
        // NB: the typings break here if we don't have { required: [] },
        // but actually putting an empty array for `required` in the runtime
        // value breaks request handling, so we just use a cast.
        data: { type: 'object' } as unknown as { type: 'object'; required: [] },
        typeId: { type: 'string' },
        typeVersion: { type: 'string' },
        typeSchemaVariant: { type: 'string', enum: rawItemSchemaVariants },
      },
      required: ['id', 'data', 'typeId'],
    },
    {
      type: 'object',
      properties: {
        id: { type: 'string' },
        // NB: the typings break here if we don't have { required: [] },
        // but actually putting an empty array for `required` in the runtime
        // value breaks request handling, so we just use a cast.
        data: { type: 'object' } as unknown as { type: 'object'; required: [] },
        type: rawItemTypeSelectorSchema,
      },
      required: ['id', 'data', 'type'],
    },
  ],
} as const satisfies JSONSchemaV4<RawItemSubmission>;
