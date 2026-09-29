import * as v from 'valibot';

import { type RawItemData } from './toNormalizedItemDataOrErrors.js';

const rawItemSchemaVariants = ['original', 'partial'] as const;

export const rawItemTypeSelectorSchema = v.object({
  id: v.string(),
  version: v.optional(v.string()),
  // Keep raw and normalized item schema-variant values decoupled.
  schemaVariant: v.optional(v.picklist(rawItemSchemaVariants)),
});

export type RawItemTypeSelector = v.InferOutput<
  typeof rawItemTypeSelectorSchema
>;

const rawItemDataSchema = v.custom<RawItemData>(
  (input) =>
    typeof input === 'object' && input !== null && !Array.isArray(input),
);

const rawItemSubmissionVariants = [
  v.object({
    id: v.string(),
    data: rawItemDataSchema,
    typeId: v.string(),
    typeVersion: v.optional(v.string()),
    typeSchemaVariant: v.optional(v.picklist(rawItemSchemaVariants)),
  }),
  v.object({
    id: v.string(),
    data: rawItemDataSchema,
    type: rawItemTypeSelectorSchema,
  }),
] as const;

export type RawItemSubmission = v.InferInput<
  v.UnionSchema<typeof rawItemSubmissionVariants, undefined>
>;

export const rawItemSubmissionSchema = v.pipe(
  v.custom<RawItemSubmission>(
    (input) =>
      rawItemSubmissionVariants.filter(
        (variant) => v.safeParse(variant, input).success,
      ).length === 1,
  ),
  v.union(rawItemSubmissionVariants),
);
