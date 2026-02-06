import * as aws from '@pulumi/aws';
import { Route, VpcEndpoint, VpcPeeringConnection } from '@pulumi/aws/ec2';
import { RecordType } from '@pulumi/aws/route53';
import * as awsx from '@pulumi/awsx';
import {
  SubnetAllocationStrategy,
  SubnetType,
  type Vpc,
} from '@pulumi/awsx/ec2';
import * as pulumi from '@pulumi/pulumi';

const awsUsEast2Provider = new aws.Provider('us-east-2', {
  region: 'us-east-2',
  defaultTags: {
    tags: {
      env: pulumi.getStack(),
    },
  },
});

type vpcProps = {
  vpcId: string;
  region: string;
  cidrBlock: string;
  subnet0Id: string;
  routeTable0Id: string;
  subnet1Id: string;
  routeTable1Id: string;
};

type ExportedVpcProps = {
  vpcId: Promise<aws.cloudformation.GetExportResult>;
  region: Promise<aws.cloudformation.GetExportResult>;
  cidrBlock: Promise<aws.cloudformation.GetExportResult>;
  subnet0Id: Promise<aws.cloudformation.GetExportResult>;
  routeTable0Id: Promise<aws.cloudformation.GetExportResult>;
  subnet1Id: Promise<aws.cloudformation.GetExportResult>;
  routeTable1Id: Promise<aws.cloudformation.GetExportResult>;
};

function getVpc(props: vpcProps): ExportedVpcProps {
  return {
    vpcId: aws.cloudformation.getExport(
      {
        name: props.vpcId,
      },
      { provider: awsUsEast2Provider },
    ),
    region: aws.cloudformation.getExport(
      {
        name: props.region,
      },
      { provider: awsUsEast2Provider },
    ),
    cidrBlock: aws.cloudformation.getExport(
      {
        name: props.cidrBlock,
      },
      { provider: awsUsEast2Provider },
    ),
    subnet0Id: aws.cloudformation.getExport(
      {
        name: props.subnet0Id,
      },
      { provider: awsUsEast2Provider },
    ),
    routeTable0Id: aws.cloudformation.getExport(
      {
        name: props.routeTable0Id,
      },
      { provider: awsUsEast2Provider },
    ),
    subnet1Id: aws.cloudformation.getExport(
      {
        name: props.subnet1Id,
      },
      { provider: awsUsEast2Provider },
    ),
    routeTable1Id: aws.cloudformation.getExport(
      {
        name: props.routeTable1Id,
      },
      { provider: awsUsEast2Provider },
    ),
  };
}

function createDatadogPrivateEndpoint(
  zoneName: string,
  serviceName: string,
  vpc: Vpc,
  peerVpc: ExportedVpcProps,
) {
  const securityGroup = new aws.ec2.SecurityGroup(zoneName, {
    vpcId: vpc.vpcId,
  });

  new aws.vpc.SecurityGroupIngressRule(`${zoneName}-allow_all_tcp_ipv4`, {
    securityGroupId: securityGroup.id,
    ipProtocol: '-1',
    cidrIpv4: '0.0.0.0/0',
  });

  new aws.vpc.SecurityGroupEgressRule(`${zoneName}-allow_all_tcp_ipv4`, {
    securityGroupId: securityGroup.id,
    ipProtocol: '-1',
    cidrIpv4: '0.0.0.0/0',
  });

  const privateEndpoint = new VpcEndpoint(zoneName, {
    vpcId: vpc.vpcId,
    vpcEndpointType: 'Interface',
    serviceName: serviceName,
    privateDnsEnabled: false,
    subnetIds: vpc.privateSubnetIds,
    securityGroupIds: [securityGroup.id],
  });

  const zone = new aws.route53.Zone(zoneName, {
    name: zoneName,
    vpcs: [
      { vpcId: vpc.vpcId },
      {
        vpcId: peerVpc.vpcId.then((v) => v.value),
        vpcRegion: peerVpc.region.then((r) => r.value),
      },
    ],
  });

  const privateEndpointDnsRecord = privateEndpoint.dnsEntries[0];

  new aws.route53.Record(zoneName, {
    zoneId: zone.zoneId,
    name: zone.name,
    aliases: [
      {
        name: privateEndpointDnsRecord.dnsName,
        zoneId: privateEndpointDnsRecord.hostedZoneId,
        evaluateTargetHealth: true,
      },
    ],
    type: RecordType.A,
  });
}

class DatadogPrivateLinkStack extends pulumi.ComponentResource {
  constructor(name: string, opts?: pulumi.ComponentResourceOptions) {
    super('pkg:index:DatadogPrivateLink', name, {}, opts);
    const config = new pulumi.Config();
    const peerVpcProps = config.requireObject<vpcProps>('peerVpc');

    const vpc = new awsx.ec2.Vpc('datadog-vpc', {
      natGateways: {
        strategy: 'None',
      },
      numberOfAvailabilityZones: 2,
      cidrBlock: '172.16.0.0/26',
      subnetStrategy: SubnetAllocationStrategy.Auto,
      subnetSpecs: [
        {
          type: SubnetType.Private,
        },
      ],
      enableDnsHostnames: true,
      enableDnsSupport: true,
    });

    const peerVpc = getVpc(peerVpcProps);

    // traces
    createDatadogPrivateEndpoint(
      'trace.agent.datadoghq.com',
      'com.amazonaws.vpce.us-east-1.vpce-svc-0355bb1880dfa09c2',
      vpc,
      peerVpc,
    );

    // profiles
    createDatadogPrivateEndpoint(
      'intake.profile.datadoghq.com',
      'com.amazonaws.vpce.us-east-1.vpce-svc-022ae36a7b2472029',
      vpc,
      peerVpc,
    );

    // metrics
    createDatadogPrivateEndpoint(
      'metrics.agent.datadoghq.com',
      'com.amazonaws.vpce.us-east-1.vpce-svc-09a8006e245d1e7b8',
      vpc,
      peerVpc,
    );

    // logs
    createDatadogPrivateEndpoint(
      'agent-http-intake.logs.datadoghq.com',
      'com.amazonaws.vpce.us-east-1.vpce-svc-025a56b9187ac1f63',
      vpc,
      peerVpc,
    );

    // api
    createDatadogPrivateEndpoint(
      'api.datadoghq.com',
      'com.amazonaws.vpce.us-east-1.vpce-svc-064ea718f8d0ead77',
      vpc,
      peerVpc,
    );

    // process
    createDatadogPrivateEndpoint(
      'process.datadoghq.com',
      'com.amazonaws.vpce.us-east-1.vpce-svc-0ed1f789ac6b0bde1',
      vpc,
      peerVpc,
    );

    // containers
    createDatadogPrivateEndpoint(
      'orchestrator.datadoghq.com',
      'com.amazonaws.vpce.us-east-1.vpce-svc-0ad5fb9e71f85fe99',
      vpc,
      peerVpc,
    );

    const peeringConnection = new VpcPeeringConnection(
      `datadog-vpc-peering`,
      {
        peerVpcId: peerVpc.vpcId.then((v) => v.value),
        vpcId: vpc.vpcId,
        peerRegion: peerVpc.region.then((r) => r.value),
      },
      { deleteBeforeReplace: true },
    );

    new aws.ec2.VpcPeeringConnectionAccepter(
      `peering-connection-accepter`,
      {
        vpcPeeringConnectionId: peeringConnection.id,
        autoAccept: true,
      },
      { provider: awsUsEast2Provider, deleteBeforeReplace: true },
    );

    [peerVpc.routeTable0Id, peerVpc.routeTable1Id].forEach(
      (routeTableId, index) => {
        new Route(
          `peer-to-vpc-route-${index}`,
          {
            routeTableId: routeTableId.then((r) => r.value),
            destinationCidrBlock: vpc.vpc.cidrBlock,
            vpcPeeringConnectionId: peeringConnection.id,
          },
          { provider: awsUsEast2Provider, deleteBeforeReplace: true },
        );
      },
    );

    vpc.privateSubnetIds.apply((subnets) => {
      subnets.forEach((subnet, index) => {
        new Route(
          `vpc-to-peer-route-${index}`,
          {
            routeTableId: aws.ec2.getRouteTableOutput({ subnetId: subnet })
              .routeTableId,
            destinationCidrBlock: peerVpc.cidrBlock.then((c) => c.value),
            vpcPeeringConnectionId: peeringConnection.id,
          },
          { deleteBeforeReplace: true },
        );
      });
    });
  }
}

new DatadogPrivateLinkStack('datadog-private-link', {});
