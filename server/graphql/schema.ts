/* eslint-disable max-lines */
import { mergeTypeDefs } from '@graphql-tools/merge';

import { typeDefs as actionTypeDefs } from './modules/action.js';
import { typeDefs as actionStatisticsTypeDefs } from './modules/actionStatistics.js';
import { typeDefs as apiKeyTypeDefs } from './modules/apiKey.js';
import { typeDefs as authenticationTypeDefs } from './modules/authentication.js';
import { typeDefs as backtestTypeDefs } from './modules/backtest.js';
import { typeDefs as contentTypeTypeDefs } from './modules/contentType.js';
import { typeDefs as genericTypeDefs } from './modules/generic.js';
import { typeDefs as hashBanksTypeDefs } from './modules/hashBanks/schema.js';
import { typeDefs as insightsTypeDefs } from './modules/insights.js';
import { typeDefs as integrationTypeDefs } from './modules/integration.js';
import { typeDefs as investigationTypeDefs } from './modules/investigation.js';
import { typeDefs as itemTypeTypeDefs } from './modules/itemType.js';
import { typeDefs as locationBankTypeDefs } from './modules/locationBank.js';
import { typeDefs as manualReviewToolTypeDefs } from './modules/manualReviewTool.js';
import { typeDefs as ncmecTypeDefs } from './modules/ncmec.js';
import { typeDefs as orgTypeDefs } from './modules/org.js';
import { typeDefs as policyTypeDefs } from './modules/policy.js';
import { typeDefs as reportingTypeDefs } from './modules/reporting.js';
import { typeDefs as reportingRulesTypeDefs } from './modules/reportingRule.js';
import { typeDefs as retroactionTypeDefs } from './modules/retroaction.js';
import { typeDefs as routingRulesTypeDefs } from './modules/routingRule.js';
import { typeDefs as ruleTypeDefs } from './modules/rule.js';
import { typeDefs as signalTypeDefs } from './modules/signal.js';
import { typeDefs as spotTestTypeDefs } from './modules/spotTest.js';
import { typeDefs as textBankTypeDefs } from './modules/textBank.js';
import { typeDefs as userTypeDefs } from './modules/user.js';

/**
 * GraphQL Schema
 */
const typeDefs = /* GraphQL */ `
  enum RuleEnvironment {
    BACKGROUND
    BACKTEST
    LIVE
    MANUAL
    RETROACTION
  }

  enum ForgotPasswordError {
    USER_NOT_FOUND
    OTHER
  }

  enum MutateActionError {
    ACTION_NAME_EXISTS
  }

  # !! IMPORTANT: when you add a value here, also add it to FieldType and SignalInputType !!
  enum ScalarType {
    USER_ID
    ID
    STRING
    BOOLEAN
    NUMBER
    AUDIO
    IMAGE
    VIDEO
    DATETIME
    GEOHASH
    RELATED_ITEM
    URL
    POLICY_ID
  }

  # This is equivalent to ScalarType, but with 'FULL_ITEM' added
  enum SignalInputType {
    USER_ID
    ID
    STRING
    BOOLEAN
    NUMBER
    AUDIO
    IMAGE
    VIDEO
    DATETIME
    GEOHASH
    RELATED_ITEM
    URL
    FULL_ITEM
    POLICY_ID
  }

  # !! IMPORTANT: when you add a value here, also add it to FieldType !!
  enum ContainerType {
    ARRAY
    MAP
  }

  enum FieldType {
    USER_ID
    ID
    STRING
    BOOLEAN
    NUMBER
    AUDIO
    IMAGE
    VIDEO
    DATETIME
    GEOHASH
    ARRAY
    MAP
    RELATED_ITEM
    URL
    POLICY_ID
  }

  enum Language {
    ABKHAZIAN
    AFAR
    AFRIKAANS
    AKAN
    ALBANIAN
    AMHARIC
    ARABIC
    ARAGONESE
    ARMENIAN
    ASSAMESE
    AVARIC
    AVESTAN
    AYMARA
    AZERBAIJANI
    AZERI
    BAMBARA
    BASHKIR
    BASQUE
    BELARUSIAN
    BENGALI
    BIHARI
    BISLAMA
    BOKMAL
    BOSNIAN
    BRETON
    BULGARIAN
    BURMESE
    CATALAN
    CEBUANO
    CENTRAL_KHMER
    CHAMORRO
    CHECHEN
    CHINESE
    CHURCH_SLAVIC
    CHUVASH
    CORNISH
    CORSICAN
    CREE
    CROATIAN
    CZECH
    DANISH
    DHIVEHI
    DUTCH
    DZONGKHA
    ENGLISH
    ESPERANTO
    ESTONIAN
    EWE
    FAROESE
    FARSI
    FIJIAN
    FINNISH
    FLEMISH
    FRENCH
    FULAH
    GAELIC
    GALICIAN
    GANDA
    GEORGIAN
    GERMAN
    GREEK
    GUARANI
    GUJARATI
    HAITIAN
    HAUSA
    HAWAIIAN
    HEBREW
    HERERO
    HINDI
    HIRI_MOTU
    HUNGARIAN
    ICELANDIC
    IDO
    IGBO
    INDONESIAN
    INTERLINGUA
    INUKTITUT
    INUPIAQ
    IRISH
    ITALIAN
    JAPANESE
    JAVANESE
    KALAALLISUT
    KANNADA
    KANURI
    KASHMIRI
    KAZAKH
    KIKUYU
    KINYARWANDA
    KOMI
    KONGO
    KOREAN
    KUANYAMA
    KURDISH
    KYRGYZ
    LAO
    LATIN
    LATVIAN
    LIMBURGAN
    LINGALA
    LITHUANIAN
    LUBA_KATANGA
    LUXEMBOURGISH
    MACEDONIAN
    MALAGASY
    MALAY
    MALAYALAM
    MALTESE
    MANX
    MAORI
    MARATHI
    MARSHALLESE
    MOLDOVIAN
    MONGOLIAN
    NAURU
    NAVAJO
    NDONGA
    NEPALI
    NORTH_NDEBELE
    NORTHERN_SAMI
    NORWEGIAN
    NYANJA
    OCCITAN
    OJIBWA
    ORIYA
    OROMO
    OSSETIAN
    PALI
    PASHTO
    PERSIAN
    PIDGIN
    POLISH
    PORTUGUESE
    PUNJABI
    QUECHUA
    ROMANIAN
    ROMANSH
    RUNDI
    RUSSIAN
    SAMOAN
    SANGO
    SANSKRIT
    SARDINIAN
    SERBIAN
    SHONA
    SICHUAN_YI
    SINDHI
    SINHALESE
    SLOVAK
    SLOVENE
    SOMALI
    SOUTH_NDEBELE
    SOUTHERN_SOTHO
    SPANISH
    SUNDANESE
    SWAHILI
    SWATI
    SWEDISH
    TAGALOG
    TAHITIAN
    TAJIK
    TAMIL
    TATAR
    TELUGU
    THAI
    TIBETAN
    TIGRINYA
    TONGA
    TSONGA
    TSWANA
    TURKISH
    TURKMEN
    TWI
    UKRAINIAN
    URDU
    UYGHUR
    UZBEK
    VENDA
    VIETNAMESE
    VOLAPUK
    WALLOON
    WELSH
    WESTERN_FRISIAN
    WOLOF
    XHOSA
    YIDDISH
    YORUBA
    ZHUANG
    ZULU
  }

  type InviteUserToken {
    token: String!
    email: String!
    role: UserRole!
    orgId: String!
    samlEnabled: Boolean!
  }

  type InviteUserTokenSuccessResponse {
    tokenData: InviteUserToken!
  }

  type InviteUserTokenExpiredError implements Error {
    title: String!
    status: Int!
    type: [String!]!
    pointer: String
    detail: String
    requestId: String
  }

  type InviteUserTokenMissingError implements Error {
    title: String!
    status: Int!
    type: [String!]!
    pointer: String
    detail: String
    requestId: String
  }

  union InviteUserTokenResponse =
      InviteUserTokenSuccessResponse
    | InviteUserTokenExpiredError
    | InviteUserTokenMissingError

  type MatchingBanks {
    textBanks: [TextBank!]!
    locationBanks: [LocationBank!]!
    hashBanks: [HashBank!]!
  }

  enum LoginMethod {
    PASSWORD
    SAML
  }

  input SignUpInput {
    email: String!
    password: String
    loginMethod: LoginMethod!
    firstName: String!
    lastName: String!
    orgId: String!
    role: UserRole
    inviteUserToken: String
  }

  type SignUpSuccessResponse {
    data: User
  }

  type SignUpUserExistsError implements Error {
    title: String!
    status: Int!
    type: [String!]!
    pointer: String
    detail: String
    requestId: String
  }

  union SignUpResponse = SignUpSuccessResponse | SignUpUserExistsError

  type CountByDay {
    date: Date!
    count: Int!
  }

  type CountByPolicyByDay {
    date: Date!
    count: Int!
    policy: CountByPolicyByDayPolicy!
  }

  type CountByPolicyByDayPolicy {
    id: ID!
    name: String!
  }

  type CountByTagByDay {
    date: Date!
    count: Int!
    tag: String!
  }

  type CountByActionByDay {
    date: Date!
    count: Int!
    action: CountByActionByDayAction!
  }

  type CountByActionByDayAction {
    name: String!
    id: ID!
  }

  type CountByDecisionTypeByDay {
    date: Date!
    count: Int!
    decisionType: String!
  }

  type AllRuleInsights {
    totalSubmissionsByDay: [CountByDay!]!
    actionedSubmissionsByDay: [CountByDay!]!
    actionedSubmissionsByPolicyByDay: [CountByPolicyByDay!]!
    actionedSubmissionsByTagByDay: [CountByTagByDay!]!
    actionedSubmissionsByActionByDay: [CountByActionByDay!]!
  }

  input CreateOrgInput {
    name: String!
    email: String!
    website: String!
  }

  input SendPasswordResetInput {
    email: String!
  }

  input ResetPasswordInput {
    token: String!
    newPassword: String!
  }

  input UpdateRoleInput {
    id: ID!
    role: UserRole!
  }

  input InviteUserInput {
    email: String!
    role: UserRole!
  }

  type PendingInvite {
    id: ID!
    email: String!
    role: UserRole!
    createdAt: DateTime!
  }

  enum RequestDemoInterest {
    CUSTOM_AI_MODELS
    MODERATOR_CONSOLE
    AUTOMATED_ENFORCEMENT
    COMPLIANCE_TOOLKIT
  }

  input RequestDemoInput {
    email: String!
    company: String!
    website: String!
    interests: [RequestDemoInterest!]!
    ref: String!
    isFromGoogleAds: Boolean!
  }

  directive @publicResolver on FIELD_DEFINITION

  type Query {
    myOrg: Org
    userFromToken(token: String!): ID
    inviteUserToken(token: String!): InviteUserTokenResponse! @publicResolver
    allRuleInsights: AllRuleInsights!
  }

  type Mutation {
    # TODO: secure these; figure out where they should go
    # (auth module? user module? org module?)
    signUp(input: SignUpInput!): SignUpResponse! @publicResolver
    sendPasswordReset(input: SendPasswordResetInput!): Boolean! @publicResolver
    resetPassword(input: ResetPasswordInput!): Boolean! @publicResolver
    generatePasswordResetToken(userId: ID!): String
    updateRole(input: UpdateRoleInput!): Boolean
    inviteUser(input: InviteUserInput!): String
    deleteInvite(id: ID!): Boolean
    approveUser(id: ID!): Boolean
    rejectUser(id: ID!): Boolean

    requestDemo(input: RequestDemoInput!): Boolean @publicResolver
  }
`;

export default mergeTypeDefs([
  typeDefs,
  genericTypeDefs,
  // Modules
  actionStatisticsTypeDefs,
  actionTypeDefs,
  apiKeyTypeDefs,
  authenticationTypeDefs,
  backtestTypeDefs,
  contentTypeTypeDefs,
  hashBanksTypeDefs,
  insightsTypeDefs,
  integrationTypeDefs,
  investigationTypeDefs,
  itemTypeTypeDefs,
  locationBankTypeDefs,
  manualReviewToolTypeDefs,
  ncmecTypeDefs,
  orgTypeDefs,
  policyTypeDefs,
  reportingRulesTypeDefs,
  reportingTypeDefs,
  retroactionTypeDefs,
  routingRulesTypeDefs,
  ruleTypeDefs,
  signalTypeDefs,
  spotTestTypeDefs,
  textBankTypeDefs,
  userTypeDefs,
]);
