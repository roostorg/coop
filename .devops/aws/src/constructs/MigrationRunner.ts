import path from 'path';
import { fileURLToPath } from 'url';
import * as k8s from '@kubernetes/client-node';
import * as cdk from 'aws-cdk-lib';
import type { ISecurityGroup, IVpc } from 'aws-cdk-lib/aws-ec2';
import { DockerImageAsset, Platform } from 'aws-cdk-lib/aws-ecr-assets';
import { KubernetesObjectValue, type ICluster } from 'aws-cdk-lib/aws-eks';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Provider } from 'aws-cdk-lib/custom-resources';
import { App as cdk8sApp, Chart, type ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import stringify from 'safe-stable-stringify';

// would love to move this to a shared lib
import { safeGetEnvVar } from '../../../../server/iocContainer/utils.js';
import {
  KubeRole,
  KubeRoleBinding,
  KubeSecret,
  type PodSpec,
} from '../imports/k8s.js';
import type { DeploymentEnvironmentName } from '../stacks/app_pipeline.js';
import { getTracingEnvVars } from '../utils.js';
import {
  KubernetesSecretsIntegration,
  type SecretsMap,
} from './KubernetesSecretsIntegration.js';

type RunMigrationsProps = {
  cluster: ICluster;
  migrationsImage: DockerImageAsset;
  vpc: IVpc;
  secrets: SecretsMap;
  deploymentEnvironment: DeploymentEnvironmentName;
  env: Record<string, string>;
  dbArgs: ('api-server-pg' | 'snowflake' | 'scylla')[];
};

export class MigrationRunner extends Construct {
  constructor(scope: Construct, id: string, props: RunMigrationsProps) {
    super(scope, id);

    const { secrets, cluster, vpc, migrationsImage: image } = props;

    const namespace = 'coop';

    // Service account for the lambda. It only needs access to get and create
    // jobs.
    const lambdaServiceAccount = cluster.addServiceAccount('migrator-lambda', {
      name: `${id}-migrator-lambda`,
      namespace,
    });

    // Separate service account for the job pod which has access to secrets.
    const migratorJobServiceAccount = cluster.addServiceAccount(
      'migrator-job',
      {
        name: `${id}-migrator-job`,
        namespace,
      },
    );

    const secretsHandler = new KubernetesSecretsIntegration(
      this,
      `${id}-secrets`,
      {
        serviceAccount: migratorJobServiceAccount,
        secrets,
      },
    );

    const migrationsChart = new MigrationsChart(
      new cdk8sApp(),
      'MigrationsChart',
      {
        image,
        serviceAccountName: lambdaServiceAccount.serviceAccountName,
        namespace,
        secretsHandler,
        resourcePrefix: id,
      },
    );

    const migrationsManifest = cluster.addCdk8sChart(
      'migrations',
      migrationsChart,
    );

    migrationsManifest.node.addDependency(lambdaServiceAccount);
    const secretToken = new KubernetesObjectValue(this, 'secret token', {
      cluster,
      objectName: migrationsChart.secretName,
      objectNamespace: namespace,
      objectType: 'secret',
      jsonPath: '.data.token',
    });

    const secretCert = new KubernetesObjectValue(this, 'secret cert', {
      cluster,
      objectName: migrationsChart.secretName,
      objectNamespace: namespace,
      objectType: 'secret',
      jsonPath: '.data.ca\\.crt',
    });

    secretToken.node.addDependency(migrationsManifest);
    secretCert.node.addDependency(migrationsManifest);
    const onEventHandler = new NodejsFunction(this, 'DbMigrationsOnEvent', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        '../migrator/lambdaOnEvent.ts',
      ),
      vpc: vpc,
      securityGroups: [cluster.kubectlSecurityGroup!],
      logRetention: cdk.aws_logs.RetentionDays.ONE_DAY,
    });
    const isCompleteHandler = new NodejsFunction(
      this,
      'DbMigrationsIsComplete',
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'handler',
        entry: path.join(
          path.dirname(fileURLToPath(import.meta.url)),
          '../migrator/lambdaIsComplete.ts',
        ),
        vpc: vpc,
        securityGroups: [cluster.kubectlSecurityGroup as ISecurityGroup],
        logRetention: cdk.aws_logs.RetentionDays.ONE_DAY,
      },
    );

    // We create the job spec here since it is much easier to do it in a cdk
    // context with access to the secrets integration. We will pass the object
    // to the onEvent lambda which will create the job. We don't want to create
    // it here because we want to avoid terminating the job on stack rollback.
    const job: k8s.V1Job = {
      metadata: {
        // Since the job name is static, job creation will fail if a job from a
        // previous run is still running. This is intended to avoid concurrency.
        // However, this does mean that the stack will FAIL TO ROLLBACK when a job
        // is already running. This is okay, you will just have to wait for the job
        // to finish or manually terminate it before continuing rollback.
        name: id,
        namespace,
      },
      spec: {
        // Not sure what the best ttl is here. We want the job to be cleaned up
        // before the next run starts. We can lower it if it causes issues. Logs
        // and events should be available in Datadog after deletion.
        ttlSecondsAfterFinished: 120,
        // Until we're better at ensuring migrations are idempotent — which is
        // hard in some cases — we shouldn't retry at all, imo. Retries could
        // lead to data issues/inconsistencies.
        backoffLimit: 0,
        template: {
          metadata: {
            annotations: {
              'linkerd.io/inject': 'disabled',
              'instrumentation.opentelemetry.io/inject-nodejs':
                'opentelemetry/default',
            },
          },
          spec: secretsHandler.getPodSpec({
            restartPolicy: 'Never',
            containers: [
              {
                name: 'migrator',
                image: image.imageUri,
                command: [
                  'node',
                  'index.js',
                  'apply',
                  ...props.dbArgs.flatMap((db) => ['--db', db]),
                  '--env',
                  `${props.deploymentEnvironment.toLowerCase()}`,
                ],
                env: [
                  ...getTracingEnvVars(id, props.deploymentEnvironment),
                  ...Object.entries(props.env).map(([name, value]) => ({
                    name,
                    value,
                  })),
                ],
              },
            ],
          } satisfies PodSpec),
        },
      },
    };

    const customResource = new cdk.CustomResource(this, 'DbMigrations', {
      serviceToken: new Provider(this, 'DbMigrationsProvider', {
        onEventHandler,
        isCompleteHandler,
        totalTimeout: cdk.Duration.hours(1),
        logRetention: cdk.aws_logs.RetentionDays.ONE_DAY,
      }).serviceToken,

      properties: {
        // We manually serialize here because for some reason CDK/Cloudformation
        // was converting booleans to strings which was causing the lambda to
        // fail.
        jobBody: stringify(job),
        cert: secretCert.value,
        token: secretToken.value,
        clusterServer: cluster.clusterEndpoint,
      },
    });

    customResource.node.addDependency(migrationsManifest);
  }
}

type MigrationsChartProps = ChartProps & {
  image: DockerImageAsset;
  serviceAccountName: string;
  secretsHandler: KubernetesSecretsIntegration;
  resourcePrefix: string;
};

class MigrationsChart extends Chart {
  public readonly secretName: string;
  constructor(scope: Construct, id: string, props: MigrationsChartProps) {
    super(scope, id, { namespace: props.namespace });
    const { resourcePrefix } = props;
    const jobReaderRoleName = `${resourcePrefix}-job-reader`;

    new KubeRole(this, 'JobReaderRole', {
      metadata: {
        namespace: props.namespace,
        name: jobReaderRoleName,
      },
      rules: [
        {
          apiGroups: ['batch'],
          resources: ['jobs', 'jobs/status'],
          verbs: ['get', 'list', 'watch', 'create'],
        },
      ],
    });

    // Role Binding
    new KubeRoleBinding(this, 'JobReaderRoleBinding', {
      metadata: {
        name: `${resourcePrefix}-read-jobs`,
        namespace: props.namespace,
      },
      subjects: [
        {
          kind: 'ServiceAccount',
          name: props.serviceAccountName,
          namespace: props.namespace,
        },
      ],
      roleRef: {
        kind: 'Role',
        name: jobReaderRoleName,
        apiGroup: 'rbac.authorization.k8s.io',
      },
    });

    const secretName = `${props.serviceAccountName}-token`;

    // Manually create the service account secret since Kubernetes no longer
    // automatically creates it. This is necessary to get a token for the lambda
    // to auth with the K8s API server.
    new KubeSecret(this, `${id}-migrations`, {
      metadata: {
        name: secretName,
        namespace: props.namespace,
        annotations: {
          'kubernetes.io/service-account.name': props.serviceAccountName,
        },
      },
      type: 'kubernetes.io/service-account-token',
    });

    this.secretName = secretName;

    // no dependencies since we deploy the job in the onEvent lambda
    props.secretsHandler.addToChart(this, []);
  }
}
