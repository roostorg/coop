/* eslint-disable max-lines */
import { createRequire } from 'module';
import Bottle from '@ethanresnick/bottlejs';
import { SchemaType } from '@kafkajs/confluent-schema-registry';
import opentelemetry from '@opentelemetry/api';
import { makeDateString, type ItemIdentifier } from '@roostorg/types';
import avro from 'avsc';
import { types as scyllaTypes } from 'cassandra-driver';
import IORedis, { type Cluster } from 'ioredis';
import { logLevel } from 'kafkajs';
import * as knexPkg from 'knex';
import { type Knex } from 'knex';
import {
  Kysely,
  PostgresDialect,
  type PostgresCursorConstructor,
} from 'kysely';
import _ from 'lodash';
import { DynamicPool } from 'node-worker-threads-pool';
import pg from 'pg';
import Cursor from 'pg-cursor';
import { type JsonObject, type ReadonlyDeep } from 'type-fest';
import { v1 as uuidv1 } from 'uuid';

import Kafka, { SchemaRegistry, type SchemaIdFor } from '../kafka/index.js';
import {
  makeItemQueueBulkWrite,
  type ItemQueueBulkWrite,
} from '../kafka/itemQueueBulkWrite.js';
import logCreator from '../kafka/logger.js';
import makeDb from '../models/index.js';
import { type PolicyActionPenalties } from '../models/OrgModel.js';
import { type HashBank, HashBankService } from '../services/hmaService/index.js';
import makeActionPublisher, {
  type ActionPublisher,
  type ActionTargetItem,
} from '../rule_engine/ActionPublisher.js';
import makeRuleEngine, { type RuleEngine } from '../rule_engine/RuleEngine.js';
import {
  makeGetActionsForRuleEventuallyConsistent,
  makeGetEnabledRulesForItemTypeEventuallyConsistent,
  makeGetItemTypesForOrgEventuallyConsistent,
  makeGetLocationBankLocationsEventuallyConsistent,
  makeGetPoliciesForRulesEventuallyConsistent,
  makeGetSequelizeItemTypeEventuallyConsistent,
  makeGetTextBankStringsEventuallyConsistent,
  makeRecordRuleActionLimitUsage,
  type GetActionsForRuleEventuallyConsistent,
  type GetEnabledRulesForItemTypeEventuallyConsistent,
  type GetItemTypesForOrgEventuallyConsistent,
  type GetLocationBankLocationsBankEventuallyConsistent,
  type GetPoliciesForRulesEventuallyConsistent,
  type GetSequelizeItemTypeEventuallyConsistent,
  type GetTextBankStringsEventuallyConsistent,
  type RecordRuleActionLimitUsage,
} from '../rule_engine/ruleEngineQueries.js';
import makeRuleEvaluator, {
  type RuleEvaluator,
} from '../rule_engine/RuleEvaluator.js';
import { Scylla } from '../scylla/index.js';
import {
  makeActionStatisticsService,
  type ActionStatisticsService,
} from '../services/actionStatisticsService/index.js';
import {
  makeAggregationsService,
  makeKeyValueStore,
  type AggregationsService,
  type StringNumberKeyValueStore,
} from '../services/aggregationsService/index.js';
import {
  makeApiKeyService,
  type ApiKeyService,
} from '../services/apiKeyService/index.js';
import makeHmaService from '../services/hmaService/index.js';
import { type CombinedPg } from '../services/combinedDbTypes.js';
import {
  makeDerivedFieldsService,
  type DerivedFieldsService,
} from '../services/derivedFieldsService/index.js';
import { ItemInvestigationService } from '../services/itemInvestigationService/index.js';
import {
  getFieldValueForRole,
  itemSubmissionWithTypeIdentifierToItemSubmission,
  type ItemSubmissionWithTypeIdentifier,
  type NormalizedItemData,
} from '../services/itemProcessingService/index.js';
import {
  ManualReviewToolService,
  type ManualReviewAppealJobInput,
  type ManualReviewJobInput,
} from '../services/manualReviewToolService/index.js';
import {
  makeGetActionsByIdEventuallyConsistent,
  makeGetPoliciesByIdEventuallyConsistent,
  type GetActionsByIdEventuallyConsistent,
  type GetPoliciesByIdEventuallyConsistent,
  // TODO: disable this for now until we rationalize how our caching works and
  // define these functions elsewhere (since they're not really appropriately
  // owned by the MRT service)
  // eslint-disable-next-line import/no-restricted-paths
} from '../services/manualReviewToolService/manualReviewToolQueries.js';
import {
  ModerationConfigService,
  type Action,
} from '../services/moderationConfigService/index.js';
import {
  makeGetItemTypeEventuallyConsistent,
  type GetItemTypeEventuallyConsistent,
  // TODO: disable this (correct) warning for now until we rationalize how our
  // caching works (since these functions aren't really appropriate to export)
  // eslint-disable-next-line import/no-restricted-paths
} from '../services/moderationConfigService/moderationConfigServiceQueries.js';
import {
  makeNcmecService,
  ncmecProdQueues,
  type NcmecService,
} from '../services/ncmecService/index.js';
import {
  fetchHTTP,
  type FetchHTTP,
} from '../services/networkingService/index.js';
import {
  makeNotificationsService,
  type NotificationsService,
} from '../services/notificationsService/index.js';
import {
  makeGetTransientRunSignalWithCache,
  type TransientRunSignalWithCache,
} from '../services/orgAwareSignalExecutionService/index.js';
import {
  makeOrgSettingsService,
  type OrgSettingsService,
} from '../services/orgSettingsService/index.js';
import makePartialItemsService, {
  type PartialItemsService,
} from '../services/partialItemsService/index.js';
import {
  makePlacesApiService,
  type PlacesApiService,
} from '../services/placesApiService/index.js';
import {
  makeReportingService,
  type ReportingService,
} from '../services/reportingService/index.js';
import {
  makeGetCurrentPeriodRuleAlarmStatuses,
  makeGetRuleAnomalyDetectionStatistics,
  type GetCurrentPeriodRuleAlarmStatuses,
  type GetRuleAnomalyDetectionStatistics,
} from '../services/ruleAnomalyDetectionService/index.js';
import {
  makeGetSimplifiedRuleHistory,
  type GetSimplifiedRuleHistory,
} from '../services/ruleHistoryService/index.js';
import s3StoreObjectFactory, {
  type S3StoreObjectFactory,
} from '../services/s3StoreObject.js';
import makeSendEmail, {
  type SendEmail,
} from '../services/sendEmailService/index.js';
import {
  makeSignalAuthService,

  type SignalAuthService,
} from '../services/signalAuthService/index.js';
import {
  makeSignalsService,
  type SignalsService,
} from '../services/signalsService/index.js';
import {
  makeSigningKeyPairService,
  PostgresSigningKeyPairStorage,
  type SigningKeyPairService,
  type SigningKeyPairStorage,
} from '../services/signingKeyPairService/index.js';
import {
  makeSSOService,
  type SSOService,
} from '../services/SSOService/index.js';
import {
  makeUserManagementService,
  type UserManagementService,
} from '../services/userManagementService/index.js';
import {
  makeUserStatisticsService,
  type UserScore,
} from '../services/userStatisticsService/index.js';
import { UserStrikeService } from '../services/userStrikeService/index.js';
import {
  type DataWarehouseOutboxKafkaMessageKey,
  type DataWarehouseOutboxKafkaMessageValue,
} from '../snowflake/snowflake.js';
import {
  makeActionExecutionLogger,
  makeContentApiLogger,
  makeItemModelScoreLogger,
  makeOrgCreationLogger,
  makeReportingRuleExecutionLogger,
  makeRoutingRuleExecutionLogger,
  makeRuleExecutionLogger,
  type ActionExecutionLogger,
  type ContentApiLogger,
  type ItemModelScoreLogger,
  type OrgCreationLogger,
  type ReportingRuleExecutionLogger,
  type RoutingRuleExecutionLogger,
  type RuleExecutionLogger,
} from '../services/analyticsLoggers/index.js';
import {
  makeItemHistoryQueries,
  makeRuleActionInsights,
  makeUserHistoryQueries,
  type ItemHistoryQueries,
  type RuleActionInsights,
  type UserHistoryQueries,
} from '../services/analyticsQueries/index.js';
import {
  DataWarehouseFactory,
  type IDataWarehouse,
  type IDataWarehouseDialect,
} from '../storage/dataWarehouse/index.js';
import type { IDataWarehouseAnalytics } from '../storage/dataWarehouse/IDataWarehouseAnalytics.js';
import {
  ClickhouseActionStatisticsAdapter,
  SnowflakeActionStatisticsAdapter,
  ClickhouseReportingAnalyticsAdapter,
  SnowflakeReportingAnalyticsAdapter,
  ClickhouseActionExecutionsAdapter,
  SnowflakeActionExecutionsAdapter,
  ClickhouseContentApiRequestsAdapter,
  SnowflakeContentApiRequestsAdapter,
  ClickhouseOrgCreationAdapter,
  SnowflakeOrgCreationAdapter,
} from '../plugins/warehouse/queries/index.js';
import type { IActionStatisticsAdapter } from '../plugins/warehouse/queries/IActionStatisticsAdapter.js';
import type { IReportingAnalyticsAdapter } from '../plugins/warehouse/queries/IReportingAnalyticsAdapter.js';
import type { IActionExecutionsAdapter } from '../plugins/warehouse/queries/IActionExecutionsAdapter.js';
import type { IContentApiRequestsAdapter } from '../plugins/warehouse/queries/IContentApiRequestsAdapter.js';
import type { IOrgCreationAdapter } from '../plugins/warehouse/queries/IOrgCreationAdapter.js';
import { cached, type Cached } from '../utils/caching.js';
import {
  toCorrelationId,
  type CorrelationId,
} from '../utils/correlationIds.js';
import { CoopMeter } from '../utils/CoopMeter.js';
import { getUsableCoreCount } from '../utils/cpu-helpers.js';
import { jsonStringify, type JsonOf } from '../utils/encoding.js';
import { __throw, assertUnreachable } from '../utils/misc.js';
import SafeTracer from '../utils/SafeTracer.js';
import {
  isNonEmptyArray,
  type CollapseCases,
  type NonEmptyArray,
  type Satisfies,
} from '../utils/typescript-types.js';
import { registerGqlDataSources } from './services/gqlDataSources.js';
import { registerWorkersAndJobs } from './services/workersAndJobs.js';
import { register, safeGetEnvVar } from './utils.js';

// the otel instrumentation currently intercepts require statements. support for
// esm support is experimental so we should wait until it is stable
const require = createRequire(import.meta.url);
const { Client: ScyllaClient } = require('cassandra-driver');
export type { DataSources } from './services/gqlDataSources.js';

// All Kafka topics and their schemas should be referenced here. Currently, we
// have to create schemas and topics manually, and manually keep them in sync
// across environments, which is hard to do reliably. Eventually, we'll have
// an IaC solution that lets us keep these schemas in code somewhere and view
// them in the repo. Until then, talk to Ethan if you need a new topic or schema.
export type ItemSubmissionKafkaMessageKey = {
  syntheticThreadId: string;
};
export type ItemSubmissionKafkaMessageValue = {
  metadata: {
    syntheticThreadId: string;
    requestId: CorrelationId<'post-items'>;
    orgId: string;
  };
  itemSubmissionWithTypeIdentifier: {
    submissionId: string;
    submissionTime: Date;
    itemId: string;
    dataJSON: JsonOf<NormalizedItemData>;
    itemTypeIdentifier: {
      id: string;
      version: string;
      schemaVariant: 'original' | 'partial';
    };
  };
};

export type KafkaSchemaMap = {
  ITEM_SUBMISSION_EVENTS: {
    keySchema: SchemaIdFor<ItemSubmissionKafkaMessageKey>;
    valueSchema: SchemaIdFor<ItemSubmissionKafkaMessageValue>;
  };
  ITEM_SUBMISSION_EVENTS_RETRY_0: {
    keySchema: SchemaIdFor<ItemSubmissionKafkaMessageKey>;
    valueSchema: SchemaIdFor<ItemSubmissionKafkaMessageValue>;
  };
  DATA_WAREHOUSE_INGEST_EVENTS: {
    keySchema: SchemaIdFor<DataWarehouseOutboxKafkaMessageKey>;
    valueSchema: SchemaIdFor<DataWarehouseOutboxKafkaMessageValue>;
  };
};

// Defines a global map type of all injectable dependencies, where the key is,
// conceptually, the name of the "interface"/name of the contract, and the value
// is the type that any implementation must sastify.
//
// Since many of these services only have one implementation, we often use, for
// the interface/contract type, a type exported from the primary implementation
// of the service, which itself is automatically defined based on the shape of
// the implementation (often using `typeof` in TS to lift runtime values to the
// type level). This isn't really correct [we're not programming against a
// contract] but it saves us from having to define a million boilerplate
// intefrace definitions and actually create a common contract before we need
// one. When we do need a common contract, meanwhile, the PublicInterface type
// helps make one quickly.
//
// Over time, defining this type inline and setting up all the container
// bindings in this one file will get unweildy, but we'll break it up later.
export interface Dependencies {
  // Pg query services. See comments below.
  // We register the services as Kysely<any> so that each service that depends
  // on Kysely can type its arg more specifically, based on the db tables that
  // it's supposed to be able to "see". E.g., the UserStatisticsService can type
  // its argument as `Kysely<UserStatisticsServicePg>`, so that its code can only
  // query the tables in the user_statistics_service schema, and the `KyselyPg`
  // service will be assignable to that argument because of the `any`. Slightly
  // more correct than `any`, ig, would be using a type that includes every
  // table in every schema (but doesn't allow querying non-existent tables
  // but idk if TS would properly/perfomantly get the variance right.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  KyselyPg: Kysely<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  KyselyPgReadReplica: Kysely<any>;

  // Similar to our Kysely services, we register the services as Scylla<any> so
  // that each dependent service can type its arg more specifically with the set
  // of tables it is responsible for / allowed to query.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Scylla: Scylla<any> & { close: () => Promise<void> };

  Sequelize: ReturnType<typeof makeDb>;
  OrgModel: ReturnType<typeof makeDb>['Org'];
  RuleModel: ReturnType<typeof makeDb>['Rule'];
  ActionModel: ReturnType<typeof makeDb>['Action'];
  PolicyModel: ReturnType<typeof makeDb>['Policy'];
  ItemTypeModel: ReturnType<typeof makeDb>['ItemType'];
  LocationBankModel: ReturnType<typeof makeDb>['LocationBank'];
  LocationBankLocationModel: ReturnType<typeof makeDb>['LocationBankLocation'];

  // Data Warehouse abstraction
  DataWarehouse: IDataWarehouse;
  DataWarehouseDialect: IDataWarehouseDialect;
  DataWarehouseAnalytics: IDataWarehouseAnalytics;
  ActionStatisticsAdapter: IActionStatisticsAdapter;
  ReportingAnalyticsAdapter: IReportingAnalyticsAdapter;
  ActionExecutionsAdapter: IActionExecutionsAdapter;
  ContentApiRequestsAdapter: IContentApiRequestsAdapter;
  OrgCreationAdapter: IOrgCreationAdapter;

  // Deprecated Snowflake aliases - use DataWarehouse/DataWarehouseDialect instead
  // Kept for backward compatibility with services that haven't migrated yet
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Snowflake: IDataWarehouse;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  KyselySnowflake: Kysely<any>;
  
  itemSubmissionQueueBulkWrite: ItemQueueBulkWrite;
  itemSubmissionRetryQueueBulkWrite: ItemQueueBulkWrite;
  Knex: Knex;
  IORedis: IORedis.Redis | Cluster;
  // We register the services as Kafka<any> so that each service that depends
  // on Kafka can type its arg more specifically, based on the topic that
  // it's supposed to be able to "see". E.g., the Snowflake Ingestion Worker can type
  // its argument as `Kafka<Pick<KafkaSchemaMap, 'ITEM_SUBMISSION_EVENTS'>>`, so that its code can only
  // read messages from the topic with the intended schema, and the `Kafka`
  // service will be assignable to that argument because of the `any`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Kafka: Kafka<any>;

  // Loggers
  RuleExecutionLogger: RuleExecutionLogger;
  RoutingRuleExecutionLogger: RoutingRuleExecutionLogger;
  ActionExecutionLogger: ActionExecutionLogger;
  ContentApiLogger: ContentApiLogger;
  ItemModelScoreLogger: ItemModelScoreLogger;
  OrgCreationLogger: OrgCreationLogger;
  ReportingRuleExecutionLogger: ReportingRuleExecutionLogger;

  // Core business logic services
  ActionPublisher: ActionPublisher;
  RuleEngine: RuleEngine;
  RuleEvaluator: RuleEvaluator;
  RuleActionInsights: RuleActionInsights;
  ItemHistoryQueries: ItemHistoryQueries;
  ActionStatisticsService: ActionStatisticsService;
  NotificationsService: PublicInterface<NotificationsService>;
  PlacesApiService: PlacesApiService;
  ReportingService: ReportingService;
  ManualReviewToolService: ManualReviewToolService;
  SignalsService: SignalsService;
  ItemInvestigationService: ItemInvestigationService;
  DerivedFieldsService: DerivedFieldsService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  UserStatisticsService: any; // TODO: Fix circular reference with Dependencies
  OrgSettingsService: OrgSettingsService;
  UserManagementService: UserManagementService;
  ModerationConfigService: ModerationConfigService;
  NcmecService: NcmecService;
  PartialItemsService: PartialItemsService;
  UserStrikeService: UserStrikeService;
  AggregationsService: AggregationsService;
  SSOService: SSOService;

  // Networking helper functions
  fetchHTTP: FetchHTTP;

  // Rule helper functions
  getRuleAnomalyDetectionStatistics: GetRuleAnomalyDetectionStatistics;
  UserHistoryQueries: UserHistoryQueries;
  getSimplifiedRuleHistory: GetSimplifiedRuleHistory;
  getCurrentPeriodRuleAlarmStatuses: GetCurrentPeriodRuleAlarmStatuses;

  // Creating, running, and fetching data for rule/signal execution (w/ caches).
  TransientRunSignalWithCacheFactory: () => TransientRunSignalWithCache;
  SignalAuthService: SignalAuthService;
  getUserScoreEventuallyConsistent: (
    orgId: string,
    userItemIdentifier: ItemIdentifier,
  ) => Promise<UserScore>;
  getUserStrikeTTLInDaysEventuallyConsistent: Cached<
    (orgId: string) => Promise<number | undefined>
  >;
  getPolicyActionPenaltiesEventuallyConsistent: Cached<
    (orgId: string) => Promise<PolicyActionPenalties[]>
  >;
  getImageBankEventuallyConsistent: Cached<
    (input: { orgId: string; bankId: string }) => Promise<HashBank | null>
  >;

  getSequelizeItemTypeEventuallyConsistent: GetSequelizeItemTypeEventuallyConsistent;
  getItemTypesForOrgEventuallyConsistent: GetItemTypesForOrgEventuallyConsistent;
  getItemTypeEventuallyConsistent: GetItemTypeEventuallyConsistent;
  getEnabledRulesForItemTypeEventuallyConsistent: GetEnabledRulesForItemTypeEventuallyConsistent;
  getPoliciesForRulesEventuallyConsistent: GetPoliciesForRulesEventuallyConsistent;
  getActionsForRuleEventuallyConsistent: GetActionsForRuleEventuallyConsistent;
  recordRuleActionLimitUsage: RecordRuleActionLimitUsage;

  getLocationBankLocationsEventuallyConsistent: GetLocationBankLocationsBankEventuallyConsistent;
  getTextBankStringsEventuallyConsistent: GetTextBankStringsEventuallyConsistent;
  getActionsByIdEventuallyConsistent: GetActionsByIdEventuallyConsistent;
  getPoliciesByIdEventuallyConsistent: GetPoliciesByIdEventuallyConsistent;

  getIgnoreCallbackEventuallyConsistent: Cached<
    (orgId: string) => Promise<string | undefined>
  >;

  // Misc helper services
  ApiKeyService: PublicInterface<ApiKeyService>;
  SigningKeyPairService: PublicInterface<SigningKeyPairService>;
  SigningKeyPairStorageService: SigningKeyPairStorage;
  S3StoreObjectFactory: S3StoreObjectFactory;
  sendEmail: SendEmail;
  closeSharedResourcesForShutdown: () => Promise<void>;
  GlobalWorkerPool: DynamicPool;
  Tracer: SafeTracer;
  Meter: CoopMeter;
  KeyValueStore: StringNumberKeyValueStore;
  ConfigService: { uiUrl: string };
}

// Takes a class and returns a type that just contains its public methods and
// fields. Useful to use as the type for our DI container services, as mocks
// can satisfy this type (but can't satisfy the class-type because of the nominal
// treatment that TS gives to classes with private fields; see https://stackoverflow.com/questions/55281162/can-i-force-the-typescript-compiler-to-use-nominal-typing)
export type PublicInterface<T extends object> = { [K in keyof T]: T[K] };

/**
 * A function for creating our service container, configured for production.
 * Services can be rebound in other contexts (namely, tests) as needed.
 * This export is a function, not a container object, so that you can create
 * copies of the container as needed for selective rebinding.
 */
export default async function getBottle() {
  // NB: this is a function because safeGetEnvVar can throw, so we only want to
  // try to look up the env vars (and throw if they're missing) _if someone
  // actually tries to fetch a service from bottle that needs these env vars_.
  // Not every worker/job needs every service or is given every var in its env.
  //
  // NB: while we can reasonably provide default values for some of the env vars
  // below, we wouldn't want to provide default values for all of them, as then
  // that would defeat the ability of safeGetEnvVar to alert us in prod if a
  // worker that needs these vars is run without them.
  const getPgMasterConnectionInfo = () => ({
    user: process.env.DATABASE_USER ?? 'postgres',
    database: process.env.DATABASE_NAME ?? 'development',
    password: safeGetEnvVar('DATABASE_PASSWORD'),
    port: parseInt(process.env.DATABASE_PORT ?? '5432'),
    host: safeGetEnvVar('DATABASE_HOST'),
    max: 30,
    application_name:
      getEnvVarOrWarn('OTEL_SERVICE_NAME') ?? 'unknown-coop-service',
  });

  const bottle = new Bottle<Dependencies>();

  // Pg services.
  //
  // - 'KyselyPg' is for issuing raw pg queries w/o sequelize (e.g., the queries
  //   that some of the our "services" issue to pg, to the non-public schemas).
  //   These queries go to our primary db, which accepts writes. Using knex for
  //   query building is deprecated in favor of kysely, because the latter offers
  //   better typings.
  //
  // - KyselyPgReadReplica gives us the same type safety, but sends queries to our
  //   replicas, for when we only need reads and we're ok w/ eventual consistency.
  //
  // - 'Sequelize' + the sequelize models are used to query pg through sequelize.
  bottle.factory(
    'KyselyPg',
    () =>
      new Kysely<CombinedPg>({
        dialect: new PostgresDialect({
          pool: new pg.Pool(getPgMasterConnectionInfo()),
          cursor: Cursor as unknown as PostgresCursorConstructor,
        }),
      }),
  );

  bottle.factory(
    'KyselyPgReadReplica',
    () =>
      new Kysely<CombinedPg>({
        dialect: new PostgresDialect({
          pool: new pg.Pool({
            ...getPgMasterConnectionInfo(),
            max: 150,
            host: safeGetEnvVar('DATABASE_READ_ONLY_HOST'),
          }),
          cursor: Cursor as unknown as PostgresCursorConstructor,
        }),
      }),
  );

  bottle.factory('IORedis', () =>
    safeGetEnvVar('REDIS_USE_CLUSTER') === 'true'
      ? new IORedis.Cluster(
          [
            {
              host: safeGetEnvVar('REDIS_HOST'),
              port: parseInt(process.env.REDIS_PORT ?? '6379'),
            },
          ],
          {
            // See
            // https://github.com/luin/ioredis/blob/c275e9a337a4aee1565e96fe631d28a29ecb4efa/README.md#special-note-aws-elasticache-clusters-with-tls
            dnsLookup: (address, callback) => callback(null, address),
            redisOptions: {
              tls: {},
              username: safeGetEnvVar('REDIS_USER'),
              password: safeGetEnvVar('REDIS_PASSWORD'),
            },
          },
        )
      : new IORedis.default({
          maxRetriesPerRequest: null,
          port: parseInt(process.env.REDIS_PORT ?? '6379'),
          host: safeGetEnvVar('REDIS_HOST'),
        }),
  );

  bottle.factory('Kafka', () => {
    // TODO: think about shutdown logic. Right now, creating this instance
    // doesn't open up any resources that need to be shutdown, so we're ok.
    // However, when a producer/consumer are created from this instance and then
    // they call .connect(), that opens a connection that we must terminate by
    // manually calling .disconnect() on shutdown. Maybe there's a more
    // elegant/robust way?
    return new Kafka(
      {
        // NB: Confluent Cloud exposes only one endpoint URL that load balances
        // between multiple brokers, so we don't need to worry about splitting
        // this to an array.
        brokers: [safeGetEnvVar('KAFKA_BROKER_HOST')],
        ...(['CI', 'development'].includes(process.env.NODE_ENV ?? 'production') ? {} : {
          ssl: true,
          sasl: {
            mechanism: 'plain',
            username: safeGetEnvVar('KAFKA_BROKER_USERNAME'),
            password: safeGetEnvVar('KAFKA_BROKER_PASSWORD'),
          },
        }),
        // Found experimentally. Confluent docs seem to recommend setting at
        // least some timeouts to a value above 10s, but they don't mention a
        // specific value to use, and the setting described in those docs may
        // not map 1:1 to a kafkajs setting. Nevertheless, the kafkajs default
        // of 1s was giving timeout errors, so we had to bump this. See
        // https://docs.confluent.io/cloud/current/cp-component/clients-cloud-config.html#prerequisitesq
        connectionTimeout: 10_000,
        // Default here is 30s but we set it to avoid long-running requests
        // wait that long.
        requestTimeout: 10_000,
        // Set clientId to help with monitoring/observability.
        // See https://kafka.js.org/docs/configuration#client-id
        clientId: getEnvVarOrWarn('OTEL_SERVICE_NAME'),
        logLevel: logLevel.WARN,
        logCreator,
      },
      {
        DATA_WAREHOUSE_INGEST_EVENTS: {
          keySchema: parseInt(
            safeGetEnvVar('KAFKA_TOPIC_KEY_SCHEMA_ID_DATA_WAREHOUSE_INGEST_EVENTS'),
          ) as SchemaIdFor<DataWarehouseOutboxKafkaMessageKey>,
          valueSchema: parseInt(
            safeGetEnvVar(
              'KAFKA_TOPIC_VALUE_SCHEMA_ID_DATA_WAREHOUSE_INGEST_EVENTS',
            ),
          ) as SchemaIdFor<DataWarehouseOutboxKafkaMessageValue>,
        },
        ITEM_SUBMISSION_EVENTS: {
          keySchema: parseInt(
            safeGetEnvVar('KAFKA_TOPIC_KEY_SCHEMA_ID_ITEM_SUBMISSION_EVENTS'),
          ) as SchemaIdFor<ItemSubmissionKafkaMessageKey>,
          valueSchema: parseInt(
            safeGetEnvVar('KAFKA_TOPIC_VALUE_SCHEMA_ID_ITEM_SUBMISSION_EVENTS'),
          ) as SchemaIdFor<ItemSubmissionKafkaMessageValue>,
        },
        ITEM_SUBMISSION_EVENTS_RETRY_0: {
          keySchema: parseInt(
            safeGetEnvVar(
              'KAFKA_TOPIC_KEY_SCHEMA_ID_ITEM_SUBMISSION_EVENTS_RETRY_0',
            ),
          ) as SchemaIdFor<ItemSubmissionKafkaMessageKey>,
          valueSchema: parseInt(
            safeGetEnvVar(
              'KAFKA_TOPIC_VALUE_SCHEMA_ID_ITEM_SUBMISSION_EVENTS_RETRY_0',
            ),
          ) as SchemaIdFor<ItemSubmissionKafkaMessageValue>,
        },
      },
      new SchemaRegistry(
        {
          host: safeGetEnvVar('KAFKA_SCHEMA_REGISTRY_HOST'),
          auth: {
            username: safeGetEnvVar('KAFKA_SCHEMA_REGISTRY_USERNAME'),
            password: safeGetEnvVar('KAFKA_SCHEMA_REGISTRY_PASSWORD'),
          },
        },
        {
          [SchemaType.AVRO]: {
            logicalTypes: {
              // Implementation copied from avsc docs.
              // See https://gist.github.com/mtth/1aec40375fbcb077aee7#file-date-js
              'timestamp-millis': class extends avro.types.LogicalType {
                override _fromValue(val: string) {
                  return new Date(val);
                }
                override _toValue(date: Date) {
                  return date instanceof Date ? Number(date) : undefined;
                }
                override _resolve(type: unknown) {
                  return avro.Type.isType(
                    type,
                    'long',
                    'string',
                    'logical:timestamp-millis',
                  )
                    ? this._fromValue
                    : undefined;
                }
              },
            },
          },
        },
      ),
    );
  });

  bottle.factory('Sequelize', () => makeDb());
  bottle.factory('OrgModel', ({ Sequelize }) => Sequelize.Org);
  bottle.factory('RuleModel', ({ Sequelize }) => Sequelize.Rule);
  bottle.factory('ActionModel', ({ Sequelize }) => Sequelize.Action);
  bottle.factory('PolicyModel', ({ Sequelize }) => Sequelize.Policy);
  bottle.factory('ItemTypeModel', ({ Sequelize }) => Sequelize.ItemType);
  bottle.factory(
    'LocationBankModel',
    ({ Sequelize }) => Sequelize.LocationBank,
  );
  bottle.factory(
    'LocationBankLocationModel',
    ({ Sequelize }) => Sequelize.LocationBankLocation,
  );

  // Data Warehouse abstraction layer
  //
  // All warehouse operations use these interfaces.
  // Switch warehouse providers via WAREHOUSE_ADAPTER.
  //
  // - 'DataWarehouse' - Core queries and transactions
  // - 'DataWarehouseDialect' - Type-safe Kysely queries  
  // - 'DataWarehouseAnalytics' - Bulk writes, CDC, logging
  bottle.factory('DataWarehouse', () => {
    const config = DataWarehouseFactory.createConfigFromEnv();
    const dataWarehouse = DataWarehouseFactory.createDataWarehouse(config);
    dataWarehouse.start();
    return dataWarehouse;
  });

  bottle.factory('DataWarehouseDialect', () => {
    const config = DataWarehouseFactory.createConfigFromEnv();
    return DataWarehouseFactory.createKyselyDialect(config);
  });

  bottle.factory('DataWarehouseAnalytics', (container) => {
    const config = DataWarehouseFactory.createConfigFromEnv();
    const enhancedConfig = {
      ...config,
      kafka: config.provider === 'snowflake' ? container.Kafka : undefined,
    };
    return DataWarehouseFactory.createAnalyticsAdapter(
      enhancedConfig,
      container.DataWarehouseDialect,
    );
  });

  bottle.factory('ActionStatisticsAdapter', (container) => {
    const config = DataWarehouseFactory.createConfigFromEnv();
    // eslint-disable-next-line switch-statement/require-appropriate-default-case
    switch (config.provider) {
      case 'clickhouse':
        return new ClickhouseActionStatisticsAdapter(
          container.DataWarehouse,
          container.Tracer,
        );
      case 'snowflake':
        return new SnowflakeActionStatisticsAdapter(
          container.DataWarehouseDialect.getKyselyInstance(),
        );
      default:
        return new SnowflakeActionStatisticsAdapter(
          container.DataWarehouseDialect.getKyselyInstance(),
        );
    }
  });

  bottle.factory('OrgCreationAdapter', (container) => {
    const config = DataWarehouseFactory.createConfigFromEnv();
    // eslint-disable-next-line switch-statement/require-appropriate-default-case
    switch (config.provider) {
      case 'clickhouse':
        return new ClickhouseOrgCreationAdapter(
          container.DataWarehouse,
          container.Tracer,
        );
      case 'snowflake':
        return new SnowflakeOrgCreationAdapter(
          container.DataWarehouse,
          container.Tracer,
        );
      default:
        return new SnowflakeOrgCreationAdapter(
          container.DataWarehouse,
          container.Tracer,
        );
    }
  });

  bottle.factory('ReportingAnalyticsAdapter', (container) => {
    const config = DataWarehouseFactory.createConfigFromEnv();
    // eslint-disable-next-line switch-statement/require-appropriate-default-case
    switch (config.provider) {
      case 'clickhouse':
        return new ClickhouseReportingAnalyticsAdapter(
          container.DataWarehouse,
          container.Tracer,
        );
      case 'snowflake':
        return new SnowflakeReportingAnalyticsAdapter(
          container.DataWarehouseDialect.getKyselyInstance(),
        );
      default:
        return new SnowflakeReportingAnalyticsAdapter(
          container.DataWarehouseDialect.getKyselyInstance(),
        );
    }
  });

  bottle.factory('ActionExecutionsAdapter', (container) => {
    const config = DataWarehouseFactory.createConfigFromEnv();
    // eslint-disable-next-line switch-statement/require-appropriate-default-case
    switch (config.provider) {
      case 'clickhouse':
        return new ClickhouseActionExecutionsAdapter(
          container.DataWarehouse,
          container.Tracer,
        );
      case 'snowflake':
        return new SnowflakeActionExecutionsAdapter(
          container.DataWarehouseDialect.getKyselyInstance(),
        );
      default:
        return new SnowflakeActionExecutionsAdapter(
          container.DataWarehouseDialect.getKyselyInstance(),
        );
    }
  });

  bottle.factory('ContentApiRequestsAdapter', (container) => {
    const config = DataWarehouseFactory.createConfigFromEnv();
    // eslint-disable-next-line switch-statement/require-appropriate-default-case
    switch (config.provider) {
      case 'clickhouse':
        return new ClickhouseContentApiRequestsAdapter(
          container.DataWarehouse,
          container.Tracer,
        );
      case 'snowflake':
        return new SnowflakeContentApiRequestsAdapter(
          container.DataWarehouseDialect.getKyselyInstance(),
        );
      default:
        return new SnowflakeContentApiRequestsAdapter(
          container.DataWarehouseDialect.getKyselyInstance(),
        );
    }
  });

  // Snowflake-specific utilities - delegate to abstraction
  bottle.factory('Snowflake', (container) => {
    return container.DataWarehouse;
  });

  bottle.factory('KyselySnowflake', (container) => {
    return container.DataWarehouseDialect.getKyselyInstance();
  });

  bottle.factory('itemSubmissionQueueBulkWrite', (container) =>
    makeItemQueueBulkWrite(container.Kafka, 'ITEM_SUBMISSION_EVENTS'),
  );
  bottle.factory('itemSubmissionRetryQueueBulkWrite', (container) =>
    makeItemQueueBulkWrite(container.Kafka, 'ITEM_SUBMISSION_EVENTS_RETRY_0'),
  );

  // Legacy service deprecated in favor of kysely.
  // NB: for knex, we're using the pg dialect because it's the closest one to
  // Snowflake, which knex doesn't support explicitly. The only difference
  // should be, since Knex quotes all identifiers, that we have to make sure we
  // pass in UPPER_CASE identifiers, as the canonical form of Snowflake
  // identifiers (which is the form that must be provided in quoted identifier
  // references) is usually uppercase.
  bottle.value(
    'Knex',
    knexPkg.default.knex({
      client: 'pg',
      connection: getPgMasterConnectionInfo,
    }),
  );

  // Loggers
  register(bottle, 'RuleExecutionLogger', makeRuleExecutionLogger);

  register(
    bottle,
    'RoutingRuleExecutionLogger',
    makeRoutingRuleExecutionLogger,
  );
  register(
    bottle,
    'ReportingRuleExecutionLogger',
    makeReportingRuleExecutionLogger,
  );
  register(bottle, 'ActionExecutionLogger', makeActionExecutionLogger);
  register(bottle, 'ContentApiLogger', makeContentApiLogger);
  register(bottle, 'ItemModelScoreLogger', makeItemModelScoreLogger);
  register(bottle, 'OrgCreationLogger', makeOrgCreationLogger);

  // Core business logic services
  register(bottle, 'RuleEngine', makeRuleEngine);
  register(bottle, 'RuleEvaluator', makeRuleEvaluator);
  register(bottle, 'RuleActionInsights', makeRuleActionInsights);
  register(bottle, 'ItemHistoryQueries', makeItemHistoryQueries);
  register(bottle, 'ActionStatisticsService', makeActionStatisticsService);
  register(bottle, 'UserHistoryQueries', makeUserHistoryQueries);
  register(bottle, 'NotificationsService', makeNotificationsService);
  register(bottle, 'PlacesApiService', makePlacesApiService);
  register(bottle, 'ReportingService', makeReportingService);
  register(bottle, 'OrgSettingsService', makeOrgSettingsService);
  register(bottle, 'NcmecService', makeNcmecService);
  register(bottle, 'ActionPublisher', makeActionPublisher);
  register(bottle, 'PartialItemsService', makePartialItemsService);
  register(bottle, 'UserManagementService', makeUserManagementService);
  register(bottle, 'AggregationsService', makeAggregationsService);
  register(bottle, 'SSOService', makeSSOService);
  register(bottle, 'HMAHashBankService', makeHmaService);

  bottle.factory(
    'UserStrikeService',
    (container) =>
      new UserStrikeService(
        container.Scylla,
        container.ModerationConfigService,
        container.getUserStrikeTTLInDaysEventuallyConsistent,
        container.ActionExecutionsAdapter,
        async (triggeredActions, executionContext) => {
          return container.ActionPublisher.publishActions(
            triggeredActions,
            executionContext,
          );
        },
      ),
  );

  // N.B. Currently all our services that use Scylla as a backing datastore
  // use the same keyspace, i.e. `item_investigation_service`. If we ever
  // need to add a keyspace (e.g. because we have tables that need a new
  // replication strategy, or we support multiple datacenters) we will want to
  // create one one Scylla client per keyspace, since the underlying driver is
  // keyspace aware and it's very annoying and likely error prone to be
  // switching keyspaces with `USE KEYSPACE` all the time.
  bottle.factory('Scylla', () => {
    const scyllaDriver = new ScyllaClient({
      contactPoints: safeGetEnvVar('SCYLLA_HOSTS')
        .split(',')
        .map((it) => it.trim()),
      credentials: {
        username: safeGetEnvVar('SCYLLA_USERNAME'),
        password: safeGetEnvVar('SCYLLA_PASSWORD'),
      },
      localDataCenter: safeGetEnvVar('SCYLLA_LOCAL_DATACENTER'),
      keyspace: 'item_investigation_service',
      pooling: {
        coreConnectionsPerHost: {
          [scyllaTypes.distance.local]: 3,
          [scyllaTypes.distance.remote]: 1,
        },
      },
      queryOptions: {
        // Quorum consistency requires a simple majority of nodes in a
        // replica group to respond to read/write requests. Local Quorum is
        // the same except it only expects nodes in the local datacenter to
        // respond. For our current Scylla infrastructure quorum and local
        // quorum will have identical behavior, but if we ever add another
        // datacenter to the cluster using Quorum and requiring responses
        // from multiple DCs would degrade performance significantly
        consistency: scyllaTypes.consistencies.localQuorum,
      },
    });
    class ClosableScylla<
      DB extends Record<string, Record<string, unknown>>,
    > extends Scylla<DB> {
      async close() {
        return scyllaDriver.shutdown();
      }
    }
    return new ClosableScylla(scyllaDriver);
  });

  bottle.factory('ItemInvestigationService', (container) => {
    return new ItemInvestigationService(
      container.Scylla,
      container.Tracer,
      container.PartialItemsService,
      container.ActionExecutionsAdapter,
      container.ContentApiRequestsAdapter,
      container.ModerationConfigService,
      container.Meter,
    );
  });

  bottle.factory(
    'ModerationConfigService',
    (container) =>
      new ModerationConfigService(
        container.KyselyPg,
        container.KyselyPgReadReplica,
        async (_) => {},
      ),
  );

  bottle.factory('ManualReviewToolService', (container) => {
    return new ManualReviewToolService(
      container.IORedis,
      container.RuleEvaluator,
      container.RoutingRuleExecutionLogger,
      container.KyselyPg,
      container.KyselyPgReadReplica,
      container.UserStatisticsService,
      container.getActionsByIdEventuallyConsistent,
      container.Tracer,
      container.ModerationConfigService,
      container.PartialItemsService,
      // this is the `.onRecordDecision` function, which
      // handles action publishing after an MRT decision is made.
      // This comment is important because otherwise it is impossible to find
      // the function definition by searching for `onRecordDecision`. Please do
      // not delete
      async function ({
        decisionComponents,
        relatedActions,
        job,
        queueId,
        reviewerId,
        reviewerEmail,
        decisionReason,
      }) {
        const { orgId } = job;
        const { itemId, itemTypeIdentifier, data } = job.payload.item;
        const actionPublisher = container.ActionPublisher;

        const publishActions = async (params: {
          decisionActions: NonEmptyArray<{
            actionId: string;
            // TODO: Extract this to a type in a reasonable place
            // as `customMrtApiParamsForActionPublishing` or something
            customMrtApiParamDecisionPayload?: Record<
              string,
              string | boolean | unknown
            >;
          }>;
          policyIds: readonly string[];
          orgId: string;
          item: ItemSubmissionWithTypeIdentifier | ActionTargetItem;
          actorId: string;
          actorEmail: string;
          decisionReason?: string;
        }) => {
          const {
            decisionActions,
            policyIds,
            orgId,
            item,
            actorId,
            actorEmail,
          } = params;
          const actionIds = decisionActions.map((action) => action.actionId);
          const [actions, policies] = await Promise.all([
            container.getActionsByIdEventuallyConsistent({
              ids: actionIds,
              orgId,
            }),
            container.getPoliciesByIdEventuallyConsistent({
              ids: policyIds,
              orgId,
            }),
          ]);
          const actionsWithCustomMrtParams = decisionActions.map((action) => {
            return {
              action: actions.find((a) => a.id === action.actionId),
              customMrtApiParamDecisionPayload:
                action.customMrtApiParamDecisionPayload,
            };
          });
          const nonNullActionsWithCustomMrtParams =
            actionsWithCustomMrtParams.filter((a) => a.action !== undefined);

          const correlationId = toCorrelationId({
            type: 'mrt-decision',
            id: uuidv1(),
          });
          const itemType = await container.getItemTypeEventuallyConsistent({
            orgId,
            typeSelector:
              'itemTypeIdentifier' in item
                ? item.itemTypeIdentifier
                : { id: item.itemType.id },
          });
          if (!itemType) {
            throw new Error('Item Type does not exist');
          }

          const itemSubmission =
            'submissionId' in item && !('itemType' in item)
              ? itemSubmissionWithTypeIdentifierToItemSubmission(item, itemType)
              : item;
          actionPublisher
            .publishActions(
              nonNullActionsWithCustomMrtParams.map((action) => ({
                // we can cast to non-undefined (!) because we know that
                // although typescript did not narrow the type of
                // action.action through the filter applied to
                // nonNullActionsWithCustomMrtParams, we know that
                // narrowing has occurred.
                action: action.action! satisfies ReadonlyDeep<
                  CollapseCases<Action>
                > as Action,
                matchingRules: undefined,
                ruleEnvironment: undefined,
                policies,
                jobId: job.id,
                customMrtApiParamDecisionPayload:
                  action.customMrtApiParamDecisionPayload,
              })),
              {
                orgId,
                correlationId,
                targetItem: itemSubmission,
                actorId,
                actorEmail,
              },
            )
            .catch((error) => {
              container.Tracer.addSpan(
                { resource: 'actionPublisher', operation: 'publishAction' },
                (span) => {
                  span.setAttribute('job.id', job.id);
                  span.setAttribute('org.id', orgId);
                  container.Tracer.logSpanFailed(span, error);
                  return null;
                },
              );
            });
        };

        const correlationId = toCorrelationId({
          type: 'mrt-decision',
          id: uuidv1(),
        });

        await Promise.all(
          // eslint-disable-next-line complexity
          decisionComponents.map(async (decision) => {
            switch (decision.type) {
              // Don't need to do anything if the job is automatically closed
              case 'AUTOMATIC_CLOSE':
                break;
              case 'IGNORE':
                const ignoreCallback =
                  await container.getIgnoreCallbackEventuallyConsistent(orgId);
                if (ignoreCallback === undefined) {
                  break;
                }
                const ignoreCallbackBody = {
                  id: job.payload.item.itemId,
                  typeId: job.payload.item.itemTypeIdentifier.id,
                  data: job.payload.item.data,
                  ...(job.payload.kind === 'NCMEC'
                    ? {
                        ncmecMedia: job.payload.allMediaItems.map((it) => ({
                          id: it.contentItem.itemId,
                          typeId: it.contentItem.itemTypeIdentifier,
                        })),
                      }
                    : {}),
                };

                await container.fetchHTTP({
                  url: ignoreCallback,
                  method: 'post',
                  body: jsonStringify(ignoreCallbackBody),
                  logRequestAndResponseBody: 'ON_FAILURE',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  handleResponseBody: 'discard',
                  signWith: container.SigningKeyPairService.sign.bind(
                    container.SigningKeyPairService,
                    orgId,
                  ),
                });
                break;
              // The difference in payload between reject/accept appeal
              // is handled in the action publisher, so these cases have
              // the same logic
              case 'REJECT_APPEAL':
              case 'ACCEPT_APPEAL':
                const appealedItemType =
                  await container.getItemTypeEventuallyConsistent({
                    orgId,
                    typeSelector: job.payload.item.itemTypeIdentifier,
                  });
                if (!appealedItemType) {
                  throw new Error('Item Type does not exist');
                }

                const orgAppealSettings =
                  await container.OrgSettingsService.getAppealSettings(orgId);

                if (!orgAppealSettings.appealCallbackUrl) {
                  throw Error(`No Appeal Callback URL set for org ${orgId}`);
                }
                const appealCustomBodyParams =
                  orgAppealSettings.appealCallbackBody;
                const appealHeaders = orgAppealSettings.appealCallbackHeaders;

                const appealCallbackBody = {
                  appealId: decision.appealId,
                  appealedBy: {
                    id:
                      'appealerIdentifier' in job.payload
                        ? job.payload.appealerIdentifier?.id
                        : undefined,

                    typeId:
                      'appealerIdentifier' in job.payload
                        ? job.payload.appealerIdentifier?.typeId
                        : undefined,
                  },
                  appealDecision:
                    decision.type === 'ACCEPT_APPEAL' ? 'ACCEPT' : 'REJECT',
                  item: {
                    id: job.payload.item.itemId,
                    typeId: job.payload.item.itemTypeIdentifier.id,
                  },
                  ...(appealCustomBodyParams
                    ? { custom: appealCustomBodyParams }
                    : {}),
                };

                const appealResponse = await container.fetchHTTP({
                  url: orgAppealSettings.appealCallbackUrl,
                  method: 'post',
                  body: jsonStringify(appealCallbackBody),
                  logRequestAndResponseBody: 'ON_FAILURE',
                  headers: {
                    // TODO: We should make sure that there's no value a user
                    // could provide that would have security implications when blindly fed
                    // in here -- like something that would somehow lead fetch to do something
                    // unexpected.
                    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                    ...((appealHeaders as JsonObject | undefined) ?? undefined),
                    // Put this header last so customHeaders can't override it, which I
                    // think makes sense, since there's no way for users to effect the
                    // body in a way that would change the content type.
                    'Content-Type': 'application/json',
                  },
                  handleResponseBody: 'discard',
                  signWith: container.SigningKeyPairService.sign.bind(
                    container.SigningKeyPairService,
                    orgId,
                  ),
                });

                if (!appealResponse.ok) {
                  throw Error(`User's server returned non-success status`);
                }
                break;

              case 'CUSTOM_ACTION':
                const actions = decision.actions.map((action) => {
                  const actionPayload = {
                    actionId: action.id,
                    ...(decision.actionIdsToMrtApiParamDecisionPayload !==
                    undefined
                      ? {
                          customMrtApiParamDecisionPayload: decision
                            .actionIdsToMrtApiParamDecisionPayload[
                            action.id
                          ] as Record<string, string | boolean | unknown>,
                        }
                      : {}),
                  };
                  // By default reportedForReasons as well as decision reason to the
                  // custom action callback payload whether or not there is an
                  // existing custom payload
                  if (job.payload.kind === 'DEFAULT') {
                    // TODO: this is unholy we have got to remove this as soon
                    // as possible, specifically when the new report decision
                    // API is in place
                    const additionalPayload = job.payload.reportedForReasons
                      ? {
                          // eslint-disable-next-line no-restricted-syntax
                          reportHistory: job.payload.reportedForReasons.map(
                            (it) => ({
                              reason: it.reason,
                              reporter: it.reporterId,
                            }),
                          ),
                          reason: decisionReason,
                        }
                      : { reason: decisionReason };
                    actionPayload.customMrtApiParamDecisionPayload = {
                      ...actionPayload.customMrtApiParamDecisionPayload,
                      ...(additionalPayload.reportHistory
                        ? additionalPayload
                        : {}),
                    };
                  }
                  return actionPayload;
                });
                // TODO: make this illegal at the time the decision is submitted.
                if (!isNonEmptyArray(actions)) {
                  throw new Error(
                    'Attempting to take a user action without any actions',
                  );
                }
                await publishActions({
                  decisionActions: actions,
                  policyIds: decision.policies.map((policy) => policy.id),
                  orgId,
                  item: job.payload.item,
                  actorId: reviewerId,
                  actorEmail: reviewerEmail,
                });
                break;
              case 'SUBMIT_NCMEC_REPORT':
                if (job.payload.kind !== 'NCMEC') {
                  throw new Error(
                    'Attempting to submit a NCMEC report for a non-NCMEC job',
                  );
                }
                const itemType =
                  await container.getItemTypeEventuallyConsistent({
                    orgId,
                    typeSelector: itemTypeIdentifier,
                  });
                if (itemType === undefined || itemType.kind !== 'USER') {
                  throw new Error('Item Type for User does not exist');
                }
                const displayName = getFieldValueForRole(
                  itemType.schema,
                  itemType.schemaFieldRoles,
                  'displayName',
                  data,
                );
                const profilePicUrl = getFieldValueForRole(
                  itemType.schema,
                  itemType.schemaFieldRoles,
                  'profileIcon',
                  data,
                );

                const allMedia = job.payload.allMediaItems;
                const media = await Promise.all(
                  decision.reportedMedia.map(async (it) => {
                    const reportedItem = allMedia.find(
                      (payloadMedia) =>
                        payloadMedia.contentItem.itemId === it.id,
                    );
                    if (reportedItem === undefined) {
                      throw new Error(
                        'Unable to find reported media in job payload',
                      );
                    }
                    const itemType =
                      await container.getItemTypeEventuallyConsistent({
                        orgId,
                        typeSelector:
                          reportedItem.contentItem.itemTypeIdentifier,
                      });
                    if (itemType === undefined) {
                      throw new Error(
                        'Unable to find item type for reported media',
                      );
                    }

                    const createdAt =
                      getFieldValueForRole(
                        itemType.schema,
                        itemType.schemaFieldRoles,
                        'createdAt',
                        reportedItem.contentItem.data,
                      ) ?? makeDateString(new Date().toISOString());
                    if (createdAt === undefined) {
                      throw new Error('No created at for reported media');
                    }

                    return {
                      id: it.id,
                      typeId: it.typeId,
                      url: it.url,
                      createdAt,
                      industryClassification: it.industryClassification,
                      fileAnnotations: it.fileAnnotations,
                    };
                  }),
                );
                const isTest = !ncmecProdQueues.includes(queueId);
                await container.NcmecService.submitReport(
                  {
                    reportedUser: {
                      id: itemId,
                      typeId: itemTypeIdentifier.id,
                      ...(displayName ? { displayName } : {}),
                      ...(profilePicUrl
                        ? { profilePicture: profilePicUrl.url }
                        : {}),
                    },
                    threads: decision.reportedMessages,
                    orgId,
                    media,
                    reviewerId,
                    incidentType: decision.incidentType,
                  },
                  isTest,
                );
                const actionAndPolicy =
                  await container.NcmecService.getNCMECActionsToRunAndPolicies(
                    orgId,
                  );
                const decisionActions = actionAndPolicy?.actionsToRunIds
                  ? actionAndPolicy.actionsToRunIds.map((a) => ({
                      actionId: a,
                    }))
                  : [];
                if (
                  actionAndPolicy != null &&
                  actionAndPolicy.actionsToRunIds != null &&
                  isNonEmptyArray(decisionActions) &&
                  !isTest
                ) {
                  await publishActions({
                    decisionActions,
                    policyIds: actionAndPolicy.policyIds,
                    orgId,
                    item: job.payload.item,
                    actorId: reviewerId,
                    actorEmail: reviewerEmail,
                  });
                }
                break;
              case 'TRANSFORM_JOB_AND_RECREATE_IN_QUEUE':
                const defaultJobInput = {
                  enqueueSource: 'MRT_JOB',
                  enqueueSourceInfo: { kind: 'MRT_JOB' },
                  reenqueuedFrom: { jobId: job.id },
                  payload: {
                    kind: 'DEFAULT',
                    item: job.payload.item,
                    ...{
                      reportIds:
                        'reportIds' in job.payload
                          ? job.payload.reportIds ?? []
                          : [],
                    },
                    ...('reportedForReason' in job.payload
                      ? { reportedForReason: job.payload.reportedForReason }
                      : {}),
                    ...('reporterIdentifier' in job.payload
                      ? {
                          reporterIdentifier: job.payload.reporterIdentifier,
                        }
                      : {}),
                    ...('reportedForReasons' in job.payload
                      ? {
                          reportedForReasons:
                            job.payload.reportedForReasons ?? [],
                        }
                      : { reportedForReasons: [] }),
                    ...('reportHistory' in job.payload
                      ? {
                          reportHistory: job.payload.reportHistory,
                        }
                      : { reportHistory: [] }),
                  },
                  createdAt: new Date(),
                  orgId,
                  correlationId,
                  policyIds: job.policyIds,
                } as const;
                switch (decision.newJobKind) {
                  case 'DEFAULT':
                    await container.ManualReviewToolService.enqueue(
                      defaultJobInput,

                      decision.newQueueId ?? undefined,
                    );
                    break;
                  case 'NCMEC':
                    // TODO: the NCMEC service is currently in charge of NCMEC job
                    // enrichment, but once we replace the NCMEC snowflake job with
                    // Scylla we should move it back into the MRT service
                    await container.NcmecService.enqueueForHumanReviewIfApplicable(
                      {
                        orgId,
                        createdAt: new Date(),
                        enqueueSource: 'MRT_JOB',
                        enqueueSourceInfo: { kind: 'MRT_JOB' },
                        correlationId,
                        item: job.payload.item,
                        reenqueuedFrom: { jobId: job.id },
                      },
                    );
                    break;
                  default:
                    assertUnreachable(decision.newJobKind);
                }
                break;

              default:
                assertUnreachable(decision);
            }
          }),
        );

        // Publish any related actions
        const flattenedRelatedActions = relatedActions.flatMap((it) => {
          return it.itemIds.map((itemId) => ({
            ..._.omit(it, 'itemIds'),
            itemId,
          }));
        });
        await Promise.all(
          flattenedRelatedActions.map(async (it) => {
            const { actionIds, policyIds, itemId, itemTypeId } = it;
            if (!isNonEmptyArray(actionIds)) {
              return;
            }

            const itemType = await container.getItemTypeEventuallyConsistent({
              orgId,
              typeSelector: { id: itemTypeId },
            });

            if (!itemType) {
              return;
            }
            const decisionActions = actionIds.map((actionId) => ({
              actionId,
            }));

            if (isNonEmptyArray(decisionActions)) {
              await publishActions({
                decisionActions,
                policyIds,
                orgId,
                item: { itemId, itemType },
                actorId: reviewerId,
                actorEmail: reviewerEmail,
              });
            }
          }),
        );
      },
      async function onEnqueue(
        _input: ManualReviewJobInput | ManualReviewAppealJobInput,
        _queueId: string,
      ) {},
    );
  });

  // Networking helper functions
  bottle.factory(
    'fetchHTTP',
    (container) => fetchHTTP.bind(null, container.Tracer) as FetchHTTP,
  );

  // rule + anomaly detection helper functions
  register(
    bottle,
    'getRuleAnomalyDetectionStatistics',
    makeGetRuleAnomalyDetectionStatistics,
  );
  register(bottle, 'getSimplifiedRuleHistory', makeGetSimplifiedRuleHistory);
  register(
    bottle,
    'getCurrentPeriodRuleAlarmStatuses',
    makeGetCurrentPeriodRuleAlarmStatuses,
  );

  // Creating, running, and fetching data for signal execution (w/ caches).
  register(
    bottle,
    'TransientRunSignalWithCacheFactory',
    makeGetTransientRunSignalWithCache,
  );
  register(bottle, 'SignalAuthService', makeSignalAuthService);

  bottle.factory('getUserScoreEventuallyConsistent', (container) => {
    const statsService = container.UserStatisticsService;
    return statsService.getUserScore.bind(statsService);
  });

  bottle.factory(
    'getPolicyActionPenaltiesEventuallyConsistent',
    (container) => {
      const Org = container.OrgModel;

      return cached({
        async producer(orgId) {
          return Org.getPolicyActionPenaltiesEventuallyConsistent(orgId);
        },
        directives: { freshUntilAge: 60 },
      });
    },
  );

  bottle.factory(
    'getImageBankEventuallyConsistent',
    (container) => {
      const kyselyPg = container.KyselyPg;
      const hashBankService = new HashBankService(kyselyPg);

      return cached({
        async producer({ orgId, bankId }) {
          // bankId could be either database ID or bank name
          // Check if bankId is numeric (database ID)
          const numericBankId = parseInt(bankId);
          if (!isNaN(numericBankId)) {
            // Get by database ID
            return hashBankService.findById(numericBankId, orgId);
          } else {
            // Get by name
            return hashBankService.findByName(bankId, orgId);
          }
        },
        directives: { freshUntilAge: 300 }, // 5 minutes cache for image banks
      });
    },
  );


  bottle.factory('getUserStrikeTTLInDaysEventuallyConsistent', (container) => {
    return cached({
      producer: async (orgId: string) =>
        container.OrgSettingsService.userStrikeTTLInDays(orgId),
      directives: { freshUntilAge: 600 },
    });
  });

  bottle.factory('getIgnoreCallbackEventuallyConsistent', (container) => {
    return cached({
      producer: async (orgId: string) =>
        container.ManualReviewToolService.getIgnoreCallbackForOrg(orgId),
      directives: { freshUntilAge: 600 },
    });
  });

  register(
    bottle,
    'getSequelizeItemTypeEventuallyConsistent',
    makeGetSequelizeItemTypeEventuallyConsistent,
  );

  register(
    bottle,
    'getEnabledRulesForItemTypeEventuallyConsistent',
    makeGetEnabledRulesForItemTypeEventuallyConsistent,
  );

  register(
    bottle,
    'getPoliciesForRulesEventuallyConsistent',
    makeGetPoliciesForRulesEventuallyConsistent,
  );

  register(
    bottle,
    'getActionsForRuleEventuallyConsistent',
    makeGetActionsForRuleEventuallyConsistent,
  );

  register(
    bottle,
    'recordRuleActionLimitUsage',
    makeRecordRuleActionLimitUsage,
  );

  register(
    bottle,
    'getLocationBankLocationsEventuallyConsistent',
    makeGetLocationBankLocationsEventuallyConsistent,
  );

  register(
    bottle,
    'getTextBankStringsEventuallyConsistent',
    makeGetTextBankStringsEventuallyConsistent,
  );

  register(
    bottle,
    'getActionsByIdEventuallyConsistent',
    makeGetActionsByIdEventuallyConsistent,
  );

  register(
    bottle,
    'getPoliciesByIdEventuallyConsistent',
    makeGetPoliciesByIdEventuallyConsistent,
  );

  register(
    bottle,
    'getItemTypesForOrgEventuallyConsistent',
    makeGetItemTypesForOrgEventuallyConsistent,
  );

  register(
    bottle,
    'getItemTypeEventuallyConsistent',
    makeGetItemTypeEventuallyConsistent,
  );

  register(bottle, 'UserStatisticsService', makeUserStatisticsService);

  register(bottle, 'SignalsService', makeSignalsService);
  register(bottle, 'DerivedFieldsService', makeDerivedFieldsService);

  // Misc helper services
  register(bottle, 'ApiKeyService', makeApiKeyService);
  register(bottle, 'SigningKeyPairService', makeSigningKeyPairService);
  bottle.factory(
    'SigningKeyPairStorageService',
    (container) => new PostgresSigningKeyPairStorage(container.KyselyPg),
  );
  bottle.value('ConfigService', { uiUrl: safeGetEnvVar('UI_URL') });
  bottle.value('S3StoreObjectFactory', s3StoreObjectFactory);
  bottle.factory('sendEmail', makeSendEmail);
  register(bottle, 'KeyValueStore', makeKeyValueStore);

  // Here, we make sure that our thread pool has at least one core. We also
  // set the maximum number of to be the number of usable cores minus one
  // so that we don't accidentally contend for resources with the main
  // thread. It's possible we'll need to increase this to use all cores
  // in an instance where the main thread is empty, but that should be
  // pretty rare, and we can monitor to see if it's necessary
  bottle.factory(
    'GlobalWorkerPool',
    () => new DynamicPool(Math.max(1, Math.floor(getUsableCoreCount()) - 1)),
  );

  // NB: for now, we only expose the SafeTracer instance through bottle,
  // because we want all tracing to go through its helper functions.
  bottle.factory('Tracer', () => {
    const tracer = opentelemetry.trace.getTracer('coop-api-tracer');
    return new SafeTracer(tracer);
  });

  bottle.factory('Meter', () => {
    return new CoopMeter();
  });

  // This service exposes a function that we call right before we want to
  // terminate the node process, which will shutdown any global services/close
  // all open connections that might block the process from shutting down.
  // Individual services can/should have their own shutdown methods but, because
  // some services rely on shared connection pools (which should not be drained
  // just because one user of the pool shuts down), we need a global shutdown
  // method as well, which closes these shared resources. That's what this does.
  bottle.factory('closeSharedResourcesForShutdown', (container) => {
    // NB: we have to be careful that calling this shutdown function doesn't
    // _start up_ any of these shared services that it'd be shutting down (like
    // a snowflake connection). Inadvertently starting up services when we're 
    // trying to shut down would be ironic, but it would also cause big crashes,
    // as some of these services won't start correctly
    // in some contexts (e.g., in a worker that doesn't have the required
    // credentials).
    return async () => {
      const tracer = container.Tracer;
      await tracer.addActiveSpan(
        { resource: 'app', operation: 'shutdown' },
        async () => {
          // The `ClosableServiceName` type should be an exhaustive set of
          // "closable" services, so that we can check that every service in
          // that set is included in `servicesThatCanBeShutdown`. For this to
          // add value, we can't just manually enumerate the closable services,
          // as that's as error-prone as manually writing out
          // `servicesThatCanBeShutdown`. So, instead, we find all services that
          // look potentially closable, and then exclude false positives.
          type CloseMethodName = 'close' | 'destroy' | 'quit' | 'disconnect';
          type ClosableServiceName = Exclude<
            keyof Pick<
              Dependencies,
              {
                [ServiceName in keyof Dependencies]: {
                  [Method in CloseMethodName]: Dependencies[ServiceName] extends {
                    [_ in Method]: unknown;
                  }
                    ? ServiceName
                    : never;
                }[CloseMethodName];
              }[keyof Dependencies]
            >,
            // Seqelize puts a close method on each model, but we only need to
            // close the root sequelize instance.
            | 'OrgModel'
            | 'PolicyModel'
            | 'RuleModel'
            | 'ActionModel'
            | 'ItemTypeModel'
            | 'LocationBankModel'
            | 'LocationBankLocationModel'
            // Deprecated services that delegate to DataWarehouse
            | 'Snowflake'
            | 'KyselySnowflake'
            // Services that don't need cleanup
            | 'UserStatisticsService'
            | 'HMAHashBankService'
          >;

          // This will be a type error if we forgot to close something.
          type _AllServicesClosedCheck = Satisfies<
            ClosableServiceName,
            (typeof servicesThatCanBeShutdown)[number]
          >;

          // NB: any service in this list must have a `close`, `destroy`, or
          // `quit` method, as that's what we're gonna try to call to do the
          // shutdown.
          const servicesThatCanBeShutdown = [
            'Scylla',
            'itemSubmissionQueueBulkWrite',
            'itemSubmissionRetryQueueBulkWrite',
            'Sequelize',
            'Knex',
            'IORedis',
            // Storage abstractions
            'DataWarehouse',
            'DataWarehouseDialect',
            'DataWarehouseAnalytics',
            'ReportingAnalyticsAdapter',
            'KyselyPg',
            'KyselyPgReadReplica',
            'getSequelizeItemTypeEventuallyConsistent',
            'getEnabledRulesForItemTypeEventuallyConsistent',
            'getPoliciesForRulesEventuallyConsistent',
            'getActionsForRuleEventuallyConsistent',
            'getLocationBankLocationsEventuallyConsistent',
            'getTextBankStringsEventuallyConsistent',
            'getPolicyActionPenaltiesEventuallyConsistent',
            'getImageBankEventuallyConsistent',
            'getActionsByIdEventuallyConsistent',
            'getPoliciesByIdEventuallyConsistent',
            'getUserStrikeTTLInDaysEventuallyConsistent',
            'ManualReviewToolService',
            'SigningKeyPairService',
            'GlobalWorkerPool',
            'SignalsService',
            'ModerationConfigService',
            'OrgSettingsService',
            'getIgnoreCallbackEventuallyConsistent',
          ] as const;

          // Only get and shutdown services that have actually been
          // used/instantiated. For the others, we have to make sure not to
          // reference them from the container, as that risks starting them (since
          // most our services start up automatically upon being required), which
          // may cause a crash (e.g., if a secret env var is missing because it's
          // for a service we don't expect to use).
          //
          // NB: the `const` assertion means that TS can check below that that we're
          // trying to shutdown services that actually have shutdown methods defined.
          const servicesToShutdown = servicesThatCanBeShutdown
            .filter((serviceName) =>
              serviceHasBeenAccessed(container, serviceName),
            )
            .map(
              (serviceName) => [serviceName, container[serviceName]] as const,
            );

          await Promise.all(
            servicesToShutdown.map(async ([name, it]) =>
              tracer.addActiveSpan(
                { resource: name, operation: 'shutdown' },
                async () => {
                  if ('close' in it && typeof it.close === 'function') {
                    await it.close();
                  } else if ('destroy' in it && typeof it.destroy === 'function') {
                    await it.destroy();
                  } else if ('quit' in it && typeof it.quit === 'function') {
                    await it.quit();
                  } else if ('flushPendingWrites' in it && typeof it.flushPendingWrites === 'function') {
                    await it.flushPendingWrites();
                  }
                },
              ),
            ),
          );
        },
      );
    };
  });

  registerWorkersAndJobs(bottle);
  registerGqlDataSources(bottle);

  return bottle;
}

export { inject } from './utils.js';

/**
 * Simple helper function that looks at a bottle container and returns whether
 * a given service has been accessed/constructed from that container before.
 */
function serviceHasBeenAccessed<Deps extends object>(
  container: Bottle.IContainer<Deps>,
  serviceName: keyof Deps,
) {
  // Bottle sets the proprety on the container to be a getter before the service
  // is first accessed; then, it replaces property with the value returned by
  // that getter after the first access. So, we can inspect the property and see
  // if it's a getter.
  const propDesc = Object.getOwnPropertyDescriptor(container, serviceName);
  return typeof propDesc?.get !== 'function';
}

/**
 * Gets an env var, or logs a warning if the variable is not defined. This is
 * useful for cases where an env var should be provided, but the app can recover
 * on the off-chance that the variable was improperly omitted, and we'd rather
 * have the fallback behavior than create an outage. However, we still want to
 * log a warning so that we can see in DD that we need to set this variable.
 *
 * TODO: create a DD metric that counts these warnings, and set up a monitor to
 * alert if there are any.
 */
function getEnvVarOrWarn(varName: string) {
  const value = process.env[varName];

  if (value == null) {
    // NB: using this format for the logged JSON is taking on some tech debt
    // (esp if/once we create a DD monitor/metric that uses `title` to find
    // these errors), because we probably want to reformat these logged errors
    // later in a way that makes them more consistent amongst each other and
    // possibly also more consistent with CoopError errors. For now, though,
    // figuring out that end state isn't worth the brainpower.
    // eslint-disable-next-line no-console
    console.warn(
      jsonStringify({
        title: 'MissingEnvVar',
        message: `Missing env var ${varName}`,
      }),
    );
  }

  return value;
}
