import { makeEnumLike } from '@roostorg/types';

/**
 * List of all 3rd party integration names. There should only be one value per
 * 3rd party service, even if that service offers multiple model/signal types.
 */
export const Integration = makeEnumLike([
  'GOOGLE_CONTENT_SAFETY_API',
  'OPEN_AI',
  'ZENTROPI',
]);

export type Integration = keyof typeof Integration;
