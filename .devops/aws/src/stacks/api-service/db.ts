import {
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  StackProps,
} from 'aws-cdk-lib';
import {
  ScalableTarget,
  ServiceNamespace,
} from 'aws-cdk-lib/aws-applicationautoscaling';
import { ComparisonOperator, Metric } from 'aws-cdk-lib/aws-cloudwatch';
import {
  ClientVpnEndpoint,
  ClientVpnRouteTarget,
  InstanceClass,
  InstanceSize,
  InstanceType,
  Peer,
  Port,
  SecurityGroup,
  SubnetType,
  type ISecurityGroup,
  type IVpc,
} from 'aws-cdk-lib/aws-ec2';
import type { DockerImageAsset } from 'aws-cdk-lib/aws-ecr-assets';
import * as iam from 'aws-cdk-lib/aws-iam';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import * as memorydb from 'aws-cdk-lib/aws-memorydb';
import {
  AuroraPostgresEngineVersion,
  Credentials,
  DatabaseCluster,
  DatabaseClusterEngine,
  ParameterGroup,
} from 'aws-cdk-lib/aws-rds';
import { Topic } from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';

import { makeKubectlVersionProps } from '../../constants.js';
import {
  clusterFromAttributes,
  type VersionAgnosticClusterAttributes,
} from '../../constructs/clusterFromAttributes.js';
import { MigrationRunner } from '../../constructs/MigrationRunner.js';
import { withSnsNotifications } from '../../constructs/SnsAlarmStateChangeNotifications.js';
import { type DeploymentEnvironmentName } from '../app_pipeline.js';

type DbStackProps = StackProps & {
  vpc: IVpc;
  numInstances: number;
  vpnCertificateArn: string;
  highUrgencyAlarmsTopicArn: string;
  lowUrgencyAlertsTopicArn: string;
  migrationsImage: DockerImageAsset;
  stage: DeploymentEnvironmentName;
  provisionProdLevelsOfCompute: boolean;
  clusterSecurityGroup: ISecurityGroup;
  kubernetesClusterAttributes: VersionAgnosticClusterAttributes;
  scyllaSecretArn: string;
  snowflakeSecretArn: string;
};

/**
 * A stack holding the various db clusters powering our api.
 */
export class ApiDbClusterStack extends Stack {
  public rdsConnectionSecretArn: string;
  public rdsConnectionSecretArnOutput: CfnOutput;
  public rdsReadOnlyClusterHost: string;

  constructor(scope: Construct, id: string, props: DbStackProps) {
    const {
      vpc,
      highUrgencyAlarmsTopicArn,
      numInstances,
      provisionProdLevelsOfCompute,
      scyllaSecretArn,
      snowflakeSecretArn,
      ...stackProps
    } = props;

    super(scope, id, stackProps);

    // intentionally destructured separately, so it's included in stackProps above.
    const { stage } = stackProps;
    const highUrgencyAlarmsTopic = Topic.fromTopicArn(
      this,
      'MonitoringAlertsTopic',
      highUrgencyAlarmsTopicArn,
    );

    const lowUrgencyAlertsTopic = Topic.fromTopicArn(
      this,
      'LowUrgencyAlertsTopic',
      props.lowUrgencyAlertsTopicArn,
    );

    const rdsEngine = DatabaseClusterEngine.auroraPostgres({
      version: AuroraPostgresEngineVersion.VER_14_6,
    });

    const rdsParameterGroup = new ParameterGroup(
      this,
      'SlowQueryLogParamGroup14',
      {
        engine: rdsEngine,
        description:
          'Aurora PostgreSQL 14 Cluster Parameter Group with Slow Query Logging',
        parameters: {
          log_min_duration_statement: '500',
        },
      },
    );

    const instanceIdentifierBase = `${stage}-api-db-instance`.toLowerCase();

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
    const defaultDatabaseName = 'coop';
    const rdsCluster = new DatabaseCluster(this, 'ApiServerDatabaseCluster', {
      credentials: Credentials.fromGeneratedSecret('postgres', {
        secretName: `${stage}/Api/Postgres`,
      }),
      storageEncrypted: true,
      engine: rdsEngine,
      instances: numInstances,
      defaultDatabaseName,
      parameterGroup: rdsParameterGroup,
      instanceProps: {
        vpc,
        // NB: ideally we'd have this cluster deployed in an isolated subnet,
        // not a public one, but our db used to be publicly accessible, and it'd
        // require downtime (I think), or some careful coordination, to move it
        // to another subnet now. However, our security groups should prevent
        // public connection attempts to the db anyway, even in its current subnet.
        vpcSubnets: { subnetType: SubnetType.PUBLIC, onePerAz: true },
        enablePerformanceInsights: true,
        instanceType: provisionProdLevelsOfCompute
          ? InstanceType.of(InstanceClass.R6G, InstanceSize.LARGE)
          : InstanceType.of(InstanceClass.T3, InstanceSize.MEDIUM),
      },
      clusterIdentifier: `${stage}-api-db-cluster`,
      instanceIdentifierBase,
      deletionProtection: stage === 'Prod',
      removalPolicy:
        stage === 'Prod' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      backup: {
        preferredWindow: '06:51-07:21', // i.e., 1:51am to 2:21am NYC time
        retention: Duration.days(7),
      },
      cloudwatchLogsExports: ['postgresql'],
      cloudwatchLogsRetention:
        stage === 'Prod' ? RetentionDays.ONE_MONTH : RetentionDays.THREE_DAYS,
      monitoringRole,
      monitoringInterval: Duration.seconds(30),
    });

    this.rdsReadOnlyClusterHost = rdsCluster.clusterReadEndpoint.hostname;

    // For now, allow connections from anywhere in the VPC.
    rdsCluster.connections.allowDefaultPortFrom(Peer.ipv4(vpc.vpcCidrBlock));

    withSnsNotifications(
      rdsCluster
        .metric('AuroraReplicaLag', {
          statistic: 'Maximum',
          period: Duration.seconds(10),
        })
        .createAlarm(this, 'DbHighReplicationLagAlarm', {
          comparisonOperator:
            ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
          threshold: 3000,
          evaluationPeriods: 3,
          datapointsToAlarm: 2,
          // we do not currently know what to do in response to this alarm so we
          // are disabling it for the time being
          actionsEnabled: false,
        }),
      lowUrgencyAlertsTopic,
    );

    // NB: this logic is totally broken; see
    // https://coop.atlassian.net/browse/COOP-580
    const readAutoscalingTarget = new ScalableTarget(
      this,
      'ReadAutoscalingTarget',
      {
        minCapacity: 2,
        maxCapacity: 10,
        serviceNamespace: ServiceNamespace.RDS,
        resourceId: `cluster:${rdsCluster.clusterIdentifier}`,
        scalableDimension: 'rds:cluster:ReadReplicaCount',
      },
    );
    readAutoscalingTarget.scaleToTrackMetric('DatabaseCPUUtilization', {
      targetValue: 0.65,
      customMetric: rdsCluster.metric('DatabaseCPUUtilization', {
        statistic: 'Average',
        period: Duration.minutes(5),
      }),
    });
    readAutoscalingTarget.scaleToTrackMetric('BufferHitCacheRatio', {
      targetValue: 99.0,
      customMetric: rdsCluster.metric('BufferHitCacheRatio', {
        statistic: 'Average',
        period: Duration.minutes(5),
      }),
    });

    // TODO, for when we build more robust monitoring/alarming than cloudwatch
    // supports: there are some other metrics that'd be good to alert on.
    // Consider, if we introduce a query that pg plans poorly, we want to know
    // about that right away, even if it's not causing cpu/memory bottlenecks.
    // we could detect that by comparing the ratio of rows that pg had to read
    // compared to the number that were ultimately returned. That data is
    // captured in performance insights, which exposes tup_fetched and
    // tup_returned from pg (see https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_PerfInsights_Counters.html).
    // Unfortunately, that data is not available in Cloudwatch. Similarly,
    // there are pg-collected metrics that aren't exposed to Cloudwatch or
    // Performance Insights, like the the number of seq scans; see https://www.postgresql.org/docs/10/monitoring-stats.html#PG-STAT-ALL-TABLES-VIEW
    //
    // NB: We don't need to alert on available disk space, because AWS autoscales that.

    // Cloudwatch reports some metrics at the cluster level, but some only at
    // the instance level. For the latter, Cloudwatch doesn't let us easily
    // aggregate those metrics across all instances. So, instead, we create an
    // alarm for each instance.
    for (let i = 0; i < numInstances; i++) {
      // Create an alert if any of our instances are short on CPU. Setting the
      // threshold here is a bit tricky but, we can probably assume that, if our
      // total utilization _averaged over one minute_, for 2 of 3 consecutive
      // minutes is > 50, then (because query volume is decently spiky) some
      // queries are probably coming in and having to wait a bit. Cloudwatch is
      // stupid, and it won't let us just aggregate all the cpu utilization
      // metrics (from the different instances within each cluster) and build an
      // alert on that. Instead, we build an alert for each instance manually.
      // We could also use the DbLoadCPU metric provided by performance insights,
      // but that's a little trickier because interpreting it requires factoring
      // in the number of vCPUs on the instance. See https://aws.amazon.com/blogs/database/set-alarms-on-performance-insights-metrics-using-amazon-cloudwatch/
      withSnsNotifications(
        new Metric({
          namespace: 'AWS/RDS',
          metricName: 'CPUUtilization',
          dimensionsMap: {
            DBInstanceIdentifier: `${instanceIdentifierBase}${i + 1}`,
          },
          period: Duration.minutes(2),
        }).createAlarm(this, `RdsInstance${i + 1}HighCpuUtilizationAlarm`, {
          comparisonOperator:
            ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
          threshold: 75,
          evaluationPeriods: 3,
          datapointsToAlarm: 2,
        }),
        lowUrgencyAlertsTopic,
      );

      // If we're running out of memory, or not getting a high cache hit rate
      // (which may indicate not enough ram, or badly-planned queries), alarm.
      // SQL workload performance in particular tends to be incredibly sensitive
      // to the cache hit rate. Similarly, if the disk can't keep up -- which
      // could be from high write volume, but it also gonna happen if the cache
      // hit rate drops -- we almost certainly have a perf issue.
      withSnsNotifications(
        new Metric({
          namespace: 'AWS/RDS',
          metricName: 'FreeableMemory',
          dimensionsMap: {
            DBInstanceIdentifier: `${instanceIdentifierBase}${i + 1}`,
          },
          period: Duration.minutes(1),
        }).createAlarm(this, `RdsInstance${i + 1}LowFreeMemoryAlarm`, {
          comparisonOperator: ComparisonOperator.LESS_THAN_THRESHOLD,
          threshold: 512 * 1024 * 1024, // 512MiB
          evaluationPeriods: 2,
        }),
        highUrgencyAlarmsTopic,
      );

      withSnsNotifications(
        new Metric({
          namespace: 'AWS/RDS',
          metricName: 'DiskQueueDepth',
          dimensionsMap: {
            DBInstanceIdentifier: `${instanceIdentifierBase}${i + 1}`,
          },
          period: Duration.minutes(1),
        }).createAlarm(this, `RdsInstance${i + 1}DiskQueueLengthAlarm`, {
          comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
          threshold: 1,
          // A spike in one minute is probably ok/normal (e.g., during
          // vacuuming), if not ideal. But 2 of 3 mins is a real problem.
          evaluationPeriods: 3,
          datapointsToAlarm: 2,
        }),
        lowUrgencyAlertsTopic,
      );

      withSnsNotifications(
        new Metric({
          namespace: 'AWS/RDS',
          metricName: 'BufferCacheHitRatio',
          dimensionsMap: {
            DBInstanceIdentifier: `${instanceIdentifierBase}${i + 1}`,
          },
          period: Duration.minutes(1),
        }).createAlarm(this, `RdsInstance${i + 1}LowCacheHitRateAlarm`, {
          comparisonOperator:
            ComparisonOperator.LESS_THAN_OR_EQUAL_TO_THRESHOLD,
          // Relational dbs can often achieve crazy high cache hit rates (AWS
          // recommends targeting 99.98%), and monitoring this is critical
          // becasue a tiny drop in hit rate translates to a big load spike on
          // the db. E.g., going from 99.98% hits to just 99.9% hits means _5x_
          // the number of reads have to be served from disk.
          //
          // For us, our db server RAM is much bigger than our data size, so we
          // should always be able to have ~100% hit ratio, as long as new
          // writes aren't coming in and triggering invalidations. When certain
          // writes do come in, though, our hit ratio usually drops a bit. The
          // drop isn't enough to cause issues -- our instances are provisioned
          // enough, and our write volume is low enough, that we can easily
          // handle pretty extended periods with way lower hit rates -- but it's
          // enough that setting this monitor to 99.9 was leading to lots of
          // spurious alerts during those periods of writes. So, this value is
          // just low enough to avoid those spurious alerts, while otherwise
          // being as high as possible, so that we get alerted if our hit rate
          // starts going down more than before.
          threshold: 99,
          evaluationPeriods: 3,
          datapointsToAlarm: 2,
        }),
        lowUrgencyAlertsTopic,
      );

      // We absolutely need to know if the instance is approaching
      // transaction id wraparound.
      withSnsNotifications(
        new Metric({
          namespace: 'AWS/RDS',
          metricName: 'MaximumUsedTransactionIDs',
        }).createAlarm(this, `RdsInstance${i + 1}TxIdWraparoundAlarm`, {
          comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
          // pg supports 2 billion transaction ids, so we'll alarm at 1 billion.
          threshold: 1_000_000_000,
          evaluationPeriods: 3,
          datapointsToAlarm: 2,
        }),
        highUrgencyAlarmsTopic,
      );
    }

    this.rdsConnectionSecretArn = rdsCluster.secret!.secretFullArn!;
    this.rdsConnectionSecretArnOutput = new CfnOutput(this, 'SecretArn', {
      value: this.rdsConnectionSecretArn,
    });

    // Now, add a durable Redis db that'll serve as the database for MRT
    const redisSubnetGroup = new memorydb.CfnSubnetGroup(
      this,
      'RedisSubnetGroup',
      {
        subnetGroupName: `${props.stage}-redis-subnet-group`.toLowerCase(),
        subnetIds: vpc.selectSubnets({
          subnetType: SubnetType.PRIVATE_ISOLATED,
          onePerAz: true,
        }).subnetIds,
      },
    );

    const redisSecurityGroup = new SecurityGroup(this, 'RedisSecurityGroup', {
      vpc,
    });

    redisSecurityGroup.addIngressRule(
      Peer.ipv4(vpc.vpcCidrBlock),
      Port.tcp(6379),
      'Allow connections from inside the VPC.',
    );

    const redis = new memorydb.CfnCluster(this, 'RedisCluster', {
      clusterName: `${props.stage}-private-redis-cluster`.toLowerCase(),
      engineVersion: '6.2',
      autoMinorVersionUpgrade: true,
      subnetGroupName: redisSubnetGroup.subnetGroupName,
      nodeType: provisionProdLevelsOfCompute
        ? 'db.r7g.xlarge'
        : 'db.t4g.medium',
      numReplicasPerShard: props.numInstances > 1 ? 1 : 0,
      numShards: 1,
      snapshotWindow: '08:51-10:21', // after pg finishes,
      snapshotRetentionLimit: 7,
      securityGroupIds: [redisSecurityGroup.securityGroupId],
      aclName: 'full-access',
      tlsEnabled: true,
    });

    redis.addDependency(redisSubnetGroup);

    withSnsNotifications(
      new Metric({
        namespace: 'AWS/MemoryDB',
        metricName: 'DatabaseMemoryUsagePercentage',
        dimensionsMap: {
          ClusterName: redis.clusterName,
          NodeName: `${redis.clusterName}-0001-001`,
        },
        period: Duration.minutes(1),
      }).createAlarm(
        this,
        `${redis.clusterName}HighDatabaseMemoryUsagePercentage-75`,
        {
          comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
          threshold: 75,
          evaluationPeriods: 3,
          datapointsToAlarm: 2,
        },
      ),
      highUrgencyAlarmsTopic,
    );

    withSnsNotifications(
      new Metric({
        namespace: 'AWS/MemoryDB',
        metricName: 'DatabaseMemoryUsagePercentage',
        dimensionsMap: {
          ClusterName: redis.clusterName,
          NodeName: `${redis.clusterName}-0001-001`,
        },
        period: Duration.minutes(1),
      }).createAlarm(
        this,
        `${redis.clusterName}HighDatabaseMemoryUsagePercentage-85`,
        {
          comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
          threshold: 85,
          evaluationPeriods: 3,
          datapointsToAlarm: 2,
        },
      ),
      highUrgencyAlarmsTopic,
    );

    withSnsNotifications(
      new Metric({
        namespace: 'AWS/MemoryDB',
        metricName: 'DatabaseMemoryUsagePercentage',
        dimensionsMap: {
          ClusterName: redis.clusterName,
          NodeName: `${redis.clusterName}-0001-001`,
        },
        period: Duration.minutes(1),
      }).createAlarm(
        this,
        `${redis.clusterName}HighDatabaseMemoryUsagePercentage-90`,
        {
          comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
          threshold: 90,
          evaluationPeriods: 3,
          datapointsToAlarm: 2,
        },
      ),
      highUrgencyAlarmsTopic,
    );

    const cluster = clusterFromAttributes(this, 'K8sCluster', {
      ...props.kubernetesClusterAttributes,
      ...makeKubectlVersionProps(this),
    });

    new MigrationRunner(this, 'api-migrations', {
      migrationsImage: props.migrationsImage,
      cluster,
      secrets: {
        API_SERVER_DATABASE_USER: [this.rdsConnectionSecretArn, 'username'],
        API_SERVER_DATABASE_PASSWORD: [this.rdsConnectionSecretArn, 'password'],
        SNOWFLAKE_USERNAME: [snowflakeSecretArn, 'username'],
        SNOWFLAKE_PASSWORD: [snowflakeSecretArn, 'password'],
        SNOWFLAKE_DB_NAME: [snowflakeSecretArn, 'database'],
        SCYLLA_HOSTS: [scyllaSecretArn, 'hosts'],
        SCYLLA_USERNAME: [scyllaSecretArn, 'username'],
        SCYLLA_PASSWORD: [scyllaSecretArn, 'password'],
      },
      env: {
        API_SERVER_DATABASE_HOST: rdsCluster.clusterEndpoint.hostname,
        API_SERVER_DATABASE_PORT: rdsCluster.clusterEndpoint.port.toString(),
        API_SERVER_DATABASE_NAME: defaultDatabaseName,
        SNOWFLAKE_WAREHOUSE: 'MIGRATIONS',
        SCYLLA_LOCAL_DATACENTER: 'AWS_US_EAST_2',
        SCYLLA_KEYSPACE: 'item_investigation_service',
        SCYLLA_REPLICATION_CLASS: 'NetworkTopologyStrategy',
        SCYLLA_REPLICATION_FACTOR: '3',
        SCYLLA_COMPACTION_STRATEGY: 'IncrementalCompactionStrategy',
        SCYLLA_HAS_ENTERPRISE_FEATURES: 'true',
      },
      dbArgs: ['api-server-pg', 'snowflake', 'scylla'],
      deploymentEnvironment: stage,
      vpc,
    });

    const vpnEndpoint = new ClientVpnEndpoint(this, 'DbVpnEndpoint', {
      vpc,
      // When a client from the outside world connects to the VPC via the VPN
      // endpoint, the endpoint has to assign that client a private IP address
      // for routing intra-VPC traffic back to it. The CIDR block below
      // defines the range from which those private IP addresses are allocated.
      // This CIDR block can't overlap at all with the VPC's CIDR block, as
      // the VPC might be using those IPs already to assign to instances etc.
      cidr: '10.1.0.0/16',
      // Client will use same cert as stored on server, for TLS mutual
      // authentication.
      serverCertificateArn: props.vpnCertificateArn,
      clientCertificateArn: props.vpnCertificateArn,
      // Simpler for now than fine-grained auth rules for different users
      // connecting to the VPC thhough the VPN endpoint. Ditto, we'll leave
      // the default for `securityGroups`, which has CDK create a new security
      // group so the traffic is routable from the VPN endpoint to the rest of
      // the VPC.
      authorizeAllUsersToVpcCidr: true,

      // Only route traffic to AWS resources through the VPN, so that we don't
      // incur costs and slowness for devs browsing the internet to look up
      // docs or whatever while they're connected to the VPN. This is "split
      // tunneling". However, do route all DNS requests to the VPC's DNS
      // resolvers so that AWS resources that resolve differently when looked
      // up against public DNS vs the VPC's DNS will be handled correctly.
      // This is especially important for RDS endpoints, which are (currently)
      // publicly-accessible to a limited set of IPs, and so have public DNS,
      // but need to resolve to a VPC-local private IP for the traffic to them
      // to properly be routed through the VPN by the split-tunneling config
      // (which is the only way to make the db accessible to VPN-connected
      // clients not using an RDS-whitelisted IP).
      splitTunnel: true,
      // AWS always puts the VPC's DNS server at the .2 address of the VPC's
      // primary cidr. However, computing that .2 address in Cloudformation
      // from the vpcCidrBlock import is hard, given Cfn's limited intrinsic
      // functions, so we leverage the fact that AWS also exposes the DNS
      // server at this fixed address.
      // See https://docs.aws.amazon.com/vpc/latest/userguide/vpc-dns.html
      // We've seen spotty availability from this DNS sever so I've added the
      // hard coded .2 address here which seems to help even though I don't
      // understand why.
      dnsServers: ['169.254.169.253', '10.0.0.2'],
    });
    vpnEndpoint.connections.allowTo(props.clusterSecurityGroup, Port.tcp(443));

    // Make the DNS enpoint reachable locally while connected to the VPN.
    vpnEndpoint.addRoute('dns-resolution', {
      cidr: '169.254.169.253/32',
      target: ClientVpnRouteTarget.subnet(vpc.privateSubnets[0]),
    });

    vpnEndpoint.addAuthorizationRule('dns-resolution-access', {
      cidr: '169.254.169.253/32',
    });

    // Make the Scylla peering ips reachable while connected to the VPN
    vpnEndpoint.addRoute('scylla-vpc', {
      cidr: '172.31.0.0/16',
      target: ClientVpnRouteTarget.subnet(vpc.privateSubnets[0]),
    });

    vpnEndpoint.addAuthorizationRule('scylla-vpc-access', {
      cidr: '172.31.0.0/16',
    });
  }
}
