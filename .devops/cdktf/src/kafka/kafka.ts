import { TerraformStack } from 'cdktf';
import type { Construct } from 'constructs';

import { ApiKey } from '../../.gen/providers/confluent/api-key/index';
import { DataConfluentSchemaRegistryCluster } from '../../.gen/providers/confluent/data-confluent-schema-registry-cluster/index';
import { Environment } from '../../.gen/providers/confluent/environment/index';
import { KafkaCluster } from '../../.gen/providers/confluent/kafka-cluster/index';
import { KafkaTopic } from '../../.gen/providers/confluent/kafka-topic/index';
import { ConfluentProvider } from '../../.gen/providers/confluent/provider/index';
import { RoleBinding } from '../../.gen/providers/confluent/role-binding/index';
import { Schema } from '../../.gen/providers/confluent/schema/index';
import { ServiceAccount } from '../../.gen/providers/confluent/service-account/index';
import { type EnvironmentProps } from '../main';
import { makeAwsProvider, makeS3Backend } from '../utils';

export class KafkaStack extends TerraformStack {
  constructor(scope: Construct, id: string, props: EnvironmentProps) {
    super(scope, id);

    makeS3Backend(this, id, props);

    if (!process.env.CONFLUENT_CLOUD_API_KEY) {
      throw new Error(
        'CONFLUENT_CLOUD_API_KEY environment variable must be set.',
      );
    }

    if (!process.env.CONFLUENT_CLOUD_API_SECRET) {
      throw new Error(
        'CONFLUENT_CLOUD_API_SECRET environment variable must be set.',
      );
    }

    new ConfluentProvider(this, 'kafka-provider', {});

    makeAwsProvider(this, props.region, props.environment);

    const environment = new Environment(this, 'environment', {
      displayName: props.kafka.environmentName,
      lifecycle: { preventDestroy: true },
    });

    const schemaRegistryCluster = new DataConfluentSchemaRegistryCluster(
      this,
      'schema-registry-cluster',
      {
        environment,
      },
    );

    const kafkaCluster = new KafkaCluster(this, 'kafka-cluster', {
      availability: props.kafka.availability,
      displayName: props.kafka.clusterName,
      cloud: 'AWS',
      region: props.region,
      environment,
      [props.kafka.clusterType]: [{}],
      lifecycle: {
        preventDestroy: true,
      },
    });

    const serviceAccount = new ServiceAccount(this, 'service-account', {
      displayName: `${props.environment}-cdktf`,
    });

    const schemaRegistryRoleBinding = new RoleBinding(
      this,
      'schema-registry-role-binding',
      {
        crnPattern: `${schemaRegistryCluster.resourceName}/subject=*`,
        roleName: 'DeveloperWrite',
        principal: `User:${serviceAccount.id}`,
      },
    );

    const schemaRegistryApiKey = new ApiKey(this, 'schema-registry-api-key', {
      owner: {
        id: serviceAccount.id,
        apiVersion: serviceAccount.apiVersion,
        kind: serviceAccount.kind,
      },
      managedResource: {
        id: schemaRegistryCluster.id,
        apiVersion: schemaRegistryCluster.apiVersion,
        kind: schemaRegistryCluster.kind,
        environment,
      },
      dependsOn: [schemaRegistryRoleBinding],
    });
    schemaRegistryApiKey;

    new Schema(this, 'ITEM_SUBMISSION_EVENTS-key', {
      format: 'AVRO',
      subjectName: 'ITEM_SUBMISSION_EVENTS-key',
      schemaRegistryCluster: { id: schemaRegistryCluster.id },
      restEndpoint: schemaRegistryCluster.restEndpoint,
      recreateOnUpdate: true,
      schema: JSON.stringify({
        type: 'record',
        name: 'ItemSubmissionPartitioningInfo',
        doc: 'This schema defines the key used to partition incoming item submissions.',
        fields: [
          {
            name: 'syntheticThreadId',
            type: 'string',
            doc: "The thread id, or a synthetic version for items that aren't in a thread.",
          },
        ],
      }),
      credentials: {
        key: schemaRegistryApiKey.id,
        secret: schemaRegistryApiKey.secret,
      },
      lifecycle: {
        preventDestroy: true,
      },
    });

    new Schema(this, 'ITEM_SUBMISSION_EVENTS-value', {
      format: 'AVRO',
      subjectName: 'ITEM_SUBMISSION_EVENTS-value',
      schemaRegistryCluster: { id: schemaRegistryCluster.id },
      restEndpoint: schemaRegistryCluster.restEndpoint,
      recreateOnUpdate: true,
      credentials: {
        key: schemaRegistryApiKey.id,
        secret: schemaRegistryApiKey.secret,
      },
      schema: JSON.stringify({
        type: 'record',
        name: 'ItemSubmissionMessage',
        fields: [
          {
            name: 'metadata',
            type: {
              type: 'record',
              name: 'ItemSubmissionMetadata',
              fields: [
                { name: 'syntheticThreadId', type: 'string' },
                { name: 'requestId', type: 'string' },
                { name: 'orgId', type: 'string' },
              ],
            },
          },
          {
            name: 'itemSubmissionWithTypeIdentifier',
            type: {
              type: 'record',
              name: 'ItemSubmissionWithTypeIdentifier',
              fields: [
                { name: 'submissionId', type: 'string' },
                {
                  name: 'submissionTime',
                  type: { type: 'long', logicalType: 'timestamp-millis' },
                },
                { name: 'itemId', type: 'string' },
                { name: 'dataJSON', type: 'string' },
                {
                  name: 'itemTypeIdentifier',
                  type: {
                    type: 'record',
                    name: 'ItemTypeIdentifier',
                    fields: [
                      { name: 'id', type: 'string' },
                      { name: 'version', type: 'string' },
                      {
                        name: 'schemaVariant',
                        type: {
                          type: 'enum',
                          name: 'SchemaVariant',
                          symbols: ['original', 'partial'],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      }),
    });

    new Schema(this, 'ITEM_SUBMISSION_EVENTS_RETRY_0-key', {
      format: 'AVRO',
      subjectName: 'ITEM_SUBMISSION_EVENTS_RETRY_0-key',
      schemaRegistryCluster: { id: schemaRegistryCluster.id },
      restEndpoint: schemaRegistryCluster.restEndpoint,
      recreateOnUpdate: true,
      credentials: {
        key: schemaRegistryApiKey.id,
        secret: schemaRegistryApiKey.secret,
      },
      schema: JSON.stringify({
        type: 'record',
        name: 'ItemSubmissionPartitioningInfo',
        doc: 'This schema defines the key used to partition incoming item submissions.',
        fields: [
          {
            name: 'syntheticThreadId',
            type: 'string',
            doc: "The thread id, or a synthetic version for items that aren't in a thread.",
          },
        ],
      }),
    });

    new Schema(this, 'ITEM_SUBMISSION_EVENTS_RETRY_0-value', {
      format: 'AVRO',
      subjectName: 'ITEM_SUBMISSION_EVENTS_RETRY_0-value',
      schemaRegistryCluster: { id: schemaRegistryCluster.id },
      restEndpoint: schemaRegistryCluster.restEndpoint,
      recreateOnUpdate: true,
      credentials: {
        key: schemaRegistryApiKey.id,
        secret: schemaRegistryApiKey.secret,
      },
      schema: JSON.stringify({
        type: 'record',
        name: 'ItemSubmissionMessage',
        fields: [
          {
            name: 'metadata',
            type: {
              type: 'record',
              name: 'ItemSubmissionMetadata',
              fields: [
                { name: 'syntheticThreadId', type: 'string' },
                { name: 'requestId', type: 'string' },
                { name: 'orgId', type: 'string' },
              ],
            },
          },
          {
            name: 'itemSubmissionWithTypeIdentifier',
            type: {
              type: 'record',
              name: 'ItemSubmissionWithTypeIdentifier',
              fields: [
                { name: 'submissionId', type: 'string' },
                {
                  name: 'submissionTime',
                  type: { type: 'long', logicalType: 'timestamp-millis' },
                },
                { name: 'itemId', type: 'string' },
                { name: 'dataJSON', type: 'string' },
                {
                  name: 'itemTypeIdentifier',
                  type: {
                    type: 'record',
                    name: 'ItemTypeIdentifier',
                    fields: [
                      { name: 'id', type: 'string' },
                      { name: 'version', type: 'string' },
                      {
                        name: 'schemaVariant',
                        type: {
                          type: 'enum',
                          name: 'SchemaVariant',
                          symbols: ['original', 'partial'],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      }),
    });

    new Schema(this, 'SNOWFLAKE_INGEST_EVENTS-key', {
      format: 'AVRO',
      subjectName: 'SNOWFLAKE_INGEST_EVENTS-key',
      schemaRegistryCluster: { id: schemaRegistryCluster.id },
      restEndpoint: schemaRegistryCluster.restEndpoint,
      recreateOnUpdate: true,
      credentials: {
        key: schemaRegistryApiKey.id,
        secret: schemaRegistryApiKey.secret,
      },
      schema: JSON.stringify({
        type: 'record',
        name: 'CustomerEndUserId',
        doc: "This schema identifies an end user (i.e., someone using an app made by one of Coop's users), _NOT_ a direct user of Coop's products.",
        fields: [
          {
            name: 'orgId',
            type: 'string',
            doc: 'The id of the Coop organization, which makes the whole record globally unique (if different Coop organizations assign users overlapping ids).',
          },
          {
            name: 'userId',
            type: 'string',
            doc: "The id that Coop's user assigned to the end-user on their platform.",
          },
        ],
      }),
    });

    new Schema(this, 'SNOWFLAKE_INGEST_EVENTS-value', {
      format: 'AVRO',
      subjectName: 'SNOWFLAKE_INGEST_EVENTS-value',
      schemaRegistryCluster: { id: schemaRegistryCluster.id },
      restEndpoint: schemaRegistryCluster.restEndpoint,
      recreateOnUpdate: true,
      credentials: {
        key: schemaRegistryApiKey.id,
        secret: schemaRegistryApiKey.secret,
      },
      schema: JSON.stringify({
        type: 'record',
        name: 'SnowflakeRow',
        fields: [
          { name: 'dataJSON', type: 'string' },
          {
            name: 'recordedAt',
            type: { type: 'long', logicalType: 'timestamp-millis' },
          },
          { name: 'table', type: 'string' },
        ],
      }),
    });

    const kafkaClusterRoleBinding = new RoleBinding(
      this,
      'kafka-cluster-role-binding',
      {
        crnPattern: kafkaCluster.rbacCrn,
        roleName: 'CloudClusterAdmin',
        principal: `User:${serviceAccount.id}`,
      },
    );

    const kafkaClusterApiKey = new ApiKey(this, 'kafka-cluster-api-key', {
      owner: {
        id: serviceAccount.id,
        apiVersion: serviceAccount.apiVersion,
        kind: serviceAccount.kind,
      },
      managedResource: {
        id: kafkaCluster.id,
        apiVersion: kafkaCluster.apiVersion,
        kind: kafkaCluster.kind,
        environment,
      },
      dependsOn: [kafkaClusterRoleBinding],
    });
    kafkaClusterApiKey;

    new KafkaTopic(this, 'ITEM_SUBMISSION_EVENTS', {
      topicName: 'ITEM_SUBMISSION_EVENTS',
      kafkaCluster,
      restEndpoint: kafkaCluster.restEndpoint,
      partitionsCount: 200,
      credentials: {
        key: kafkaClusterApiKey.id,
        secret: kafkaClusterApiKey.secret,
      },
      lifecycle: {
        preventDestroy: true,
      },
    });

    new KafkaTopic(this, 'ITEM_SUBMISSION_EVENTS_RETRY_0', {
      topicName: 'ITEM_SUBMISSION_EVENTS_RETRY_0',
      kafkaCluster,
      restEndpoint: kafkaCluster.restEndpoint,
      partitionsCount: 200,
      credentials: {
        key: kafkaClusterApiKey.id,
        secret: kafkaClusterApiKey.secret,
      },
      lifecycle: {
        preventDestroy: true,
      },
    });

    new KafkaTopic(this, 'SNOWFLAKE_INGEST_EVENTS', {
      topicName: 'SNOWFLAKE_INGEST_EVENTS',
      kafkaCluster,
      restEndpoint: kafkaCluster.restEndpoint,
      partitionsCount: props.kafka.snowflakeIngestTopic.partitionCount,
      credentials: {
        key: kafkaClusterApiKey.id,
        secret: kafkaClusterApiKey.secret,
      },
      lifecycle: {
        preventDestroy: true,
      },
    });
  }
}
