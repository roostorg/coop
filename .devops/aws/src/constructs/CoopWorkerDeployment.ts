import { ICluster, ServiceAccount } from 'aws-cdk-lib/aws-eks';
import { Chart, type ChartProps } from 'cdk8s';
import { Construct, IDependable } from 'constructs';

import { DatadogMetric } from '../imports/datadoghq.com.js';
import {
  KubeDeployment,
  KubeHorizontalPodAutoscalerV2,
  PodSpec,
  Quantity,
  ResourceRequirements,
} from '../imports/k8s.js';
import { DeploymentEnvironmentName } from '../stacks/app_pipeline.js';
import { DeployedNodeType } from '../stacks/k8s_cluster.js';
import { NonEmptyArray } from '../types.js';
import {
  computeNodeMemoryOptions,
  getInstrumentationPodAnnotations,
  getNodeAffinityForInstanceTypes,
  getTracingEnvVars,
  NodeJsMemoryOptions,
  toKubernetesName,
} from '../utils.js';
import { KubernetesSecretsIntegration } from './KubernetesSecretsIntegration.js';

type WorkerDeploymentProps = ChartProps & {
  workerName: string;
  stage: DeploymentEnvironmentName;
  env: { [k: string]: string };
  uiUrl: string;

  // Name of the namespace in which to create the worker deployment.
  namespace: string;

  // How much memory and CPU each worker pod should request/be limited to.
  resources: ResourceRequirements & { limits: { memory: Quantity } };
  nodeJsMemoryOptions?: NodeJsMemoryOptions;

  // The url of the docker image. This must be our "master" docker image that
  // can start an instance of any of our workers given a worker name. NB: if the
  // image is built for a particular CPU architecture, the `allowedNodeTypes`
  // must all use that architecture.
  imageUrl: string;
  allowedNodeTypes: Readonly<NonEmptyArray<DeployedNodeType>>;

  // If there are any CDK resources that this deployment depends on, like the
  // chart to create the namespace (if it might not exist yet) or the
  // DockerImageAsset resource (to make sure the image is published before we
  // try to start up a worker node), pass those dependencies here and they'll
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
  ) &
  (
    | {
        // Desired number of replicas to run of this worker.
        // NB: if this is set to 1, then a code change (which produces a new version
        // of the docker image and also a new deployment) will force the currently
        // running instance of the worker to stop before the new one starts up, so
        // so that there's never two running concurrently. If this is set to anything
        // greater than 1, then occassionally there could be more than `targetReplicas`
        // number of workers running at once (as the old ones exit while new ones start).
        targetReplicas: number;

        autoscalerConfig?: undefined;
      }
    | {
        // If an autoscaler is configured, targetReplicas must be undefined
        // and vice-versa
        targetReplicas?: undefined;
        autoscalerConfig: {
          enableDatadog: boolean;
          customMetricName: string;
          customMetricTargetValue: number;
          minReplicas: number;
          maxReplicas: number;
          customMetricQuery: string;
        };
      }
  );

/**
 * Generates a Deployment resource, that can be deployed into our k8s cluster,
 * which'll run a Node worker (in 1+ pods) to handle some background tasks.
 * The name of the worker to start is passed as a prop.
 */
export class CoopWorkerDeployment extends Chart {
  private workerName: string;
  private dependencies: IDependable[];
  private serviceAccount: ServiceAccount;
  public deployment: KubeDeployment;

  public constructor(
    scope: Construct,
    id: string,
    props: WorkerDeploymentProps,
  ) {
    const {
      env,
      stage,
      workerName,
      serviceAccount,
      secretsHandler,
      targetReplicas: targetReplicas,
      resources,
      nodeJsMemoryOptions,
      dependencies,
      imageUrl,

      allowedNodeTypes,
      namespace,
      ...otherChartProps
    } = props;
    super(scope, id, { namespace, ...otherChartProps });

    this.workerName = workerName;
    this.serviceAccount = serviceAccount ?? secretsHandler.serviceAccount;
    this.dependencies = dependencies;

    const label = { app: toKubernetesName(workerName) };

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
          command: ['node'],
          args: [
            ...computeNodeMemoryOptions({
              containerMemoryRequest:
                resources.requests?.memory ?? resources.limits.memory,
              ...nodeJsMemoryOptions,
            }),
            'bin/run-worker-or-job.js',
            workerName,
          ],
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
            ...getTracingEnvVars(`api-worker-${workerName}`, stage),
            ...Object.entries(env).map(([k, v]) => ({
              name: k,
              value: v,
            })),
            { name: 'UI_URL', value: props.uiUrl },
          ],
        },
      ],
    };
    const deploymentName = toKubernetesName(`${workerName}-deployment`);

    const customMetricAutoScaleName = props.autoscalerConfig
      ? `datadogmetric@${props.namespace}:${props.autoscalerConfig?.customMetricName}`
      : '';

    if (props.autoscalerConfig) {
      new DatadogMetric(
        this,
        `${props.autoscalerConfig?.customMetricName}-metric`,
        {
          metadata: {
            name: props.autoscalerConfig?.customMetricName,
            namespace: props.namespace,
          },
          spec: {
            query: props.autoscalerConfig.customMetricQuery,
          },
        },
      );
    }

    const autoscaler = props.autoscalerConfig
      ? new KubeHorizontalPodAutoscalerV2(this, `${deploymentName}-hpa`, {
          metadata: { name: deploymentName },
          spec: {
            scaleTargetRef: {
              apiVersion: 'apps/v1',
              kind: 'Deployment',
              name: deploymentName,
            },
            // We really only need two replicas, but we're setting the minimum
            // to 3 in order to better tolerate situations in which one
            // crashes so that we don't ever end up with only one node
            // handling all traffic before a replacement can start up.
            minReplicas: props.autoscalerConfig.minReplicas,
            maxReplicas: props.autoscalerConfig.maxReplicas,
            // TODO(Peter): move some of these configs into the autoscalerConfig
            // prop so the behavior can be configured with more granularity for
            // different workers.
            // The current metrics configuration is a duplicate of what we
            // apply to api-server pods
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
              ...(props.autoscalerConfig.enableDatadog
                ? [
                    {
                      type: 'External',
                      external: {
                        metric: {
                          name: customMetricAutoScaleName,
                        },
                        target: {
                          type: 'Value',
                          value: Quantity.fromNumber(
                            props.autoscalerConfig.customMetricTargetValue,
                          ),
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
                stabilizationWindowSeconds: 120,
                policies: [
                  {
                    type: 'Percent',
                    value: 25,
                    periodSeconds: 15,
                  },
                ],
              },
              scaleUp: {
                stabilizationWindowSeconds: 45,
                policies: [
                  {
                    type: 'Percent',
                    value: 50,
                    periodSeconds: 15,
                  },
                  {
                    type: 'Pods',
                    value: 2,
                    periodSeconds: 15,
                  },
                ],
                selectPolicy: 'Min',
              },
            },
          },
        })
      : undefined;

    this.deployment = new KubeDeployment(this, 'deployment', {
      metadata: {
        name: deploymentName,
        labels: label,
      },
      spec: {
        replicas: targetReplicas,
        ...(targetReplicas === 1 ? { strategy: { type: 'Recreate' } } : {}),
        selector: { matchLabels: label },
        template: {
          metadata: {
            labels: label,
            annotations: {
              ...getInstrumentationPodAnnotations(label.app),
            },
          },
          spec: secretsHandler
            ? secretsHandler.getPodSpec(basePodSpec)
            : {
                serviceAccount: serviceAccount.serviceAccountName,
                ...basePodSpec,
              },
        },
      },
    });

    if (props.autoscalerConfig) {
      autoscaler?.addDependency(this.deployment);
    }
    secretsHandler?.addToChart(this, [this.deployment]);
  }

  public addToCluster(cluster: ICluster) {
    const { workerName, serviceAccount, dependencies } = this;
    const deploymentManifest = cluster.addCdk8sChart(workerName, this);
    deploymentManifest.node.addDependency(serviceAccount);
    dependencies.forEach((dep) => {
      deploymentManifest.node.addDependency(dep);
    });
  }
}
