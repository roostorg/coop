import { IVpc } from 'aws-cdk-lib/aws-ec2';
import { Cluster, KubernetesVersion } from 'aws-cdk-lib/aws-eks';
import { OpenIdConnectProvider } from 'aws-cdk-lib/aws-iam';
import * as iam from 'aws-cdk-lib/aws-iam';
import { ILayerVersion } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export type ClusterAttributes = {
  clusterName: string;
  kubectlRoleArn: string;
  openIdConnectProviderArn: string;
  vpc: IVpc;
  kubectlLayer: ILayerVersion;
  version: KubernetesVersion;
  kubectlLambdaRoleArn: string;
  kubectlSecurityGroupId: string;
  clusterEndpoint: string;
};

// This just removes the versioning related properties from ClusterAttributes,
// which is convenient only because the kubectlLayer prop has to be
// re-instantiated within each stack, because the lamba layer construct can only
// be created within the scope of a Stack.
export type VersionAgnosticClusterAttributes = Omit<
  ClusterAttributes,
  'kubectlLayer' | 'version'
>;

/**
 * We deploy our k8s cluster in a separate stack (our ClusterStack) from the
 * stacks that deploy resources into the cluster (like our api, workers, etc).
 *
 * These other stacks need to reference the k8s cluster, but we can't pass in a
 * JS reference to the Cluster object from our ClusterStack, or else the
 * mutations to the cluster that we make in these subsequent stacks will effect
 * the cluster object that's seen (after synth) as being in the ClusterStack --
 * breaking the ability to deploy each stack independently.
 *
 * So, instead, we recreate a reference to the cluster in each of these
 * subsequest stacks, relying on the cluster to already exist and using its
 * attributes. This mostly works, except for the VPC (getting a fully usable
 * stand-in object for a VPC from its attributes doesn't work well in CDK), so,
 * just for the VPC, we're required to actually pass in the Vpc object from our
 * VpcStack. That works ok, as long as we're careful not to mutate the vpc itself.
 *
 * Anyway, this function abstracts the boilerplate of creating that cluster from
 * attributes, and defines the common type we need for it.
 */
export function clusterFromAttributes(
  scope: Construct,
  id: string,
  attributes: ClusterAttributes,
) {
  const { openIdConnectProviderArn, kubectlLambdaRoleArn, ...restAttributes } =
    attributes;
  return Cluster.fromClusterAttributes(scope, id, {
    ...restAttributes,
    kubectlPrivateSubnetIds: attributes.vpc.privateSubnets.map(
      (subnet) => subnet.subnetId,
    ),
    // this is required as of aws-cdk-lib v2.80.0. Explanation and implementation
    // is detailed here https://github.com/aws/aws-cdk/issues/25674
    kubectlLambdaRole: iam.Role.fromRoleArn(
      scope,
      'KubectlLambdaRole',
      kubectlLambdaRoleArn,
    ),
    openIdConnectProvider: OpenIdConnectProvider.fromOpenIdConnectProviderArn(
      scope,
      'OpenIdConnectProvider',
      openIdConnectProviderArn,
    ),
  });
}
