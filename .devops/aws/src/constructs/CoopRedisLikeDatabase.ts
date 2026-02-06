/**
 * AWS offers five different options for provisioning Redis-API-compatible
 * databases:
 *
 * - MemoryDB (cluster mode or not cluster mode)
 * - Elasticache serverless
 * - Elasticache provisioned (cluster mode or not cluster mode)
 *
 * MemoryDb is basically Redis with a lot more durability (because writes are
 * synchronously replicated to multi-AZ persistent storage) at the expense of
 * higher write latency.
 *
 * Elasticache (provisioned) is basically relabeled standard Redis, with Redis'
 * standard durability properties (i.e., durability is achieved via replication
 * with the option for periodic snapshotting to disk), plus a bunch of AWS-added
 * performance improvements. (See eg
 * https://aws.amazon.com/blogs/database/enhanced-io-multiplexing-for-amazon-elasticache-for-redis/)
 *
 * For both MemoryDb and provisioned Elasticache, every database key is
 * associated with a primary (which handles all writes to that key and can also
 * serve reads) and n read-only replicas. In non-cluster mode, there's only one
 * primary, which handles all keys. In cluster mode, the keys are hashed and
 * sharded across primaries, with each primary owning a chunk of the hash range.
 * For both MemoryDb and provisioned Elasticache, in cluster and non-cluster
 * mode, the online scaling options are robust: I believe it's possible to
 * vertically scale the primaries, scale the number of read replicas, and (for
 * cluster mode) do online resharding.
 *
 * The pros of cluster mode are:
 *
 * - Because of the ability to horizontally shard writes (not just vertically
 *   scale the primary, which has limits given Redis' single-threaded nature,
 *   though Elasticache tries to work around them by moving work to other
 *   threads where possible), the maximum capacity of the database is bigger
 *   and, when vertical scaling costs become non-linear (which I think they do
 *   at some point) it can be cheaper too.
 *
 * - The cluster can be slightly more available: if a primary fails, only writes
 *   to that shard (rather than to the whole db) fail for the few seconds until
 *   a replica is promoted to primary.
 *
 * However, cluster mode also has real cons:
 *
 * - Multi-key operations only work if the keys are on the same shard. Redis has
 *   a mechanism for forcing a set of keys to all be put on the same shard, but
 *   ensuring that the relevant keys are on the same shard while keeping the
 *   shards balanced complicates application logic (often needlessly).
 *
 * - A vertically-scaled system, at least within the range where doubling the
 *   capacity only doubles the price, is usually cheaper. E.g., if you have 5
 *   shards, you need to provision each shard for the peak workload of the
 *   highest-traffic shard. If you have a vertically scaled system, the total
 *   load at peak is likely to be much less than 5x the peak load of the highest
 *   traffic shard (because the other shards, by definition, have lower peak
 *   loads, and because not all shards will be at peak load at the same time).
 *
 * Finally, the serverless Elasticache is very tempting: its autoscaling looks
 * to be truly 0 effort (no setting up policies etc); not having to do capacity
 * planning upfront is nice (esp. as Redis capacity planning requires reserving
 * up to 50% of storage, depending on workload, for background write
 * operations); and it hides all the semi-gnarly cluster topology details
 * discussed above. However, as of December 2023, serverless Elasticache is only
 * 1 week old, so I'm not sure I trust it yet. It also seems like there's a
 * substantial price premium (up to 2-3x) and some of its implementation details
 * are not public, which makes its consistency/operational characteristics a bit
 * hard to understand. (E.g., can reads can be forcibly sent to the primary and,
 * if not, what sort of replication lag is common? how do multi-key transactions
 * work?).
 *
 * This construct may eventually add higher-level options that make it easier to
 * get the right Redis-compatible db cluster set up -- e.g., that automate the
 * math for determining the instance type from the data storage volumes and the
 * number of shards (while leaving a buffer for bg write operations).
 *
 * For now, though, this just supports creating Elasticache provisioned
 * databases with cluster mode disabled and a fixed instance type.
 *
 * All the docs above are solely because the AWS documentation really buries the
 * lead on the fundamental differences between the different offerings; it took
 * me quite some time to load all these details, so I wanted to write them down
 * for whoever next needs to set up a Redis-like db.
 */

import { Duration, Token } from 'aws-cdk-lib';
import { ComparisonOperator, Metric } from 'aws-cdk-lib/aws-cloudwatch';
import {
  IVpc,
  Peer,
  Port,
  SecurityGroup,
  SubnetType,
} from 'aws-cdk-lib/aws-ec2';
import {
  CfnReplicationGroup,
  CfnSubnetGroup,
} from 'aws-cdk-lib/aws-elasticache';
import { ITopic } from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';
import _ from 'lodash';

import { DeploymentEnvironmentName } from '../stacks/app_pipeline.js';
import { toAwsName } from '../utils.js';
import { withSnsNotifications } from './SnsAlarmStateChangeNotifications.js';

type CoopRedisLikeDatabaseProps = {
  stage: DeploymentEnvironmentName;
  vpc: IVpc;
  monitoringAlertsTopic: ITopic;
  cacheNodeType: string;
};

type CoopRedisLikeDatabaseConnectionDetails = {
  address: string;
  port: number;
};

export class CoopRedisLikeDatabase extends Construct {
  readonly replicationGroupPrimaryConnectionDetails: CoopRedisLikeDatabaseConnectionDetails;
  readonly replicationGroupReaderConnectionDetails: CoopRedisLikeDatabaseConnectionDetails;

  constructor(
    scope: Construct,
    name: string,
    props: CoopRedisLikeDatabaseProps,
  ) {
    super(scope, name);
    const { vpc, stage, monitoringAlertsTopic } = props;

    const REDIS_PORT = 6379;

    // This is the group of subnets into which the db instances will be placed.
    const subnetGroup = new CfnSubnetGroup(this, 'SubnetGroup', {
      cacheSubnetGroupName: toAwsName(`${stage}-${name}-redis-subnet-group`),
      description: '',
      subnetIds: vpc.selectSubnets({
        subnetType: SubnetType.PRIVATE_ISOLATED,
        onePerAz: true,
      }).subnetIds,
    });

    // A security group that will control access to the db's instances.
    const securityGroup = new SecurityGroup(this, 'SecurityGroup', {
      vpc,
    });

    securityGroup.addIngressRule(
      Peer.ipv4(vpc.vpcCidrBlock),
      Port.tcp(REDIS_PORT),
      'Allow connections from inside the VPC.',
    );

    // The AWS terms for Elasticache components are supeeer confusing.
    //
    // - "replication group": this is what everyone else calls a cluster (i.e.,
    //   its a group of nodes, with possibly multiple shards and a replica set
    //   per shard).
    //
    // - "cluster": not a cluster at all, but rather a single redis instance.
    //   (this is what's usually called a node).
    //
    // - "node group": the only term that makes sense; refers to all the nodes
    //   (primary + n replicas) serving a shard. In single-shard (i.e., "cluster
    //   mode disabled") clusters, the cluster (i.e., "replication group") only
    //   has one, automatically-created node group.

    // Set these variables using standard terms, not AWS' nonsensical ones; then
    // map them to the AWS names in the replication config below.
    //
    // NB: these will eventually become props of the construct, but that's a bit
    // premature for now, because there's other tweaks we'd have to make to the
    // CfnReplicationGroup below to properly support things like construct users
    // changing the number of shards (which can require a migration to cluster
    // mode, online resharding, etc).
    const numShards = 1;
    const numReplicasPerShard = 1;
    const numNodesPerShard = numReplicasPerShard + 1; // replicas + the primary.

    const replicationGroup = new CfnReplicationGroup(this, 'ReplicationGroup', {
      replicationGroupDescription: 'Coop Redis-like Database',

      engine: 'redis',
      engineVersion: '7.1',
      autoMinorVersionUpgrade: true,

      // We enable automatic failover and specify the required minimum of 2
      // clusters (i.e., nodes), so that there's one replica. We allow them to
      // be in separate availability zones.
      automaticFailoverEnabled: true,
      ...(numShards === 1
        ? {
            // clusterMode disabled/enabled must be lowercase as per:
            // https://repost.aws/questions/QUj6IF3l-qSsKKkD3yxY_EDw/elasticache-cluster-mode-updates-are-not-supported-while-attempting-to-update-additional-propertie
            clusterMode: 'disabled',
            numCacheClusters: numNodesPerShard,
          }
        : {
            clusterMode: 'enabled',
            replicasPerNodeGroup: numReplicasPerShard,
            numNodeGroups: numShards,
          }),
      multiAzEnabled: true,
      cacheNodeType: props.cacheNodeType,

      cacheSubnetGroupName: subnetGroup.cacheSubnetGroupName,
      securityGroupIds: [securityGroup.securityGroupId],

      port: REDIS_PORT,
    });

    // Token for the id that the replication group will have once created.
    const replicationGroupId = replicationGroup.ref;

    this.replicationGroupPrimaryConnectionDetails = {
      address: replicationGroup.attrPrimaryEndPointAddress,
      port: Token.asNumber(replicationGroup.attrPrimaryEndPointPort),
    };

    this.replicationGroupReaderConnectionDetails = {
      address: replicationGroup.attrReaderEndPointAddress,
      port: Token.asNumber(replicationGroup.attrReaderEndPointPort),
    };

    // define alert thresholds
    const memoryUsagePercentageWarningThresholds = [75, 85, 90];
    const cpuUsagePercentageWarningThresholds = [50];

    // create Alarms for each each cluster in the replication group
    // TODO: this may need to be adjusted for cluster with multiple shards; idk
    // how the nodes get numbered in that case.
    for (let i = 1; i <= numNodesPerShard; i++) {
      const nodeId = String(i).padStart(3, '0');
      memoryUsagePercentageWarningThresholds.forEach((threshold) => {
        withSnsNotifications(
          new Metric({
            namespace: 'AWS/ElastiCache',
            metricName: 'DatabaseMemoryUsagePercentage',
            dimensionsMap: {
              CacheClusterId: `${replicationGroupId}-${nodeId}`,
            },
            period: Duration.minutes(1),
          }).createAlarm(
            this,
            `HighDatabaseMemoryUsagePercentage-${threshold}-Node-${nodeId}`,
            {
              comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
              threshold,
              evaluationPeriods: 3,
              datapointsToAlarm: 2,
            },
          ),
          monitoringAlertsTopic,
        );
      });
      cpuUsagePercentageWarningThresholds.forEach((threshold) => {
        withSnsNotifications(
          new Metric({
            namespace: 'AWS/ElastiCache',
            metricName: 'CPUUtilization',
            dimensionsMap: {
              CacheClusterId: `${replicationGroupId}-${nodeId}`,
            },
            period: Duration.minutes(1),
          }).createAlarm(
            this,
            `HighDatabaseCPUUtilization-${threshold}-Node-${nodeId}`,
            {
              comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
              threshold,
              evaluationPeriods: 3,
              datapointsToAlarm: 2,
            },
          ),
          monitoringAlertsTopic,
        );
      });
    }
  }
}
