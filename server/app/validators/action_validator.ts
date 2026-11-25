import vine from '@vinejs/vine';
import type { FieldContext, Infer } from '@vinejs/vine/types';

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

// VineJS treats null as missing: `optional()` accepts and drops it, and a
// required field reports "required". JSON Schema reported null as the wrong
// type ("must be string"). Swapping null for a non-null value makes each
// field's type rule report it.
const rejectNull = (value: unknown) =>
  value === null ? Symbol('null') : value;

// Any JSON object, including null values inside it (`vine.record()` reports
// those as missing keys); the handler validates the values.
const jsonObject = vine.createRule(
  (value: unknown, _options: undefined, field: FieldContext) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      field.report('must be object', 'object', field);
    }
  },
);

const nonNullString = () => vine.string().parse(rejectNull);

const itemIdentifier = vine
  .object({ id: nonNullString(), typeId: nonNullString() })
  .parse(rejectNull);

export const submitActionValidator = vine.create({
  actionId: nonNullString(),
  itemId: nonNullString(),
  itemTypeId: nonNullString(),
  policyIds: vine.array(nonNullString()).parse(rejectNull).optional(),
  reportedItems: vine.array(itemIdentifier).parse(rejectNull).optional(),
  actorId: nonNullString().optional(),
  // Parameter values are checked against the stored action spec in the handler.
  parameters: vine.any().parse(rejectNull).use(jsonObject()).optional(),
  note: nonNullString()
    .use(maxCodePoints({ max: MAX_ACTOR_NOTE_LENGTH }))
    .optional(),
});

export type SubmitActionInput = Infer<typeof submitActionValidator>;
