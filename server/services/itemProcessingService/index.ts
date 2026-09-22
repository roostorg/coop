export type { RawItemSubmission } from './types.js';
export { rawItemSubmissionSchema } from './types.js';
export type { ItemSubmission, SubmissionId } from './makeItemSubmission.js';
export {
  rawItemSubmissionToItemSubmission,
  submissionDataToItemSubmission,
  makeSubmissionId,
} from './makeItemSubmission.js';
export { fieldTypeHandlers } from './fieldTypeHandlers.js';
export {
  type RawItemData,
  type NormalizedItemData,
  toNormalizedItemDataOrErrors,
} from './toNormalizedItemDataOrErrors.js';
export {
  getValuesFromFields,
  getFieldValueOrValues,
  getFieldValueForRole,
} from './extractItemDataValues.js';
export type { ItemSubmissionWithTypeIdentifier } from './makeItemSubmissionWithTypeIdentifier.js';
export {
  itemSubmissionWithTypeIdentifierToItemSubmission,
  itemSubmissionToItemSubmissionWithTypeIdentifier,
} from './makeItemSubmissionWithTypeIdentifier.js';
