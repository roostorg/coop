import { dirname, join as pathJoin } from 'path';
import { fileURLToPath } from 'url';
import { KubectlV29Layer } from '@aws-cdk/lambda-layer-kubectl-v29';
import { KubernetesVersion } from 'aws-cdk-lib/aws-eks';
import { Construct } from 'constructs';

import { DeploymentEnvironmentName } from './stacks/app_pipeline.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Useful for getting reference to the main app's Dockerfile, or the source code
// directories outside of the devops folder.
export const repoRootDir = pathJoin(__dirname, '../../..');

export const awsSrcDir = __dirname;

export type PgEnvVar = (typeof pgEnvVars)[number];
export const pgEnvVars = [
  'DATABASE_HOST',
  'DATABASE_PORT',
  'DATABASE_NAME',
  'DATABASE_USER',
  'DATABASE_PASSWORD',
] as const;

export type SnowflakeEnvVar = (typeof snowflakeEnvVars)[number];
export const snowflakeEnvVars = [
  'SNOWFLAKE_USERNAME',
  'SNOWFLAKE_PASSWORD',
  'SNOWFLAKE_DB_NAME',
] as const;

export type RedisEnvVar = (typeof redisEnvVars)[number];
export const redisEnvVars = [
  'REDIS_USE_CLUSTER',
  'REDIS_HOST',
  'REDIS_PORT',
  'REDIS_USER',
  'REDIS_PASSWORD',
] as const;

export type ScyllaEnvVars = (typeof scyllaEnvVars)[number];
export const scyllaEnvVars = [
  'SCYLLA_USERNAME',
  'SCYLLA_PASSWORD',
  'SCYLLA_HOSTS',
  'SCYLLA_LOCAL_DATACENTER',
] as const;

export const kafkaSecretEnvVars = [
  'KAFKA_SCHEMA_REGISTRY_USERNAME',
  'KAFKA_SCHEMA_REGISTRY_PASSWORD',
  // Each client (producer/consnumer) also has a secret defined for its service
  // account, but those have different keys for each account, so not listed here.
] as const;

export const kafkaEnvVars = [
  ...kafkaSecretEnvVars,
  'KAFKA_BROKER_HOST',
  'KAFKA_SCHEMA_REGISTRY_HOST',
] as const;

export type KafkaSecretEnvVar = (typeof kafkaSecretEnvVars)[number];
export type KafkaEnvVar = (typeof kafkaEnvVars)[number];

// TODO: replace w/ some sort of infrastructure as code solution.
export const topicSchemaIds = {
  Demo: {
    // TODO
    KAFKA_TOPIC_KEY_SCHEMA_ID_SNOWFLAKE_INGEST_EVENTS: 0,
    KAFKA_TOPIC_VALUE_SCHEMA_ID_SNOWFLAKE_INGEST_EVENTS: 0,
    KAFKA_TOPIC_KEY_SCHEMA_ID_ITEM_SUBMISSION_EVENTS: 0,
    KAFKA_TOPIC_VALUE_SCHEMA_ID_ITEM_SUBMISSION_EVENTS: 0,
    KAFKA_TOPIC_KEY_SCHEMA_ID_ITEM_SUBMISSION_EVENTS_RETRY_0: 0,
    KAFKA_TOPIC_VALUE_SCHEMA_ID_ITEM_SUBMISSION_EVENTS_RETRY_0: 0,
  },
  Staging: {
    KAFKA_TOPIC_KEY_SCHEMA_ID_SNOWFLAKE_INGEST_EVENTS: 100002,
    KAFKA_TOPIC_VALUE_SCHEMA_ID_SNOWFLAKE_INGEST_EVENTS: 100003,
    KAFKA_TOPIC_KEY_SCHEMA_ID_ITEM_SUBMISSION_EVENTS: 100006,
    KAFKA_TOPIC_VALUE_SCHEMA_ID_ITEM_SUBMISSION_EVENTS: 100008,
    KAFKA_TOPIC_KEY_SCHEMA_ID_ITEM_SUBMISSION_EVENTS_RETRY_0: 100006,
    KAFKA_TOPIC_VALUE_SCHEMA_ID_ITEM_SUBMISSION_EVENTS_RETRY_0: 100008,
  },
  Prod: {
    KAFKA_TOPIC_KEY_SCHEMA_ID_SNOWFLAKE_INGEST_EVENTS: 100002,
    KAFKA_TOPIC_VALUE_SCHEMA_ID_SNOWFLAKE_INGEST_EVENTS: 100004,
    KAFKA_TOPIC_KEY_SCHEMA_ID_ITEM_SUBMISSION_EVENTS: 100005,
    KAFKA_TOPIC_VALUE_SCHEMA_ID_ITEM_SUBMISSION_EVENTS: 100008,
    KAFKA_TOPIC_KEY_SCHEMA_ID_ITEM_SUBMISSION_EVENTS_RETRY_0: 100005,
    KAFKA_TOPIC_VALUE_SCHEMA_ID_ITEM_SUBMISSION_EVENTS_RETRY_0: 100008,
  },
} satisfies {
  [K in DeploymentEnvironmentName]: { [Var in TopicEnvVar]: number };
};

type TopicNameInEnvVar =
  | 'SNOWFLAKE_INGEST_EVENTS'
  | 'ITEM_SUBMISSION_EVENTS'
  | 'ITEM_SUBMISSION_EVENTS_RETRY_0';
// prettier-ignore
type TopicEnvVar = `KAFKA_TOPIC_${'KEY' | 'VALUE'}_SCHEMA_ID_${TopicNameInEnvVar}`;

export const makeKubectlVersionProps = (scope: Construct) => ({
  version: KubernetesVersion.V1_29,
  kubectlLayer: new KubectlV29Layer(scope, 'KubectlLayer'),
});
