// Re-export public types/enums/type guards/arbitraries.
export { Integration } from './types/Integration.js';
export {
  type SignalId,
  SignalIdArbitrary,
  type ExternalSignalId,
  ExternalSignalIdArbitrary,
  type InternalSignalId,
  InternalSignalIdArbitrary,
  isSignalId,
  getSignalIdString,
  signalIsInternal,
  signalIsExternal,
} from './types/SignalId.js';
export {
  BuiltInThirdPartySignalType,
  UserCreatedExternalSignalType,
  integrationForSignalType,
  InternalSignalType,
  ExternalSignalType,
  SignalType,
} from './types/SignalType.js';
export { type SignalOutputType } from './types/SignalOutputType.js';
export {
  isSignalErrorResult,
  type SignalResult,
  type SignalInput,
  type SignalInputType,
  type SignalDisabledInfo,
} from './signals/SignalBase.js';

export {
  SignalsService,
  type Signal,
  type SignalReference,
  type SignalTypesToRunInputTypes,
  type SignalTypesToRunOutputTypes,
} from './SignalsService.js';

export {
  type SignalArgsByType,
  type SignalArgs,
} from './types/SignalArgsByType.js';

// This is the signal service factory function for bottle.
export { default as makeSignalsService } from './SignalsService.js';
