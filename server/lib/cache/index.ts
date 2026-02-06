import {
  age,
  birthDate,
  isFresh,
  isValidatable,
} from "./utils/normalizedProducerResultResourceHelpers.js";

export { default as Cache } from "./Cache.js";
export { default as wrapProducer } from "./utils/wrapProducer.js";
export { default as collapsedTaskCreator } from "./utils/collapsedTaskCreator.js";
export { default as RedisStore } from "./stores/RedisStore/RedisStore.js";
export { default as MemoryStore } from "./stores/MemoryStore/MemoryStore.js";
export * from "./types/index.js";

export const entryUtils = { birthDate, age, isValidatable, isFresh };

// These are functions that Store authors will likely want to use to implement
// support for variants in their stores.
export {
  resultVariantKey,
  variantMatchesRequest,
  requestVariantKeyForVaryKeys,
  VariantKey,
  VaryKeys,
} from "./utils/varyHelpers.js";
