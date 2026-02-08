import path from 'path';
import { fileURLToPath } from 'url';
import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib';
import {
  ComparisonOperator,
  MathExpression,
  Metric,
  TreatMissingData,
} from 'aws-cdk-lib/aws-cloudwatch';
import { DockerImageAsset, Platform } from 'aws-cdk-lib/aws-ecr-assets';
import {
  ICluster,
  KubernetesManifest,
  KubernetesObjectValue,
} from 'aws-cdk-lib/aws-eks';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as targets from 'aws-cdk-lib/aws-elasticloadbalancingv2-targets';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Topic } from 'aws-cdk-lib/aws-sns';
import { Provider } from 'aws-cdk-lib/custom-resources';
import { App as Cdk8sApp, Chart } from 'cdk8s';
import { Construct } from 'constructs';
import _ from 'lodash';

import {
  KafkaSecretEnvVar,
  makeKubectlVersionProps,
  PgEnvVar,
  RedisEnvVar,
  repoRootDir,
  SnowflakeEnvVar,
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
import {
  CoopApiGateway,
  type CoopApiGatewayProps,
} from '../../constructs/CoopApiGateway.js';
import { withSnsNotifications } from '../../constructs/SnsAlarmStateChangeNotifications.js';
import {
  AnalysisTemplate,
  AnalysisTemplateSpecMetricsCount,
  AnalysisTemplateSpecMetricsFailureLimit,
  AnalysisTemplateSpecMetricsProviderCloudWatchMetricDataQueriesMetricStatPeriod,
  Rollout,
  RolloutSpecStrategyCanaryStepsPauseDuration,
  type AnalysisTemplateSpecMetricsProviderCloudWatchMetricDataQueriesMetricStatMetricDimensions,
  type RolloutSpecTemplateSpec,
} from '../../imports/argoproj.io.js';
import {
  IntOrString,
  KubeHorizontalPodAutoscalerV2,
  KubeIngress,
  KubeService,
  Quantity,
  type HttpIngressPath,
} from '../../imports/k8s.js';
import { NamespacedChartProps } from '../../types.js';
import {
  __throw,
  computeNodeMemoryOptions,
  getInstrumentationPodAnnotations,
  getNodeAffinityForInstanceTypes,
  getTracingEnvVars,
  toKubernetesName,
} from '../../utils.js';
import { type DeploymentEnvironmentName } from '../app_pipeline.js';

const { omit } = _;

type ApiStackProps = StackProps & {
  namespaceName: string; // where to put all the k8s resources.
  clusterAttributes: VersionAgnosticClusterAttributes;
  apiGateway: Omit<CoopApiGatewayProps, 'targetNlb'>;
  statefulResourceRemovalPolicy: cdk.RemovalPolicy;
  // the arns of all secrets that should be exposed to the api pods.
  secrets: SecretsMap<
    | 'SESSION_SECRET'
    | 'GROQ_SECRET_KEY'
    | 'SENDGRID_API_KEY'
    | 'GOOGLE_PLACES_API_KEY'
    | 'READ_ME_JWT_SECRET'
    | 'LAUNCHDARKLY_SECRET'
    | 'GOOGLE_TRANSLATE_API_KEY'
    | 'OPEN_AI_API_KEY'
    | 'GRAPHQL_OPAQUE_SCALAR_SECRET'
    | KafkaSecretEnvVar
    | 'KAFKA_API_SERVICE_ACCOUNT_USERNAME'
    | 'KAFKA_API_SERVICE_ACCOUNT_PASSWORD'
    | 'SLACK_APP_BEARER_TOKEN'
    | PgEnvVar
    | RedisEnvVar
    | SnowflakeEnvVar
  >;
  stage: DeploymentEnvironmentName;
  kafkaHosts: {
    broker: string;
    schemaRegistry: string;
  };
  rdsReadOnlyClusterHost: string;
  monitoringAlertsTopicArn: string;
  provisionProdLevelsOfCompute: boolean;
  sendRolloutFailuresToOpsGenie: boolean;
  rolloutNotificationsSlackChannel: string;
  enableDatadog: boolean;
  uiUrl: string;
};

type ApiDeploymentProps = NamespacedChartProps & {
  uiUrl: string;
  imageUrl: string;
  gitCommitSha: string;
  stage: DeploymentEnvironmentName;
  cluster: ICluster;
  stack: Stack;
  enableDatadog: boolean;
  secretsHandler: KubernetesSecretsIntegration;
  sendRolloutFailuresToOpsGenie: boolean;
  rolloutNotificationsSlackChannel: string;
  servicePort: number;
  apiGateway: {
    // map from the coop id for each plan (in CDK) to the plan's aws id
    usagePlans: { [coopPlanId: string]: string };
    routes: CoopApiGatewayProps['routes'];
  };
  rdsReadOnlyClusterHost: string;
  // This metric to autoscale on is only defined in environments where the
  // Datadog agents are installed.
  kafkaHosts: {
    broker: string;
    schemaRegistry: string;
  };
  provisionProdLevelsOfCompute: boolean;
};

/**
 * A stack representing the Kubernetes deployment for our API + all the
 * infrastructure for exposing it to the internet (API Gateway, load balancer).
 */
export class ApiStack extends Stack {
  public readonly coopApiGateway: CoopApiGateway;
  constructor(scope: Construct, id: string, props: ApiStackProps) {
    const {
      clusterAttributes,
      kafkaHosts,
      monitoringAlertsTopicArn,
      namespaceName,
      rdsReadOnlyClusterHost,
      secrets,
      stage,
      statefulResourceRemovalPolicy,
      ...stackProps
    } = props;

    super(scope, id, stackProps);

    // Reference the existing backend cluster, which we've deployed separately.
    // NB: do not rename this from 'BackendCluster', as it was deployed previously
    // w/ that name, and changing it will lead CDK to attempt to recreate the service
    // account below, which will fail because it already exists.
    const cluster = clusterFromAttributes(this, 'BackendCluster', {
      ...clusterAttributes,
      ...makeKubectlVersionProps(this),
    });

    const servicePort = 80;

    const serverPodImage = new DockerImageAsset(this, 'app-server-image', {
      directory: repoRootDir,
      target: 'build_server',
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

    // Will be used to inject credentials that allow our API pods to communicate
    // with AWS resources, like the S3 bucket that will hold user uploads and
    // be able to add new API keys when users sign up.
    // TODO: create separate service accounts by deployment
    const serviceAccount = cluster.addServiceAccount('ApiServiceAccount', {
      namespace: namespaceName,
      name: 'api-service-account',
    });

    // Our traffic routing looks like this:
    //
    // Internet -> Api Gateway -> NLB -> ALB -> Server pods.
    //
    // The Api Gateway and the NLB are created below with CDK constructs, while
    // the ALB is created by an Ingress resource that's part of the API Server's
    // deployment, using hte ALB Controller installed in our k8s cluster.
    //
    // The reason for this indirection is:
    //
    // 1. We need API Gateway to hit some load balancer (so that it sends
    //    traffic evenly to all the pods in our API service) and we need that
    //    load balancer to be inaccessible from the internet (so that people
    //    can't hit it directly and bypass API Gateway's rate limiting + auth).
    //    To make the load balancer inaccessible, it has to be in a private
    //    subnet of our VPC, and then we have to use a VPC PrivateLink to allow
    //    API Gateway to call it. However, AWS only allows API Gateway to talk
    //    to an NLB -- not an ALB -- through a VPC PrivateLink. So, this first
    //    load balancer is an NLB.
    //
    // 2. With an NLB, which load balances TCP connections rather than HTTP
    //    requests, we weren't getting an even enough traffic distribution to
    //    our pods, which was causing occasional crashes and preventing efficent
    //    resource utilization. So, we needed to put an ALB in front of the
    //    pods. Also, this ALB is needed for Argo Rollouts (which manages the
    //    ALB's traffic weighing config) in order to support canary deployments.
    //
    // Finally, the reason the ALB is created by an ingress (rather than using
    // a CDK construct directly) is because Argo Rollouts requires the Ingress
    // to manipulate the underlying ALB. Using an Ingress to create the ALB did
    // cause some CDK interop issues, though; see below.
    const nlb = new elbv2.NetworkLoadBalancer(this, 'ApiNlb', {
      vpc: cluster.vpc,
      internetFacing: false,
    });

    const nlbTargetPort = 1024;

    const gateway = new CoopApiGateway(this, 'ApiGateway', {
      ...props.apiGateway,
      targetNlb: { loadBalancer: nlb, targetPort: nlbTargetPort },
    });

    this.coopApiGateway = gateway;

    // Set up the X-Ray exporter, which will poll AWS X-Ray for traces and ship
    // them to the OTel collector.
    const xrayExporterServiceAccount = cluster.addServiceAccount(
      'xray-exporter',
      {
        name: 'awsxray-exporter',
        namespace: 'awsxray-exporter',
      },
    );

    xrayExporterServiceAccount.addToPrincipalPolicy(
      new iam.PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['xray:GetTraceSummaries', 'xray:BatchGetTraces'],
        resources: ['*'],
      }),
    );

    cluster.addHelmChart('awsxray-exporter', {
      release: 'awsxray-exporter',
      repository: 'https://jholm117.github.io/awsxray-exporter',
      chart: 'awsxray-exporter',
      version: '0.1.3',
      namespace: 'awsxray-exporter',
      createNamespace: true,
      values: {
        otelCollector: {
          hostname: 'default-collector.opentelemetry',
        },
        filterExpression: `annotation[aws:api_id] = "${gateway.restApi.restApiId}"`,
        serviceAccount: {
          create: false,
          name: xrayExporterServiceAccount.serviceAccountName,
        },
        image: {
          repository:
            '361188080279.dkr.ecr.us-east-2.amazonaws.com/ghcr/jholm117/awsxray-exporter',
          tag: '0.1.3',
        },
        awsRegion: this.region,
      },
    });

    // Set up some alarms.
    const monitoringAlertsTopic = Topic.fromTopicArn(
      this,
      'MonitoringAlertsTopic',
      monitoringAlertsTopicArn,
    );

    // TODO: this if condition is very hacky, but we need to set different metrics
    // per env before we can do this properly.
    if (stage === 'Prod') {
      gateway.restApi.methods.forEach((method) => {
        // Similarly, alert if 500s are too high.
        withSnsNotifications(
          new MathExpression({
            expression: 'm1/m2',
            usingMetrics: {
              m1: new Metric({
                namespace: 'AWS/ApiGateway',
                metricName: '5XXError',
                dimensionsMap: {
                  ApiName: gateway.restApi.restApiName,
                  Resource: method.resource.path,
                  Method: method.httpMethod,
                  Stage: gateway.restApi.deploymentStage.stageName,
                },
                statistic: 'sum',
                period: Duration.minutes(2),
              }),
              m2: new Metric({
                namespace: 'AWS/ApiGateway',
                metricName: 'Count',
                dimensionsMap: {
                  ApiName: gateway.restApi.restApiName,
                  Resource: method.resource.path,
                  Method: method.httpMethod,
                  Stage: gateway.restApi.deploymentStage.stageName,
                },
                statistic: 'sum',
                period: Duration.minutes(2),
              }),
            },
          }).createAlarm(
            this,
            `${method.httpMethod}-${method.resource.path}-ApiHigh5xxErrors`,
            {
              comparisonOperator:
                ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
              threshold: 0.01,
              evaluationPeriods: 3,
              datapointsToAlarm: 2,
              treatMissingData: TreatMissingData.NOT_BREACHING,
            },
          ),
          monitoringAlertsTopic,
        );
      });
    }
    // Allow our API pods to add new API keys (and associate them w/ the api's
    // usage plans, whose AWS ids we'll expose to the pods through ENV vars).
    // Available resources reference: https://docs.aws.amazon.com/service-authorization/latest/reference/list_amazonapigatewaymanagement.html
    // Some examples, with action names: https://docs.aws.amazon.com/apigateway/latest/developerguide/security_iam_id-based-policy-examples.html
    serviceAccount.addToPrincipalPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['apigateway:POST', 'apigateway:GET'],
        resources: [
          `arn:aws:apigateway:${this.region}::/apikeys`,
          ...Object.values(gateway.apiUsagePlanIds).map(
            (id) => `arn:aws:apigateway:${this.region}::/usageplans/${id}/keys`,
          ),
        ],
      }),
    );

    // Allow our API server to create and read secrets to/from Secrets Manager
    // so we can sign requests with customers' webhook signing secret
    serviceAccount.addToPrincipalPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          'secretsmanager:GetSecretValue',
          'secretsmanager:DescribeSecret',
          'secretsmanager:CreateSecret',
          'secretsmanager:DeleteSecret',
        ],
        resources: ['arn:aws:secretsmanager:*:*:*'],
      }),
    );

    // Allow our API server to call Rekognition APIs for some of our internal
    // signals
    serviceAccount.addToPrincipalPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['rekognition:*'],
        resources: ['*'],
      }),
    );

    // Grant our API service account full SageMaker access. We previously tried
    // to grant the AmazonSageMakerFullAccess managed policy to the service account
    // with the following:
    //
    // serviceAccount.role.addManagedPolicy(
    //  iam.ManagedPolicy.fromManagedPolicyArn(
    //    this,
    //    'AmazonSageMakerFullAccessPermission',
    //    'arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole',
    //  ),
    // );
    //
    // But that didn't work, so now we're explicitly listing the permissions required,
    // starting with the sagemaker:InvokeEndpoint permission. If/when we do additional
    // SageMaker operations (like training models) from our API server, we'll have to
    // add the relevant permissions here.
    serviceAccount.addToPrincipalPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['sagemaker:InvokeEndpoint'],
        // See https://docs.aws.amazon.com/sagemaker/latest/dg/api-permissions-reference.html
        resources: ['arn:aws:sagemaker:*:*:endpoint/*'],
      }),
    );

    // S3 Bucket used to store user data uploaded during manual onboarding
    // for the models service
    // TODO(maxdumas): Delete/reconsider this bucket once we have a production
    // way of onboarding customers.
    const modelsServiceManualOnboardingCustomerDataBucket = new s3.Bucket(
      this,
      'ModelsServiceManualOnboardingCustomerDataBucket',
      {
        removalPolicy: statefulResourceRemovalPolicy,
        publicReadAccess: false,
        lifecycleRules: [
          {
            enabled: true,
            expiration: Duration.days(15),
          },
        ],
      },
    );
    modelsServiceManualOnboardingCustomerDataBucket.grantRead(serviceAccount);
    const cdk8sApp = new Cdk8sApp();
    const apiDeployment = new ApiAutoscaledServiceDeployment(cdk8sApp, 'api', {
      namespace: namespaceName,
      imageUrl: serverPodImage.imageUri,
      apiGateway: {
        usagePlans: gateway.apiUsagePlanIds,
        routes: props.apiGateway.routes,
      },
      rdsReadOnlyClusterHost,
      enableDatadog: props.enableDatadog,
      stack: this,
      stage,
      kafkaHosts,
      cluster,
      gitCommitSha:
        process.env.CODEBUILD_RESOLVED_SOURCE_VERSION ?? 'undefined',
      servicePort,
      secretsHandler: new KubernetesSecretsIntegration(this, 'ApiSecrets', {
        serviceAccount,
        secrets: {
          ...omit(secrets, [
            'KAFKA_API_SERVICE_ACCOUNT_USERNAME',
            'KAFKA_API_SERVICE_ACCOUNT_PASSWORD',
          ]),
          KAFKA_BROKER_USERNAME: secrets.KAFKA_API_SERVICE_ACCOUNT_USERNAME,
          KAFKA_BROKER_PASSWORD: secrets.KAFKA_API_SERVICE_ACCOUNT_PASSWORD,
        },
      }),
      provisionProdLevelsOfCompute: props.provisionProdLevelsOfCompute,
      rolloutNotificationsSlackChannel: props.rolloutNotificationsSlackChannel,
      sendRolloutFailuresToOpsGenie: props.sendRolloutFailuresToOpsGenie,
      uiUrl: props.uiUrl,
    });

    const apiManifest = cluster.addCdk8sChart('api', apiDeployment);
    apiManifest.node.addDependency(serverPodImage);
    apiManifest.node.addDependency(serviceAccount);

    const kubeIngressHostname = new KubernetesObjectValue(
      this,
      'ingressObject',
      {
        cluster,
        objectType: 'ingress',
        objectNamespace: namespaceName,
        objectName: apiDeployment.ingress.name,
        jsonPath: '.status.loadBalancer.ingress[0].hostname',
      },
    );
    kubeIngressHostname.node.addDependency(apiManifest);

    const elbv2DescribeLoadBalancers = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['elasticloadbalancing:DescribeLoadBalancers'],
      resources: ['*'], // Adjust this to specify specific load balancer ARNs if needed
    });

    // As mentioned above, we need to create an Ignress and have that create the
    // ALB for Argo Rollouts to work. However, when we have the Ingress/ALB
    // Controller create the ALB, we still have to get its ARN somehow, in order
    // for the NLB to use it as a target. The issue is that, with an Ingress,
    // the ALB won't exist at CDK synth time (at least on the first deploy), so
    // we have to do these crazy custom resource contortions to fetch its ARN.
    const applicationLoadBalancerCustomResource = new cdk.CustomResource(
      this,
      'LoadBalancerLookup',
      {
        serviceToken: new Provider(this, 'LoadBalancerLookupProvider', {
          onEventHandler: new NodejsFunction(this, 'LoadBalancerLookupLambda', {
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: 'handler',
            logRetention: cdk.aws_logs.RetentionDays.ONE_DAY,
            initialPolicy: [elbv2DescribeLoadBalancers],
            entry: path.join(
              path.dirname(fileURLToPath(import.meta.url)),
              './lambda/loadBalancerLookupOnEvent.ts',
            ),
          }),
          isCompleteHandler: new NodejsFunction(
            this,
            'LoadBalancerIsComplete',
            {
              runtime: lambda.Runtime.NODEJS_18_X,
              handler: 'handler',
              logRetention: cdk.aws_logs.RetentionDays.ONE_DAY,
              initialPolicy: [elbv2DescribeLoadBalancers],
              entry: path.join(
                path.dirname(fileURLToPath(import.meta.url)),
                './lambda/loadBalancerLookUpIsComplete.ts',
              ),
            },
          ),
          totalTimeout: Duration.minutes(5),
          logRetention: cdk.aws_logs.RetentionDays.ONE_DAY,
        }).serviceToken,
        properties: {
          hostname: kubeIngressHostname.value,
          region: this.region,
          // increment this every time we change the lambda code so that cdk
          // knows it needs to dispatch an update event to the lambda
          codeVersion: 1,
        },
      },
    );

    const applicationLoadBalancerArn =
      applicationLoadBalancerCustomResource.getAttString('LoadBalancerArn');
    const applicationLoadBalancerName =
      applicationLoadBalancerCustomResource.getAttString('LoadBalancerName');

    nlb.addListener('AlbListener', {
      defaultTargetGroups: [
        new elbv2.NetworkTargetGroup(this, 'ApiNlbToAlbTargetGroup', {
          port: 80,
          targets: [new targets.AlbArnTarget(applicationLoadBalancerArn, 80)],
          vpc: cluster.vpc,
          healthCheck: {
            path: ApiAutoscaledServiceDeployment.albHealthCheckPath,
          },
        }),
      ],
      port: nlbTargetPort,
    });

    // Initially I put this logic in the AdditionalApiResources chart, but that did
    // not allow me to add an explicit dependency between the LoadBalancerLookup
    // Lambda and these lambdas so I moved it up to this level. This is
    // neceessary because we need to make sure the loadbalancer is created
    // before we try to fetch the target groups otherwise we will timeout.
    const servicesWithTargetGroupNames = apiDeployment.services.map(
      (service) => {
        const { serviceName, canaryServiceName } = service;
        const tagGetResourcesPolicy = new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['tag:GetResources'],
          resources: ['*'],
        });

        const targetGroupLookupResource = new cdk.CustomResource(
          this,
          `${serviceName}-TargetGroupLookup`,
          {
            serviceToken: new Provider(
              this,
              `${serviceName}-TargetGroupLookupProvider`,
              {
                onEventHandler: new NodejsFunction(
                  this,
                  `${serviceName}-TargetGroupLookupLambda`,
                  {
                    runtime: lambda.Runtime.NODEJS_18_X,
                    handler: 'handler',
                    logRetention: cdk.aws_logs.RetentionDays.ONE_DAY,
                    initialPolicy: [tagGetResourcesPolicy],
                    timeout: cdk.Duration.minutes(2),
                    entry: path.join(
                      path.dirname(fileURLToPath(import.meta.url)),
                      './lambda/targetGroupLookupOnEvent.ts',
                    ),
                  },
                ),
                logRetention: cdk.aws_logs.RetentionDays.ONE_DAY,
              },
            ).serviceToken,
            properties: {
              ingressName: apiDeployment.ingress.name,
              clusterName: cluster.clusterName,
              namespaceName,
              serviceName,
              canaryServiceName,
              servicePort,
              region: this.region,
            },
          },
        );
        targetGroupLookupResource.node.addDependency(
          applicationLoadBalancerCustomResource,
        );
        const baselineTargetGroupName =
          targetGroupLookupResource.getAttString('TargetGroupName');
        const canaryTargetGroupName = targetGroupLookupResource.getAttString(
          'CanaryTargetGroupName',
        );
        return {
          ...service,
          baselineTargetGroupName,
          canaryTargetGroupName,
        };
      },
    );

    const apiAdditionalResources = new ApiAdditionalResources(
      cdk8sApp,
      'api-additional-resources',
      {
        namespaceName,
        cluster,
        ingressName: apiDeployment.ingress.name,
        stack: this,
        servicesWithTargetGroupNames,
        applicationLoadBalancerName,
      },
    );
    const additionalResourcesManifest = cluster.addCdk8sChart(
      'api-additional-resources',
      apiAdditionalResources,
    );
    additionalResourcesManifest.node.addDependency(apiManifest);

    // There is a circular dependency between Rollout > AnalysisTemplate >
    // TargetGroup > Rollout. So we initially create the Rollout without the
    // analysis template to allow the target group to initialize before trying
    // to create the analysis template, and then patch the Rollout to add the
    // reference to the analysis template.
    apiDeployment.services.forEach((service) => {
      const json = service.rollout.toJson();
      json.spec.strategy.canary.steps.push({
        analysis: {
          templates: [
            {
              templateName: service.analysisTemplateName,
            },
          ],
        },
      });
      const manifest = new KubernetesManifest(
        this,
        `${service.rollout.name}-with-analysis`,
        {
          cluster,
          manifest: [json],
          overwrite: true,
        },
      );
      manifest.node.addDependency(additionalResourcesManifest);
    });
  }
}

class ApiAutoscaledServiceDeployment extends Chart {
  public readonly ingress: KubeIngress;
  public static readonly albHealthCheckPath = '/api/v1/ready';
  public readonly services: Service[];

  public constructor(scope: Construct, id: string, props: ApiDeploymentProps) {
    const {
      imageUrl,
      secretsHandler,
      stage,
      servicePort,
      ...chartProps
    } = props;

    super(scope, id, chartProps);

    const routes = [...props.apiGateway.routes, { path: '/graphql' }];
    const resourcesByRoute = {
      '/items/async/': {
        minReplicas: 2,
        useEventLoopDelayForAutoscaling: false,
        memoryRequest: '4Gi',
        memoryLimit: '4Gi',
        cpuRequest: '2',
        cpuLimit: '3',
        youngGenerationSemiSpaceSize: Quantity.fromString('256Mi'),
      },
      // This endpoint's pods gets fewer resources than `/items/async`'s, even
      // though the logic they're running is similar, because the load they're
      // under is so much smaller. I.e., we have about 100x more items coming to
      // `POST /items/async`, but it only has about 5x the number of replicas,
      // because of the `minReplicas: 3` for all endpoints. So, the /content
      // pods can be much smaller.
      '/content/': {
        minReplicas: 2,
        useEventLoopDelayForAutoscaling: false,
        memoryRequest: '2Gi',
        memoryLimit: '2Gi',
        cpuRequest: '1',
        cpuLimit: '1',
        youngGenerationSemiSpaceSize: undefined,
      },
      // We copy the /items/async/ resources because it accepts the same batch
      // size of items but the processing is different enough that we may want
      // to customize this in the future.
      '/items/scores/': {
        minReplicas: 1,
        useEventLoopDelayForAutoscaling: false,
        memoryRequest: '2Gi',
        memoryLimit: '2Gi',
        cpuRequest: '1',
        cpuLimit: '1',
        youngGenerationSemiSpaceSize: undefined,
      },
      // This endpoint isn't in use, so it can have very small resource limits.
      // We probably don't need this much memory but we can't make the memory
      // request any smaller, because the `computeNodeMemoryOptions` function,
      // which we use to divide up the memory request between different types of
      // memory, reserves a large, fixed chunk of memory for non-JS-objects
      // allocated by v8; see comment in that function.
      '/policies/': {
        minReplicas: 1,
        useEventLoopDelayForAutoscaling: false,
        memoryRequest: '768Mi',
        memoryLimit: '768Mi',
        cpuRequest: '.2',
        cpuLimit: '.2',
        youngGenerationSemiSpaceSize: undefined,
      },
      '/gdpr/delete/': {
        minReplicas: 1,
        useEventLoopDelayForAutoscaling: false,
        memoryRequest: '768Mi',
        memoryLimit: '768Mi',
        cpuRequest: '.2',
        cpuLimit: '.2',
        youngGenerationSemiSpaceSize: undefined,
      },
      '/user_scores/': {
        minReplicas: 1,
        useEventLoopDelayForAutoscaling: false,
        memoryRequest: '768Mi',
        memoryLimit: '768Mi',
        cpuRequest: '.2',
        cpuLimit: '.2',
        youngGenerationSemiSpaceSize: undefined,
      },
      '/graphql': {
        minReplicas: 2,
        useEventLoopDelayForAutoscaling: false,
        memoryRequest: '1.5Gi',
        memoryLimit: '1.5Gi',
        cpuRequest: '.3',
        cpuLimit: '.3',
        youngGenerationSemiSpaceSize: undefined,
      },
      '/report/': {
        minReplicas: 1,
        useEventLoopDelayForAutoscaling: false,
        memoryRequest: '1.5Gi',
        memoryLimit: '1.5Gi',
        cpuRequest: '.3',
        cpuLimit: '.3',
        youngGenerationSemiSpaceSize: undefined,
      },
      '/report/appeal': {
        minReplicas: 1,
        useEventLoopDelayForAutoscaling: false,
        memoryRequest: '1.5Gi',
        memoryLimit: '1.5Gi',
        cpuRequest: '.3',
        cpuLimit: '.3',
        youngGenerationSemiSpaceSize: undefined,
      },
      '/actions/': {
        minReplicas: 1,
        useEventLoopDelayForAutoscaling: false,
        memoryRequest: '768Mi',
        memoryLimit: '768Mi',
        cpuRequest: '.2',
        cpuLimit: '.2',
        youngGenerationSemiSpaceSize: undefined,
      },
    } satisfies Record<
      string,
      {
        minReplicas: number;
        useEventLoopDelayForAutoscaling: boolean;
        memoryRequest: string;
        memoryLimit: string;
        cpuRequest: string;
        // We want a limit to simplify load testing.
        // See https://stackoverflow.com/a/74429536/1261879
        cpuLimit: string;
        // undefined = use default computed by `computeNodeMemoryOptions`,
        // which is generally a good value.
        youngGenerationSemiSpaceSize: Quantity | undefined;
      }
    >;

    const ingressName = 'api-service-ingress';

    const deployments = routes.map((route) => {
      const serviceName = `${toKubernetesName(route.path)}-service`;

      const containerPort = 8080;

      const label = { app: serviceName };
      const resources =
        resourcesByRoute[route.path as keyof typeof resourcesByRoute] ??
        __throw(new Error('Resources not defined for route: ' + route.path));

      const {
        memoryRequest,
        memoryLimit,
        cpuLimit,
        cpuRequest,
        youngGenerationSemiSpaceSize,
      } = resources;

      new KubeService(this, `${serviceName}-service`, {
        metadata: {
          name: serviceName,
          labels: label,
        },
        spec: {
          type: 'ClusterIP',
          selector: label,
          ports: [
            {
              port: servicePort,
              targetPort: IntOrString.fromNumber(containerPort),
              protocol: 'TCP',
            },
          ],
        },
      });

      const canaryServiceName = `${serviceName}-canary`;
      // Canary for Argo Rollouts
      new KubeService(this, canaryServiceName, {
        metadata: {
          name: canaryServiceName,
          labels: label,
        },
        spec: {
          type: 'ClusterIP',
          selector: label,
          ports: [
            {
              port: servicePort,
              targetPort: IntOrString.fromNumber(containerPort),
              protocol: 'TCP',
            },
          ],
        },
      });

      // Below, we define a custom DatadogMetric resource for autoscaling our API
      // server based on DD-captured event loop delay. See rationale below.
      //
      // (If we didn't already have DD in place, we'd probably scale on ELU using
      // https://www.nearform.com/blog/event-loop-utilization-with-hpa/ or
      // similar, but DD's event loop delay metric is similar enough.)
      //
      // "Event loop delay" is a measure of the time spent running JS callback
      // code within a single tick of the event loop. These callbacks include
      // promise/microtask callbacks, timer callbacks, event callbacks (e.g., on
      // incoming request), etc. The name "event loop delay" refers to the fact
      // that the the event loop can't restart from the top until these callbacks
      // have finished, so their run time delays the handling of new timer, io,
      // and other events, which won't be checked for again until the next tick.
      // Note that garbage collection time should mostly be excluded from event
      // loop delay, except, perhaps, for the brief periods when GC must pause the
      // main thread (during which GC work uses multiple cores, at least).
      //
      // Event loop delay is not a totally standard term, and DD's docs are
      // sparse, but the source code is here:
      // https://github.com/DataDog/dd-native-metrics-js/blob/d4c060425f3f0a39fe728fc5b11cef373884a1d2/src/metrics/EventLoop.hpp#L84.
      // For general background on the event loop, which explains how to read that
      // code, see https://blog.logrocket.com/complete-guide-node-js-event-loop/.
      //
      // We assume that our JS code for processing each event doesn't block for a
      // meaningful period of time so, when event loop delay is high, it's because
      // there were _many event callbacks_ that were ready run on that tick of the
      // event loop. This happens when callbacks are getting enqueued faster than
      // the server can process them. If event loop delay remains high for more
      // than a brief period of time, it's a very clear sign that we need to scale
      // up: the server was, and likely still is, getting inundandated with work
      // faster than it can handle it, and will soon be at risk of a crash.
      //
      // Concretely, when the server is not overloaded, a healthy event loop delay
      // is measured in nanoseconds or, if the server has to do some big, blocking
      // operation (e.g., parsing a large JSON blob), it might be a couple hundred
      // microseconds. However, if a backlog of callbacks builds up, a single tick
      // of the event loop could spend _miliseconds_ running them -- a
      // 1,000-100,000x increase.
      //
      // So, we need to keep the event loop delay reasonable, and, to do that, we
      // want to at least have the option to scale directly on a metric derived
      // from event loop delay, rather than being able to scale _only_ on CPU
      // usage, because event loop delay and CPU usage aren't always
      // well-correlated: CPU usage can rise considerably if new code does
      // CPU-intensive work off the main thread (like crypto, or adding a Worker)
      // without event loop delay rising or the server being overloaded.
      //
      // However, actually building the metric to scale on is a bit tricky:
      //
      // 1. We want to distinguish between true overload and a very temporary
      //    spike in work that the server will be able to catch up with. To do
      //    that, we want to look at the _minimum event loop delay over the last
      //    20 seconds_ on each replica, and average that across all replicas.
      //    This is a strategy we adopt from this paper:
      //    https://sigops.org/s/conferences/hotos/2021/papers/hotos21-s11-bronson.pdf
      //
      //      "[For] accurately differentiating persistent overload from load
      //       spikes[, we] have found it effective to measure the minimum
      //       queueing latency over a sliding window... for the internal work
      //       queues of the server. A small value means that the queue was
      //       drained at some point during the window, indicating that even if
      //       the queue is large, it is probably a manageable spike."
      //
      //    Note that this choice of 20s is service-dependent. It's based on how
      //    much latency (from the queueing delay in the event loop) is acceptable
      //    (when the load spike actually is temporary and the queue will clear
      //    itself), plus how reactive/pessimistic you want to be in assuming
      //    that, once even a short event loop delay starts to build, it's a sign
      //    that the queue _won't_ clear and the server should scale right away to
      //    avoid becoming overwhelmed.
      //
      //    NB: when computing a sliding window with moving_rollup(30), Datadog
      //    emits a new metric value every 10s. However, the DD cluster agent only
      //    polls DD for new metric values every 30s. So, the HPA -- which, by
      //    default, tries to read the external metrics every 15 seconds (see the
      //    --horizontal-pod-autoscaler-sync-period option) will observe the same
      //    value multiple times. I think this can lead it to scale multiple times
      //    -- i.e., I think the HPA can think that it's scaling was insufficient
      //    and scale again, when really the new value just hasn't arrived.
      //
      // 2. We must deal with the fact that HPA normally multiplies the current
      //    replica count by (current metric value/target value), and this won't
      //    work for raw event loop delay: the event loop delay gets >1000x bigger
      //    than its target under times of stress, but we obviously don't want
      //    1000x more replicas. Really, we don't know how many replicas to add...
      //
      //    To deal with this, we use log10() on the value so that an
      //    exponentially higher event loop delay only results in linearly more
      //    replicas. Then, we do some other transformations that are just based
      //    on rough guesswork of how much scaling should be triggered by how much
      //    event loop delay.
      //
      // 3. Related to the above, when our event loop delay value is _not_ high,
      //    its not clear whether we can scale down safely, or by how much.
      //    Essentially, event loop delay has some roughly fixed minimum value
      //    (governed by the complexity of our callbacks) and it can be at/around
      //    that value _both_ when there is room to scale down and when there
      //    isn't. That's because the event loop varies how long it waits for new
      //    IO events during the polling phase based on what other work it has to
      //    do. Therefore, at times of more work (but before it gets overloaded)
      //    the event loop may simply wait less and do more iterations per second,
      //    handling the extra load _without the event loop delay going up_.
      //
      //    To deal with this, we set up the metric to have a value of .83 when
      //    the event loop delay is within an acceptable, baseline range. The idea
      //    is that the HPA using this metric can/must use 1 as the target value;
      //    then, .83 means that we'll be constantly trying to scale down, in
      //    order to discover whether or not there is in fact some slack -- but,
      //    we'll only be doing this scale down only if the other metrics allow
      //    it, and only at a frequency specified by the scaling policies, and
      //    only when we have more than 5 replicas (b/c `ceil(5*(.83/1))`, which
      //    is what HPA uses to calculate the new replica count, is still 5).
      //
      // Putting it all together, we:
      //
      // 1. Round any event loop delay value between 0 and 30us up to 30us -- by
      //    first subtracting 30us from the base event loop delay value (i.e., the
      //    average of the 20s minimums across replicas) and taking the max of
      //    that result and 30us. We do this to raise the baseline value, which
      //    lowers the ratio of the value during a spike to this baseline value,
      //    which makes the autoscaling results more sensible.
      //
      // 2. Then, take the log10 of the result -- again as part of making sure we
      //    don't scale up too much during a spike. DD only has functions for log2
      //    and log10, so we had to control most of the scaling ratio by choosing
      //    the baseline 30us value.
      //
      // 3. Finally, divide by 5.4 so that, when event loop delay is at or under
      //    30us, the metric evaluates to .83, per the discussion above.
      //
      // Note that this metric still isn't perfectly accurate for our purposes,
      // because it's not tightly integrated with k8s. For example, if a new
      // deployment is rolled out, and the existing pods are shut down gradually,
      // each pod (while it's shutting down but before it's killed completely)
      // will continue to have its event loop delay reported to Datadog and
      // counted in the average. Because the pod is shutting down, it's event loop
      // delay will likely be artificially low, which could cause issues if the
      // average value is being used to scale the incoming deployment.
      // Alternatively, there might be relatively-synchronous cleanup jobs that
      // happen on shutdown (likely flushing big blobs of pending metrics/logs),
      // which would then artificially inflate the metric. So the underlying point
      // is just that it's not totally accurate, and we might want a buffer
      // (autoscaling at a bit lower threshold than we otherwise might, mainly).
      const eventLoopDelayMetricName = `${serviceName}-event-loop-delay`;
      const useEventLoopDelayMetric =
        props.enableDatadog && resources.useEventLoopDelayForAutoscaling;
      if (useEventLoopDelayMetric) {
        new KubernetesManifest(
          props.stack,
          `${serviceName}-dd-event-loop-delay-metric`,
          {
            cluster: props.cluster,
            manifest: [
              {
                apiVersion: 'datadoghq.com/v1alpha1',
                kind: 'DatadogMetric',
                metadata: {
                  name: eventLoopDelayMetricName,
                  namespace: props.namespace,
                },
                spec: {
                  query: `div(log10(max(sub(moving_rollup(avg:runtime.node.event_loop.delay.min{service:${serviceName}, env:${stage.toLowerCase()}}, 20, 'min'), 30000), 30000)), 5.4)`,
                },
              },
            ],
          },
        );
      }

      // Public name for the metric is its full name.
      const autoscaleEventLoopMetricName = `datadogmetric@${props.namespace}:${eventLoopDelayMetricName}`;

      const autoscaler = new KubeHorizontalPodAutoscalerV2(
        this,
        `${serviceName}-hpa`,
        {
          metadata: { name: serviceName },
          spec: {
            scaleTargetRef: {
              apiVersion: 'argoproj.io/v1alpha1',
              kind: 'Rollout',
              name: serviceName,
            },
            // We really only need two replicas, but we're setting the minimum
            // to 3 in order to better tolerate situations in which one
            // crashes so that we don't ever end up with only one node
            // handling all traffic before a replacement can start up.
            minReplicas: props.provisionProdLevelsOfCompute
              ? resources.minReplicas
              : 1,
            maxReplicas: props.provisionProdLevelsOfCompute ? 100 : 2,
            metrics: [
              {
                type: 'Resource',
                resource: {
                  name: 'cpu',
                  target: {
                    type: 'Utilization',
                    averageUtilization: 40,
                  },
                },
              },
              ...(useEventLoopDelayMetric
                ? [
                    {
                      type: 'External',
                      external: {
                        metric: { name: autoscaleEventLoopMetricName },
                        target: {
                          type: 'Value',
                          value: Quantity.fromNumber(1),
                        },
                      },
                    },
                  ]
                : []),
              {
                type: 'Resource',
                resource: {
                  name: 'memory',
                  target: {
                    type: 'Utilization',
                    averageUtilization: 75,
                  },
                },
              },
            ],
            behavior: {
              scaleDown: {
                // If we remove a server pod and have to add it back later, that's
                // potentially disruptive, because latency goes up a lot while the
                // location bank cache is being warmed if we have a large location
                // bank. So, be a bit more conservative (for now) about scaling
                // down. This'd be less of an issue if the location bank cache
                // didn't live in memory.
                stabilizationWindowSeconds: 300,
                policies: [
                  {
                    type: 'Pods',
                    value: 1,
                    periodSeconds: 15,
                  },
                ],
              },
              scaleUp: {
                stabilizationWindowSeconds: 45,
                policies: [
                  {
                    type: 'Percent',
                    value: 100,
                    periodSeconds: 15,
                  },
                  {
                    type: 'Pods',
                    value: 4,
                    periodSeconds: 15,
                  },
                ],
                selectPolicy: 'Min',
              },
            },
          },
        },
      );

      const analysisTemplateName = `${serviceName}-error-rate`;
      const rollout = new Rollout(this, `${serviceName}-rollout`, {
        metadata: {
          name: serviceName,
          annotations: {
            'getcoop.com/git-commit-sha': `${props.gitCommitSha}`,
            'notifications.argoproj.io/subscribe.on-rollout-completed.slack':
              props.rolloutNotificationsSlackChannel,

            ...(props.sendRolloutFailuresToOpsGenie
              ? {
                  'notifications.argoproj.io/subscribe.on-rollout-aborted.opsgenie':
                    'Engineers',
                }
              : {
                  'notifications.argoproj.io/subscribe.on-rollout-aborted.slack':
                    props.rolloutNotificationsSlackChannel,
                }),
          },
        },
        spec: {
          selector: { matchLabels: label },
          template: {
            metadata: {
              labels: label,
              annotations: {
                ...getInstrumentationPodAnnotations(serviceName),
              },
            },
            spec: secretsHandler.getPodSpec({
              affinity: {
                nodeAffinity: getNodeAffinityForInstanceTypes([
                  props.provisionProdLevelsOfCompute
                    ? 'm7i.2xlarge'
                    : 't3.2xlarge',
                ]),
              },
              containers: [
                {
                  name: serviceName,
                  image: imageUrl,
                  imagePullPolicy: 'IfNotPresent',
                  lifecycle: {
                    // When Kubernetes shuts down our api server, like during a
                    // rolling deploy, there's some lag before the load balancer
                    // controller picks up that the pod is no longer a valid
                    // target and deregisters it from the load balancer's target
                    // group. I.e., there's a window when the api-server has
                    // received a shutdown signal, but the load balancer is still
                    // sending it traffic (including possibly opening new
                    // connections). See
                    // https://blog.gruntwork.io/delaying-shutdown-to-wait-for-pod-deletion-propagation-445f779a8304
                    //
                    // During that window, we have to make sure that the pod will
                    // still handle new, incoming requests (including on new
                    // connections), in addition to finishing up on existing ones.
                    //
                    // Previously, we tried to accomplish this inside the shutdown
                    // logic in the app itself, by having the server not block new
                    // connections until all old connections were idle + closed.
                    // However, that logic isn't foolproof, as there's a case
                    // where the app has no active connections at the time the
                    // shutdown signal is sent, but then the load balancer tries
                    // to open a connection in the window between shutdown being
                    // sent and the deregistration occurring.
                    //
                    // There may also be further weird race conditions that we
                    // don't fully understand. Potential causes could be things
                    // like the NLB not immediately detecting that a connection is
                    // idle (and therefore still trying to send traffic down it
                    // even when the target is draining), or maybe some TCP socket
                    // state that's in an OS-level queue but can't be seen by Node
                    // yet -- I honestly don't know, or know how plausible those
                    // causes are.
                    //
                    // Anyway, the fix for at least the first issue would seem to
                    // be to add a delay before we send the pod the shutdown
                    // signal, to allow the deregistration to propagate. See
                    // https://github.com/kubernetes-sigs/aws-load-balancer-controller/issues/1719
                    // However, we start w/ a shorter delay than the
                    // deregistration timeout, b/c -- if I'm understanding the NLB
                    // docs correctly (and if they're accurate) -- then, because
                    // we also still have some logic in our app to wait for
                    // pending requests to finish, the sleep here should only need
                    // to be controller process time (to send the deregistration
                    // request) + ELB API propagation time (to process it), which
                    // is <10s according to that github issue.
                    //
                    // NB: there is one comment on that issue that suggests that
                    // this sleep has to be longer than the deregistration
                    // timeout, but that may be a misunderstanding on the poster's
                    // part, or a difference between his shutdown logic and ours,
                    // so we try this first.
                    preStop: { exec: { command: ['sh', '-c', 'sleep 15'] } },
                  },
                  resources: {
                    requests: {
                      cpu: cpuRequest,
                      memory: memoryRequest,
                      // although we don't explicitly use the file system from
                      // our code, kubernetes warning events (that only started
                      // showing up when our nodes got low on disk space)
                      // indicate that our pods are indirectly trying to store
                      // some data in the filesystem -- if I had to guess, this
                      // data might be stdout content that the container runtime
                      // automatically writes to disk? or maybe its some
                      // trace/metrics data stored on disk by the dd-trace
                      // package? So, we can use this resource request to make
                      // sure the container has access to all the storage it
                      // needs. The limit here is 2x the max storage usage I saw
                      // in the warning events.
                      'ephemeral-storage': '200Mi',
                    },
                    limits: {
                      memory: memoryLimit,
                      cpu: cpuLimit,
                    },
                  },
                  env: [
                    { name: 'NODE_ENV', value: 'production' },
                    //{ name: 'DD_TRACE_SAMPLE_RATE', value: '0.1' },
                    ...getTracingEnvVars(serviceName, stage),
                    {
                      name: 'KAFKA_BROKER_HOST',
                      value: props.kafkaHosts.broker,
                    },
                    {
                      name: 'LOG_REQUEST_BODY',
                      value: props.stage === 'Prod' ? 'false' : 'true',
                    },
                    {
                      name: 'KAFKA_SCHEMA_REGISTRY_HOST',
                      value: props.kafkaHosts.schemaRegistry,
                    },
                    ...Object.entries(topicSchemaIds[props.stage] ?? {}).map(
                      ([k, v]) => ({ name: k, value: String(v) }),
                    ),
                    {
                      name: 'DATABASE_READ_ONLY_HOST',
                      value: props.rdsReadOnlyClusterHost,
                    },
                    // For each usage plan, add an env var with its aws id, where
                    // the name of the var is derived from the coop id for the plan.
                    ...Object.entries(props.apiGateway.usagePlans).map(
                      ([coopId, awsId]) => ({
                        name: `${coopId
                          .toUpperCase()
                          .replace(/[^A-Z]/g, '_')}_API_USAGE_PLAN_ID`,
                        value: awsId,
                      }),
                    ),
                    {
                      name: 'MODELS_SERVICE_API_URL',
                      value:
                        // This is only for the Twilio load test. We will need
                        // to update configs so the proper URL is used for
                        // inference+training workflows.
                        'http://removed-models-service',
                    },
                    {
                      name: 'ITEM_QUEUE_TRAFFIC_PERCENTAGE',
                      value: '0.50',
                    },
                    {
                      name: 'UI_URL',
                      value: props.uiUrl,
                    },
                  ],
                  ports: [{ containerPort: containerPort, name: 'http' }],
                  command: ['node'],
                  args: [
                    ...computeNodeMemoryOptions({
                      containerMemoryRequest:
                        Quantity.fromString(memoryRequest),
                      majorGcInterval: 800,
                      youngGenerationSemiSpaceSize,
                    }),
                    'bin/www.js',
                  ],
                },
              ],
              terminationGracePeriodSeconds: 90,
            } satisfies RolloutSpecTemplateSpec),
          },
          strategy: {
            canary: {
              // canaryService and stableService are references to Services
              // which the Rollout will modify to target the canary ReplicaSet
              // and stable ReplicaSet respectively (required).
              canaryService: canaryServiceName,
              stableService: serviceName,
              steps: [
                { setWeight: 20 },
                // the analysis run will lookback at the last 5 minutes of data
                // so we wait 5 minutes before initiating the analysis. The
                // analysis step is added to the rollout after the initial
                // creation as to avoid the circular dependency between the
                // Rollout and the AnalysisTemplate and Target Group.
                {
                  pause: {
                    duration:
                      RolloutSpecStrategyCanaryStepsPauseDuration.fromString(
                        '300s',
                      ),
                  },
                },
              ],
              trafficRouting: {
                alb: {
                  // The referenced ingress will be injected with a custom
                  // action annotation, directing the AWS Load Balancer
                  // Controller to split traffic between the canary and stable
                  // Service, according to the desired traffic weight
                  // (required).
                  ingress: ingressName,
                  // Service port is the port which the Service listens on
                  // (required).
                  servicePort,
                },
              },
            },
          },
        },
      });

      autoscaler.addDependency(rollout);

      return {
        ...route,
        serviceName,
        rollout,
        canaryServiceName,
        servicePort,
        analysisTemplateName,
      };
    }, this);

    secretsHandler.addToChart(
      this,
      deployments.map((d) => d.rollout),
    );

    this.services = deployments;

    // the aws-load-balancer-controller will add a finalizer to this resource
    // which prevents deletion. cdk will be unable to delete the resource so you
    // must manually remove the finalizer in order to delete it. the same is
    // true for the corresponding TargetGroupBinding CR which is created by the
    // load balancer controller.
    this.ingress = new KubeIngress(this, 'ingress', {
      metadata: {
        name: ingressName,
        annotations: {
          'alb.ingress.kubernetes.io/target-type': 'ip',
          'alb.ingress.kubernetes.io/healthcheck-path':
            ApiAutoscaledServiceDeployment.albHealthCheckPath,
          // Default is 5 and the min is 2. If we timeout after three seconds on
          // a readiness check that has only a 1 second timeout then I think
          // it's safe to assume we don't want to route more traffic to this
          // instance.
          'alb.ingress.kubernetes.io/healthcheck-timeout-seconds': '3',
          // default is 15 which seems too long.
          'alb.ingress.kubernetes.io/healthcheck-interval-seconds': '5',
        },
      },
      spec: {
        ingressClassName: 'alb',
        rules: [
          {
            http: {
              paths: [
                ...deployments.map(
                  ({ serviceName, path }): HttpIngressPath => ({
                    backend: {
                      service: {
                        name: serviceName,
                        // servicePort must be the value: use-annotation This
                        // instructs AWS Load Balancer Controller to look to
                        // annotations on how to direct traffic
                        port: { name: 'use-annotation' },
                      },
                    },
                    // remove trailing slashes
                    path: `/api/v1${path.replace(/\/+$/, '')}`,
                    pathType: 'Exact',
                  }),
                ),
                // Serve static assets from the graphql-service. Eventually we
                // will move this to S3 but for now this seems reasonable.
                {
                  backend: {
                    service: {
                      name: 'graphql-service',
                      port: { name: 'use-annotation' },
                    },
                  },
                  path: '/',
                  pathType: 'Prefix',
                },
              ],
            },
          },
        ],
      },
    });
  }
}

type Service = {
  serviceName: string;
  canaryServiceName: string;
  servicePort: string | number;
  analysisTemplateName: string;
  rollout: Rollout;
};

type ServiceWithTargetGroupNames = {
  serviceName: string;
  analysisTemplateName: string;
  baselineTargetGroupName: string;
  canaryTargetGroupName: string;
};

type ApiAdditionalResourcesProps = {
  servicesWithTargetGroupNames: ServiceWithTargetGroupNames[];
  stack: cdk.Stack;
  ingressName: string;
  namespaceName: string;
  cluster: ICluster;
  applicationLoadBalancerName: string;
};

class ApiAdditionalResources extends Chart {
  constructor(
    scope: Construct,
    id: string,
    props: ApiAdditionalResourcesProps,
  ) {
    super(scope, id);
    const {
      servicesWithTargetGroupNames,
      namespaceName,
      applicationLoadBalancerName,
    } = props;

    servicesWithTargetGroupNames.forEach(
      ({
        serviceName,
        analysisTemplateName,
        baselineTargetGroupName,
        canaryTargetGroupName,
      }) => {
        const makeDimensions = (
          targetGroupName: string,
        ): AnalysisTemplateSpecMetricsProviderCloudWatchMetricDataQueriesMetricStatMetricDimensions[] => {
          return [
            {
              name: 'TargetGroup',
              value: targetGroupName,
            },
            {
              name: 'LoadBalancer',
              value: applicationLoadBalancerName,
            },
          ];
        };

        const baselineDimensions = makeDimensions(baselineTargetGroupName);
        const canaryDimensions = makeDimensions(canaryTargetGroupName);

        new AnalysisTemplate(this, `${serviceName}-analysis-template`, {
          metadata: {
            name: analysisTemplateName,
            namespace: namespaceName,
          },
          spec: {
            metrics: [
              {
                name: 'alb-5xx-error-rate',
                // Overall Frequency (interval: 1m): The top-level interval
                // indicates that the analysis will be performed every 1 minute.
                // This means every minute, the system will run the metric queries
                // defined under metricDataQueries.
                interval: '1m',
                count: AnalysisTemplateSpecMetricsCount.fromNumber(5),
                // The error rate of the canary must be less than 5% greater
                // than the baseline.
                successCondition: 'all(result[0].Values, {# <= 0.05})',
                // Not sure what the ideal here is. I think we will get a better
                // idea once we run this in prod.
                failureLimit:
                  AnalysisTemplateSpecMetricsFailureLimit.fromNumber(2),
                provider: {
                  cloudWatch: {
                    // Data Collection Period (interval: 5m): The CloudWatch
                    // interval of 5 minutes means that for each analysis run,
                    // CloudWatch will provide metrics that span the last 5
                    // minutes.
                    interval: '5m',
                    metricDataQueries: [
                      // API reference:
                      // https://docs.aws.amazon.com/AmazonCloudWatch/latest/APIReference/API_MetricDataQuery.html
                      {
                        // If the baseline doesn't have any errors, we will
                        // treat any errors in the canary as an automatic
                        // failure. This probably isn't the optimal solution,
                        // but the likelihood of this scenario occuring with a
                        // false positive seems so low that it's better to be
                        // safe and default to rolling back as a starting point.
                        id: 'error_rate_delta',
                        expression:
                          'IF(baseline_rate == 0, IF(canary_rate > 0, 1, 0), (canary_rate - baseline_rate)/baseline_rate)',
                        returnData: true,
                      },
                      {
                        id: 'baseline_rate',
                        expression: 'baseline_errors / baseline_requests',
                        returnData: false,
                      },
                      {
                        id: 'baseline_errors',
                        metricStat: {
                          metric: {
                            namespace: 'AWS/ApplicationELB',
                            metricName: 'HTTPCode_Target_5XX_Count',
                            dimensions: baselineDimensions,
                          },
                          // Granularity (period: 300): The period of 300 seconds
                          // (5 minutes) for individual metric queries means that
                          // each metric data point represents a sum or average
                          // over a 5-minute period. This helps in reducing noise
                          // and provides more stable metric readings.
                          period:
                            AnalysisTemplateSpecMetricsProviderCloudWatchMetricDataQueriesMetricStatPeriod.fromNumber(
                              300,
                            ),
                          stat: 'Sum',
                          unit: 'Count',
                        },
                        returnData: false,
                      },
                      {
                        id: 'baseline_requests',
                        metricStat: {
                          metric: {
                            namespace: 'AWS/ApplicationELB',
                            metricName: 'RequestCount',
                            dimensions: baselineDimensions,
                          },
                          period:
                            AnalysisTemplateSpecMetricsProviderCloudWatchMetricDataQueriesMetricStatPeriod.fromNumber(
                              300,
                            ),
                          stat: 'Sum',
                          unit: 'Count',
                        },
                        returnData: false,
                      },
                      {
                        id: 'canary_rate',
                        expression: 'canary_errors / canary_requests',
                        returnData: false,
                      },
                      {
                        id: 'canary_errors',
                        metricStat: {
                          metric: {
                            namespace: 'AWS/ApplicationELB',
                            metricName: 'HTTPCode_Target_5XX_Count',
                            dimensions: canaryDimensions,
                          },
                          period:
                            AnalysisTemplateSpecMetricsProviderCloudWatchMetricDataQueriesMetricStatPeriod.fromNumber(
                              300,
                            ),
                          stat: 'Sum',
                          unit: 'Count',
                        },
                        returnData: false,
                      },
                      {
                        id: 'canary_requests',
                        metricStat: {
                          metric: {
                            namespace: 'AWS/ApplicationELB',
                            metricName: 'RequestCount',
                            dimensions: canaryDimensions,
                          },
                          period:
                            AnalysisTemplateSpecMetricsProviderCloudWatchMetricDataQueriesMetricStatPeriod.fromNumber(
                              300,
                            ),
                          stat: 'Sum',
                          unit: 'Count',
                        },
                        returnData: false,
                      },
                    ],
                  },
                },
              },
            ],
          },
        });
      },
    );
  }
}
