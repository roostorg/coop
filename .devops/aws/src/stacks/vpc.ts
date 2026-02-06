import { CfnOutput, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { CfnRoute } from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

import { DeploymentEnvironmentName } from './app_pipeline.js';

type VpcProps = StackProps & {
  numAZs: number;
  stage: DeploymentEnvironmentName;
};

// Outputs used to recreate the VPC in contexts where we can't reference the
// stack's vpc object directly (e.g., because we're crossing stage boundaries).
// NB: this recreation is gonna be hacky; see https://github.com/aws/aws-cdk/issues/4118
export type VpcOutputs = {
  vpcId: CfnOutput;
  vpcAzs: CfnOutput;
  vpcPrivateSubnetIds: CfnOutput[];
  vpcCidrBlock: CfnOutput;
  vpcPrivateSubnetRouteTableIds?: CfnOutput[];
  vpcRegion: CfnOutput;
};

/**
 * A stack representing our VPC.
 *
 * Our VPC needs to be sized/configured based on what we ultimately want to run
 * in it -- e.g., a number of services require a minimum of 2 AZs, and we must
 * make sure our subnets have plenty of available IPs for the kubernetes pods we
 * want to run, since each gets an IP. However, even though we want to configure
 * our VPC based on what we're gonna put in it, we actually have to deploy the
 * VPC before we can deploy anything into it. So it has to be an output that
 * other stacks take a dependency on.
 *
 * We also don't want to create the VPC based solely on the resource needs of
 * our other existing stacks -- even if those stacks could somehow report their
 * VPC needs and we could sum those needs here -- because VPCs are hard to
 * change later, so we sorta have to oversize from the beginning, independent
 * of our existing needs.
 */
export class VpcStack extends Stack {
  public readonly vpc: ec2.Vpc;
  public readonly outputs: VpcOutputs;

  constructor(scope: Construct, id: string, props: VpcProps) {
    const { numAZs, stage, ...stackProps } = props;
    super(scope, id, stackProps);

    this.vpc = new ec2.Vpc(this, 'vpc', {
      // EKS clusters need at least 2 AZs or they won't provision.
      maxAzs: Math.max(2, numAZs),
      // only one subnet of each type here, since this config is applied per AZ.
      // We need the private subnets to hold our worker nodes + a load balancer
      // in front of them (which we don't want to expose to the internet); and
      // we need need a nat, which is automatically created by default per AZ in
      // the public subnet, that'll allow the worker nodes to receive responses
      // to outbound requests they make to the internet. Finally, we have an
      // isolated subnet for stuff that doesn't need outbound internet access.
      subnetConfiguration: [
        { name: 'private', subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        { name: 'public', subnetType: ec2.SubnetType.PUBLIC },
        { name: 'isolated', subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      ],
    });

    // Add flow logging to our VPC (as part of SOC2 compliance)
    // Some logic taken from https://docs.aws.amazon.com/cdk/api/v1/docs/@aws-cdk_aws-ec2.FlowLog.html#example
    // and https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ec2.FlowLogOptions.html#example
    const role = new iam.Role(this, 'VpcFlowLogRole', {
      assumedBy: new iam.ServicePrincipal('vpc-flow-logs.amazonaws.com'),
    });
    const bucket = new s3.Bucket(this, 'VpcFlowLogBucket', {
      removalPolicy: RemovalPolicy.RETAIN,
      publicReadAccess: false,
    });
    bucket.grantReadWrite(role);

    this.vpc.addFlowLog('VpcFlowLogS3', {
      destination: ec2.FlowLogDestination.toS3(bucket),
    });

    // This gateway endpoint will be used to route traffic to S3 from our
    // private subnets. Normally, the traffic is sent through the public
    // internet using an internet gateway. However, dynamo and s3 can be written
    // through all within our private internet, using a gateway endpoint, as per
    // https://docs.aws.amazon.com/vpc/latest/privatelink/vpc-endpoints-s3.html#create-gateway-endpoint-s3.
    //
    // ********** SOME STUFF MANUALLY DONE IN AWS CONSOLE (by pywoo2) **********
    // The gateway endpoint was manually added as a route in the route tables
    // for the private subnets in the AWS console, due to:
    // https://github.com/aws/aws-cdk/issues/15115
    //
    // NB: The route tables were only updated on prod, and only for the private
    // subnets (not the isolated or public ones), which may not be correct.
    new ec2.GatewayVpcEndpoint(this, 'S3GatewayEndpoint', {
      service: ec2.GatewayVpcEndpointAwsService.S3,
      vpc: this.vpc,
    });

    // Enable private connectivity to ECR for image pulls in vpc
    this.vpc.addInterfaceEndpoint('EcrDockerEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.ECR_DOCKER,
    });

    this.vpc.addInterfaceEndpoint('XrayEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.XRAY,
    });

    // After setting up a Scylla cluster and peering it with our VPC, we have to
    // edit the VPC's main route table to allow traffic to flow to/from Scylla.
    // We assume that the Scylla VPC always uses 172.31.0.0/16, which we choose
    // when setting up the Scylla cluster.
    if (stage === 'Staging' || stage === 'Prod') {
      const vpcPeerConnectionId =
        stage === 'Prod' ? 'pcx-0c5506439b55364e8' : 'pcx-0f09434d417fdcb01';
      const scyllaVpcCidr = '172.31.0.0/16';

      this.vpc.isolatedSubnets.forEach((subnet, i) => {
        new CfnRoute(this, `IsolatedSubnetScyllaPeeringConnectionRoute-${i}`, {
          destinationCidrBlock: scyllaVpcCidr,
          routeTableId: subnet.routeTable.routeTableId,
          vpcPeeringConnectionId: vpcPeerConnectionId,
        });
      });

      this.vpc.privateSubnets.forEach((subnet, i) => {
        new CfnRoute(this, `PrivateSubnetScyllaPeeringConnectionRoute-${i}`, {
          destinationCidrBlock: scyllaVpcCidr,
          routeTableId: subnet.routeTable.routeTableId,
          vpcPeeringConnectionId: vpcPeerConnectionId,
        });
      });
    }

    const { vpcId, privateSubnets, availabilityZones } = this.vpc;

    const exportNamePrefix = this.vpc.node.path.replace(
      /[^a-zA-Z0-9:\-]/g,
      '-',
    );

    this.outputs = {
      vpcId: new CfnOutput(this, 'VpcId', {
        value: vpcId,
        exportName: `${exportNamePrefix}-id-export`,
      }),
      vpcAzs: new CfnOutput(this, 'VpcAzs', {
        value: availabilityZones.join(','),
        exportName: `${exportNamePrefix}-azs-export`,
      }),
      vpcPrivateSubnetIds: privateSubnets.map(
        (it, i) =>
          new CfnOutput(this, `VpcPrivateSubnetIds${i}`, {
            value: it.subnetId,
            exportName: `${exportNamePrefix}-subnet-${i}-id-export`,
          }),
      ),
      vpcCidrBlock: new CfnOutput(this, 'VpcCidrBlock', {
        value: this.vpc.vpcCidrBlock,
        exportName: `${exportNamePrefix}-cidr-export`,
      }),
      vpcPrivateSubnetRouteTableIds: privateSubnets.map(
        (it, i) =>
          new CfnOutput(this, `VpcPrivateSubnetRouteTableIds${i}`, {
            value: it.routeTable.routeTableId,
            exportName: `${exportNamePrefix}-subnet-${i}-route-table-id-export`,
          }),
      ),
      vpcRegion: new CfnOutput(this, 'VpcRegion', {
        value: this.region,
        exportName: `${exportNamePrefix}-region-export`,
      }),
    };
  }
}
