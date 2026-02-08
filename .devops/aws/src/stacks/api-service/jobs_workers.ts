import { Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { DockerImageAsset, Platform } from 'aws-cdk-lib/aws-ecr-assets';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { App as Cdk8sApp } from 'cdk8s';
import { Construct } from 'constructs';
import _ from 'lodash';

import {
  KafkaSecretEnvVar,
  kafkaSecretEnvVars,
  makeKubectlVersionProps,
  PgEnvVar,
  pgEnvVars,
  RedisEnvVar,
  redisEnvVars,
  repoRootDir,
  ScyllaEnvVars,
  scyllaEnvVars,
  SnowflakeEnvVar,
  snowflakeEnvVars,
  topicSchemaIds,
} from '../../constants.js';
import {
  clusterFromAttributes,
  VersionAgnosticClusterAttributes,
} from '../../constructs/clusterFromAttributes.js';
import {
  KubernetesSecretsIntegration,
  SecretsMap,
} from '../../constructs/KubernetesSecretsIntegration.js';
import { CoopCronJob } from '../../constructs/CoopCronJob.js';
import { CoopWorkerDeployment } from '../../constructs/CoopWorkerDeployment.js';
import { Quantity } from '../../imports/k8s.js';
import { type DeploymentEnvironmentName } from '../app_pipeline.js';
import { deployedIntelNodeTypes } from '../k8s_cluster.js';

const { pick } = _;

type WorkersStackProps = StackProps & {
  namespaceName: string;
  uiUrl: string;
  clusterAttributes: VersionAgnosticClusterAttributes;
  secrets: SecretsMap<
    | PgEnvVar
    | RedisEnvVar
    | SnowflakeEnvVar
    | 'SENDGRID_API_KEY'
    | KafkaSecretEnvVar
    | ScyllaEnvVars
    | 'KAFKA_SNOWFLAKE_INGEST_SERVICE_ACCOUNT_USERNAME'
    | 'KAFKA_SNOWFLAKE_INGEST_SERVICE_ACCOUNT_PASSWORD'
    | 'KAFKA_API_SERVICE_ACCOUNT_USERNAME'
    | 'KAFKA_API_SERVICE_ACCOUNT_PASSWORD'
  >;
  stage: DeploymentEnvironmentName;
  provisionProdLevelsOfCompute: boolean;
  rdsReadOnlyClusterHost: string;
  snowpipeQueueArn?: string;
  bullmqTokenSecretArn?: string;
  kafkaHosts: {
    broker: string;
    schemaRegistry: string;
  };
  statefulResourceRemovalPolicy: RemovalPolicy;
  enableDatadog: boolean;
};

/**
 * A stack representing all background processes that are part of our API
 * service. We deploy these as k8s cron jobs or long-lived pods, as needed.
 */
export class JobsAndWorkersStack extends Stack {
  constructor(scope: Construct, id: string, props: WorkersStackProps) {
    const {
      clusterAttributes,
      stage,
      provisionProdLevelsOfCompute,
      namespaceName,
      secrets,
      snowpipeQueueArn,
      rdsReadOnlyClusterHost,
      kafkaHosts,
      statefulResourceRemovalPolicy,
      ...stackProps
    } = props;
    super(scope, id, stackProps);

    // Reference the existing backend cluster, which we've deployed separately.
    const cluster = clusterFromAttributes(this, 'Cluster', {
      ...clusterAttributes,
      ...makeKubectlVersionProps(this),
    });

    const workerPodImage = new DockerImageAsset(this, `worker-image`, {
      directory: repoRootDir,
      target: 'build_worker_runner',
      // The build args will always change, since BUILD_ID is based on the
      // commit id. But, if none of the other docker inputs changed (i.e., our
      // actual code files), there's no need to rebuild the image.
      invalidation: { buildArgs: false },
      buildArgs: {
        BUILD_ID: process.env.CODEBUILD_RESOLVED_SOURCE_VERSION ?? '',
        NPM_TOKEN: process.env.NPM_TOKEN ?? '',
      },
      platform: Platform.LINUX_AMD64,
    });

    // A service account to grant our workers access to the needed secrets and
    // to our s3 bucket for dumping tables to snowflake and to the SQS queue.
    // For now, we'll make one service account for all workers.
    const serviceAccount = cluster.addServiceAccount('WorkerServiceAccount', {
      namespace: namespaceName,
      name: 'worker-service-account',
    });

    // S3 Bucket used to store data that'll be ingested by snowflake.
    const snowflakeIngestBucket = new s3.Bucket(this, 'SnowflakeIngestBucket', {
      removalPolicy: statefulResourceRemovalPolicy,
      publicReadAccess: false,
      lifecycleRules: [
        {
          enabled: true,
          expiration: Duration.days(7),
        },
      ],
    });
    snowflakeIngestBucket.grantReadWrite(serviceAccount);

    // Also grant it permission to read secrets, because we need to read signing
    // keys in any workers that can (however indirectly) make a signed request
    // to our customers' endpoints (e.g. for partial items and actions).
    serviceAccount.addToPrincipalPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['secretsmanager:GetSecretValue'],
        resources: [
          `arn:aws:secretsmanager:${this.region}:${this.account}:secret:Prod/OrgSecrets/*`,
        ],
      }),
    );

    if (snowpipeQueueArn) {
      snowflakeIngestBucket.addEventNotification(
        s3.EventType.OBJECT_CREATED,
        new s3n.SqsDestination(
          Queue.fromQueueArn(this, 'SnowpipeQueue', snowpipeQueueArn),
        ),
      );
    }

    new CoopWorkerDeployment(new Cdk8sApp(), 'kafka-snowflake-worker', {
      workerName: 'SnowflakeIngestionToS3Worker',
      uiUrl: props.uiUrl,
      imageUrl: workerPodImage.imageUri,
      allowedNodeTypes: deployedIntelNodeTypes,
      namespace: namespaceName,
      resources: {
        requests: {
          cpu: Quantity.fromString('400m'),
          memory: Quantity.fromString('3Gi'),
        },
        limits: {
          cpu: Quantity.fromString('800m'),
          memory: Quantity.fromString('6Gi'),
        },
      },
      nodeJsMemoryOptions: {
        nodeExternalMemoryPercent: 0.33,
      },
      secretsHandler: new KubernetesSecretsIntegration(
        this,
        'KafkaSnowflakeWorkerSecrets',
        {
          serviceAccount,
          secrets: {
            ..._.pick(secrets, kafkaSecretEnvVars),
            KAFKA_BROKER_USERNAME:
              secrets.KAFKA_SNOWFLAKE_INGEST_SERVICE_ACCOUNT_USERNAME,
            KAFKA_BROKER_PASSWORD:
              secrets.KAFKA_SNOWFLAKE_INGEST_SERVICE_ACCOUNT_PASSWORD,
          },
        },
      ),
      // On staging, only run 1 replicas so that we can launch other replicas
      // locally for testing, and they'll actually get assigned to a partition.
      targetReplicas: props.provisionProdLevelsOfCompute ? 4 : 1,
      stage,
      env: {
        SNOWFLAKE_S3_BUCKET_NAME: snowflakeIngestBucket.bucketName,
        SNOWFLAKE_S3_BUCKET_REGION: this.region,
        KAFKA_BROKER_HOST: kafkaHosts.broker,
        KAFKA_SCHEMA_REGISTRY_HOST: kafkaHosts.schemaRegistry,
        ..._.mapValues(topicSchemaIds[stage], String),
      },
      dependencies: [workerPodImage, snowflakeIngestBucket],
    }).addToCluster(cluster);

    new CoopWorkerDeployment(new Cdk8sApp(), 'item-processing-worker', {
      workerName: 'ItemProcessingWorker',
      uiUrl: props.uiUrl,
      imageUrl: workerPodImage.imageUri,
      allowedNodeTypes: deployedIntelNodeTypes,
      namespace: namespaceName,
      resources: {
        requests: {
          cpu: Quantity.fromString('1000m'),
          memory: Quantity.fromString('4Gi'),
        },
        limits: {
          cpu: Quantity.fromString('1000m'),
          memory: Quantity.fromString('4Gi'),
        },
      },
      nodeJsMemoryOptions: {
        nodeExternalMemoryPercent: 0.33,
      },
      secretsHandler: new KubernetesSecretsIntegration(
        this,
        'ItemProcessingWorkerSecrets',
        {
          serviceAccount,
          secrets: {
            ..._.pick(secrets, [
              ...kafkaSecretEnvVars,
              ...scyllaEnvVars,
              ...pgEnvVars,
              ...redisEnvVars,
              'OPEN_AI_API_KEY',
            ]),
            KAFKA_BROKER_USERNAME: secrets.KAFKA_API_SERVICE_ACCOUNT_USERNAME,
            KAFKA_BROKER_PASSWORD: secrets.KAFKA_API_SERVICE_ACCOUNT_PASSWORD,
          },
        },
      ),
      targetReplicas: props.provisionProdLevelsOfCompute ? 10 : 1,
      stage,
      env: {
        KAFKA_BROKER_HOST: kafkaHosts.broker,
        KAFKA_SCHEMA_REGISTRY_HOST: kafkaHosts.schemaRegistry,
        DATABASE_READ_ONLY_HOST: rdsReadOnlyClusterHost,
        ..._.mapValues(topicSchemaIds[stage], String),
      },
      dependencies: [workerPodImage],
    }).addToCluster(cluster);

    // new CoopCronJob(new Cdk8sApp(), 'run-user-rules-job', {
    //   jobName: 'RunUserRulesJob',
    //   imageUrl: workerPodImage.imageUri,
    //   allowedNodeTypes: deployedIntelNodeTypes,
    //   namespace: namespaceName,
    //   concurrencyPolicy: 'Forbid',
    //   schedule: '*/5 * * * *' as any,
    //   resources: {
    //     requests: {
    //       cpu: Quantity.fromString('500m'),
    //       memory: Quantity.fromString('1Gi'),
    //     },
    //     limits: {
    //       cpu: Quantity.fromString('1'),
    //       memory: Quantity.fromString('1Gi'),
    //     },
    //   },
    //   secretsHandler: new KubernetesSecretsIntegration(
    //     this,
    //     'RunUserRulesJobSecrets',
    //     {
    //       serviceAccount,
    //       secrets: {
    //         ...omit(secrets, [
    //           'KAFKA_API_SERVICE_ACCOUNT_USERNAME',
    //           'KAFKA_API_SERVICE_ACCOUNT_PASSWORD',
    //         ]),
    //         KAFKA_BROKER_USERNAME: secrets.KAFKA_API_SERVICE_ACCOUNT_USERNAME,
    //         KAFKA_BROKER_PASSWORD: secrets.KAFKA_API_SERVICE_ACCOUNT_PASSWORD,
    //       },
    //     },
    //   ),
    //   stage,
    //   env: {
    //     DATABASE_READ_ONLY_HOST: rdsReadOnlyClusterHost,
    //     KAFKA_BROKER_HOST: kafkaHosts.broker,
    //     KAFKA_SCHEMA_REGISTRY_HOST: kafkaHosts.schemaRegistry,
    //     ..._.mapValues(topicSchemaIds[stage], String),
    //   },
    //   dependencies: [workerPodImage],
    // }).addToCluster(cluster);

    // new CoopCronJob(new Cdk8sApp(), 'refresh-user-scores-job', {
    //   jobName: 'RefreshUserScoresCacheJob',
    //   imageUrl: workerPodImage.imageUri,
    //   allowedNodeTypes: deployedIntelNodeTypes,
    //   namespace: namespaceName,
    //   concurrencyPolicy: 'Forbid',
    //   schedule: '*/5 * * * *' as any,
    //   secretsHandler: new KubernetesSecretsIntegration(
    //     this,
    //     'RefreshUserScoresCacheJobSecrets',
    //     { serviceAccount, secrets },
    //   ),
    //   stage,
    //   env: {
    //     DATABASE_READ_ONLY_HOST: rdsReadOnlyClusterHost,
    //     ..._.mapValues(topicSchemaIds[stage], String),
    //   },
    //   dependencies: [workerPodImage],
    //   resources: {
    //     requests: {
    //       cpu: Quantity.fromString('300m'),
    //       memory: Quantity.fromString('756Mi'),
    //     },
    //     limits: {
    //       cpu: Quantity.fromString('500m'),
    //       memory: Quantity.fromString('756Mi'),
    //     },
    //   },
    //   nodeJsMemoryOptions: {
    //     nodeExternalMemoryPercent: 0.03,
    //   },
    // }).addToCluster(cluster);

    new CoopCronJob(
      new Cdk8sApp(),
      'refresh-mrt-decisions-materialized-view-job',
      {
        jobName: 'RefreshMRTDecisionsMaterializedViewJob',
        uiUrl: props.uiUrl,
        imageUrl: workerPodImage.imageUri,
        allowedNodeTypes: deployedIntelNodeTypes,
        namespace: namespaceName,
        concurrencyPolicy: 'Forbid',
        schedule: '*/5 * * * *' as any,
        secretsHandler: new KubernetesSecretsIntegration(
          this,
          'RefreshMRTDecisionsMaterializedViewJobSecrets',
          { serviceAccount, secrets: pick(secrets, [...pgEnvVars]) },
        ),
        stage,
        env: {},
        dependencies: [workerPodImage],
        resources: {
          requests: {
            cpu: Quantity.fromString('50m'),
            memory: Quantity.fromString('756Mi'),
          },
          limits: {
            cpu: Quantity.fromString('100m'),
            memory: Quantity.fromString('756Mi'),
          },
        },
        nodeJsMemoryOptions: {
          nodeExternalMemoryPercent: 0.03,
        },
      },
    ).addToCluster(cluster);
    new CoopCronJob(new Cdk8sApp(), 'rule-pass-rate-anomaly-detection-job', {
      jobName: 'DetectRulePassRateAnomaliesJob',
      uiUrl: props.uiUrl,
      imageUrl: workerPodImage.imageUri,
      allowedNodeTypes: deployedIntelNodeTypes,
      namespace: namespaceName,
      concurrencyPolicy: 'Forbid',
      schedule: '0 * * * *',
      // This worker queries snowflake for rule pass rates, sets alarm status
      // in pg, and maybe sends emails when an alarm occurs, so it needs all those secrets.
      secretsHandler: new KubernetesSecretsIntegration(
        this,
        'DetectRulePassRateAnomaliesJobSecrets',
        {
          serviceAccount,
          secrets: pick(secrets, [
            ...pgEnvVars,
            ...snowflakeEnvVars,
            'SENDGRID_API_KEY',
          ]),
        },
      ),
      stage,
      env: {
        DATABASE_READ_ONLY_HOST: rdsReadOnlyClusterHost,
        ..._.mapValues(topicSchemaIds[stage], String),
      },
      dependencies: [workerPodImage],
      resources: {
        requests: {
          cpu: Quantity.fromString('500m'),
          memory: Quantity.fromString('1.5Gi'),
        },
        limits: {
          cpu: Quantity.fromString('800m'),
          memory: Quantity.fromString('2Gi'),
        },
      },
    }).addToCluster(cluster);

    new CoopCronJob(new Cdk8sApp(), 'retry-failed-ncmec-decisions-job', {
      jobName: 'RetryFailedNcmecDecisionsJob',
      uiUrl: props.uiUrl,
      imageUrl: workerPodImage.imageUri,
      allowedNodeTypes: deployedIntelNodeTypes,
      namespace: namespaceName,
      concurrencyPolicy: 'Forbid',
      // Once a day at midnight
      schedule: '30 20 * * *' as any,
      secretsHandler: new KubernetesSecretsIntegration(
        this,
        'RetryFailedNcmecDecisions',
        {
          serviceAccount,
          secrets: {
            ..._.pick(secrets, [
              ...kafkaSecretEnvVars,
              ...scyllaEnvVars,
              ...pgEnvVars,
              ...redisEnvVars,
              ...snowflakeEnvVars,
              'OPEN_AI_API_KEY',
            ]),
            KAFKA_BROKER_USERNAME: secrets.KAFKA_API_SERVICE_ACCOUNT_USERNAME,
            KAFKA_BROKER_PASSWORD: secrets.KAFKA_API_SERVICE_ACCOUNT_PASSWORD,
          },
        },
      ),
      stage,
      env: {
        DATABASE_READ_ONLY_HOST: rdsReadOnlyClusterHost,
        KAFKA_BROKER_HOST: kafkaHosts.broker,
        KAFKA_SCHEMA_REGISTRY_HOST: kafkaHosts.schemaRegistry,
        ..._.mapValues(topicSchemaIds[stage], String),
      },
      dependencies: [workerPodImage],
      resources: {
        requests: {
          cpu: Quantity.fromString('500m'),
          memory: Quantity.fromString('1.5Gi'),
        },
        limits: {
          cpu: Quantity.fromString('800m'),
          memory: Quantity.fromString('2Gi'),
        },
      },
      nodeJsMemoryOptions: {
        nodeExternalMemoryPercent: 0.03,
      },
    }).addToCluster(cluster);

    new CoopCronJob(new Cdk8sApp(), 'daily-usage-statistics-job', {
      jobName: 'DailyUsageStatisticsJob',
      uiUrl: props.uiUrl,
      imageUrl: workerPodImage.imageUri,
      allowedNodeTypes: deployedIntelNodeTypes,
      namespace: namespaceName,
      concurrencyPolicy: 'Forbid',
      schedule: '0 1 * * *' as any, // 1am UTC every day.
      secretsHandler: new KubernetesSecretsIntegration(
        this,
        'DailyUsageStatisticsJobSecrets',
        {
          serviceAccount,
          secrets: pick(secrets, [
            ...pgEnvVars,
            ...scyllaEnvVars,
            ...snowflakeEnvVars,
            ...redisEnvVars,
          ]),
        },
      ),
      stage,
      env: {
        DATABASE_READ_ONLY_HOST: rdsReadOnlyClusterHost,
      },
      dependencies: [workerPodImage],
      resources: {
        requests: {
          cpu: Quantity.fromString('50m'),
          memory: Quantity.fromString('756Mi'),
        },
        limits: {
          cpu: Quantity.fromString('100m'),
          memory: Quantity.fromString('756Mi'),
        },
      },
      nodeJsMemoryOptions: {
        nodeExternalMemoryPercent: 0.03,
      },
    }).addToCluster(cluster);
  }
}
