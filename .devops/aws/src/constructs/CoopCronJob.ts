import { ICluster, ServiceAccount } from 'aws-cdk-lib/aws-eks';
import { Chart, type ChartProps } from 'cdk8s';
import { Construct, IDependable } from 'constructs';

import {
  KubeCronJob,
  PodSpec,
  Quantity,
  ResourceRequirements,
} from '../imports/k8s.js';
import { DeploymentEnvironmentName } from '../stacks/app_pipeline.js';
import { DeployedNodeType } from '../stacks/k8s_cluster.js';
import { NonEmptyArray, SimpleCronSpec } from '../types.js';
import {
  computeNodeMemoryOptions,
  getInstrumentationPodAnnotations,
  getNodeAffinityForInstanceTypes,
  getTracingEnvVars,
  NodeJsMemoryOptions,
  toKubernetesName,
} from '../utils.js';
import { KubernetesSecretsIntegration } from './KubernetesSecretsIntegration.js';

type CronJobProps = ChartProps & {
  jobName: string;
  stage: DeploymentEnvironmentName;
  env: { [k: string]: string };
  uiUrl: string;

  // Name of the namespace in which to create the job.
  namespace: string;

  schedule: SimpleCronSpec;
  concurrencyPolicy?: 'Allow' | 'Forbid' | 'Replace';
  restartPolicy?: 'OnFailure' | 'Never';

  // How much memory and CPU each job pod should request/be limited to.
  resources: ResourceRequirements & { limits: { memory: Quantity } };
  nodeJsMemoryOptions?: NodeJsMemoryOptions;

  // The url of the docker image. This must be our "master" docker image that
  // can start an instance of any of our jobs given a job name. NB: if the image
  // is built for a particular CPU architecture, the `allowedNodeTypes` must all
  // use that architecture.
  imageUrl: string;
  allowedNodeTypes: Readonly<NonEmptyArray<DeployedNodeType>>;
  taskDefinition?: { command: string[]; args: string[] };

  // If there are any CDK resources that this deployment depends on, like the
  // chart to create the namespace (if it might not exist yet) or the
  // DockerImageAsset resource (to make sure the image is published before we
  // try to start up a job's pod), pass those dependencies here and they'll
  // be registered as dependencies when the deployment is added to the cluster.
  // (NB: the service account will automatically be registered as a dependency.)
  dependencies: IDependable[];
} & (
    | {
        serviceAccount?: undefined;
        secretsHandler: KubernetesSecretsIntegration;
      }
    | {
        // Service Account that will be attached to the pod, for the sake of
        // authorizing/authenticating itself to other AWS services.
        // NB: service account must be in same namespace as the passed in namespace.
        serviceAccount: ServiceAccount;
        secretsHandler?: undefined;
      }
  );

/**
 * Generates a Job resource, that can be deployed into our k8s cluster,
 * which'll run a Node cronjob (in 1+ pods) to handle some background tasks.
 * The name of the worker to start is passed as a prop.
 */
export class CoopCronJob extends Chart {
  private jobName: string;
  private dependencies: IDependable[];
  private serviceAccount: ServiceAccount;
  private job: KubeCronJob;

  public constructor(scope: Construct, id: string, props: CronJobProps) {
    const {
      env,
      stage,
      jobName,
      schedule,
      concurrencyPolicy = 'Allow',
      serviceAccount,
      secretsHandler,
      restartPolicy = 'OnFailure',
      resources,
      nodeJsMemoryOptions,
      dependencies,
      imageUrl,
      allowedNodeTypes,
      taskDefinition = {
        command: ['node'],
        args: [
          ...computeNodeMemoryOptions({
            containerMemoryRequest:
              resources.requests?.memory ?? resources.limits.memory,
            ...nodeJsMemoryOptions,
          }),
          'bin/run-worker-or-job.js',
          jobName,
        ],
      },
      namespace,
      ...otherChartProps
    } = props;

    super(scope, id, { namespace, ...otherChartProps });

    this.jobName = jobName;
    this.serviceAccount = serviceAccount ?? secretsHandler.serviceAccount;
    this.dependencies = dependencies;

    const label = { app: toKubernetesName(jobName) };

    // Only provide CPU defaults if neither a request or limit was specified.
    // If user specified at least one, we let them leave the other out (like k8s does).
    // For memory, logic's even simpler cuz a limit's always required.
    const [cpuRequest, cpuLimit] =
      !resources.requests?.cpu && !resources.limits.cpu
        ? [Quantity.fromString('250m'), Quantity.fromString('750m')]
        : [resources.requests?.cpu, resources.limits.cpu];

    const basePodSpec: PodSpec = {
      affinity: {
        nodeAffinity: getNodeAffinityForInstanceTypes(allowedNodeTypes),
      },
      containers: [
        {
          name: label.app,
          image: imageUrl,
          imagePullPolicy: 'IfNotPresent',
          ...taskDefinition,
          resources: {
            ...resources,
            limits: {
              ...resources.limits,
              ...(cpuLimit != null ? { cpu: cpuLimit } : {}),
            },
            requests: {
              ...resources.requests,
              ...(cpuRequest != null ? { cpu: cpuRequest } : {}),
            },
          },
          env: [
            ...getTracingEnvVars(`api-job-${jobName}`, stage),
            ...Object.entries(env).map(([k, v]) => ({
              name: k,
              value: v,
            })),
            { name: 'UI_URL', value: props.uiUrl },
          ],
        },
      ],
    };

    const basePodSpecWithCredentials = secretsHandler
      ? secretsHandler.getPodSpec(basePodSpec)
      : { serviceAccount: serviceAccount.serviceAccountName, ...basePodSpec };

    this.job = new KubeCronJob(this, 'Job', {
      metadata: {
        name: toKubernetesName(jobName),
      },
      spec: {
        schedule: props.schedule,
        concurrencyPolicy,
        jobTemplate: {
          spec: {
            template: {
              metadata: {
                labels: label,
                annotations: {
                  // TODO: enable graceful shutdown of meshed jobs:
                  // https://linkerd.io/2.14/tasks/graceful-shutdown/#graceful-shutdown-of-job-and-cronjob-resources
                  // For now I am unmeshing job pods since it's not super important at
                  // the moment.
                  'linkerd.io/inject': 'disabled',
                  ...getInstrumentationPodAnnotations(label.app),
                },
              },
              spec: {
                ...basePodSpecWithCredentials,
                restartPolicy,
              },
            },
          },
        },
      },
    });

    secretsHandler?.addToChart(this, [this.job]);
  }

  public addToCluster(cluster: ICluster) {
    const { jobName, serviceAccount, dependencies } = this;
    const deploymentManifest = cluster.addCdk8sChart(jobName, this);
    deploymentManifest.node.addDependency(serviceAccount);
    dependencies.forEach((dep) => {
      deploymentManifest.node.addDependency(dep);
    });
  }
}
