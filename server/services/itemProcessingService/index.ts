export { rawItemSubmissionSchema, RawItemSubmission } from './types.js';
export {
  rawItemSubmissionToItemSubmission,
  ItemSubmission,
  SubmissionId,
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
export {
  ItemSubmissionWithTypeIdentifier,
  itemSubmissionWithTypeIdentifierToItemSubmission,
  itemSubmissionToItemSubmissionWithTypeIdentifier,
} from './makeItemSubmissionWithTypeIdentifier.js';
