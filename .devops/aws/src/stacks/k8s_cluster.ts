// ES6+ example
import { readdirSync, readFileSync } from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import { CfnJson, Duration, Stack, type StackProps } from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { IVpc } from 'aws-cdk-lib/aws-ec2';
import { DockerImageAsset, Platform } from 'aws-cdk-lib/aws-ecr-assets';
import * as eks from 'aws-cdk-lib/aws-eks';
import { KubernetesObjectValue } from 'aws-cdk-lib/aws-eks';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Effect, ManagedPolicy } from 'aws-cdk-lib/aws-iam';
import * as route53 from 'aws-cdk-lib/aws-route53';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { App as Cdk8sApp, Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import { load } from 'js-yaml';
import jsonToPrettyYaml from 'json-to-pretty-yaml';
import _ from 'lodash';

import { bodyCancellationReason } from '../../../../server/services/networkingService/bodyCancellationReason.js';
import { type EnvPreLoadedSecrets } from '../app.js';
import { makeKubectlVersionProps } from '../constants.js';
import {
  Certificate,
  CertificateSpecPrivateKeyAlgorithm,
  CertificateSpecUsages,
  Issuer,
} from '../imports/cert-manager.io.js';
import {
  KubeClusterRole,
  KubeClusterRoleBinding,
  KubeIngress,
  KubeNamespace,
  KubeSecret,
} from '../imports/k8s.js';
import {
  Instrumentation,
  OpenTelemetryCollector,
  OpenTelemetryCollectorSpecMode,
  OpenTelemetryCollectorSpecResourcesRequests,
} from '../imports/opentelemetry.io.js';
import { DeploymentEnvironmentName } from './app_pipeline.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// TODO: actually find some way to verify in TS or with a unit test that a node
// group for all of these types is deployed, and that no other node types are
// deployed. For now, at least using the toInstanceType function helps.
export const deployedArmNodeTypes = [] as const;
export const deployedIntelNodeTypes = [
  'm7i.2xlarge',
  't3.medium',
  't3.2xlarge',
] as const;
export const deployedNodeTypes = [
  ...deployedArmNodeTypes,
  ...deployedIntelNodeTypes,
];

const toInstanceType = (it: DeployedNodeType) => new ec2.InstanceType(it);

export type DeployedNodeType = (typeof deployedNodeTypes)[number];
export type DeployedArmNodeType = (typeof deployedArmNodeTypes)[number];
export type DeployedIntelNodeType = (typeof deployedIntelNodeTypes)[number];

export type K8sOutputs = {
  clusterName: cdk.CfnOutput;
  kubectlRoleArn: cdk.CfnOutput;
  kubectlLambdaRoleArn: cdk.CfnOutput;
  openIdConnectProviderArn: cdk.CfnOutput;
  clusterSecurityGroupId: cdk.CfnOutput;
  kubectlSecurityGroupId: cdk.CfnOutput;
  clusterEndpoint: cdk.CfnOutput;
};

/**
 * Since a k8s cluster is, at least in a minimal way, stateful (e.g., with k8s
 * volumes), and it's also a resource that's pretty slow and expensive to
 * recreate, we don't want to recreate it willy-nilly. So, we need to make sure
 * its logical id is stable, and likely later enable various deletion
 * preventions. To support preventing deletion, we define it in its own stack.
 * This also has the virtue that, if there's some bug in a manifest file we try
 * to deploy to the cluster, the auto cdk rollback of that deploy won't try to
 * delete the cluster itself.
 */
export class K8sClusterStack extends Stack {
  public readonly cluster: eks.Cluster;
  public readonly namespaceName: string;
  public readonly outputs: K8sOutputs;
  public readonly otelCollectorUrl: string;

  constructor(
    scope: Construct,
    id: string,
    props: StackProps &
      Pick<Required<StackProps>, 'env'> & {
        minNodes: number;
        vpc: IVpc;
        preLoadedSecrets: EnvPreLoadedSecrets;
        provisionProdLevelsOfCompute: boolean;
        deploymentEnvironmentName: DeploymentEnvironmentName;
        domain: {
          subdomainName: string;
          zoneName: string;
          hostedZoneId: string;
        };
      },
  ) {
    super(scope, id, props);

    // Set up a kubernetes cluster that our app will run in,
    // and expose it on this.cluster.
    this.cluster = new eks.Cluster(this, 'Cluster', {
      // Some notes about updating the cluster version....
      //
      // 1. In every new kubernetes version, some deprecated apis are removed.
      //    Because we have kubernetes resources that we add manually (for our
      //    deployments), and ones added through helm charts (explicitly listed
      //    in this CDK codebase), plus ones added by high-level CDK constructs
      //    [e.g., this eks.Cluster construct installs the ALB Controller and
      //    the various machinery around integrating kubernetes pods with IAM],
      //    we need some automated, reliable way to scan all these resources for
      //    uses of these would-be-removed APIs. I found two tools online for
      //    that: https://github.com/doitintl/kube-no-trouble and
      //    https://github.com/FairwindsOps/pluto. I haven't tried pluto, but
      //    kubent seems to work well. We can also search through the cluster
      //    audit logs for deprecated APIs. See
      //    https://docs.aws.amazon.com/eks/latest/userguide/control-plane-logs.html#viewing-control-plane-logs
      //    (We'd have to enable cluster audit logging first, which is doable
      //    through CDK, but I haven't bothered for now, to save cost.)
      //
      // 2. When running kubent, it tells us that one of the resources
      //    automatically added by this high-level CDK construct (to integrate
      //    pods with IAM) uses a k8s API that needs upgrading. This suggests
      //    that, to bump the kubernetes cluster version, we'd have to do it
      //    through this CDK prop below, and let CDK handle updating the IAM
      //    integration (specifically, the pod-identity-webhook
      //    MutatingWebhookConfiguration resource in the default namespace).
      //
      // 3. After updating the cluster, we also should update all the things
      //    we've installed, like cluster-autoscaler, the secrets store driver,
      //    the cloudwatch agent, kubernetes metrics server, the ALB controller,
      //    etc. to the latest compatible version. We'll also need to update
      //    the nodes to the latest EKS AMI release version for the corresponding
      //    k8s version we're updating to, found here: https://github.com/awslabs/amazon-eks-ami/releases
      ...makeKubectlVersionProps(this),

      // we'll add a variable-sized node group ourselves below.
      // defaultCapacity: 0 stops cdk from provitisioning one for us (which
      // wouldn't have the right autoscaling settings.)
      defaultCapacity: 0,

      // We want our cluster to be created with a k8s controller that allows it
      // to interface with AWS Load Balancers (which is what ALB stands for
      // here; it does not stand for "Application Load Balancer", as in the rest
      // of the AWS docs). This controller will create a Network Load Balancer
      // to implement Kubernetes's "Service" construct and an Application Load
      // Balancer for K8s's "Ingress" construct. We need the NLB, because that's
      // the only load balancer that's compatible with API Gateway v1 REST APIs.
      albController: { version: eks.AlbControllerVersion.V2_5_1 },

      vpc: props.vpc,

      endpointAccess: eks.EndpointAccess.PRIVATE,

      // TODO: have AWS encrypt the cluster's secrets?
      // https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_eks-readme.html#encryption
    });

    // Create a role that, when assumed by an IAM principal, will alow the
    // principal to access resources in the cluster itself/see those resources
    // in the AWS console (because the role gets mapped into the cluster's RBAC
    // setup) and will allow the principal to interact with the EKS service
    // via the associated policy.
    const clusterAdminRole = new iam.Role(this, 'ClusterAdminRole', {
      // this allows any user in the account where this CDK stack is deployed
      // to assume the role (i.e., the role itself is not restricting who can
      // assume it). But, I think individual users still have to have a policy
      // attached to them that'll let them assume it as well.
      assumedBy: new iam.AccountRootPrincipal(),
    });

    this.cluster.awsAuth.addMastersRole(clusterAdminRole);
    new iam.Policy(this, 'ClusterAdminPolicy', {
      policyName: 'EKSFullAccess',
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'eks:ListClusters',
            'eks:DescribeAddonVersions',
            'eks:CreateCluster',
          ],
          resources: ['*'],
        }),
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['eks:*'],
          resources: [
            'arn:aws:eks:*:361188080279:nodegroup/*/*/*',
            'arn:aws:eks:*:361188080279:cluster/*',
            'arn:aws:eks:*:361188080279:addon/*/*/*',
            'arn:aws:eks:*:361188080279:identityproviderconfig/*/*/*/*',
          ],
        }),
      ],
      roles: [clusterAdminRole],
    });

    // Allow users in the admins group to assume the cluster admin role.
    iam.Group.fromGroupArn(
      this,
      'ClusterAdminGroup',
      'arn:aws:iam::361188080279:group/Admin',
    ).addToPrincipalPolicy(
      new iam.PolicyStatement({
        sid: 'assumeEksAdmin',
        effect: iam.Effect.ALLOW,
        actions: ['sts:AssumeRole'],
        resources: [clusterAdminRole.roleArn],
      }),
    );

    // Set up a namespace that'll hold all our kubernetes resources.
    // It's very convenient to create that in this stack, as then all dependent
    // stacks can just assume that the namespace already exists.
    // This doesn't need to include the environment's name, because each
    // deployment environment has its own cluster.
    //
    // NB: Chart nodes generated by Cdk8s can't be parented by (i.e., directly
    // mixed with) construct nodes from our aws/cdk tree. So, instead, we have
    // to make a new tree parented by a dummy Ck8sApp node as the root node.
    //  Then, we attach that tree (chart) into our cdk cluster.
    this.namespaceName = 'coop';
    this.cluster.addCdk8sChart(
      'ns',
      new Namespace(new Cdk8sApp(), 'ns', {
        name: this.namespaceName,
        // When we pushed a new Deployment for our Service, we were running into
        // an issue where load balancer would deregister the old pods from the
        // target group before the new pods were up and healthy, or at least try
        // to route traffic to the new pods before they were ready. This should
        // force the load balancer to make sure the new pods are up and healthy
        // before draining the old ones. See https://kubernetes-sigs.github.io/aws-load-balancer-controller/v2.1/deploy/pod_readiness_gate/
        labels: { 'elbv2.k8s.aws/pod-readiness-gate-inject': 'enabled' },
        annotations: { 'linkerd.io/inject': 'enabled' },
      }),
      // @ts-ignore The types are wrong here; they specify that the overwrite
      // property isn't allowed, but it's actually passed through and works as
      // expected (see KubernetesManifestProps).
      { overwrite: true },
    );

    // We want the cluster to automatically scale how many underlying EC2 nodes
    // are running. To do that, we have to get the Cluster Autoscaler feature
    // (which is provided by the k8s team but isn't built-in) to talk to our
    // underlying EC2 autoscaling group. To do that, we have to run an AWS
    // controller in the cluster, and give it access to ec2 through another
    // service account. (We grant the access to the ec2 instance info to all
    // nodes in the cluser, which is a bit of overpermissioning -- technically,
    // only the pod running the autoscaler needs this access -- but it's easier
    // this way for now; no need for a separate; instructions to limit this are
    // here: https://github.com/kubernetes/autoscaler/tree/master/charts/cluster-autoscaler#aws---iam-roles-for-service-accounts-irsa)

    // First, though, we have to add variable-sized node groups.
    // These are managed node groups, which is the recommended way:
    // https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_eks-readme.html#managed-node-groups
    // We're not using Fargate nodes, cause they come with limitations/caveats
    // that'd make it slower to get this MVP up and running (even though they
    // might be cheaper).
    const twoXLargeNodesMin = 2;
    const amiReleaseVersion = '1.29.3-20240514';

    const costOptimizedNodeGroupOptions: eks.NodegroupOptions = {
      capacityType: eks.CapacityType.SPOT,
      minSize: 1,
      maxSize: 10,
      instanceTypes: [toInstanceType('t3.2xlarge')],
    };

    const costOptimizedGpuNodeGroupOptions: eks.NodegroupOptions = {
      capacityType: eks.CapacityType.SPOT,
      minSize: 1,
      maxSize: 2,
    };
    const userData = ec2.UserData.forLinux();

    // https://aws.amazon.com/blogs/containers/introducing-ubuntu-support-for-amazon-eks-1-18/
    userData.addExecuteFileCommand({
      filePath: '/etc/eks/bootstrap.sh',
      arguments: this.cluster.clusterName,
    });

    const ubuntuEksLaunchTemplate = new ec2.LaunchTemplate(
      this,
      'UbuntuEksLaunchTemplate',
      {
        // This must be a special ubuntu image as per NVIDIA operator - see the
        // following links:
        // https://docs.nvidia.com/datacenter/cloud-native/gpu-operator/latest/amazon-eks.html#about-using-the-operator-with-amazon-eks
        // https://cloud-images.ubuntu.com/aws-eks/
        // N.B. make sure to use the version that corresponds with the k8s
        // version, e.g. Jammy 1.29 for K8s 1.29

        instanceType: new ec2.InstanceType(
          props.provisionProdLevelsOfCompute ? 'g6.xlarge' : 'g4dn.xlarge',
        ),
        machineImage: ec2.MachineImage.lookup({
          name: 'ubuntu-eks/k8s_1.29/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-20241113',
          owners: ['099720109477'],
          filters: {
            'image-type': ['machine'],
            'image-id': ['ami-073b5635996bead97'],
          },
        }),
        securityGroup: this.cluster.clusterSecurityGroup,
        userData,
        blockDevices: [
          {
            deviceName: '/dev/sda1',
            // The other node groups use 40 by default. We set this higher b/c
            // the triton server image size will be very large with the included
            // embedding model.
            volume: ec2.BlockDeviceVolume.ebs(100),
          },
        ],
      },
    );

    const nodeGroups = [
      this.cluster.addNodegroupCapacity('ClusterNodeGroup', {
        // TODO: consider switching to ARM nodes -- like t4g.medium or maybe
        // t4g.large -- which appear to offer much better value. t4g.medium also
        // supports 17 pods per node (under the default way AWS assigns IPs to
        // pods w/i nodes), which should be enough. See pod-per-node limits at
        // https://github.com/awslabs/amazon-eks-ami/blob/master/files/eni-max-pods.txt
        instanceTypes: [toInstanceType('t3.medium')],
        releaseVersion: amiReleaseVersion,
        minSize: Math.max(0, props.minNodes - twoXLargeNodesMin),
        maxSize: 100,
        diskSize: 40,
        ...(props.provisionProdLevelsOfCompute
          ? {}
          : costOptimizedNodeGroupOptions),
      }),
      // A few of our pods sometimes need more than than the ~3.5gb of memory
      // that's available on a t3.medium for user work, or are more latency-
      // sensitive (or need faster compute) than t3 instances can deliver.
      // So, we create an extra node group of these higher-capacity instances.
      this.cluster.addNodegroupCapacity('ClusterHigherCapacityNodeGroupM7I', {
        instanceTypes: [toInstanceType('m7i.2xlarge')],
        releaseVersion: amiReleaseVersion,
        minSize: twoXLargeNodesMin,
        maxSize: 100,
        diskSize: 40,
        ...(props.provisionProdLevelsOfCompute
          ? {}
          : costOptimizedNodeGroupOptions),
      }),

      this.cluster.addNodegroupCapacity('DefaultGpuGroup', {
        // This must be a special ubuntu image as per NVIDIA operator - see the
        // following links:
        // https://docs.nvidia.com/datacenter/cloud-native/gpu-operator/latest/amazon-eks.html#about-using-the-operator-with-amazon-eks
        // https://cloud-images.ubuntu.com/aws-eks/
        // N.B. make sure to use the version that corresponds with the k8s
        // version, e.g. Jammy 1.29 for K8s 1.29
        // releaseVersion: 'ami-073b5635996bead97',
        // TODO: update these values for prod.
        // instanceTypes: [new ec2.InstanceType('g5.xlarge')],
        // amiType: eks.NodegroupAmiType.
        launchTemplateSpec: {
          // launchTemplateId should be string
          id: ubuntuEksLaunchTemplate.launchTemplateId!,
          version: ubuntuEksLaunchTemplate.latestVersionNumber,
        },
        taints: [
          // This toleration is added by the NVIDIA operator
          {
            effect: eks.TaintEffect.NO_SCHEDULE,
            key: 'nvidia.com/gpu',
          },
        ],
        minSize: 1,
        maxSize: 2,
        // TODO: remove this before serving user traffic.
        capacityType: eks.CapacityType.SPOT,
        ...(props.provisionProdLevelsOfCompute
          ? {}
          : costOptimizedGpuNodeGroupOptions),
      }),
    ];

    // This allows nodes to create repositories in ECR when pulling an image
    // from the ECR pull-thru cache for the first time.
    nodeGroups.forEach((group) => {
      group.role.addManagedPolicy({
        managedPolicyArn:
          'arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryFullAccess',
      });
    });
    const clusterAutoscalerServiceAccount = this.cluster.addServiceAccount(
      'ClusterAutoscalerServiceAccount',
      {
        name: 'cluster-autoscaler',
        // looks like this has to be in same namespace as the autoscaler pods/service for it to be found
        namespace: 'kube-system',
      },
    );

    clusterAutoscalerServiceAccount.addToPrincipalPolicy(
      new iam.PolicyStatement({
        effect: Effect.ALLOW,
        resources: ['*'],
        actions: [
          'autoscaling:DescribeAutoScalingGroups',
          'autoscaling:DescribeAutoScalingInstances',
          'autoscaling:DescribeLaunchConfigurations',
          'autoscaling:DescribeScalingActivities',
          'autoscaling:DescribeInstances',
          'autoscaling:DescribeTags',
          'autoscaling:SetDesiredCapacity',
          'autoscaling:TerminateInstanceInAutoScalingGroup',
          'ec2:DescribeLaunchTemplateVersions',
          'ec2:DescribeImages',
          'ec2:GetInstanceTypesFromInstanceRequirements',
          'ec2:DescribeInstanceTypes',
          'eks:DescribeNodegroup', // needed starting in eks 1.24; see release notes: https://docs.aws.amazon.com/eks/latest/userguide/kubernetes-versions.html#kubernetes-1.24
        ],
      }),
    );

    const autoscalerChart = this.cluster.addHelmChart('ClusterAutoscaler', {
      chart: 'cluster-autoscaler',
      repository: 'https://kubernetes.github.io/autoscaler',
      // Sometimes, you may have to bump this, but also set values.image.tag to
      // a specific, earlier version of the underlying cluster-autoscaler image.
      // See https://github.com/kubernetes/autoscaler/issues/4850#issuecomment-1120399530
      // Generally, though, the version after the 9 should match the kubernetes
      // version (i.e., 9.x.* goes with kubernetes version 1.x.*).
      version: '9.28.0',
      namespace: 'kube-system',
      values: {
        cloudProvider: 'aws',
        awsRegion: this.region, // set from props.env.region
        autoDiscovery: {
          clusterName: this.cluster.clusterName,
        },
        image: {
          repository:
            '361188080279.dkr.ecr.us-east-2.amazonaws.com/k8s/autoscaling/cluster-autoscaler',
        },
        rbac: {
          serviceAccount: {
            create: false,
            name: clusterAutoscalerServiceAccount.serviceAccountName,
          },
        },
        extraArgs: {
          logtostderr: true,
          stderrthreshold: 'info',
          v: 1,
          'balance-similar-node-groups': true,
          // https://linkerd.io/2.14/features/ha/#working-with-cluster-autoscaler
          'skip-nodes-with-local-storage': false,
        },
      },
    });

    autoscalerChart.node.addDependency(clusterAutoscalerServiceAccount);

    // Add drivers etc for getting AWS Secrets Manager secrets into the cluster.
    this.cluster.addHelmChart('SecretsStoreCsiDriver', {
      namespace: 'kube-system',
      repository:
        'https://kubernetes-sigs.github.io/secrets-store-csi-driver/charts',
      chart: 'secrets-store-csi-driver',
      // we need to set this to avoid a resource name length limit.
      release: 'secrets-store-csi-driver',
      version: '1.3.1',
      values: {
        // Allow the driver to sync the secrets into k8s native secrets --
        // rather just mounting the secret content into the pod's filesystem,
        // which is the default behavior -- b/c we want to popluate env vars
        // from the secrets, which only works out of the box with k8s secrets.
        syncSecret: { enabled: true },
        // Poll for changes to secret values in the AWS Secrets Manager, and
        // update the k8s secrets accordingly. This is marginally useful but,
        // more importantly, enabling this causes the CSI driver to update any
        // k8s secrets it's previously generated _when the definition of the
        // corresponding SecretProviderClass resource is updated_. Without this,
        // adding a new secret env var to our API would not work without
        // manually deleting the old `api-secrets` secret in the cluster.
        enableSecretRotation: true,
        rotationPollInterval: '5m',
        linux: {
          image: {
            repository:
              '361188080279.dkr.ecr.us-east-2.amazonaws.com/k8s/csi-secrets-store/driver',
          },
          crds: {
            image: {
              repository:
                '361188080279.dkr.ecr.us-east-2.amazonaws.com/k8s/csi-secrets-store/driver-crds',
            },
          },
          registrarImage: {
            repository:
              '361188080279.dkr.ecr.us-east-2.amazonaws.com/k8s/sig-storage/csi-node-driver-registrar',
          },
          livenessProbeImage: {
            repository:
              '361188080279.dkr.ecr.us-east-2.amazonaws.com/k8s/sig-storage/livenessprobe',
          },
        },
      },
    });

    this.cluster.addHelmChart('AwsPluginForSecretsStoreCsiDriver', {
      namespace: 'kube-system',
      repository: 'https://aws.github.io/secrets-store-csi-driver-provider-aws',
      chart: 'secrets-store-csi-driver-provider-aws',
      version: '0.3.2',
      values: {
        image: {
          repository:
            '361188080279.dkr.ecr.us-east-2.amazonaws.com/ecr-public/aws-secrets-manager/secrets-store-csi-driver-provider-aws',
        },
      },
    });

    // Add Amazon Elastic Block Store (EBS) CSI Driver
    const ebsServiceAccount = this.cluster.addServiceAccount(
      'EbsCsiDriverControllerServiceAccount',
      {
        name: 'ebs-csi-controller-sa',
        namespace: 'kube-system',
      },
    );

    const ebsPolicy = ManagedPolicy.fromAwsManagedPolicyName(
      'service-role/AmazonEBSCSIDriverPolicy',
    );

    ebsServiceAccount.role.addManagedPolicy(ebsPolicy);

    this.cluster.addHelmChart('ElasticBlockStoreCsiDriver', {
      namespace: ebsServiceAccount.serviceAccountNamespace,
      repository: 'https://kubernetes-sigs.github.io/aws-ebs-csi-driver',
      chart: 'aws-ebs-csi-driver',
      version: '2.13.0',
      values: {
        clusterName: this.cluster.clusterName,
        controller: {
          serviceAccount: {
            name: ebsServiceAccount.serviceAccountName,
            create: false,
          },
        },
        sidecars: {
          attacher: {
            image: {
              repository:
                '361188080279.dkr.ecr.us-east-2.amazonaws.com/k8s/sig-storage/csi-attacher',
            },
          },
          livenessProbe: {
            image: {
              repository:
                '361188080279.dkr.ecr.us-east-2.amazonaws.com/k8s/sig-storage/livenessprobe',
            },
          },
          nodeDriverRegistrar: {
            image: {
              repository:
                '361188080279.dkr.ecr.us-east-2.amazonaws.com/k8s/sig-storage/csi-node-driver-registrar',
            },
          },
          provisioner: {
            image: {
              repository:
                '361188080279.dkr.ecr.us-east-2.amazonaws.com/k8s/sig-storage/csi-provisioner',
            },
          },
          resizer: {
            image: {
              repository:
                '361188080279.dkr.ecr.us-east-2.amazonaws.com/k8s/sig-storage/csi-resizer',
            },
          },
          snapshotter: {
            image: {
              repository:
                '361188080279.dkr.ecr.us-east-2.amazonaws.com/k8s/sig-storage/csi-snapshotter',
            },
          },
        },
        image: {
          repository:
            '361188080279.dkr.ecr.us-east-2.amazonaws.com/ecr-public/ebs-csi-driver/aws-ebs-csi-driver',
        },
      },
    });

    // Send logs from the cluster to CloudWatch. Super annoying that this isn't
    // supported out of the box w/ the images that power the nodes. The node IAM
    // policy we attach below is the simplest way to give Cloudwatch all the
    // permissions it needs to access our nodes (and then some). The k8s
    // manifest definitions are adapted from https://raw.githubusercontent.com/aws-samples/amazon-cloudwatch-container-insights/latest/k8s-deployment-manifest-templates/deployment-mode/daemonset/container-insights-monitoring/quickstart/cwagent-fluent-bit-quickstart.yaml
    // which is referenced in https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/Container-Insights-setup-EKS-quickstart.html
    //
    // NB: I did recently discover an (undocumented) AWS-provided helm chart that
    // might be helpful https://github.com/aws/eks-charts/tree/master/stable/aws-for-fluent-bit
    nodeGroups.forEach((nodeGroup) => {
      nodeGroup.role.addManagedPolicy(
        ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentServerPolicy'),
      );
    });

    // Add metrics-server to serve metrics to the horizontal pod autoscaling controller.
    this.cluster.addHelmChart('MetricsServer', {
      chart: 'metrics-server',
      repository: 'https://kubernetes-sigs.github.io/metrics-server/',
      namespace: 'kube-system',
      version: '3.11.0',
      values: {
        replicas: 2,
        image: {
          repository:
            '361188080279.dkr.ecr.us-east-2.amazonaws.com/k8s/metrics-server/metrics-server',
        },
      },
    });

    this.cluster.addServiceAccount('core-dump-handler', {
      name: 'core-dump-handler',
    });

    const bucket = new Bucket(this, 'core-dumps', {
      lifecycleRules: [
        {
          enabled: true,
          expiration: Duration.days(15),
        },
      ],
    });

    const namespace = 'core-dump';

    const role = new iam.Role(this, 'core-dump-admin', {
      assumedBy: new iam.FederatedPrincipal(
        this.cluster.openIdConnectProvider.openIdConnectProviderArn,
        {
          // we have to use CfnJson since this oidc arn resolves at deploy time
          StringEquals: new CfnJson(this, 'ConditionJson', {
            value: {
              // datadog-agent-0-prod-cluster-agent is set in the helm chart
              [`${this.cluster.openIdConnectProvider.openIdConnectProviderIssuer}:sub`]: `system:serviceaccount:${namespace}:core-dump-admin`,
              [`${this.cluster.openIdConnectProvider.openIdConnectProviderIssuer}:aud`]:
                'sts.amazonaws.com',
            },
          }),
        },
        'sts:AssumeRoleWithWebIdentity',
      ),
    });

    role.addToPrincipalPolicy(
      new iam.PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['s3:*'],
        resources: [bucket.bucketArn, `${bucket.bucketArn}/*`],
      }),
    );

    this.cluster.addHelmChart('core-dump-handler', {
      chart: 'core-dump-handler',
      release: 'core-dump-handler',
      version: '8.10.0',
      repository: 'https://ibm.github.io/core-dump-handler',
      namespace,
      createNamespace: true,
      // values from https://github.com/IBM/core-dump-handler/blob/main/charts/core-dump-handler/values.aws.sts.yaml
      values: {
        image: {
          registry: '361188080279.dkr.ecr.us-east-2.amazonaws.com/quay',
        },
        daemonset: {
          includeCrioExe: true,
          vendor: 'rhel7', // EKS EC2 images have an old libc=2.26
          s3BucketName: bucket.bucketName,
          s3Region: this.region,
        },
        serviceAccount: {
          annotations: {
            // See https://docs.aws.amazon.com/eks/latest/userguide/specify-service-account-role.html
            'eks.amazonaws.com/role-arn': `arn:aws:iam::${this.account}:role/${role.roleName}`,
          },
        },
      },
    });

    const autoInstrumentationImage = new DockerImageAsset(
      this,
      'auto-instrumentation-nodejs',
      {
        directory: '../../nodejs-instrumentation',
        platform: Platform.LINUX_AMD64,
      },
    );
    const opentelemetryNamespace = 'opentelemetry';

    const otelOperator = this.cluster.addHelmChart('open-telemetry-operator', {
      chart: 'opentelemetry-operator',
      release: 'opentelemetry-operator',
      version: '0.68.1',
      repository: 'https://open-telemetry.github.io/opentelemetry-helm-charts',
      namespace: opentelemetryNamespace,
      createNamespace: true,
      wait: true,
      values: {
        manager: {
          image: {
            repository:
              '361188080279.dkr.ecr.us-east-2.amazonaws.com/ghcr/open-telemetry/opentelemetry-operator/opentelemetry-operator',
            tag: '0.108.0',
          },
          autoInstrumentationImage: {
            nodejs: {
              repository: autoInstrumentationImage.repository.repositoryUri,
              tag: autoInstrumentationImage.imageTag,
            },
          },
          collectorImage: {
            repository:
              '361188080279.dkr.ecr.us-east-2.amazonaws.com/ghcr/open-telemetry/opentelemetry-collector-releases/opentelemetry-collector-contrib',
          },
          targetAllocatorImage: {
            repository:
              '361188080279.dkr.ecr.us-east-2.amazonaws.com/ghcr/open-telemetry/opentelemetry-operator/target-allocator',
          },
        },
        kubeRBACProxy: {
          image: {
            repository:
              '361188080279.dkr.ecr.us-east-2.amazonaws.com/quay/brancz/kube-rbac-proxy',
          },
        },
      },
    });

    const openTelemetryChart = new Chart(
      new Cdk8sApp(),
      'instrumentation-chart',
      { namespace: opentelemetryNamespace },
    );

    new Instrumentation(openTelemetryChart, 'instrumentation', {
      metadata: {
        name: 'default',
        namespace: opentelemetryNamespace,
      },
      spec: {
        nodejs: {
          image: autoInstrumentationImage.imageUri,
        },
      },
    });

    new KubeSecret(openTelemetryChart, 'datadog-secret', {
      metadata: {
        name: 'datadog-secret',
        namespace: opentelemetryNamespace,
      },
      // using stringData will tell k8s to base64 encode the values so we don't
      // have to do that ourselves
      stringData: {
        // yes this is a secret in plaintext, but it's already in our codebase:
        // see datadog.ts
        DD_API_KEY: '4d394dffc4ef84960adc58460c0505c1',
      },
    });

    const { hostedZoneId, zoneName, subdomainName } = props.domain;

    const siteFQDN = subdomainName
      ? `${subdomainName}.${zoneName}`
      : `${zoneName}`;
    const otelCollectorFQDN = subdomainName
      ? `otel-collector-${subdomainName}.${zoneName}`
      : `otel-collector.${zoneName}`;

    const calculateMemLimits = (memGi: number) => {
      const hardMemlimitMi = memGi * 1024;
      const softMemLimitMi = Math.floor(hardMemlimitMi * 0.8);
      return { hardMemlimitMi, softMemLimitMi };
    };

    const defaultCollectorMemLimits = calculateMemLimits(4);
    const targetAllocatorMemLimits = calculateMemLimits(0.5);

    const collectorName = 'default';
    const crdDirectoryPath = path.join(__dirname, '../../crds');
    const files = readdirSync(crdDirectoryPath);

    files.forEach((file) => {
      const crdFilePath = path.join(crdDirectoryPath, file);
      const crdFileContent = readFileSync(crdFilePath, 'utf8');
      const crd = load(crdFileContent) as any;
      const id = path.basename(file, '.yaml');
      this.cluster.addManifest(id, crd);
    });

    new OpenTelemetryCollector(openTelemetryChart, 'collector', {
      metadata: {
        name: collectorName,
        namespace: opentelemetryNamespace,
      },
      spec: {
        // we use 1 replica for now to simplify the architecture for tail
        // sampling. All spans for a trace must be sent to the same collector,
        // so if we want to run multiple replicas we will need an additional
        // collector in front of this one in order to load balance the spans.
        replicas: 1,
        env: [
          {
            name: 'GOMEMLIMIT',
            value: `${defaultCollectorMemLimits.softMemLimitMi}MiB`,
          },
        ],
        envFrom: [
          {
            secretRef: {
              name: 'datadog-secret',
            },
          },
        ],
        podAnnotations: {
          'linkerd.io/inject': 'enabled',
        },
        config: jsonToPrettyYaml.stringify({
          receivers: {
            otlp: {
              protocols: {
                grpc: {},
                http: {
                  cors: {
                    // NB: '*' doesn't work here. You must at least specify the
                    // protocol.
                    // NB: It's probably true that only the http origin is
                    // needed as ALB terminates TLS, but it can't hurt to
                    // include both and maybe one day we'll need it.
                    allowed_origins: [
                      `http://${siteFQDN}`,
                      `https://${siteFQDN}`,
                    ],
                  },
                },
              },
            },
            awsxray: {
              endpoint: '0.0.0.0:2000',
              transport: 'udp',
            },
            opencensus: {},
          },
          processors: {
            memory_limiter: {
              limit_mib: defaultCollectorMemLimits.hardMemlimitMi,
              check_interval: '1s',
            },
            // # The batch processor batches telemetry data into larger payloads.
            // # It is necessary for the Datadog traces exporter to work optimally,
            // # and is recommended for any production pipeline.
            batch: {
              //   # Datadog APM Intake limit is 3.2MB. Let's make sure the batches do not
              //   # go over that.
              send_batch_max_size: 1000,
              send_batch_size: 100,
              timeout: '10s',
            },
            resource: {
              attributes: [
                {
                  key: 'deployment.environment',
                  value: props.deploymentEnvironmentName.toLowerCase(),
                  action: 'insert',
                },
              ],
            },
            'transform/internal': {
              trace_statements: [
                // This rule is for spans generated by calling
                // Response.body.cancel() via undici. See
                // https://github.com/open-telemetry/opentelemetry-js-contrib/issues/2482
                {
                  // In this case the identifying error message is on the
                  // spanevent. Fortunately, we can access the span context from
                  // the spanevent allowing us to modify the span status code.
                  context: 'spanevent',
                  conditions: [
                    `attributes["exception.message"] == "${bodyCancellationReason}"`,
                  ],
                  statements: ['set(span.status.code, STATUS_CODE_OK)'],
                },
                // This happens when we enqueue a job in MRT that already
                // exists.
                {
                  // In this case the identifying error message is on the span
                  // context under status.message.
                  context: 'span',
                  conditions: [
                    `status.message == "duplicate key value violates unique constraint \\\"job_creations_pkey\\\""`,
                  ],
                  statements: ['set(status.code, STATUS_CODE_OK)'],
                },
              ],
            },
            transform: {
              trace_statements: [
                // Xray spans
                {
                  context: 'span',
                  conditions: ['attributes["http.url"] != nil'],
                  statements: [
                    'set(attributes["resource.name"], Concat([attributes["http.method"], URL(attributes["http.url"])["url.path"]], " "))',
                  ],
                },
                // Linkerd spans
                {
                  context: 'span',
                  conditions: ['attributes["http.path"] != nil'],
                  statements: [
                    'set(attributes["resource.name"], Concat([attributes["http.method"], attributes["http.path"]], " "))',
                  ],
                },
              ],
            },
            tail_sampling: {
              policies: [
                {
                  name: 'sample errors',
                  type: 'status_code',
                  status_code: {
                    status_codes: ['ERROR', 'UNSET'],
                  },
                },
                {
                  name: 'probabilistic sampler',
                  type: 'probabilistic',
                  probabilistic: {
                    sampling_percentage: 10,
                  },
                },
              ],
            },
          },
          connectors: {
            'datadog/connector': {},
          },
          exporters: {
            datadog: {
              api: {
                key: '${env:DD_API_KEY}',
              },
            },
          },
          extensions: {
            // provides a health check at port 13133
            health_check: {},
            // provides various monitoring capabilities at port 55679
            zpages: {},
            // enables the pprof profiler at port 1777
            pprof: {},
          },
          service: {
            extensions: ['health_check', 'zpages', 'pprof'],
            pipelines: {
              'traces/thirdparty-in': {
                receivers: ['awsxray', 'opencensus'],
                processors: [
                  'memory_limiter',
                  'batch',
                  'resource',
                  'transform',
                ],
                exporters: ['datadog/connector'],
              },
              'traces/otlp-in': {
                receivers: ['otlp'],
                processors: ['memory_limiter', 'batch', 'transform/internal'],
                exporters: ['datadog/connector'],
              },
              'traces/out': {
                receivers: ['datadog/connector'],
                processors: ['tail_sampling'],
                exporters: ['datadog'],
              },
              metrics: {
                receivers: ['otlp', 'datadog/connector'],
                processors: ['memory_limiter', 'batch'],
                exporters: ['datadog'],
              },
            },
            telemetry: {
              logs: {
                encoding: 'json',
              },
              metrics: {
                readers: [
                  {
                    periodic: {
                      interval: 10000,
                      exporter: {
                        otlp: {
                          protocol: 'grpc/protobuf',
                          endpoint: 'monitor-collector:4317',
                        },
                      },
                    },
                  },
                ],
              },
              traces: {
                processors: [
                  {
                    batch: {
                      exporter: {
                        otlp: {
                          protocol: 'grpc/protobuf',
                          // this will default to https if you do not specify
                          // the protocol. The `insecure` flag does not override
                          // this default. Interestingly, the metrics exporter
                          // above has no issue without the protocol specified.
                          endpoint: 'http://monitor-collector:4317',
                        },
                      },
                    },
                  },
                ],
              },
            },
          },
        }),
        resources: {
          requests: {
            cpu: OpenTelemetryCollectorSpecResourcesRequests.fromString('3'),
            memory: OpenTelemetryCollectorSpecResourcesRequests.fromString(
              `${defaultCollectorMemLimits.hardMemlimitMi}Mi`,
            ),
          },
        },
      },
    });

    // We deploy a separate collector for the Target Allocator because it
    // requires running in a StatefulSet or DaemonSet. We choose Statefulset
    // here but either way, it will necessitate downtime with every deployment
    // since it must use the Recreate deployment strategy. The normal
    // 'deployment' mode uses the RollingUpdate strategy which allows for
    // zero-downtime deployments and that is ideal for accepting traces (we
    // don't want to miss any). So with this setup we minimize the downtime to
    // only this workload which only scrapes for metrics we won't lose any data
    // unless we happen to miss a scrape interval which should be infrequent and
    // inherently unavoidable with otel's tooling.

    // The motivation to use the Target Allocator is to enable compatibility
    // between the otel collector and Prometheus ServiceMonitor + PodMonitor
    // resources. These are commonly included in helm charts to simplify the
    // monitoring setup for the chart user. With the TA this will allow us to
    // collect metrics from these off-the-shelf charts for free as well as
    // colocate our scrape config with the workload it's scraping.
    const taCollector = new OpenTelemetryCollector(
      openTelemetryChart,
      'target-allocator-collector',
      {
        metadata: {
          name: 'target-allocator',
        },
        spec: {
          // this must be statefulset or daemonset for use of the Target Allocator
          // we're running one instance for now, eventually we can upgrade to
          // daemonset when we need to
          mode: OpenTelemetryCollectorSpecMode.STATEFULSET,
          targetAllocator: {
            enabled: true,
            // This allows the TA to interpret ServiceMonitor + PodMonitor
            // resources
            prometheusCr: {
              enabled: true,
            },
          },
          replicas: 1,
          env: [
            {
              name: 'GOMEMLIMIT',
              value: `${targetAllocatorMemLimits.softMemLimitMi}MiB`,
            },
          ],
          envFrom: [
            {
              secretRef: {
                name: 'datadog-secret',
              },
            },
          ],
          config: jsonToPrettyYaml.stringify({
            receivers: {
              prometheus: {
                config: {
                  scrape_configs: [
                    {
                      job_name: 'otel_collector',
                      scrape_interval: '10s',
                      static_configs: [
                        {
                          targets: ['0.0.0.0:8888'],
                        },
                      ],
                    },
                  ],
                },
              },
            },
            processors: {
              memory_limiter: {
                limit_mib: targetAllocatorMemLimits.hardMemlimitMi,
                check_interval: '1s',
              },
              // # The batch processor batches telemetry data into larger payloads.
              batch: {
                //   # Datadog APM Intake limit is 3.2MB. Let's make sure the batches do not
                //   # go over that.
                send_batch_max_size: 1000,
                send_batch_size: 100,
                timeout: '10s',
              },
            },
            exporters: {
              datadog: {
                api: {
                  key: '${env:DD_API_KEY}',
                },
              },
            },
            extensions: {
              // provides a health check at port 13133
              health_check: {},
              // provides various monitoring capabilities at port 55679
              zpages: {},
              // enables the pprof profiler at port 1777
              pprof: {},
            },
            service: {
              extensions: ['health_check', 'zpages', 'pprof'],
              pipelines: {
                metrics: {
                  receivers: ['prometheus'],
                  processors: ['memory_limiter', 'batch'],
                  exporters: ['datadog'],
                },
              },
              telemetry: {
                logs: {
                  encoding: 'json',
                },
                metrics: {
                  readers: [
                    {
                      periodic: {
                        interval: 10000,
                        exporter: {
                          otlp: {
                            protocol: 'grpc/protobuf',
                            endpoint: 'monitor-collector:4317',
                          },
                        },
                      },
                    },
                  ],
                },
                traces: {
                  processors: [
                    {
                      batch: {
                        exporter: {
                          otlp: {
                            protocol: 'grpc/protobuf',
                            // this will default to https if you do not specify
                            // the protocol. The `insecure` flag does not override
                            // this default. Interestingly, the metrics exporter
                            // above has no issue without the protocol specified.
                            endpoint: 'http://monitor-collector:4317',
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          }),
          resources: {
            requests: {
              cpu: OpenTelemetryCollectorSpecResourcesRequests.fromString(
                '500m',
              ),
              memory: OpenTelemetryCollectorSpecResourcesRequests.fromString(
                `${targetAllocatorMemLimits.hardMemlimitMi}Mi`,
              ),
            },
          },
        },
      },
    );

    // taken from docs: https://github.com/open-telemetry/opentelemetry-operator/blob/main/cmd/otel-allocator/README.md#rbac
    const clusterrole = new KubeClusterRole(
      openTelemetryChart,
      'target-allocator-cluster-role',
      {
        metadata: {
          name: 'target-allocator-cluster-role',
        },
        rules: [
          {
            apiGroups: [''],
            resources: [
              'nodes',
              'nodes/metrics',
              'services',
              'endpoints',
              'pods',
            ],
            verbs: ['get', 'list', 'watch'],
          },
          {
            apiGroups: [''],
            resources: ['configmaps'],
            verbs: ['get'],
          },
          {
            apiGroups: ['discovery.k8s.io'],
            resources: ['endpointslices'],
            verbs: ['get', 'list', 'watch'],
          },
          {
            apiGroups: ['networking.k8s.io'],
            resources: ['ingresses'],
            verbs: ['get', 'list', 'watch'],
          },
          {
            nonResourceUrLs: ['/metrics'],
            verbs: ['get'],
          },
          {
            apiGroups: ['monitoring.coreos.com'],
            resources: ['servicemonitors', 'podmonitors'],
            verbs: ['*'],
          },
          {
            apiGroups: [''],
            resources: ['namespaces'],
            verbs: ['get', 'list', 'watch'],
          },
        ],
      },
    );

    new KubeClusterRoleBinding(
      openTelemetryChart,
      'target-allocator-cluster-role-binding',
      {
        metadata: {
          name: 'target-allocator-cluster-role-binding',
        },
        roleRef: {
          apiGroup: 'rbac.authorization.k8s.io',
          kind: 'ClusterRole',
          name: clusterrole.name,
        },
        subjects: [
          {
            kind: 'ServiceAccount',
            // this service account is created by via the otel collector CR
            name: `${taCollector.name}-targetallocator`,
            namespace: opentelemetryNamespace,
          },
        ],
      },
    );

    // We deploy a second collector here in order to ship the internal traces
    // from the first collector to datadog since it is currently impossible to
    // for a collector to ship its own traces (see
    // https://github.com/open-telemetry/opentelemetry-collector/issues/10711).
    // Since we have a second collector, we may as well use it to collect
    // internal metrics from the primary collector as opposed to self-reporting
    // them. A lot of the confinguration here is duplicated so maybe we should
    // figure out a way to reuse it. For now it seems simple enough to manage as
    // is.
    new OpenTelemetryCollector(openTelemetryChart, 'collector-monitor', {
      metadata: {
        name: 'monitor',
        namespace: opentelemetryNamespace,
      },
      spec: {
        replicas: 1,
        envFrom: [
          {
            secretRef: {
              name: 'datadog-secret',
            },
          },
        ],
        config: jsonToPrettyYaml.stringify({
          receivers: {
            otlp: {
              protocols: {
                grpc: {},
              },
            },
          },
          processors: {
            batch: {
              send_batch_max_size: 1000,
              send_batch_size: 100,
              timeout: '10s',
            },
            resource: {
              attributes: [
                {
                  key: 'deployment.environment',
                  value: props.deploymentEnvironmentName.toLowerCase(),
                  action: 'insert',
                },
              ],
            },
            tail_sampling: {
              policies: [
                {
                  name: 'always sample errors',
                  type: 'status_code',
                  status_code: {
                    status_codes: ['ERROR', 'UNSET'],
                  },
                },
                {
                  name: 'probabilistic sampler',
                  type: 'probabilistic',
                  probabilistic: {
                    sampling_percentage: 10,
                  },
                },
              ],
            },
          },
          connectors: {
            'datadog/connector': {},
          },
          exporters: {
            datadog: {
              api: {
                key: '${env:DD_API_KEY}',
              },
            },
          },
          service: {
            pipelines: {
              metrics: {
                receivers: ['otlp', 'datadog/connector'],
                processors: ['batch'],
                exporters: ['datadog'],
              },
              'traces/in': {
                receivers: ['otlp'],
                processors: ['batch', 'resource'],
                exporters: ['datadog/connector'],
              },
              'traces/out': {
                receivers: ['datadog/connector'],
                processors: ['tail_sampling'],
                exporters: ['datadog'],
              },
            },
            telemetry: {
              logs: {
                encoding: 'json',
              },
              metrics: {
                readers: [
                  {
                    periodic: {
                      interval: 10000,
                      exporter: {
                        otlp: {
                          protocol: 'grpc/protobuf',
                          endpoint: 'localhost:4317',
                        },
                      },
                    },
                  },
                ],
              },
            },
          },
        }),
      },
    });

    new KubeIngress(openTelemetryChart, 'otel-collector-ingress', {
      metadata: {
        name: `${collectorName}-ingress`,
        namespace: opentelemetryNamespace,
        annotations: {
          'alb.ingress.kubernetes.io/certificate-arn':
            'arn:aws:acm:us-east-2:361188080279:certificate/424a3a55-72a3-42ee-8b4d-fb5f44c20d64',
          'alb.ingress.kubernetes.io/healthcheck-port': '13133',
          'alb.ingress.kubernetes.io/scheme': 'internet-facing',
          'alb.ingress.kubernetes.io/target-type': 'ip',
        },
      },
      spec: {
        ingressClassName: 'alb',
        rules: [
          {
            http: {
              paths: [
                {
                  path: '/',
                  pathType: 'Prefix',
                  backend: {
                    service: {
                      name: `${collectorName}-collector`,
                      port: {
                        // otlp-http receiever port
                        number: 4318,
                      },
                    },
                  },
                },
              ],
            },
          },
        ],
      },
    });

    const zone = route53.HostedZone.fromHostedZoneAttributes(
      this,
      `${otelCollectorFQDN}-zone`,
      { hostedZoneId, zoneName },
    );

    const instrumentationManifest = this.cluster.addCdk8sChart(
      'instrumentation',
      openTelemetryChart,
    );

    instrumentationManifest.node.addDependency(otelOperator);

    const albHostNameName = new KubernetesObjectValue(
      this,
      'otel-collector-alb-domain-name',
      {
        cluster: this.cluster,
        objectType: 'ingress',
        objectNamespace: opentelemetryNamespace,
        objectName: `${collectorName}-ingress`,
        jsonPath: '.status.loadBalancer.ingress[0].hostname',
      },
    );

    new route53.CnameRecord(this, `${otelCollectorFQDN}-alias`, {
      recordName: otelCollectorFQDN,
      zone,
      domainName: albHostNameName.value,
    });

    albHostNameName.node.addDependency(instrumentationManifest);
    this.otelCollectorUrl = `https://${otelCollectorFQDN}/v1/traces`;

    const certManagerValuesHa = {
      replicaCount: 2,
      webhook: {
        replicaCount: 3,
        podDisruptionBudget: {
          enabled: true,
          minAvailable: 1,
        },
      },
      cainjector: {
        replicaCount: 2,
        podDisruptionBudget: {
          enabled: true,
          minAvailable: 1,
        },
      },
      podDisruptionBudget: {
        enabled: true,
        minAvailable: 1,
      },
    };

    // See
    // https://linkerd.io/2.14/tasks/automatically-rotating-control-plane-tls-credentials/#
    // for an explanation on how to set up Automatically Rotating Control Plane
    // TLS Credentials for Linkerd.
    this.cluster.addHelmChart('cert-manager', {
      chart: 'cert-manager',
      release: 'cert-manager',
      version: '1.13.3',
      repository: 'https://charts.jetstack.io',
      namespace: 'cert-manager',
      createNamespace: true,
      values: _.merge(
        props.provisionProdLevelsOfCompute ? certManagerValuesHa : {},
        {
          // If true, CRD resources will be installed as part of the Helm chart.
          // If enabled, when uninstalling CRD resources will be deleted causing
          // all installed custom resources to be DELETED
          installCRDs: true,
          image: {
            repository:
              '361188080279.dkr.ecr.us-east-2.amazonaws.com/quay/jetstack/cert-manager-controller',
          },
          webhook: {
            image: {
              repository:
                '361188080279.dkr.ecr.us-east-2.amazonaws.com/quay/jetstack/cert-manager-webhook',
            },
          },
          cainjector: {
            image: {
              repository:
                '361188080279.dkr.ecr.us-east-2.amazonaws.com/quay/jetstack/cert-manager-cainjector',
            },
          },
          acmesolver: {
            image: {
              repository:
                '361188080279.dkr.ecr.us-east-2.amazonaws.com/quay/jetstack/cert-manager-acmesolver',
            },
          },
          startupapicheck: {
            image: {
              repository:
                '361188080279.dkr.ecr.us-east-2.amazonaws.com/quay/jetstack/cert-manager-ctl',
            },
          },
        },
      ),
    });
    const linkerdNamespace = 'linkerd';

    const linkerdCrds = this.cluster.addHelmChart('linkerd-crds', {
      chart: 'linkerd-crds',
      release: 'linkerd-crds',
      repository: 'https://helm.linkerd.io/stable',
      version: '1.8.0',
      namespace: linkerdNamespace,
      createNamespace: true,
    });
    const trustAnchorSecretName = 'linkerd-trust-anchor';

    const linkerdTrustAnchorChart = new Chart(
      new Cdk8sApp(),
      'linkerd-trust-anchor-chart',
      {},
    );

    new KubeSecret(linkerdTrustAnchorChart, 'trust-anchor-secret', {
      type: 'kubernetes.io/tls',
      metadata: {
        namespace: linkerdNamespace,
        name: trustAnchorSecretName,
      },
      data: {
        'tls.crt': Buffer.from(
          props.preLoadedSecrets.linkerdTrustAnchorSigningPair.cert,
        ).toString('base64'),
        'tls.key': Buffer.from(
          props.preLoadedSecrets.linkerdTrustAnchorSigningPair.key,
        ).toString('base64'),
      },
    });
    const linkerdIssuerName = 'linkerd-trust-anchor';

    new Issuer(linkerdTrustAnchorChart, 'linkerdIssuer', {
      metadata: {
        name: linkerdIssuerName,
        namespace: linkerdNamespace,
      },
      spec: {
        ca: {
          secretName: trustAnchorSecretName,
        },
      },
    });

    new Certificate(linkerdTrustAnchorChart, 'linkerdCertificate', {
      metadata: {
        name: 'linkerd-identity-issuer',
        namespace: linkerdNamespace,
      },
      spec: {
        secretName: 'linkerd-identity-issuer',
        duration: '48h',
        renewBefore: '25h',
        issuerRef: {
          name: linkerdIssuerName,
          kind: 'Issuer',
        },
        commonName: 'identity.linkerd.cluster.local',
        dnsNames: ['identity.linkerd.cluster.local'],
        isCa: true,
        privateKey: {
          algorithm: CertificateSpecPrivateKeyAlgorithm.ECDSA,
        },
        usages: [
          CertificateSpecUsages.CERT_SIGN,
          CertificateSpecUsages.CRL_SIGN,
          CertificateSpecUsages.SERVER_AUTH,
          CertificateSpecUsages.CLIENT_AUTH,
        ],
      },
    });

    this.cluster.addCdk8sChart(
      'linkerd-auto-cert-rotation-resources',
      linkerdTrustAnchorChart,
    );
    // sourced from
    // https://github.com/linkerd/linkerd2/blob/main/charts/linkerd-control-plane/values-ha.yaml
    const valuesHA = {
      enablePodDisruptionBudget: true,
      deploymentStrategy: {
        rollingUpdate: {
          maxUnavailable: 1,
          maxSurge: '25%',
        },
      },
      enablePodAntiAffinity: true,
      proxy: {
        resources: {
          cpu: {
            request: '100m',
          },
          memory: {
            limit: '250Mi',
            request: '20Mi',
          },
        },
      },
      controllerReplicas: 3,
      controllerResources: {
        cpu: {
          limit: '',
          request: '100m',
        },
        memory: {
          limit: '250Mi',
          request: '50Mi',
        },
      },
      destinationResources: {
        cpu: {
          limit: '',
          request: '100m',
        },
        memory: {
          limit: '250Mi',
          request: '50Mi',
        },
      },
      identityResources: {
        cpu: {
          limit: '',
          request: '100m',
        },
        memory: {
          limit: '250Mi',
          request: '10Mi',
        },
      },
      heartbeatResources: {
        cpu: {
          limit: '',
          request: '100m',
        },
        memory: {
          limit: '250Mi',
          request: '50Mi',
        },
      },
      proxyInjectorResources: {
        cpu: {
          limit: '',
          request: '100m',
        },
        memory: {
          limit: '250Mi',
          request: '50Mi',
        },
      },
      webhookFailurePolicy: 'Fail',
      spValidatorResources: {
        cpu: {
          limit: '',
          request: '100m',
        },
        memory: {
          limit: '250Mi',
          request: '50Mi',
        },
      },
      policyControllerResources: {
        cpu: {
          limit: '',
          request: '100m',
        },
        memory: {
          limit: '250Mi',
          request: '50Mi',
        },
      },
      highAvailability: true,
    };

    const linkerdHelmChart = this.cluster.addHelmChart(
      'linkerd-control-plane',
      {
        chart: 'linkerd-control-plane',
        release: 'linkerd-control-plane',
        repository: 'https://helm.linkerd.io/stable',
        version: '1.16.9',
        namespace: linkerdNamespace,
        values: _.merge(props.provisionProdLevelsOfCompute ? valuesHA : {}, {
          identity: { issuer: { scheme: 'kubernetes.io/tls' } },
          identityTrustAnchorsPEM:
            props.preLoadedSecrets.linkerdTrustAnchorSigningPair.cert,
          controllerImage:
            '361188080279.dkr.ecr.us-east-2.amazonaws.com/linkerd/controller',
          controllerLogLevel: 'warn',
          controllerLogFormat: 'json',
          policyController: {
            image: {
              name: '361188080279.dkr.ecr.us-east-2.amazonaws.com/linkerd/policy-controller',
            },
          },
          proxy: {
            logLevel: 'warn,linkerd=warn,trust_dns=error',
            logFormat: 'json',
            image: {
              // this fork of the linkerd-proxy image supports xray trace
              // headers
              name: 'jholm117/linkerd-proxy',
              version: 'latest',
            },
            // This is needed for the HPA resources to work on staging.
            resources: {
              cpu: {
                request: '100m',
              },
              memory: {
                request: '20Mi',
              },
            },
            // We were seeing consistent 502s on roling deployments so we're
            // configuring this to be greater than the sleep configured in our
            // container's preStop hook (15) and less than
            // terminationGracePeriodSeconds (90).
            // https://linkerd.io/2.14/tasks/graceful-shutdown/#slow-updating-clients
            waitBeforeExitSeconds: 17,
          },
          proxyInit: {
            logLevel: 'warn',
            logFormat: 'json',
            image: {
              name: '361188080279.dkr.ecr.us-east-2.amazonaws.com/linkerd/proxy-init',
            },
          },
          debugContainer: {
            image: {
              name: '361188080279.dkr.ecr.us-east-2.amazonaws.com/linkerd/debug',
            },
          },
          networkValidator: {
            logFormat: 'json',
          },
          imagePullPolicy: 'Always',
        }),
      },
    );
    linkerdHelmChart.node.addDependency(linkerdCrds);

    this.cluster.addHelmChart('linkerd-viz', {
      chart: 'linkerd-viz',
      release: 'linkerd-viz',
      repository: 'https://helm.linkerd.io/stable',
      version: '30.12.9',
      namespace: 'linkerd-viz',
      createNamespace: true,
      values: {
        defaultRegistry: '361188080279.dkr.ecr.us-east-2.amazonaws.com/linkerd',
        defaultLogFormat: 'json',
        prometheus: {
          image: {
            registry: '361188080279.dkr.ecr.us-east-2.amazonaws.com/prom',
          },
        },
      },
    });

    this.cluster.addHelmChart('linkerd-jaeger', {
      chart: 'linkerd-jaeger',
      release: 'linkerd-jaeger',
      repository: 'https://helm.linkerd.io/stable',
      version: '30.12.11',
      namespace: 'linkerd-jaeger',
      createNamespace: true,
      values: {
        collector: { enabled: false },
        jaeger: { enabled: false },
        webhook: {
          collectorSvcAccount: 'default-collector',
          collectorSvcAddr: 'default-collector.opentelemetry:55678',
          image: {
            name: '361188080279.dkr.ecr.us-east-2.amazonaws.com/linkerd/jaeger-webhook',
          },
        },
      },
    });

    const argoRolloutsNamespaceName = `argo-rollouts`;
    const argoRolloutsServiceAccountName = `argo-rollouts-controller`;
    const argoRolloutsServiceAccount = this.cluster.addServiceAccount(
      `argo-controller-service-account`,
      {
        name: argoRolloutsServiceAccountName,
        namespace: argoRolloutsNamespaceName,
      },
    );

    argoRolloutsServiceAccount.addToPrincipalPolicy(
      new iam.PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['cloudwatch:GetMetricData'],
        resources: ['*'],
      }),
    );

    this.cluster.addHelmChart('argo-rollouts', {
      chart: 'argo-rollouts',
      release: 'argo-rollouts',
      repository: 'https://argoproj.github.io/argo-helm',
      version: '2.36.0',
      namespace: argoRolloutsNamespaceName,
      createNamespace: true,
      values: {
        dashboard: {
          enabled: true,
          image: {
            registry: '361188080279.dkr.ecr.us-east-2.amazonaws.com/quay',
          },
          ingress: {
            enabled: true,
            annotations: {
              'alb.ingress.kubernetes.io/scheme': 'internal',
              'alb.ingress.kubernetes.io/target-type': 'ip',
            },
            ingressClassName: 'alb',
          },
        },
        controller: {
          extraEnv: [
            {
              name: 'AWS_REGION',
              value: this.region,
            },
          ],
          logging: {
            level: 'warn',
            format: 'json',
          },
          metrics: {
            enabled: true,
          },
          image: {
            registry: '361188080279.dkr.ecr.us-east-2.amazonaws.com/quay',
          },
        },
        notifications: {
          secret: {
            create: true,
            items: {
              'slack-token': '',
              'opsgenie-token': '',
            },
          },
          notifiers: {
            'service.slack': jsonToPrettyYaml.stringify({
              token: '$slack-token',
            }),
            'service.opsgenie': jsonToPrettyYaml.stringify({
              apiUrl: 'api.opsgenie.com',
              apiKeys: {
                Engineers: '$opsgenie-token',
              },
            }),
          },
          templates: {
            'template.rollout-completed': jsonToPrettyYaml.stringify({
              message:
                'Rollout {{.rollout.metadata.name}} has been completed.\nLink to commit: https://github.com/roostorg/coop/commit/{{index .rollout.metadata.annotations "getcoop.com/git-commit-sha"}}',
              slack: {},
            }),
            'template.rollout-aborted': jsonToPrettyYaml.stringify({
              message: 'Rollout {{.rollout.metadata.name}} has been aborted.',
              slack: {},
              opsgenie: {
                description:
                  'Rollout: {{.rollout.metadata.name}} was aborted. You should push a fix or revert this change in GitHub.\nLink to commit: https://github.com/roostorg/coop/commit/{{index .rollout.metadata.annotations "getcoop.com/git-commit-sha"}}',
                priority: 'P3',
                alias: '{{.rollout.metadata.name}}',
                note: 'Error from Argo Rollouts!',
              },
            }),
          },
          triggers: {
            'trigger.on-rollout-completed': jsonToPrettyYaml.stringify([
              {
                send: ['rollout-completed'],
              },
            ]),
            'trigger.on-rollout-aborted': jsonToPrettyYaml.stringify([
              {
                send: ['rollout-aborted'],
              },
            ]),
          },
        },
        serviceAccount: {
          create: false,
          name: argoRolloutsServiceAccountName,
        },
      },
    });

    this.cluster.addHelmChart('nvidia-gpu-operator', {
      chart: 'gpu-operator',
      release: 'gpu-operator',
      repository: 'https://helm.ngc.nvidia.com/nvidia',
      version: '24.9.0',
      namespace: 'nvidia-gpu-operator',
      createNamespace: true,
      values: {
        'node-feature-discovery': {
          image: {
            repository:
              '361188080279.dkr.ecr.us-east-2.amazonaws.com/k8s/nfd/node-feature-discovery',
          },
        },
        dcgmExporter: {
          repository: '361188080279.dkr.ecr.us-east-2.amazonaws.com/nvidia/k8s',
          serviceMonitor: {
            enabled: true,
          },
        },
        devicePlugin: {
          repository: '361188080279.dkr.ecr.us-east-2.amazonaws.com/nvidia',
        },
        driver: {
          manager: {
            repository:
              '361188080279.dkr.ecr.us-east-2.amazonaws.com/nvidia/cloud-native',
          },
          repository: '361188080279.dkr.ecr.us-east-2.amazonaws.com/nvidia',
        },
        gfd: {
          repository: '361188080279.dkr.ecr.us-east-2.amazonaws.com/nvidia',
        },
        operator: {
          initContainer: {
            repository: '361188080279.dkr.ecr.us-east-2.amazonaws.com/nvidia',
          },
          logging: {
            level: 'error',
          },
          repository: '361188080279.dkr.ecr.us-east-2.amazonaws.com/nvidia',
        },
        sandboxDevicePlugin: {
          repository: '361188080279.dkr.ecr.us-east-2.amazonaws.com/nvidia',
        },
        toolkit: {
          repository: '361188080279.dkr.ecr.us-east-2.amazonaws.com/nvidia/k8s',
        },
        validator: {
          repository:
            '361188080279.dkr.ecr.us-east-2.amazonaws.com/nvidia/cloud-native',
        },
        vfioManager: {
          driverManager: {
            repository:
              '361188080279.dkr.ecr.us-east-2.amazonaws.com/nvidia/cloud-native',
          },
          repository: '361188080279.dkr.ecr.us-east-2.amazonaws.com/nvidia',
        },
      },
    });

    const exportNamePrefix = this.cluster.node.path.replace(
      /[^a-zA-Z0-9:\-]/g,
      '-',
    );

    this.outputs = {
      clusterName: new cdk.CfnOutput(this, 'ClusterName', {
        value: this.cluster.clusterName,
        exportName: `${exportNamePrefix}-ClusterName`,
      }),

      clusterEndpoint: new cdk.CfnOutput(this, 'ClusterEndpoint', {
        value: this.cluster.clusterEndpoint,
        exportName: `${exportNamePrefix}-ClusterEndpoint`,
      }),

      kubectlRoleArn: new cdk.CfnOutput(this, 'KubectlRoleArn', {
        value: this.cluster.kubectlRole!.roleArn,
        exportName: `${exportNamePrefix}-KubectlRoleArn`,
      }),

      kubectlLambdaRoleArn: new cdk.CfnOutput(this, 'KubectlLambdaRoleArn', {
        value: this.cluster.kubectlLambdaRole!.roleArn,
        exportName: `${exportNamePrefix}-KubectlLambdaRoleArn`,
      }),

      openIdConnectProviderArn: new cdk.CfnOutput(
        this,
        'OpenIdConnectProviderArn',
        {
          value: this.cluster.openIdConnectProvider.openIdConnectProviderArn,
          exportName: `${exportNamePrefix}-OpenIdConnectProviderArn`,
        },
      ),

      clusterSecurityGroupId: new cdk.CfnOutput(
        this,
        'ClusterSecurityGroupId',
        {
          value: this.cluster.clusterSecurityGroupId,
          exportName: `${exportNamePrefix}-ClusterSecurityGroupId`,
        },
      ),

      kubectlSecurityGroupId: new cdk.CfnOutput(
        this,
        'KubectlSecurityGroupId',
        {
          value: this.cluster.kubectlSecurityGroup!.securityGroupId,
          exportName: `${exportNamePrefix}-KubectlSecurityGroupId`,
        },
      ),
    };
  }
}

export class Namespace extends Chart {
  public readonly namespaceObject: KubeNamespace;

  public constructor(
    scope: Construct,
    id: string,
    props: Omit<ChartProps, 'namespace'> & {
      name: string;
      annotations?: { [key: string]: string };
    },
  ) {
    const { name, annotations, ...chartProps } = props;
    super(scope, id, chartProps);
    this.namespaceObject = new KubeNamespace(this, 'namespace', {
      metadata: { name, annotations },
    });
  }
}
