import vine from '@vinejs/vine';
import type { FieldContext } from '@vinejs/vine/types';

import { MAX_ACTOR_NOTE_LENGTH } from '../../services/moderationConfigService/index.js';

// VineJS' `maxLength` counts UTF-16 code units; the note limit counts code
// points, as JSON Schema's `maxLength` does.
const maxCodePoints = vine.createRule(
  (value: unknown, options: { max: number }, field: FieldContext) => {
    if (typeof value === 'string' && Array.from(value).length > options.max) {
      field.report(
        'must NOT have more than {{ max }} characters',
        'maxCodePoints',
        field,
        options,
      );
    }
  },
);

// VineJS' `optional()` accepts null and drops it from the output; JSON Schema
// rejected it ("must be string"). Swapping null for a non-null value makes
// the field's type rule report it.
const rejectNull = (value: unknown) =>
  value === null ? Symbol('null') : value;

const itemIdentifier = vine.object({
  id: vine.string(),
  typeId: vine.string(),
});

export const submitActionValidator = vine.create({
  actionId: vine.string(),
  itemId: vine.string(),
  itemTypeId: vine.string(),
  policyIds: vine.array(vine.string()).parse(rejectNull).optional(),
  reportedItems: vine.array(itemIdentifier).parse(rejectNull).optional(),
  actorId: vine.string().parse(rejectNull).optional(),
  // Parameter values are checked against the stored action spec in the handler.
  parameters: vine.record(vine.any()).parse(rejectNull).optional(),
  note: vine
    .string()
    .parse(rejectNull)
    .use(maxCodePoints({ max: MAX_ACTOR_NOTE_LENGTH }))
    .optional(),
});
