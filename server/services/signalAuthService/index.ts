// TODO: for many of these, instead of exporting them, we should be merging
// their consumers into this service and keeping them internal.
export {
  configurableIntegrations,
  default as makeSignalAuthService,
  type SignalAuthService,
  type ConfigurableIntegration,
  type CredentialTypes,
} from './signalAuthService.js';
