import * as cdk from 'aws-cdk-lib';
import { Vpc } from 'aws-cdk-lib/aws-ec2';
import type { Construct } from 'constructs';

import { makeKubectlVersionProps } from '../constants.js';
import { clusterFromAttributes } from '../constructs/clusterFromAttributes.js';
import type { DeploymentEnvironmentName } from './app_pipeline.js';
import type { K8sOutputs } from './k8s_cluster.js';
import type { VpcOutputs } from './vpc.js';

type GitHubActionsRunnerControllerStackProps = cdk.StackProps & {
  k8sOutputs: K8sOutputs;
  coopEnv: DeploymentEnvironmentName;
  vpcOutputs: VpcOutputs;
  githubAppPrivateKey: string;
};

export class GitHubActionsRunnerControllerStack extends cdk.Stack {
  constructor(
    scope: Construct,
    id: string,
    props: GitHubActionsRunnerControllerStackProps,
  ) {
    super(scope, id, props);
    const { vpcOutputs, k8sOutputs } = props;
    const vpc = Vpc.fromVpcAttributes(this, `ClusterVpc`, {
      vpcId: vpcOutputs.vpcId.importValue,
      availabilityZones: cdk.Token.asList(
        cdk.Fn.split(',', vpcOutputs.vpcAzs.importValue),
      ),
      privateSubnetIds: vpcOutputs.vpcPrivateSubnetIds.map(
        (it) => it.importValue,
      ),
    });

    const env = props.coopEnv.toLowerCase();

    const cluster = clusterFromAttributes(this, 'Cluster', {
      clusterName: k8sOutputs.clusterName.importValue,
      kubectlRoleArn: k8sOutputs.kubectlRoleArn.importValue,
      openIdConnectProviderArn: k8sOutputs.openIdConnectProviderArn.importValue,
      kubectlLambdaRoleArn: k8sOutputs.kubectlLambdaRoleArn.importValue,
      kubectlSecurityGroupId: k8sOutputs.kubectlSecurityGroupId.importValue,
      clusterEndpoint: k8sOutputs.clusterEndpoint.importValue,
      vpc,
      ...makeKubectlVersionProps(this),
    });

    const namespace = cluster.addManifest('arc-runners-namespace', {
      apiVersion: 'v1',
      kind: 'Namespace',
      metadata: {
        name: 'arc-runners',
      },
    });

    const pvc = cluster.addManifest('pvc', {
      apiVersion: 'v1',
      kind: 'PersistentVolumeClaim',
      metadata: {
        name: 'arc-runner-0',
        namespace: 'arc-runners',
      },
      spec: {
        accessModes: ['ReadWriteOnce'],
        // This is the default EBS backed storage class in EKS.
        storageClassName: 'gp2',
        resources: {
          requests: {
            // The models service assets require a lot of storage. I tried 50Gi
            // but I ran out of space. Note that you can only increase the size
            // of an EBS volume once every 6 hours.
            storage: '200Gi',
          },
        },
      },
    });

    pvc.node.addDependency(namespace);

    const daemonJsonConfigMap = cluster.addManifest('DaemonJsonConfigMap', {
      apiVersion: 'v1',
      kind: 'ConfigMap',
      metadata: {
        name: 'gha-runner-daemon-config',
        namespace: 'arc-runners',
      },
      data: {
        'daemon.json': JSON.stringify({
          builder: {
            gc: {
              enabled: true,
              defaultKeepStorage: '50GB',
              policy: [
                { keepStorage: '50GB', filter: ['unused-for=720h'] },
                { keepStorage: '100GB', all: true },
              ],
            },
          },
        }),
      },
    });

    daemonJsonConfigMap.node.addDependency(namespace);

    const ghaRunnerScaleSetController = cluster.addHelmChart(
      'GitHubActionsRunnerController',
      {
        chart: 'gha-runner-scale-set-controller',
        release: 'arc',
        namespace: 'arc-systems',
        createNamespace: true,
        repository:
          'oci://ghcr.io/actions/actions-runner-controller-charts/gha-runner-scale-set-controller',
        version: '0.9.3',
        values: {
          flags: {
            logLevel: 'warn',
            logFormat: 'json',
          },
          image: {
            repository:
              '361188080279.dkr.ecr.us-east-2.amazonaws.com/ghcr/actions/gha-runner-scale-set-controller',
          },
        },
      },
    );

    const ghaRunnerScaleSet = cluster.addHelmChart(
      'GitHubActionsRunnerControllerScaleSet',
      {
        chart: 'gha-runner-scale-set',
        release: 'arc-runner-set',
        repository:
          'oci://ghcr.io/actions/actions-runner-controller-charts/gha-runner-scale-set',
        version: '0.9.3',
        namespace: 'arc-runners',
        values: {
          githubConfigUrl: 'https://github.com/roostorg/coop',
          githubConfigSecret: {
            github_app_id: '931217',
            github_app_installation_id: '52237450',
            github_app_private_key: props.githubAppPrivateKey,
          },
          maxRunners: 1,
          minRunners: 1,
          // This is the label to be referenced by the GHA template in order to
          // select the agent
          runnerScaleSetName: `arc-runner-set-${env}`,
          // most of the template was ripped from the helm chart comments. I
          // chose not to use DinD container mode since that is intended for GHA
          // container jobs (which we are not using) and I had to customize it
          // anyway.
          // https://github.com/actions/actions-runner-controller/blob/master/charts/gha-runner-scale-set/values.yaml#L110-L158
          template: {
            spec: {
              initContainers: [
                {
                  name: 'init-dind-externals',
                  image:
                    '361188080279.dkr.ecr.us-east-2.amazonaws.com/ghcr/actions/actions-runner:latest',
                  command: [
                    'cp',
                    '-r',
                    '-v',
                    '/home/runner/externals/.',
                    '/home/runner/tmpDir/',
                  ],
                  volumeMounts: [
                    {
                      name: 'dind-externals',
                      mountPath: '/home/runner/tmpDir',
                    },
                  ],
                },
                // When we mount a volume onto the .npm directory, it changes
                // the owner to root which causes npm to throw an error so we
                // change it back.
                {
                  name: 'fix-npm-cache-permissions',
                  image:
                    '361188080279.dkr.ecr.us-east-2.amazonaws.com/ecr-public/docker/library/busybox',
                  command: ['sh', '-c', 'chown -R 1001:1001 /home/runner/.npm'],
                  volumeMounts: [
                    {
                      name: 'arc-runner-data',
                      mountPath: '/home/runner/.npm',
                      subPath: 'npm',
                    },
                  ],
                },
                // We are running Docker in Docker (DinD)
                {
                  name: 'dind',
                  image:
                    '361188080279.dkr.ecr.us-east-2.amazonaws.com/ecr-public/docker/library/docker:dind',
                  args: [
                    'dockerd',
                    '--host=unix:///var/run/docker.sock',
                    '--group=$(DOCKER_GROUP_GID)',
                  ],
                  env: [
                    {
                      name: 'DOCKER_GROUP_GID',
                      value: '123',
                    },
                  ],
                  // Setting 'restartPolicy: Always' on an initContainer is the canonical way to
                  // run sidecars in Kubernetes.
                  restartPolicy: 'Always',
                  securityContext: {
                    privileged: true,
                  },
                  volumeMounts: [
                    {
                      name: 'work',
                      mountPath: '/home/runner/_work',
                    },
                    {
                      name: 'dind-sock',
                      mountPath: '/var/run',
                    },
                    {
                      name: 'dind-externals',
                      mountPath: '/home/runner/externals',
                    },
                    // Persist the Docker cache
                    {
                      name: 'arc-runner-data',
                      mountPath: '/var/lib/docker',
                      subPath: 'docker',
                    },
                    {
                      name: 'daemon-json-config',
                      mountPath: '/etc/docker/daemon.json',
                      subPath: 'daemon.json',
                    },
                  ],
                  // https://github.com/actions/actions-runner-controller/issues/3201#issuecomment-1960800657
                  preStop: {
                    exec: {
                      command: [
                        '/bin/sh',
                        '-c',
                        "sleep 5; while grep -q running /home/runner/_work/.runner-state; do echo 'main container has work, sleeping...' >/proc/1/fd/1 2>&1; sleep 3; done; echo 'Did not find running runner. Stopping' >/proc/1/fd/1 2>&1",
                      ],
                    },
                  },
                },
                {
                  name: 'docker-gc',
                  image:
                    '361188080279.dkr.ecr.us-east-2.amazonaws.com/ecr-public/docker/library/docker:cli',
                  command: [
                    '/bin/sh',
                    '-c',
                    'docker image prune --all --filter "until=48h" --force',
                  ],
                  env: [
                    {
                      name: 'DOCKER_HOST',
                      value: 'unix:///var/run/docker.sock',
                    },
                  ],
                  volumeMounts: [
                    {
                      name: 'dind-sock',
                      mountPath: '/var/run',
                    },
                  ],
                },
              ],
              containers: [
                {
                  name: 'runner',
                  image:
                    '361188080279.dkr.ecr.us-east-2.amazonaws.com/ghcr/actions/actions-runner:latest',
                  command: ['/home/runner/run.sh'],
                  env: [
                    {
                      name: 'DOCKER_HOST',
                      value: 'unix:///var/run/docker.sock',
                    },
                  ],
                  // We set requests but not limits to ensure a minimum level of
                  // service without limiting us from using available resources.
                  resources: {
                    requests: {
                      cpu: '1',
                      memory: '2Gi',
                    },
                  },
                  volumeMounts: [
                    {
                      name: 'work',
                      mountPath: '/home/runner/_work',
                    },
                    {
                      name: 'dind-sock',
                      mountPath: '/var/run',
                    },
                    // Persist the npm cache
                    {
                      name: 'arc-runner-data',
                      mountPath: '/home/runner/.npm',
                      subPath: 'npm',
                    },
                  ],
                  preStop: {
                    exec: {
                      command: [
                        '/bin/sh',
                        '-c',
                        "echo running > /home/runner/_work/.runner-state; while pgrep Runner.Worker; do echo 'worker process found, sleeping' >/proc/1/fd/1 2>&1; sleep 3; done; rm /home/runner/_work/.runner-state; echo 'Done, removed /home/runner/_work/.runner-state (or never started)' >/proc/1/fd/1 2>&1",
                      ],
                    },
                  },
                },
              ],
              volumes: [
                {
                  name: 'work',
                  emptyDir: {},
                },
                {
                  name: 'dind-sock',
                  emptyDir: {},
                },
                {
                  name: 'dind-externals',
                  emptyDir: {},
                },
                {
                  name: 'arc-runner-data',
                  persistentVolumeClaim: {
                    claimName: 'arc-runner-0',
                  },
                },
                {
                  name: 'daemon-json-config',
                  configMap: {
                    name: 'gha-runner-daemon-config',
                    items: [{ key: 'daemon.json', path: 'daemon.json' }],
                  },
                },
              ],
            },
          },
          controllerServiceAccount: {
            namespace: 'arc-systems',
            name: 'arc-gha-rs-controller',
          },
        },
      },
    );
    ghaRunnerScaleSet.node.addDependency(pvc);
    ghaRunnerScaleSet.node.addDependency(ghaRunnerScaleSetController);
  }
}
