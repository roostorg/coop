import {
  describeContextOptions,
  readOrgContextSettings,
  type ContextKind,
  type ContextMode,
  type ContextSettingInput,
} from '../../services/integrationContextSettings/index.js';
import { getIntegrationRegistry } from '../../services/integrationRegistry/index.js';
import {
  type GQLIntegrationConfigResolvers,
  type GQLIntegrationContextKind,
  type GQLIntegrationContextMode,
  type GQLIntegrationContextSettingInput,
} from '../generated.js';

const typeDefs = /* GraphQL */ `
  enum IntegrationContextKind {
    THREAD
    PARENT
  }

  enum IntegrationContextMode {
    DEFAULT
    INCLUDE
    OFF
  }

  """
  Evaluation context a plugin integration can use, with the org's choice.
  Coop loads the included context (conversation thread, parent item) and
  passes it to the plugin's signals.
  """
  type IntegrationContextOption {
    kind: IntegrationContextKind!
    "The plugin's default: INCLUDE or OFF."
    defaultMode: IntegrationContextMode!
    "The org's choice; DEFAULT means use the plugin's default."
    mode: IntegrationContextMode!
    "Whether the context is loaded, after applying the default."
    included: Boolean!
    "The org's max messages; null means the plugin default."
    maxCount: Int
    defaultMaxCount: Int
    maxCountLimit: Int
  }

  extend type IntegrationConfig {
    contextOptions: [IntegrationContextOption!]!
  }

  input IntegrationContextSettingInput {
    kind: IntegrationContextKind!
    mode: IntegrationContextMode!
    maxCount: Int
  }

  extend input SetPluginIntegrationConfigInput {
    "Omit to keep the current settings."
    contextSettings: [IntegrationContextSettingInput!]
  }
`;

const kindToGql = {
  thread: 'THREAD',
  parent: 'PARENT',
} as const satisfies Record<ContextKind, GQLIntegrationContextKind>;

const kindFromGql = {
  THREAD: 'thread',
  PARENT: 'parent',
} as const satisfies Record<GQLIntegrationContextKind, ContextKind>;

const modeToGql = {
  default: 'DEFAULT',
  include: 'INCLUDE',
  off: 'OFF',
} as const satisfies Record<ContextMode, GQLIntegrationContextMode>;

const modeFromGql = {
  DEFAULT: 'default',
  INCLUDE: 'include',
  OFF: 'off',
} as const satisfies Record<GQLIntegrationContextMode, ContextMode>;

export function contextSettingsFromGql(
  input: readonly GQLIntegrationContextSettingInput[] | null | undefined,
): ContextSettingInput[] | undefined {
  return input?.map((setting) => ({
    kind: kindFromGql[setting.kind],
    mode: modeFromGql[setting.mode],
    maxCount: setting.maxCount ?? null,
  }));
}

const IntegrationConfig: GQLIntegrationConfigResolvers = {
  contextOptions(it) {
    const options = getIntegrationRegistry().getManifest(
      it.name,
    )?.contextOptions;
    const settings = readOrgContextSettings(it.apiCredential);
    return describeContextOptions(options, settings).map((option) => ({
      kind: kindToGql[option.kind],
      defaultMode: modeToGql[option.defaultMode],
      mode: modeToGql[option.mode],
      included: option.included,
      maxCount: option.maxCount ?? null,
      defaultMaxCount: option.defaultMaxCount ?? null,
      maxCountLimit: option.maxCountLimit ?? null,
    }));
  },
};

const resolvers = { IntegrationConfig };

export { typeDefs, resolvers };
