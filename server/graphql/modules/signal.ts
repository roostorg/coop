import { type SignalSubcategory } from '@roostorg/types';
import { AuthenticationError } from 'apollo-server-express';
import { type ReadonlyDeep } from 'type-fest';

import {
  getSignalIdString,
  type ExternalSignalType,
  type SignalOutputType as TSignalOutputType,
} from '../../services/signalsService/index.js';
import { safePick } from '../../utils/misc.js';
import {
  type GQLLanguage,
  type GQLSignalArgsResolvers,
  type GQLSignalResolvers,
  type GQLSignalType,
  type GQLSupportedLanguagesResolvers,
} from '../generated.js';
import { type ResolverMap } from '../resolvers.js';

const typeDefs = /* GraphQL */ `
  enum SignalPricingStructureType {
    FREE
    SUBSCRIPTION
  }

  type SignalPricingStructure {
    type: SignalPricingStructureType!
  }

  type RecommendedThresholds {
    highPrecisionThreshold: StringOrFloat!
    highRecallThreshold: StringOrFloat!
  }

  # Re the _ field, see https://github.com/graphql/graphql-spec/issues/568 and
  # https://github.com/graphql/graphql-spec/pull/825#issuecomment-1182979316.
  type AllLanguages {
    _: Boolean
  }

  type Languages {
    languages: [Language!]!
  }

  # Ideally, the Supported Languages union would be defined as something like
  # union SupportedLanguages = [Language!]! | 'All'
  # but GraphQL doesn't support this. Both the [Language!]! and 'All' components of
  # the union need to be wrapped in a GraphQL type. For the 'All' component, GQL
  # doesn't support string literals, so we have to create the type above called
  # AllLanguages with a dummy field in it.
  union SupportedLanguages = Languages | AllLanguages

  type Signal {
    id: ID! # JsonOf<SignalId>
    type: SignalType!
    integration: Integration
    name: String!
    description: String!
    docsUrl: String
    pricingStructure: SignalPricingStructure!
    recommendedThresholds: RecommendedThresholds
    supportedLanguages: SupportedLanguages!
    subcategory: String
    disabledInfo: DisabledInfo!
    eligibleInputs: [SignalInputType!]!
    outputType: SignalOutputType!
    shouldPromptForMatchingValues: Boolean!
    callbackUrl: String
    callbackUrlHeaders: String
    callbackUrlBody: String
    eligibleSubcategories: [SignalSubcategory!]!
    args: SignalArgs
    allowedInAutomatedRules: Boolean!
  }

  enum SignalType {
    AGGREGATION
    CUSTOM
    TEXT_MATCHING_CONTAINS_TEXT
    TEXT_MATCHING_NOT_CONTAINS_TEXT
    TEXT_MATCHING_CONTAINS_REGEX
    TEXT_MATCHING_NOT_CONTAINS_REGEX
    TEXT_MATCHING_CONTAINS_VARIANT
    TEXT_SIMILARITY_SCORE
    IMAGE_EXACT_MATCH
    IMAGE_SIMILARITY_SCORE
    IMAGE_SIMILARITY_DOES_NOT_MATCH
    IMAGE_SIMILARITY_MATCH
    BENIGN_MODEL
    GOOGLE_CONTENT_SAFETY_API_IMAGE
    OPEN_AI_GRAPHIC_VIOLENCE_TEXT_MODEL
    OPEN_AI_HATE_TEXT_MODEL
    OPEN_AI_HATE_THREATENING_TEXT_MODEL
    OPEN_AI_SELF_HARM_TEXT_MODEL
    OPEN_AI_SEXUAL_MINORS_TEXT_MODEL
    OPEN_AI_SEXUAL_TEXT_MODEL
    OPEN_AI_VIOLENCE_TEXT_MODEL
    OPEN_AI_WHISPER_TRANSCRIPTION
    ZENTROPI_LABELER
    GEO_CONTAINED_WITHIN
    USER_SCORE
    USER_STRIKE_VALUE
  }

  enum ValueComparator {
    EQUALS
    NOT_EQUAL_TO
    LESS_THAN
    LESS_THAN_OR_EQUALS
    GREATER_THAN
    GREATER_THAN_OR_EQUALS
    IS_UNAVAILABLE
    IS_NOT_PROVIDED
  }

  union SignalOutputType = ScalarSignalOutputType | EnumSignalOutputType

  type ScalarSignalOutputType {
    scalarType: ScalarType!
  }

  type EnumSignalOutputType {
    scalarType: ScalarType!
    enum: [String!]!
    ordered: Boolean!
  }

  type SignalSubcategory {
    id: String!
    label: String!
    description: String
    childrenIds: [String!]!
  }

  type DisabledInfo {
    disabled: Boolean!
    disabledMessage: String
  }

  union SignalArgs = AggregationSignalArgs

  type AggregationSignalArgs {
    aggregationClause: AggregationClause
  }

  type AggregationClause {
    id: ID!
    conditionSet: ConditionSet
    aggregation: Aggregation
    groupBy: [ConditionInputField!]!
    window: WindowConfiguration!
  }

  type WindowConfiguration {
    sizeMs: Int!
    hopMs: Int!
  }

  type Aggregation {
    type: AggregationType!
  }

  enum AggregationType {
    COUNT
  }
`;

const SignalOutputType: ResolverMap<TSignalOutputType> = {
  __resolveType(outputType) {
    return 'enum' in outputType
      ? 'EnumSignalOutputType'
      : 'ScalarSignalOutputType';
  },
};

const SupportedLanguages: GQLSupportedLanguagesResolvers = {
  __resolveType(supportedLanguages) {
    return 'languages' in supportedLanguages ? 'Languages' : 'AllLanguages';
  },
};

const SignalArgs: GQLSignalArgsResolvers = {
  __resolveType(_signalArgs) {
    return 'AggregationSignalArgs';
  },
};

const Signal: GQLSignalResolvers = {
  id(signal) {
    return getSignalIdString(signal.id);
  },
  // NB: This resolver is unnecessary from a runtime POV (its functionality is
  // the same as the default resolver), but we keep it for type checking (i.e.,
  // it verifies that our ExternalSignalType is assignable to the GQLSignalType
  // that we're supposed to be returning).
  type(signal): GQLSignalType {
    return signal.type as ExternalSignalType;
  },
  name(signal) {
    return signal.displayName;
  },
  pricingStructure(signal) {
    return { type: signal.pricingStructure };
  },
  async disabledInfo(signal, _, context) {
    const user = context.getUser();

    if (!user) {
      throw new AuthenticationError(
        'User required to load signal disabledInfo.',
      );
    }

    // Non-null assertion below is safe because, if this resolver ran, it means
    // there was some parent object (a signal) that could be found (for the
    // org), so we can assume that the disabled info will be found too.
    return (await context.services.SignalsService.getSignalDisabledForOrg({
      signalId: signal.id,
      orgId: user.orgId,
    }))!;
  },
  supportedLanguages(signal) {
    const supportedLanguages = signal.supportedLanguages;
    if (supportedLanguages === 'ALL') {
      return { _: true };
    } else {
      return { languages: supportedLanguages satisfies readonly GQLLanguage[] };
    }
  },
  async eligibleSubcategories(signal, _, context) {
    // For Zentropi signals, return org-specific labeler versions as subcategories
    if (signal.id.type === 'ZENTROPI_LABELER') {
      const user = context.getUser();
      if (user) {
        const config = await context.dataSources.integrationAPI.getConfig(
          user.orgId,
          'ZENTROPI',
        );
        if (config?.name === 'ZENTROPI') {
          const versions = config.apiCredential.labelerVersions ?? [];
          return versions.map((v) => ({
            id: v.id,
            label: v.label,
            childrenIds: [],
          }));
        }
      }
    }
    return flattenSubcategories(signal.eligibleSubcategories);
  },
  shouldPromptForMatchingValues(signal) {
    return signal.needsMatchingValues;
  },
  allowedInAutomatedRules(signal) {
    return signal.allowedInAutomatedRules;
  },
};

const resolvers = {
  SignalOutputType,
  SupportedLanguages,
  SignalArgs,
  Signal,
};

export { typeDefs, resolvers };

// Just exported for tests to reference.
export function flattenSubcategories(
  subcategories: ReadonlyDeep<SignalSubcategory[]>,
) {
  return subcategories.reduce(
    (accumulator, currentValue) =>
      accumulator.concat([
        {
          ...safePick(currentValue, ['id', 'label', 'description']),
          childrenIds: currentValue.children.map((child) => child.id),
        },
        ...currentValue.children.map((child) => ({
          ...safePick(child, ['id', 'label', 'description']),
          childrenIds: [],
        })),
      ]),
    [] as {
      id: string;
      label: string;
      description?: string;
      childrenIds: string[];
    }[],
  );
}
