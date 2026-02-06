#!/usr/bin/env node
import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';
import * as cdk from 'aws-cdk-lib';

import {
  AppPipelineStack,
  AppPipelineStackProps,
} from './stacks/app_pipeline.js';
import { GitHubActionsRunnerControllerStack } from './stacks/arc.js';
import { DevResourcesStack } from './stacks/dev.js';
import { PipelineNotificationsStack } from './stacks/pipeline_notifications.js';

type LinkerdTrustAnchorSigningPair = {
  cert: string;
  key: string;
};

export type EnvPreLoadedSecrets = {
  linkerdTrustAnchorSigningPair: LinkerdTrustAnchorSigningPair;
  githubActionsRunnerScaleSetSecret: string;
};

type PreLoadedSecrets = {
  Prod: EnvPreLoadedSecrets;
  Staging: EnvPreLoadedSecrets;
};

type PreLoadedSecretArns = {
  Prod: { [key in keyof EnvPreLoadedSecrets]: string };
  Staging: { [key in keyof EnvPreLoadedSecrets]: string };
};

async function getSecret(client: SecretsManagerClient, arn: string) {
  const command = new GetSecretValueCommand({
    SecretId: arn,
  });
  const response = await client.send(command);
  return response.SecretString!;
}

async function getSecretJson(client: SecretsManagerClient, arn: string) {
  const secret = await getSecret(client, arn);
  return JSON.parse(secret);
}

// Due to an inability to resolve Secret Construct values at runtime when
// applying kubernetes manifests and CDK's trouble with async code, we are
// fetching these values before the CDK app launches as suggested by this issue
// comment: https://github.com/aws/aws-cdk/issues/8273#issuecomment-637974897.
async function fetchSecrets(): Promise<PreLoadedSecrets> {
  // Disclaimer:
  // 1. This code is bad and I expect it to get trashed in code review but to be
  // honest I couldn't figure out how to iterate over the entries in this object
  // while achieving the type safety I wanted so I did it this way to unblock
  // myself and hopefully someone can help me figure out a better solution.

  // 2. Also here we are always fetching secrets for both envs which isn't ideal
  //    but is probably okay. There doesn't seem to be an easy way to determine
  //    the environment outside of the stack code unless we want to parse the
  //    stack name but that doesn't seem worth it.
  const client = new SecretsManagerClient({ region: 'us-east-2' });
  const config: PreLoadedSecretArns = {
    Prod: {
      linkerdTrustAnchorSigningPair:
        'arn:aws:secretsmanager:us-east-2:361188080279:secret:prod/linkerd/trust-anchor-bYSlNw',
      githubActionsRunnerScaleSetSecret:
        'arn:aws:secretsmanager:us-east-2:361188080279:secret:github/runner-vSayK5',
    },
    Staging: {
      linkerdTrustAnchorSigningPair:
        'arn:aws:secretsmanager:us-east-2:361188080279:secret:staging/linkerd/trust-anchor-aNa5LV',
      githubActionsRunnerScaleSetSecret:
        'arn:aws:secretsmanager:us-east-2:361188080279:secret:github/runner-vSayK5',
    },
  };

  return {
    Prod: {
      linkerdTrustAnchorSigningPair: await getSecretJson(
        client,
        config.Prod.linkerdTrustAnchorSigningPair,
      ),
      githubActionsRunnerScaleSetSecret: await getSecret(
        client,
        config.Prod.githubActionsRunnerScaleSetSecret,
      ),
    },
    Staging: {
      linkerdTrustAnchorSigningPair: await getSecretJson(
        client,
        config.Staging.linkerdTrustAnchorSigningPair,
      ),
      githubActionsRunnerScaleSetSecret: await getSecret(
        client,
        config.Staging.githubActionsRunnerScaleSetSecret,
      ),
    },
  };
}

async function main() {
  let preLoadedSecrets;
  try {
    preLoadedSecrets = await fetchSecrets();
  } catch (e) {
    console.log(e);
    console.log('Failed to fetch secrets. Exiting...');
    process.exit(1);
  }

  // For now, we're deploying everything -- the test, staging, and prod copies of
  // our main web app service, plus the resources that CDK itself needs [like an
  // ECR to hold our docker images, and code pipeline resources] -- to the same
  // "environment" (i.e., AWS account and region pair).
  const usaEast2Env = { account: '361188080279', region: 'us-east-2' };

  // The exception is resources for ML experiments, which are in a separate vpc in
  // us-east-1.
  const usaEast1Env = { account: '361188080279', region: 'us-east-1' };

  const app = new cdk.App();

  const arns: AppPipelineStackProps['arns'] = {
    githubConnection:
      'arn:aws:codestar-connections:us-east-2:361188080279:connection/dae8a93b-a690-4eeb-8464-74932b3ca612',
    dockerHubSecret:
      'arn:aws:secretsmanager:us-east-2:361188080279:secret:prod/Api/Docker-tBN9xY',
    // If/when renewing, see instructions here to generate:
    // https://docs.aws.amazon.com/memorydb/latest/devguide/accessing-memorydb.html#create-cert
    vpnServerCertificate:
      'arn:aws:acm:us-east-2:361188080279:certificate/be70898a-9c9f-4b1b-b511-d50b06c0667c',
    // NOT CURRENTLY USED. See Datadog stack.
    datadogSecret:
      'arn:aws:secretsmanager:us-east-2:361188080279:secret:datadog-api-key-Q82keP',
    bullmqSecret:
      'arn:aws:secretsmanager:us-east-2:361188080279:secret:npm-taskforcesh-token-SBzopm',
    npmCiTokenSecret:
      'arn:aws:secretsmanager:us-east-2:361188080279:secret:npm-ci-install-token-wq4LVq',
    Prod: {
      datadogRedisSecret:
        'arn:aws:secretsmanager:us-east-2:361188080279:secret:prod/api/datadog-redis-5MVpFr',
      datadogSnowflakeSecret:
        'arn:aws:secretsmanager:us-east-2:361188080279:secret:prod/api/datadog-snowflake-ChoHce',
      scyllaSecret:
        'arn:aws:secretsmanager:us-east-2:361188080279:secret:prod/Api/Scylla-Ff5SYT',
      snowflakeSecret:
        'arn:aws:secretsmanager:us-east-2:361188080279:secret:prod/Api/Snowflake-GSbYPm',
      sessionSecret:
        'arn:aws:secretsmanager:us-east-2:361188080279:secret:prod/Api/SessionSecret-pqjJMo',
      snowpipeQueue:
        'arn:aws:sqs:us-east-2:372912203759:sf-snowpipe-AIDAVNU2MU7XZEWHX4NYF-gDuL_ERzbUuPyF2CcnWj6A',
      kafkaSchemaRegistrySecret:
        'arn:aws:secretsmanager:us-east-2:361188080279:secret:prod/kafka/schema-registry-ngb9kf',
      kafkaApiServiceAccountSecret:
        'arn:aws:secretsmanager:us-east-2:361188080279:secret:prod/kafka/api-service-account-2Ir1Vc',
      kafkaSnowflakeWorkerServiceAccountSecret:
        'arn:aws:secretsmanager:us-east-2:361188080279:secret:prod/kafka/snowflake-ingest-worker-service-account-2ks9lG',
      redisSecret:
        'arn:aws:secretsmanager:us-east-2:361188080279:secret:prod/Api/Redis-5wOZWr',
      graphqlOpaqueScalarSecret:
        'arn:aws:secretsmanager:us-east-2:361188080279:secret:prod/Api/graphqlOpaqueScalar-aZLAKb',
    },
    Staging: {
      datadogRedisSecret:
        'arn:aws:secretsmanager:us-east-2:361188080279:secret:staging/api/datadog-redis-I4eNaY',
      datadogSnowflakeSecret:
        'arn:aws:secretsmanager:us-east-2:361188080279:secret:staging/api/datadog-snowflake-Ogmcmb',
      scyllaSecret:
        'arn:aws:secretsmanager:us-east-2:361188080279:secret:staging/Api/Scylla-8qB2b6',
      snowflakeSecret:
        'arn:aws:secretsmanager:us-east-2:361188080279:secret:staging/Api/Snowflake-NmQIg4',
      sessionSecret:
        'arn:aws:secretsmanager:us-east-2:361188080279:secret:staging/Api/SessionSecret-Hp8WsT',
      kafkaSchemaRegistrySecret:
        'arn:aws:secretsmanager:us-east-2:361188080279:secret:staging/kafka/schema-registry-tOpR2W',
      kafkaApiServiceAccountSecret:
        'arn:aws:secretsmanager:us-east-2:361188080279:secret:staging/kafka/api-service-account-LzIZdE',
      kafkaSnowflakeWorkerServiceAccountSecret:
        'arn:aws:secretsmanager:us-east-2:361188080279:secret:staging/kafka/snowflake-ingest-worker-service-account-a8CRYE',
      redisSecret:
        'arn:aws:secretsmanager:us-east-2:361188080279:secret:staging/Api/Redis-S4vd12',
      graphqlOpaqueScalarSecret:
        'arn:aws:secretsmanager:us-east-2:361188080279:secret:staging/Api/graphqlOpaqueScalar-8Ov3Hy',
      snowpipeQueue:
        'arn:aws:sqs:us-east-2:372912203759:sf-snowpipe-AIDAVNU2MU7XZEWHX4NYF-gDuL_ERzbUuPyF2CcnWj6A',
    },
    Demo: {
      datadogRedisSecret: '',
      datadogSnowflakeSecret: '',
      scyllaSecret: '',
      snowflakeSecret:
        'arn:aws:secretsmanager:us-east-2:361188080279:secret:Demo/Api/Snowflake-CUtb5a',
      sessionSecret:
        'arn:aws:secretsmanager:us-east-2:361188080279:secret:Demo/Api/SessionSecret-Vu2BpX',
      kafkaSchemaRegistrySecret: 'RESET_ON_CLUSTER_RECREATE',
      kafkaApiServiceAccountSecret: 'RESET_ON_CLUSTER_RECREATE',
      kafkaSnowflakeWorkerServiceAccountSecret: 'RESET_ON_CLUSTER_RECREATE',
      redisSecret:
        'arn:aws:secretsmanager:us-east-2:361188080279:secret:staging/Api/Redis-S4vd12',
      graphqlOpaqueScalarSecret: '',
    },
  };

  const { notificationsTarget } = new PipelineNotificationsStack(
    app,
    'PipelineNotificationsStack',
    { env: usaEast2Env },
  );

  new DevResourcesStack(app, 'DevResourcesStack', { env: usaEast1Env });

  const productionStack = new AppPipelineStack(app, 'PipelineStack', {
    env: usaEast2Env,
    pipelineNotificationTarget: notificationsTarget,
    deploymentEnvName: 'Prod',
    sourceBranchName: 'main',
    provisionProdLevelsOfCompute: true,
    arns,
    enableOpsGenie: true,
    deleteStatefulResources: false,
    enableDatadog: true,
    tracingSamplingPercentage: '0',
    preLoadedSecrets: preLoadedSecrets.Prod,
    // #ops-alerts
    alertsSlackChannelId: 'C03JWQ5N4S2',
    rolloutNotificationsSlackChannel: 'deployment-pipeline',
  });

  const stagingStack = new AppPipelineStack(app, 'StagingPipelineStack', {
    env: usaEast2Env,
    pipelineNotificationTarget: notificationsTarget,
    deploymentEnvName: 'Staging',
    sourceBranchName: 'staging',
    arns,
    enableOpsGenie: false,
    provisionProdLevelsOfCompute: false,
    deleteStatefulResources: true,
    enableDatadog: true,
    tracingSamplingPercentage: '100',
    preLoadedSecrets: preLoadedSecrets.Staging,
    // #staging-alerts
    alertsSlackChannelId: 'C06NGF21Y9W',
    rolloutNotificationsSlackChannel: 'staging-alerts',
  });

  new GitHubActionsRunnerControllerStack(
    app,
    'StagingGitHubActionsRunnerControllerStack',
    {
      env: usaEast2Env,
      coopEnv: 'Staging',
      vpcOutputs: stagingStack.deploymentEnv.vpcOutputs,
      k8sOutputs: stagingStack.deploymentEnv.k8sOutputs,
      githubAppPrivateKey:
        preLoadedSecrets.Staging.githubActionsRunnerScaleSetSecret,
    },
  );

  new GitHubActionsRunnerControllerStack(
    app,
    'ProdGitHubActionsRunnerControllerStack',
    {
      env: usaEast2Env,
      coopEnv: 'Prod',
      vpcOutputs: productionStack.deploymentEnv.vpcOutputs,
      k8sOutputs: productionStack.deploymentEnv.k8sOutputs,
      githubAppPrivateKey:
        preLoadedSecrets.Prod.githubActionsRunnerScaleSetSecret,
    },
  );
}

main();
