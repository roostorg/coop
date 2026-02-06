import path from 'path';
import match from '@ethanresnick/match';
import * as cdk from 'aws-cdk-lib';
import { RemovalPolicy, Stage, StageProps } from 'aws-cdk-lib';
import { Period } from 'aws-cdk-lib/aws-apigateway';
import { type INotificationRuleTarget } from 'aws-cdk-lib/aws-codestarnotifications';
import { Construct } from 'constructs';
import _ from 'lodash';

import controllers from '../../../../server/routes/index.js';
// Import the file below because the API server redefines some global types in
// this file and, since the CDK project imports code from the API server (e.g.,
// to extract route schemas to register with API gateway), the CDK project
// sometimes won't compile unless it's also compiled with these overriden types.
import '../../../../server/ts-reset.js';

import { type EnvPreLoadedSecrets } from '../app.js';
import { ClusterAttributes } from '../constructs/clusterFromAttributes.js';
import { type CoopApiGatewayProps } from '../constructs/CoopApiGateway.js';
import { ApiStack } from './api-service/api.js';
import { ApiDbClusterStack } from './api-service/db.js';
import { JobsAndWorkersStack } from './api-service/jobs_workers.js';
import { CloudfrontStack } from './cloudfront/cloudfront.js';
import { DatadogStack } from './datadog.js';
import { K8sClusterStack, type K8sOutputs } from './k8s_cluster.js';
import { MigrationStack } from './migrations.js';
import { ContentProxyStack } from './content-proxy.js';
import { RedirectStack } from './redirects.js';
import { TelemetryStack } from './telemetry.js';
import { VpcOutputs, VpcStack } from './vpc.js';

// Define DeploymentEnvironment type in terms of an array of all the legal
// values so that we can also enumerate the possibilities at runtime.
const deploymentEnvironments = ['Prod', 'Staging', 'Demo'] as const;
export type DeploymentEnvironmentName = (typeof deploymentEnvironments)[number];

export type AppPipelineStackProps = cdk.StackProps & {
  env: cdk.Environment;
  provisionProdLevelsOfCompute: boolean;
  pipelineNotificationTarget: INotificationRuleTarget;
  deploymentEnvName: DeploymentEnvironmentName;
  sourceBranchName: string;
  enableOpsGenie: boolean;
  deleteStatefulResources: boolean;
  enableDatadog: boolean;
  tracingSamplingPercentage: string;
  preLoadedSecrets: EnvPreLoadedSecrets;
  alertsSlackChannelId: string;
  rolloutNotificationsSlackChannel: string;
  arns: {
    dockerHubSecret: string;
    githubConnection: string;
    vpnServerCertificate: string;
    datadogSecret: string;
    bullmqSecret: string;
    npmCiTokenSecret: string;
  } & { [K in DeploymentEnvironmentName]: EnvSpecificArns };
};

type EnvSpecificArns = {
  snowflakeSecret: string;
  sessionSecret: string;
  redisSecret: string;
  kafkaSchemaRegistrySecret: string;
  kafkaApiServiceAccountSecret: string;
  kafkaSnowflakeWorkerServiceAccountSecret: string;
  snowpipeQueue?: string;
  datadogRedisSecret: string;
  datadogSnowflakeSecret: string;
  scyllaSecret: string;
  graphqlOpaqueScalarSecret: string;
};

type DeploymentEnvProps = StageProps & {
  env: Exclude<StageProps['env'], undefined>;
  routes: CoopApiGatewayProps['routes'];
  arns: EnvSpecificArns;
  globalArns: Omit<AppPipelineStackProps['arns'], DeploymentEnvironmentName>;
  enableOpsGenie: boolean;
  provisionProdLevelsOfCompute: boolean;
  deleteStatefulResources: boolean;
  enableDatadog: boolean;
  tracingSamplingPercentage: string;
  preLoadedSecrets: EnvPreLoadedSecrets;
  alertsSlackChannelId: string;
  rolloutNotificationsSlackChannel: string;
};
export class AppPipelineStack extends cdk.Stack {
  public readonly deploymentEnv: DeploymentEnv;

  constructor(scope: Construct, id: string, props: AppPipelineStackProps) {
    super(scope, id, props);

    const { deploymentEnvName, preLoadedSecrets } = props;

    const routes = Object.values(controllers).flatMap(
      ({ pathPrefix, routes }) =>
        routes.map((route) => ({
          ...route,
          path: path.join(pathPrefix, route.path),
        })),
    );

    const stage = new DeploymentEnv(this, props.deploymentEnvName, {
      env: props.env,
      routes,
      arns: props.arns[deploymentEnvName],
      provisionProdLevelsOfCompute: props.provisionProdLevelsOfCompute,
      globalArns: _.omit(props.arns, deploymentEnvironments),
      enableOpsGenie: props.enableOpsGenie,
      deleteStatefulResources: props.deleteStatefulResources,
      enableDatadog: props.enableDatadog,
      tracingSamplingPercentage: props.tracingSamplingPercentage,
      preLoadedSecrets,
      alertsSlackChannelId: props.alertsSlackChannelId,
      rolloutNotificationsSlackChannel: props.rolloutNotificationsSlackChannel,
    });

    this.deploymentEnv = stage;
  }
}

/**
 * A full description of one of our environments (e.g., test or prod),
 * with all the components declared inside a Stage, to make sure they are
 * deployed together, or not at all.
 */
class DeploymentEnv extends Stage {
  public readonly dbStack: ApiDbClusterStack;
  public readonly vpcOutputs: VpcOutputs;
  public readonly k8sOutputs: K8sOutputs;

  constructor(
    scope: Construct,
    id: DeploymentEnvironmentName,
    props: DeploymentEnvProps,
  ) {
    super(scope, id, props);
    const { provisionProdLevelsOfCompute, preLoadedSecrets } = props;
    // Originally, the idea was to define our prod vpc to create subnets in 3
    // AZs -- even though that's overkill for now, and adds a bit of cost --
    // because we might eventually want to run a service in the prod vpc that
    // should be replicated among 3 AZs, and that'd be impossible to do later
    // without deleting the whole VPC. (We can't just reserve IPs for subnets in
    // a 3rd AZ because CDK seems to require VPCs be setup symmetrically per
    // AZ.) However, the prod VPC accidentally got created with only 2 AZs, so
    // we're kinda stuck with that for now. If it becomes an issue, we can find
    // a workaround.
    const vpcStack = new VpcStack(this, 'Vpc', {
      numAZs: 2,
      stage: id,
    });

    const { vpc, outputs } = vpcStack;
    this.vpcOutputs = outputs;

    const telemetry = new TelemetryStack(this, 'Telemetry', {
      env: props.env,
      forwardToOpsGenie: props.enableOpsGenie,
      alertsSlackChannelId: props.alertsSlackChannelId,
    });
    const highUrgencyAlarmsTopicArn = telemetry.highUrgencyAlarmsTopic.topicArn;
    const lowUrgencyAlertsTopicArn = telemetry.lowUrgencyAlarmsTopic.topicArn;

    const subdomainName = match(
      ['Demo', () => 'demo'],
      ['Staging', () => 'staging'],
      ['Prod', () => undefined as string | undefined],
    )(id)!;

    const getCoopHostedZoneId = process.env.COOP_HOSTED_ZONE_ID;
    const getCoopDomainName = process.env.COOP_DOMAIN_NAME;

    const fullyQualifiedDomainName = subdomainName
      ? `${subdomainName}.${getCoopDomainName}`
      : getCoopDomainName;

    const clusterStack = new K8sClusterStack(this, 'K8sCluster', {
      env: props.env,
      terminationProtection: true,
      minNodes: props.provisionProdLevelsOfCompute ? 2 : 1,
      vpc,
      preLoadedSecrets,
      provisionProdLevelsOfCompute,
      deploymentEnvironmentName: id,
      domain: {
        subdomainName,
        zoneName: getCoopDomainName,
        hostedZoneId: getCoopHostedZoneId,
      },
    });

    // For creating an independent stand-in object for the cluster in other stacks,
    // so they don't inadvertently mutate the clusterStack's cluster.
    const clusterAttributes = {
      clusterName: clusterStack.cluster.clusterName,
      clusterEndpoint: clusterStack.cluster.clusterEndpoint,
      kubectlRoleArn: clusterStack.cluster.kubectlRole!.roleArn,
      kubectlLambdaRoleArn: clusterStack.cluster.kubectlLambdaRole!.roleArn,
      openIdConnectProviderArn:
        clusterStack.cluster.openIdConnectProvider.openIdConnectProviderArn,
      vpc: clusterStack.cluster.vpc,
      kubectlSecurityGroupId: clusterStack.cluster.clusterSecurityGroupId,
    } satisfies Partial<ClusterAttributes>;

    const migrationsImage = new MigrationStack(this, 'migrations', {
      synthesizer: new cdk.DefaultStackSynthesizer({
        dockerTagPrefix: `${id}-migrator`,
      }),
    }).image;

    this.dbStack = new ApiDbClusterStack(this, 'ApiDbCluster', {
      migrationsImage,
      numInstances: props.provisionProdLevelsOfCompute ? 3 : 1,
      vpc,
      stage: id,
      vpnCertificateArn: props.globalArns.vpnServerCertificate,
      highUrgencyAlarmsTopicArn,
      lowUrgencyAlertsTopicArn,
      provisionProdLevelsOfCompute,
      clusterSecurityGroup: clusterStack.cluster.clusterSecurityGroup,
      kubernetesClusterAttributes: clusterAttributes,
      scyllaSecretArn: props.arns.scyllaSecret,
      snowflakeSecretArn: props.arns.snowflakeSecret,
    });

    const rdsReadOnlyClusterHost = this.dbStack.rdsReadOnlyClusterHost;

    this.k8sOutputs = clusterStack.outputs;

    const kafkaHosts = {
      // TODO: wire this up more dynamically when we have IaC in place for Confluent.
      // NB: it's intentional that the same url is used for all environments, as the
      // staging and prod clusters we're using on Confluent Cloud both happen to be
      // exposed through the same frontend endpoint on our current plan.
      broker: 'pkc-ymrq7.us-east-2.aws.confluent.cloud:9092',
      schemaRegistry: 'https://psrc-68gz8.us-east-2.aws.confluent.cloud',
    };

    // Define all secrets here, using common env var names,
    // and then we can pick subsets to pass to each deployment w/i each stack.
    const { arns, globalArns } = props;
    const secrets = {
      SESSION_SECRET: [arns.sessionSecret],
      PERSPECTIVE_API_KEY: [
        'arn:aws:secretsmanager:us-east-2:361188080279:secret:prod/Api/PerspectiveApiKey-R5YxuN',
      ],
      GROQ_SECRET_KEY: [
        'arn:aws:secretsmanager:us-east-2:361188080279:secret:prod/Api/GroqSecretKey-CucLyH',
      ],
      SENDGRID_API_KEY: [
        'arn:aws:secretsmanager:us-east-2:361188080279:secret:sendgrid-api-key-YULdiW',
      ],
      GOOGLE_PLACES_API_KEY: [
        'arn:aws:secretsmanager:us-east-2:361188080279:secret:prod/Api/GooglePlaceApiKey-QhAxtj',
      ],
      READ_ME_JWT_SECRET: [
        'arn:aws:secretsmanager:us-east-2:361188080279:secret:prod/Api/ReadMeJWTSecret-jqSRIt',
      ],
      LAUNCHDARKLY_SECRET: [
        'arn:aws:secretsmanager:us-east-2:361188080279:secret:prod/Api/LaunchDarkly-nRspsT',
      ],
      OPEN_AI_API_KEY: [
        'arn:aws:secretsmanager:us-east-2:361188080279:secret:prod/Api/OpenaiEmbeddingsSecretKey-NDBtwj',
      ],
      REDIS_PASSWORD: [arns.redisSecret, 'password'],
      REDIS_HOST: [arns.redisSecret, 'host'],
      REDIS_USER: [arns.redisSecret, 'username'],
      REDIS_PORT: [arns.redisSecret, 'to_string(port)'],
      REDIS_USE_CLUSTER: [arns.redisSecret, 'cluster'],
      SCYLLA_PASSWORD: [arns.scyllaSecret, 'password'],
      SCYLLA_USERNAME: [arns.scyllaSecret, 'username'],
      SCYLLA_LOCAL_DATACENTER: [arns.scyllaSecret, 'localDataCenter'],
      SCYLLA_HOSTS: [arns.scyllaSecret, 'hosts'],
      DATABASE_HOST: [this.dbStack.rdsConnectionSecretArn, 'host'],
      DATABASE_PORT: [this.dbStack.rdsConnectionSecretArn, 'to_string(port)'],
      DATABASE_NAME: [this.dbStack.rdsConnectionSecretArn, 'dbname'],
      DATABASE_USER: [this.dbStack.rdsConnectionSecretArn, 'username'],
      DATABASE_PASSWORD: [this.dbStack.rdsConnectionSecretArn, 'password'],
      SNOWFLAKE_USERNAME: [arns.snowflakeSecret, 'username'],
      SNOWFLAKE_PASSWORD: [arns.snowflakeSecret, 'password'],
      SNOWFLAKE_DB_NAME: [arns.snowflakeSecret, 'database'],
      GOOGLE_TRANSLATE_API_KEY: [
        'arn:aws:secretsmanager:us-east-2:361188080279:secret:prod/Api/GoogleTranslateApiKey-MCdqWJ',
      ],
      GRAPHQL_OPAQUE_SCALAR_SECRET: [arns.graphqlOpaqueScalarSecret],
      KAFKA_API_SERVICE_ACCOUNT_USERNAME: [
        arns.kafkaApiServiceAccountSecret,
        'API_KEY',
      ],
      KAFKA_API_SERVICE_ACCOUNT_PASSWORD: [
        arns.kafkaApiServiceAccountSecret,
        'API_SECRET',
      ],
      KAFKA_SNOWFLAKE_INGEST_SERVICE_ACCOUNT_USERNAME: [
        arns.kafkaSnowflakeWorkerServiceAccountSecret,
        'API_KEY',
      ],
      KAFKA_SNOWFLAKE_INGEST_SERVICE_ACCOUNT_PASSWORD: [
        arns.kafkaSnowflakeWorkerServiceAccountSecret,
        'API_SECRET',
      ],
      KAFKA_SCHEMA_REGISTRY_USERNAME: [
        arns.kafkaSchemaRegistrySecret,
        'USERNAME',
      ],
      KAFKA_SCHEMA_REGISTRY_PASSWORD: [
        arns.kafkaSchemaRegistrySecret,
        'PASSWORD',
      ],
      SLACK_APP_BEARER_TOKEN: [
        'arn:aws:secretsmanager:us-east-2:361188080279:secret:prod/SlackService-UH2lqy',
        'bearer_token',
      ],
    } as const;

    // For now, only install the Datadog agent on the prod cluster,
    // which'll totally disable Datadog on staging + demo etc.
    // Until we actually use those environments for something useful
    // (like load testing), we don't want to waste money monitoring them.
    const ddStack = props.enableDatadog
      ? new DatadogStack(this, 'DatadogStack', {
          clusterAttributes,
          datadogApiSecret: globalArns.datadogSecret,
          stage: id,
          datadogRedisSecret: arns.datadogRedisSecret,
          datadogSnowflakeSecret: arns.datadogSnowflakeSecret,
          scyllaSecret: arns.scyllaSecret,
          monitorSnowflakeAccountUsage: id === 'Prod',
          tracingSamplingPercentage: props.tracingSamplingPercentage,
        })
      : undefined;

    const statefulResourceRemovalPolicy = props.deleteStatefulResources
      ? RemovalPolicy.DESTROY
      : RemovalPolicy.RETAIN;

    if (id === 'Prod') {
      new RedirectStack(this, 'RedirectsStack', {});
    }

    const uiUrl = `https://${fullyQualifiedDomainName}`;

    new ContentProxyStack(this, 'ContentProxyStack', {
      clusterAttributes,
      namespace: clusterStack.namespaceName,
      hostedZoneId: getCoopHostedZoneId,
      zoneName: getCoopDomainName,
      environment: id,
      subdomain: subdomainName,
    });


    // NB: do not rename this from 'BackendStack', as it was deployed previously
    // w/ that name, and changing it will break a bunch of stuff, per CDK's
    // normal issues with logical id changes.
    const apiStack = new ApiStack(this, 'BackendStack', {
      env: props?.env,
      namespaceName: clusterStack.namespaceName,
      clusterAttributes,
      enableDatadog: props.enableDatadog,
      stage: id,
      statefulResourceRemovalPolicy,
      secrets,
      // Needed to avoid occasional image tag conflicts between the api and
      // worker images. By default the image tag is based off the asset hash
      // which I'm guessing is the same between the two because they share the
      // same dockerfile and hence docker context. That being said, if that is
      // the case I'm not sure why the conflict isn't consistent.
      synthesizer: new cdk.DefaultStackSynthesizer({
        dockerTagPrefix: `${id}-api-`,
      }),
      rdsReadOnlyClusterHost,
      kafkaHosts,
      apiGateway: {
        apiName: `Coop ${id} API`,
        usagePlans: [
          {
            id: 'pilot-customer-plan',
            name: 'Pilot User Plan',
            description: 'This plan rate limits pilot customers',
            // These limits work for customers with ~500k requests/day (see
            // comment below re typical peak period multiples) _OR_ customers
            // that have ~1million reqs/day but that use a queue to slow down
            // their requests to us at peak times.
            throttle: { burstLimit: 144, rateLimit: 72 },
            quota: { limit: 2_500_000, period: Period.DAY },
          },
          {
            id: 'Medium-customer-plan',
            name: 'Medium User Plan',
            description:
              'This plan rate limits medium customers, on the order of 10M requests/day',
            // If a user averages 10m requests per day, they could very well
            // have peak hours with much more usage. Looking at our current
            // customers, e.g., we see 30s intervals in which they send 12x more
            // requests/s than their daily average (and 60s intervals where they
            // send 11x). So, we make this limit equivalent to 150m reqs/day.
            throttle: { rateLimit: 1750, burstLimit: 2625 },
            quota: { limit: 25_000_000, period: Period.DAY },
          },
          {
            id: 'Large-customer-plan',
            name: 'Large User Plan',
            description:
              'This plan rate limits large customers, on the order of 80M requests/day',
            // If a user averages 80m requests per day, they could very well
            // have peak hours with much more usage. Looking at our current
            // customers, e.g., we see 30s intervals in which they send 2x more
            // requests/s than their daily average (and 60s intervals where they
            // send 11x). So, we make this limit equivalent to 300m reqs/day.
            throttle: { rateLimit: 3500, burstLimit: 5000 },
            quota: { limit: 200_000_000, period: Period.DAY },
          },
        ],
        routes: props.routes,
      },
      monitoringAlertsTopicArn: highUrgencyAlarmsTopicArn,
      provisionProdLevelsOfCompute: props.provisionProdLevelsOfCompute,
      sendRolloutFailuresToOpsGenie: props.enableOpsGenie,
      rolloutNotificationsSlackChannel: props.rolloutNotificationsSlackChannel,
      uiUrl,
    });
    // The ApiStack contains k8s custom resources from datadog
    if (ddStack) {
      apiStack.addDependency(ddStack);
    }

    new CloudfrontStack(this, 'CloudfrontStack', {
      restApi: apiStack.coopApiGateway.restApi,
      stage: id,
      provisionProdLevelsOfCompute: props.provisionProdLevelsOfCompute,
      deleteStatefulResources: props.deleteStatefulResources,
      domain: {
        domainName: fullyQualifiedDomainName,
        hostedZoneId: getCoopHostedZoneId,
        certificateArn:
          'arn:aws:acm:us-east-1:361188080279:certificate/524cc562-011e-4470-84ac-e14563771e11',
      },
      vpc,
      otelCollectorUrl: clusterStack.otelCollectorUrl,
    });

    new JobsAndWorkersStack(this, 'WorkersStack', {
      env: props.env,
      stage: id,
      uiUrl,
      namespaceName: clusterStack.namespaceName,
      // Needed to avoid occasional image tag conflicts between the api and
      // worker images. By default the image tag is based off the asset hash
      // which I'm guessing is the same between the two because they share the
      // same dockerfile and hence docker context. That being said, if that is
      // the case I'm not sure why the conflict isn't consistent.
      synthesizer: new cdk.DefaultStackSynthesizer({
        dockerTagPrefix: `${id}-worker-`,
      }),
      clusterAttributes,
      secrets,
      kafkaHosts,
      snowpipeQueueArn: arns.snowpipeQueue,
      rdsReadOnlyClusterHost,
      statefulResourceRemovalPolicy,
      provisionProdLevelsOfCompute,
      enableDatadog: props.enableDatadog,
    });
  }
}
