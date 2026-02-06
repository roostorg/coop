import { Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { ManagedPolicy } from 'aws-cdk-lib/aws-iam';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import {
  AuroraPostgresEngineVersion,
  ClusterInstance,
  Credentials,
  DatabaseCluster,
  DatabaseClusterEngine,
  DBClusterStorageType,
  ParameterGroup,
} from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

/**
 * Resources used for development, mostly for ML at present. Could eventually
 * include coop employee permissions, etc.
 */
export class DevResourcesStack extends Stack {
  private vpc: ec2.IVpc;

  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    this.vpc = new ec2.Vpc(this, 'dev-resources-vpc', {});

    const securityGroup = new ec2.SecurityGroup(
      this,
      'ssh-to-dev-ec2-instance',
      {
        vpc: this.vpc,
        securityGroupName: 'ssh-to-dev-ec2-instance',
        allowAllOutbound: true,
      },
    );

    securityGroup.connections.allowFromAnyIpv4(ec2.Port.tcp(22));
    securityGroup.connections.allowFromAnyIpv4(ec2.Port.tcp(80));
    securityGroup.connections.allowFromAnyIpv4(ec2.Port.tcp(443));

    const role = new iam.Role(this, 'ec2-dev-machine-user', {
      assumedBy: new iam.AccountRootPrincipal(),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('ReadOnlyAccess'),
      ],
    });

    // NB: excludes instances for devs who've already made an instance manually,
    // possibly with slightly different config/data that we don't want to lose (e.g., Mandy)
    const devsToKeyNames = {
      michael: 'michael',
      ethan: 'ethan',
      max: 'max',
      rui: 'rui',
    };

    for (const [dev, keyName] of Object.entries(devsToKeyNames)) {
      new ec2.Instance(this, `${dev}-ec2`, {
        vpc: this.vpc,
        vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
        securityGroup: securityGroup,
        instanceType: ec2.InstanceType.of(
          ec2.InstanceClass.G5,
          ec2.InstanceSize.XLARGE2,
        ),
        machineImage: ec2.MachineImage.genericLinux({
          'us-east-1': 'ami-078afdc6b93b6177f',
        }),
        role: role,
        instanceName: `${dev}-ml-playground`,
        keyName,
        blockDevices: [
          {
            deviceName: '/dev/sda1',
            volume: ec2.BlockDeviceVolume.ebs(1024, {
              deleteOnTermination: true,
              volumeType: ec2.EbsDeviceVolumeType.GP3,
            }), // 1TB of storage
          },
        ],
      });
    }

    // Model eval db.
    const rdsEngine = DatabaseClusterEngine.auroraPostgres({
      version: AuroraPostgresEngineVersion.VER_16_3,
    });

    const rdsParameterGroup = new ParameterGroup(
      this,
      'SlowQueryLogParamGroup15', // we're no longer on pg 15, but can't rename this easily, so oh well
      {
        engine: rdsEngine,
        description:
          'Aurora PostgreSQL Cluster Parameter Group with Slow Query Logging',
        parameters: { log_min_duration_statement: '500' },
      },
    );

    const instanceIdentifierBase = `model-eval-db`;

    const monitoringRole = new iam.Role(this, 'RDSEnhancedMonitoringRole', {
      assumedBy: new iam.ServicePrincipal('monitoring.rds.amazonaws.com'),
    });
    monitoringRole.addManagedPolicy(
      iam.ManagedPolicy.fromManagedPolicyArn(
        this,
        'AmazonRDSEnhancedMonitoringPermission',
        'arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole',
      ),
    );

    const rdsCluster = new DatabaseCluster(this, 'DatabaseCluster', {
      credentials: Credentials.fromGeneratedSecret('postgres', {
        secretName: `ModelEval/Postgres`,
      }),
      storageType: DBClusterStorageType.AURORA_IOPT1,
      storageEncrypted: true,
      engine: rdsEngine,
      writer: ClusterInstance.serverlessV2('writer', {
        enablePerformanceInsights: true,
      }),
      // There's no reason to pay for a separate read replica for this dev db.
      readers: [],
      // We set the minimum capacity to very low to accommodate the expected
      // long periods for which this service will have no traffic.
      // AWS recommends setting the minimum capacity to at least 2 when using
      // Performance Insights.
      serverlessV2MinCapacity: 2,
      serverlessV2MaxCapacity: 128,
      parameterGroup: rdsParameterGroup,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC, onePerAz: true },
      vpc: this.vpc,
      clusterIdentifier: `${instanceIdentifierBase}-cluster`,
      instanceIdentifierBase,
      deletionProtection: true,
      removalPolicy: RemovalPolicy.RETAIN,
      backup: {
        preferredWindow: '06:51-07:21', // i.e., 1:51am to 2:21am NYC time
        retention: Duration.days(7),
      },
      cloudwatchLogsExports: ['postgresql'],
      cloudwatchLogsRetention: RetentionDays.ONE_DAY,
      monitoringRole,
      monitoringInterval: Duration.seconds(30),
    });

    // For now, allow connections from the public internet.
    // To only allow from within the VPC (after we add a VPN), change to:
    // rdsCluster.connections.allowDefaultPortFrom(Peer.ipv4(vpc.vpcCidrBlock));
    rdsCluster.connections.allowDefaultPortFrom(ec2.Peer.anyIpv4());

    // S3 bucket to hold images/videos for items stored in the model_eval db.
    // We want anyone to be able to fetch an object from this bucket, but we
    // don't want to allow public access to listing all the objects in the
    // bucket to prevent a competitor from finding out what data we build our
    // models from.
    new s3.Bucket(this, 'model-eval-media-bucket', {
      removalPolicy: RemovalPolicy.RETAIN,
      // This adds a policy to allow s3:GetObject for any principal
      publicReadAccess: true,
      // here we still block ACLS as is recommended by AWS, but allow public
      // access via bucket policy
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS
    });
  }
}
