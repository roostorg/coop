import { CfnJson, Stack, StackProps } from 'aws-cdk-lib';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import * as iam from 'aws-cdk-lib/aws-iam';
import { App as Cdk8sApp } from 'cdk8s';
import { Construct } from 'constructs';
import jsonToPrettyYaml from 'json-to-pretty-yaml';

import { jsonStringify } from '../../../../server/utils/encoding.js';
import { makeKubectlVersionProps } from '../constants.js';
import {
  clusterFromAttributes,
  VersionAgnosticClusterAttributes,
} from '../constructs/clusterFromAttributes.js';
import { toKubernetesName } from '../utils.js';
import { type DeploymentEnvironmentName } from './app_pipeline.js';
import { Namespace } from './k8s_cluster.js';

type ApiStackProps = StackProps & {
  clusterAttributes: VersionAgnosticClusterAttributes;
  datadogApiSecret: string; // currently unused
  stage: DeploymentEnvironmentName;
  datadogRedisSecret: string;
  datadogSnowflakeSecret: string;
  scyllaSecret: string;
  monitorSnowflakeAccountUsage: boolean; // we only want to do this in one environment
  tracingSamplingPercentage: string;
};

/**
 * A stack representing the Datadog agent.
 *
 * NB: we also have a stack called DatadogIntegration, which is used to create
 * various roles etc to give Datadog permission to pull our CloudWatch alarms,
 * custom metrics, etc. However, that stack was created manually through the
 * AWS Control Panel, using a Datadog-provided CFN template.
 */
export class DatadogStack extends Stack {
  constructor(scope: Construct, id: string, props: ApiStackProps) {
    const { clusterAttributes, stage, ...stackProps } = props;

    super(scope, id, stackProps);

    const namespaceName = 'datadog';
    const cluster = clusterFromAttributes(this, 'K8sCluster', {
      ...clusterAttributes,
      ...makeKubectlVersionProps(this),
    });

    const namespace = cluster.addCdk8sChart(
      'ns',
      new Namespace(new Cdk8sApp(), 'ns', { name: namespaceName }),
      // @ts-ignore The types are wrong here; they specify that the overwrite
      // property isn't allowed, but it's actually passed through and works as
      // expected (see KubernetesManifestProps).
      { overwrite: true },
    );

    const releaseName = toKubernetesName(`datadog-agent-0-${stage}`);

    // We are creating this role in order to grant the
    // datadog-agent-0-prod-cluster-agent service account (created by the helm
    // chart) access to secrets in AWS Secrets Manager We are doing this instead
    // of creating our own service account, because there is no easy way to
    // integrate it with the other resources in the helm chart without disabling
    // all other rbac resources (e.g. roles, role bindings)
    const role = new iam.Role(this, 'datadog-role', {
      // this policy was copied from an existing Role that was created
      // automatically by using the cluster.addServiceAccount() method
      assumedBy: new iam.FederatedPrincipal(
        cluster.openIdConnectProvider.openIdConnectProviderArn,
        {
          // we have to use CfnJson since this oidc arn resolves at deploy time
          StringEquals: new CfnJson(this, 'ConditionJson', {
            value: {
              // datadog-agent-0-prod-cluster-agent is set in the helm chart
              [`${cluster.openIdConnectProvider.openIdConnectProviderIssuer}:sub`]: `system:serviceaccount:${namespaceName}:${releaseName}-cluster-agent`,
              [`${cluster.openIdConnectProvider.openIdConnectProviderIssuer}:aud`]:
                'sts.amazonaws.com',
            },
          }),
        },
        'sts:AssumeRoleWithWebIdentity',
      ),
    });

    role.addToPrincipalPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          'secretsmanager:GetSecretValue',
          'secretsmanager:DescribeSecret',
        ],
        resources: [
          props.datadogRedisSecret,
          props.datadogSnowflakeSecret,
          props.scyllaSecret,
        ],
      }),
    );

    // Copied from
    // https://github.com/open-telemetry/opentelemetry-js-contrib/blob/main/metapackages/auto-instrumentations-node/src/utils.ts#L105
    // Used to rename span operations for visibility in the UI. Update
    // periodically/as needed.
    const otelNodeInstrumentationPackageNames = [
      '@opentelemetry/instrumentation-amqplib',
      '@opentelemetry/instrumentation-aws-lambda',
      '@opentelemetry/instrumentation-aws-sdk',
      '@opentelemetry/instrumentation-bunyan',
      '@opentelemetry/instrumentation-cassandra-driver',
      '@opentelemetry/instrumentation-connect',
      '@opentelemetry/instrumentation-cucumber',
      '@opentelemetry/instrumentation-dataloader',
      '@opentelemetry/instrumentation-dns',
      '@opentelemetry/instrumentation-express',
      '@opentelemetry/instrumentation-fastify',
      '@opentelemetry/instrumentation-fs',
      '@opentelemetry/instrumentation-generic-pool',
      '@opentelemetry/instrumentation-graphql',
      '@opentelemetry/instrumentation-grpc',
      '@opentelemetry/instrumentation-hapi',
      '@opentelemetry/instrumentation-http',
      '@opentelemetry/instrumentation-ioredis',
      '@opentelemetry/instrumentation-knex',
      '@opentelemetry/instrumentation-koa',
      '@opentelemetry/instrumentation-lru-memoizer',
      '@opentelemetry/instrumentation-memcached',
      '@opentelemetry/instrumentation-mongodb',
      '@opentelemetry/instrumentation-mongoose',
      '@opentelemetry/instrumentation-mysql2',
      '@opentelemetry/instrumentation-mysql',
      '@opentelemetry/instrumentation-nestjs-core',
      '@opentelemetry/instrumentation-net',
      '@opentelemetry/instrumentation-pg',
      '@opentelemetry/instrumentation-pino',
      '@opentelemetry/instrumentation-redis',
      '@opentelemetry/instrumentation-redis-4',
      '@opentelemetry/instrumentation-restify',
      '@opentelemetry/instrumentation-router',
      '@opentelemetry/instrumentation-socket.io',
      '@opentelemetry/instrumentation-tedious',
      '@opentelemetry/instrumentation-winston',
      'opentelemetry-instrumentation-undici',
    ];

    const otelSpanKinds = [
      'server',
      'client',
      'internal',
      'producer',
      'consumer',
    ];

    const secretVolumeName = 'secret-volume';
    const datadogSecretsProviderName = 'datadog-secret-provider';
    const snowflakeUsernameFilename = 'snowflake-username';
    const snowflakePasswordFilename = 'snowflake-password';
    const snowflakeRoleFilename = 'snowflake-role';
    const snowflakeAccountFilename = 'snowflake-account';
    const redisUsernameFilename = 'redis-username';
    const redisPasswordFilename = 'redis-password';
    const redisHostFilename = 'redis-host';
    const redisPortFilename = 'redis-port';
    const scyllaTokenFilename = 'scylla-token';
    const datadogSecretsProvider = cluster.addManifest(
      'datadog-secrets-provider',
      {
        apiVersion: 'secrets-store.csi.x-k8s.io/v1',
        kind: 'SecretProviderClass',
        metadata: {
          name: datadogSecretsProviderName,
          namespace: namespaceName,
        },
        spec: {
          provider: 'aws',
          parameters: {
            objects: jsonToPrettyYaml.stringify([
              {
                objectName: props.datadogRedisSecret,
                jmesPath: [
                  {
                    path: 'username',
                    objectAlias: redisUsernameFilename,
                  },
                  {
                    path: 'password',
                    objectAlias: redisPasswordFilename,
                  },
                  {
                    path: 'hostname',
                    objectAlias: redisHostFilename,
                  },
                  {
                    path: 'port',
                    objectAlias: redisPortFilename,
                  },
                ],
              },
              {
                objectName: props.datadogSnowflakeSecret,
                jmesPath: [
                  {
                    path: 'username',
                    objectAlias: snowflakeUsernameFilename,
                  },
                  {
                    path: 'password',
                    objectAlias: snowflakePasswordFilename,
                  },
                  {
                    path: 'account',
                    objectAlias: snowflakeAccountFilename,
                  },
                  {
                    path: 'role',
                    objectAlias: snowflakeRoleFilename,
                  },
                ],
              },
              {
                objectName: props.scyllaSecret,
                jmesPath: [
                  {
                    path: 'token',
                    objectAlias: scyllaTokenFilename,
                  },
                ],
              },
            ]),
          },
        },
      },
    );

    const secretsMountPath = '/etc/secrets';

    const snowflakeInstances = [];

    props.monitorSnowflakeAccountUsage &&
      // this config is for monitoring account level usage and we only want to do that once (in prod)
      snowflakeInstances.push({
        account: `ENC[file@${secretsMountPath}/${snowflakeAccountFilename}]`,
        username: `ENC[file@${secretsMountPath}/${snowflakeUsernameFilename}]`,
        password: `ENC[file@${secretsMountPath}/${snowflakePasswordFilename}]`,
        role: `ENC[file@${secretsMountPath}/${snowflakeRoleFilename}]`,
        min_collection_interval: 3600,
      });

    const datadogAgent = cluster.addHelmChart('DatadogAgent', {
      chart: 'datadog',
      release: releaseName,
      version: '3.67.3',
      repository: 'https://helm.datadoghq.com',
      namespace: 'datadog',
      values: {
        registry:
          '361188080279.dkr.ecr.us-east-2.amazonaws.com/ecr-public/datadog',
        // This should really be a secret manager secret reference, but that
        // isn't supported yet. We could try to use our standard infrastructure
        // for syncing secrets manager secrets into k8s secrets, as the chart
        // can accept a k8s secret reference, but the Secrets Store CSI Driver
        // doesn't support syncing to k8s secrets unless you have a running pod
        // trying to mount the secret (which we don't yet here). We've got shit
        // to do that's more important shit to do than build a custom resource
        // provider (https://github.com/aws/aws-cdk/issues/16476), so...
        datadog: {
          appKey: 'bd4211bce8bd21c0d17df98a8b2bab967acae643',
          apiKey: '4d394dffc4ef84960adc58460c0505c1',
          site: 'datadoghq.com', // varies by datadog region
          clusterName: stage.toLowerCase(),
          checksCardinality: 'orchestrator',
          logLevel: 'WARN',
          ignoreAutoConfig: ['apache'],
          logs: {
            enabled: true,
            containerCollectAll: true,
            autoMultiLineDetection: true,
          },
          // We have to send APM and metrics data (i.e., from dogstatsd) to the
          // agent over a port, rather than a socket, even though the latter is
          // much more efficient, because we're sending data to the OTLP
          // endpoint over a port (with GRPC), and the cluster agent's
          // admissions controller doesn't seem able to properly configure the
          // pods to use a mix of sockets, with a port for OTLP.
          apm: {
            portEnabled: true,
          },
          confd: {
            'linkerd.yaml': jsonToPrettyYaml.stringify({
              // ad_identifiers must be set to 'proxy' which I couldn't find in
              // the docs but did find in this GitHub issue comment:
              // https://github.com/DataDog/integrations-core/issues/4684#issuecomment-665998181.
              ad_identifiers: ['proxy'],
              init_config: {},
              instances: [
                { openmetrics_endpoint: 'http://%%host%%:4191/metrics' },
              ],
            }),
          },
          env: [
            {
              name: 'DD_ENV',
              value: stage.toLowerCase(),
            },
            {
              name: 'DD_OTLP_CONFIG_TRACES_PROBABILISTIC_SAMPLER_SAMPLING_PERCENTAGE',
              value: props.tracingSamplingPercentage,
            },
            {
              name: 'DD_OTLP_CONFIG_METRICS_TAG_CARDINALITY',
              value: 'orchestrator',
            },
            {
              name: 'DD_APM_ENABLE_RARE_SAMPLER',
              value: 'true',
            },
            {
              name: 'DD_LOG_FORMAT_JSON',
              value: 'true',
            },
          ],
          envDict: {
            // We disable collection of arc runner logs since they are so
            // verbose (and therefore costly) and the runner does not provide a
            // way to adjust log levels. See:
            // https://github.com/actions/runner/issues/3045
            DD_CONTAINER_EXCLUDE_LOGS: 'kube_namespace:^arc-runners$',
          },
          dogstatsd: {
            port: 8125,
            useHostPort: true,
            nonLocalTraffic: true,
          },
          otlp: {
            receiver: {
              protocols: {
                grpc: {
                  enabled: true,
                },
              },
            },
          },
          secretBackend: {
            command: '/readsecret_multiple_providers.sh',
          },
          serviceMonitoring: {
            enabled: true,
          },
        },
        agents: {
          containers: {
            agent: {
              env: [
                {
                  name: 'DD_LOGS_CONFIG_PROCESSING_RULES',
                  value: jsonStringify([
                    {
                      type: 'exclude_at_match',
                      name: 'exclude_otel_end_on_span_once_error',
                      pattern: '.*You can only call end\\(\\) on a span once',
                    },
                    {
                      type: 'exclude_at_match',
                      name: 'exclude_otel_execute_on_ended_span_error',
                      pattern: 'Can not execute the operation on ended Span.*',
                    },
                  ]),
                },
              ],
            },
            traceAgent: {
              env: [
                // OpenTelemetry has a concept of a span's name, which is
                // supposed to describe the unit of work that the span is
                // tracing, in a relatively low cardinality way that could be
                // useful for aggregation. E.g., `GET /users/{id}` might be a
                // span name or `DELETE FROM ORGS WHERE ID = ?`. Datadog,
                // meanwhile, has an analogous concept called a "resource".
                // However, DD also has a concept called an "operation". The
                // idea is that multiple resources can support the same
                // operation -- e.g., all your endpoints might support an
                // `http.request` operation -- such that a span might have
                // (operation, resource) tuple of (http.request, GET /users).
                // Moreover, the idea is that it can be useful to have stats
                // and various aggregate data by operation name. Otel doesn't
                // have a concept analogous to an operation, but it does have
                // something called SpanKind (see Otel docs) and, combining a
                // span's SpanKind with the name of the instrumentation library
                // that produced it can give a string that decently (though
                // certainly not perfectly!) captures the DD idea of an
                // operation. So, the DD agent does that concatenation to form
                // the operation name. However, the instrumentation library
                // strings are super long, so this leads to operation names in
                // the DD UI that are actually too long to read (they get
                // truncated). To fix this, we can tell DD to map the operation
                // name it would've generated to one that's actually readable in
                // the UI. That's what the code below does.
                // See also https://github.com/open-telemetry/opentelemetry-collector-contrib/issues/1909
                {
                  name: 'DD_OTLP_CONFIG_TRACES_SPAN_NAME_REMAPPINGS',
                  value: JSON.stringify(
                    Object.fromEntries(
                      otelSpanKinds.flatMap((spanKind) =>
                        otelNodeInstrumentationPackageNames.map(
                          (packageName) => [
                            `${packageName}.${spanKind}`,
                            `${packageName
                              .replace('@opentelemetry/instrumentation-', '')
                              .replace(
                                'opentelemetry-instrumentation-',
                                '',
                              )}.${spanKind}`,
                          ],
                        ),
                      ),
                    ),
                  ),
                },
                // TODO: too high/expensive?
                { name: 'DD_APM_MAX_TPS', value: '100' },
              ],
            },
          },
          tolerations: [
            // This should tolerate all taints. We use this so that we may
            // collect logs on gpu nodes which are tainted.
            {
              operator: 'Exists',
            },
          ],
        },
        clusterAgent: {
          admissionController: {
            enabled: true,
            // TODO: to save money, we might not want datadog to record all the
            // logs from our various background/utility containers (e.g., the
            // Datadog and cloudwatch agents, the load balancer controller,
            // internal kubernetes dns, etc). In that case, we'd set this false
            // and add the label: `admission.datadoghq.com/enabled=true` to any
            // pods whose containers we do want tracked. See
            mutateUnlabelled: true,
            configMode: 'hostip',
          },
          confd: {
            'redisdb.yaml': jsonToPrettyYaml.stringify({
              cluster_check: true,
              instances: [
                {
                  host: `ENC[file@${secretsMountPath}/${redisHostFilename}]`,
                  port: `ENC[file@${secretsMountPath}/${redisPortFilename}]`,
                  username: `ENC[file@${secretsMountPath}/${redisUsernameFilename}]`,
                  password: `ENC[file@${secretsMountPath}/${redisPasswordFilename}]`,
                  ssl: true,
                },
              ],
            }),
            'snowflake.yaml': jsonToPrettyYaml.stringify({
              cluster_check: true,
              instances: snowflakeInstances,
            }),
            'scylla.yaml': jsonToPrettyYaml.stringify({
              cluster_check: true,
              instances: [
                {
                  prometheus_url:
                    'https://us-east-1.aws.metrics.cloud.scylladb.com/api/v1/cluster/15999/proxy/federate?match[]={job=~".*"}',
                  skip_proxy: true, // default here is false, but we want to connect to the server directly
                  headers: {
                    Authorization: `ENC[file@${secretsMountPath}/${scyllaTokenFilename}]`,
                  },
                  label_to_hostname: 'instance',
                  log_requests: true,
                  // Type override allows you to override a type in the
                  // Prometheus payload or type an untyped metric (they’re
                  // ignored by default). these are all untyped from scylla's
                  // prometheus
                  // https://docs.datadoghq.com/integrations/scylla/#data-collected
                  type_overrides: {
                    scylla_alien_receive_batch_queue_length: 'gauge',
                    scylla_alien_total_received_messages: 'counter',
                    scylla_alien_total_sent_messages: 'counter',
                    scylla_batchlog_manager_total_write_replay_attempts:
                      'counter',
                    scylla_cache_active_reads: 'gauge',
                    scylla_cache_bytes_total: 'gauge',
                    scylla_cache_bytes_used: 'gauge',
                    scylla_cache_concurrent_misses_same_key: 'counter',
                    scylla_cache_mispopulations: 'counter',
                    scylla_cache_partition_evictions: 'counter',
                    scylla_cache_partition_hits: 'counter',
                    scylla_cache_partition_insertions: 'counter',
                    scylla_cache_partition_merges: 'counter',
                    scylla_cache_partition_misses: 'counter',
                    scylla_cache_partition_removals: 'counter',
                    scylla_cache_partitions: 'gauge',
                    scylla_cache_pinned_dirty_memory_overload: 'counter',
                    scylla_cache_reads: 'counter',
                    scylla_cache_reads_with_misses: 'counter',
                    scylla_cache_row_evictions: 'counter',
                    scylla_cache_row_hits: 'counter',
                    scylla_cache_row_insertions: 'counter',
                    scylla_cache_row_misses: 'counter',
                    scylla_cache_row_removals: 'counter',
                    scylla_cache_rows: 'gauge',
                    scylla_cache_rows_dropped_from_memtable: 'counter',
                    scylla_cache_rows_merged_from_memtable: 'counter',
                    scylla_cache_rows_processed_from_memtable: 'counter',
                    scylla_cache_sstable_partition_skips: 'counter',
                    scylla_cache_sstable_reader_recreations: 'counter',
                    scylla_cache_sstable_row_skips: 'counter',
                    scylla_cache_static_row_insertions: 'counter',
                    scylla_commitlog_alloc: 'counter',
                    scylla_commitlog_allocating_segments: 'gauge',
                    scylla_commitlog_bytes_written: 'counter',
                    scylla_commitlog_cycle: 'counter',
                    scylla_commitlog_disk_total_bytes: 'gauge',
                    scylla_commitlog_flush: 'counter',
                    scylla_commitlog_flush_limit_exceeded: 'counter',
                    scylla_commitlog_memory_buffer_bytes: 'gauge',
                    scylla_commitlog_pending_allocations: 'gauge',
                    scylla_commitlog_pending_flushes: 'gauge',
                    scylla_commitlog_requests_blocked_memory: 'counter',
                    scylla_commitlog_segments: 'gauge',
                    scylla_commitlog_slack: 'counter',
                    scylla_commitlog_unused_segments: 'gauge',
                    scylla_compaction_manager_compactions: 'gauge',
                    scylla_cql_authorized_prepared_statements_cache_evictions:
                      'counter',
                    scylla_cql_authorized_prepared_statements_cache_size:
                      'gauge',
                    scylla_cql_batches: 'counter',
                    scylla_cql_batches_pure_logged: 'counter',
                    scylla_cql_batches_pure_unlogged: 'counter',
                    scylla_cql_batches_unlogged_from_logged: 'counter',
                    scylla_cql_deletes: 'counter',
                    scylla_cql_filtered_read_requests: 'counter',
                    scylla_cql_filtered_rows_dropped_total: 'counter',
                    scylla_cql_filtered_rows_matched_total: 'counter',
                    scylla_cql_filtered_rows_read_total: 'counter',
                    scylla_cql_inserts: 'counter',
                    scylla_cql_prepared_cache_evictions: 'counter',
                    scylla_cql_prepared_cache_memory_footprint: 'gauge',
                    scylla_cql_prepared_cache_size: 'gauge',
                    scylla_cql_reads: 'counter',
                    scylla_cql_reverse_queries: 'counter',
                    scylla_cql_rows_read: 'counter',
                    scylla_cql_secondary_index_creates: 'counter',
                    scylla_cql_secondary_index_drops: 'counter',
                    scylla_cql_secondary_index_reads: 'counter',
                    scylla_cql_secondary_index_rows_read: 'counter',
                    scylla_cql_statements_in_batches: 'counter',
                    scylla_cql_unpaged_select_queries: 'counter',
                    scylla_cql_updates: 'counter',
                    scylla_cql_user_prepared_auth_cache_footprint: 'gauge',
                    scylla_database_active_reads: 'gauge',
                    scylla_database_active_reads_memory_consumption: 'gauge',
                    scylla_database_clustering_filter_count: 'counter',
                    scylla_database_clustering_filter_fast_path_count:
                      'counter',
                    scylla_database_clustering_filter_sstables_checked:
                      'counter',
                    scylla_database_clustering_filter_surviving_sstables:
                      'counter',
                    scylla_database_counter_cell_lock_acquisition: 'counter',
                    scylla_database_counter_cell_lock_pending: 'gauge',
                    scylla_database_dropped_view_updates: 'counter',
                    scylla_database_large_partition_exceeding_threshold:
                      'counter',
                    scylla_database_multishard_query_failed_reader_saves:
                      'counter',
                    scylla_database_multishard_query_failed_reader_stops:
                      'counter',
                    scylla_database_multishard_query_unpopped_bytes: 'counter',
                    scylla_database_multishard_query_unpopped_fragments:
                      'counter',
                    scylla_database_paused_reads: 'gauge',
                    scylla_database_paused_reads_permit_based_evictions:
                      'counter',
                    scylla_database_querier_cache_drops: 'counter',
                    scylla_database_querier_cache_lookups: 'counter',
                    scylla_database_querier_cache_memory_based_evictions:
                      'counter',
                    scylla_database_querier_cache_misses: 'counter',
                    scylla_database_querier_cache_population: 'gauge',
                    scylla_database_querier_cache_resource_based_evictions:
                      'counter',
                    scylla_database_querier_cache_time_based_evictions:
                      'counter',
                    scylla_database_queued_reads: 'gauge',
                    scylla_database_requests_blocked_memory: 'counter',
                    scylla_database_requests_blocked_memory_current: 'gauge',
                    scylla_database_short_data_queries: 'counter',
                    scylla_database_short_mutation_queries: 'counter',
                    scylla_database_sstable_read_queue_overloads: 'counter',
                    scylla_database_total_reads: 'counter',
                    scylla_database_total_reads_failed: 'counter',
                    scylla_database_total_result_bytes: 'gauge',
                    scylla_database_total_view_updates_failed_local: 'counter',
                    scylla_database_total_view_updates_failed_remote: 'counter',
                    scylla_database_total_view_updates_pushed_local: 'counter',
                    scylla_database_total_view_updates_pushed_remote: 'counter',
                    scylla_database_total_writes: 'counter',
                    scylla_database_total_writes_failed: 'counter',
                    scylla_database_total_writes_timedout: 'counter',
                    scylla_database_view_building_paused: 'counter',
                    scylla_database_view_update_backlog: 'counter',
                    scylla_execution_stages_function_calls_enqueued: 'counter',
                    scylla_execution_stages_function_calls_executed: 'counter',
                    scylla_execution_stages_tasks_preempted: 'counter',
                    scylla_execution_stages_tasks_scheduled: 'counter',
                    scylla_gossip_heart_beat: 'counter',
                    scylla_hints_for_views_manager_corrupted_files: 'counter',
                    scylla_hints_for_views_manager_discarded: 'counter',
                    scylla_hints_for_views_manager_dropped: 'counter',
                    scylla_hints_for_views_manager_errors: 'counter',
                    scylla_hints_for_views_manager_sent: 'counter',
                    scylla_hints_for_views_manager_size_of_hints_in_progress:
                      'gauge',
                    scylla_hints_for_views_manager_written: 'counter',
                    scylla_hints_manager_corrupted_files: 'counter',
                    scylla_hints_manager_discarded: 'counter',
                    scylla_hints_manager_dropped: 'counter',
                    scylla_hints_manager_errors: 'counter',
                    scylla_hints_manager_sent: 'counter',
                    scylla_hints_manager_size_of_hints_in_progress: 'gauge',
                    scylla_hints_manager_written: 'counter',
                    scylla_httpd_connections_current: 'gauge',
                    scylla_httpd_connections_total: 'counter',
                    scylla_httpd_read_errors: 'counter',
                    scylla_httpd_reply_errors: 'counter',
                    scylla_httpd_requests_served: 'counter',
                    scylla_io_queue_delay: 'gauge',
                    scylla_io_queue_queue_length: 'gauge',
                    scylla_io_queue_shares: 'gauge',
                    scylla_io_queue_total_bytes: 'counter',
                    scylla_io_queue_total_operations: 'counter',
                    scylla_lsa_free_space: 'gauge',
                    scylla_lsa_large_objects_total_space_bytes: 'gauge',
                    scylla_lsa_memory_allocated: 'counter',
                    scylla_lsa_memory_compacted: 'counter',
                    scylla_lsa_non_lsa_used_space_bytes: 'gauge',
                    scylla_lsa_occupancy: 'gauge',
                    scylla_lsa_segments_compacted: 'counter',
                    scylla_lsa_segments_migrated: 'counter',
                    scylla_lsa_small_objects_total_space_bytes: 'gauge',
                    scylla_lsa_small_objects_used_space_bytes: 'gauge',
                    scylla_lsa_total_space_bytes: 'gauge',
                    scylla_lsa_used_space_bytes: 'gauge',
                    scylla_memory_allocated_memory: 'counter',
                    scylla_memory_cross_cpu_free_operations: 'counter',
                    scylla_memory_dirty_bytes: 'gauge',
                    scylla_memory_free_memory: 'counter',
                    scylla_memory_free_operations: 'counter',
                    scylla_memory_malloc_live_objects: 'gauge',
                    scylla_memory_malloc_operations: 'counter',
                    scylla_memory_reclaims_operations: 'counter',
                    scylla_memory_regular_dirty_bytes: 'gauge',
                    scylla_memory_regular_virtual_dirty_bytes: 'gauge',
                    scylla_memory_streaming_dirty_bytes: 'gauge',
                    scylla_memory_streaming_virtual_dirty_bytes: 'gauge',
                    scylla_memory_system_dirty_bytes: 'gauge',
                    scylla_memory_system_virtual_dirty_bytes: 'gauge',
                    scylla_memory_total_memory: 'counter',
                    scylla_memory_virtual_dirty_bytes: 'gauge',
                    scylla_memtables_pending_flushes: 'gauge',
                    scylla_memtables_pending_flushes_bytes: 'gauge',
                    scylla_node_operation_mode: 'gauge',
                    scylla_query_processor_queries: 'counter',
                    scylla_query_processor_statements_prepared: 'counter',
                    scylla_reactor_aio_bytes_read: 'counter',
                    scylla_reactor_aio_bytes_write: 'counter',
                    scylla_reactor_aio_errors: 'counter',
                    scylla_reactor_aio_reads: 'counter',
                    scylla_reactor_aio_writes: 'counter',
                    scylla_reactor_cpp_exceptions: 'counter',
                    scylla_reactor_cpu_busy_ms: 'counter',
                    scylla_reactor_cpu_steal_time_ms: 'counter',
                    scylla_reactor_fstream_read_bytes: 'counter',
                    scylla_reactor_fstream_read_bytes_blocked: 'counter',
                    scylla_reactor_fstream_reads: 'counter',
                    scylla_reactor_fstream_reads_ahead_bytes_discarded:
                      'counter',
                    scylla_reactor_fstream_reads_aheads_discarded: 'counter',
                    scylla_reactor_fstream_reads_blocked: 'counter',
                    scylla_reactor_fsyncs: 'counter',
                    scylla_reactor_io_queue_requests: 'gauge',
                    scylla_reactor_io_threaded_fallbacks: 'counter',
                    scylla_reactor_logging_failures: 'counter',
                    scylla_reactor_polls: 'counter',
                    scylla_reactor_tasks_pending: 'gauge',
                    scylla_reactor_tasks_processed: 'counter',
                    scylla_reactor_timers_pending: 'counter',
                    scylla_reactor_utilization: 'gauge',
                    scylla_scheduler_queue_length: 'gauge',
                    scylla_scheduler_runtime_ms: 'counter',
                    scylla_scheduler_shares: 'gauge',
                    scylla_scheduler_tasks_processed: 'counter',
                    scylla_scheduler_time_spent_on_task_quota_violations_ms:
                      'counter',
                    scylla_sstables_capped_local_deletion_time: 'counter',
                    scylla_sstables_capped_tombstone_deletion_time: 'counter',
                    scylla_sstables_cell_tombstone_writes: 'counter',
                    scylla_sstables_cell_writes: 'counter',
                    scylla_sstables_index_page_blocks: 'counter',
                    scylla_sstables_index_page_hits: 'counter',
                    scylla_sstables_index_page_misses: 'counter',
                    scylla_sstables_partition_reads: 'counter',
                    scylla_sstables_partition_seeks: 'counter',
                    scylla_sstables_partition_writes: 'counter',
                    scylla_sstables_range_partition_reads: 'counter',
                    scylla_sstables_range_tombstone_writes: 'counter',
                    scylla_sstables_row_reads: 'counter',
                    scylla_sstables_row_writes: 'counter',
                    scylla_sstables_single_partition_reads: 'counter',
                    scylla_sstables_sstable_partition_reads: 'counter',
                    scylla_sstables_static_row_writes: 'counter',
                    scylla_sstables_tombstone_writes: 'counter',
                    scylla_storage_proxy_coordinator_background_read_repairs:
                      'counter',
                    scylla_storage_proxy_coordinator_background_reads: 'gauge',
                    scylla_storage_proxy_coordinator_background_replica_writes_failed_local_node:
                      'counter',
                    scylla_storage_proxy_coordinator_background_write_bytes:
                      'counter',
                    scylla_storage_proxy_coordinator_background_writes: 'gauge',
                    scylla_storage_proxy_coordinator_background_writes_failed:
                      'counter',
                    scylla_storage_proxy_coordinator_canceled_read_repairs:
                      'counter',
                    scylla_storage_proxy_coordinator_completed_reads_local_node:
                      'counter',
                    scylla_storage_proxy_coordinator_current_throttled_base_writes:
                      'gauge',
                    scylla_storage_proxy_coordinator_current_throttled_writes:
                      'gauge',
                    scylla_storage_proxy_coordinator_foreground_read_repair:
                      'counter',
                    scylla_storage_proxy_coordinator_foreground_reads: 'gauge',
                    scylla_storage_proxy_coordinator_foreground_writes: 'gauge',
                    scylla_storage_proxy_coordinator_last_mv_flow_control_delay:
                      'gauge',
                    scylla_storage_proxy_coordinator_queued_write_bytes:
                      'counter',
                    scylla_storage_proxy_coordinator_range_timeouts: 'counter',
                    scylla_storage_proxy_coordinator_range_unavailable:
                      'counter',
                    scylla_storage_proxy_coordinator_read_errors_local_node:
                      'counter',
                    scylla_storage_proxy_coordinator_read_latency_count:
                      'counter',
                    scylla_storage_proxy_coordinator_read_latency_sum: 'gauge',
                    scylla_storage_proxy_coordinator_read_repair_write_attempts_local_node:
                      'counter',
                    scylla_storage_proxy_coordinator_read_retries: 'counter',
                    scylla_storage_proxy_coordinator_read_timeouts: 'counter',
                    scylla_storage_proxy_coordinator_read_unavailable:
                      'counter',
                    scylla_storage_proxy_coordinator_reads_local_node:
                      'counter',
                    scylla_storage_proxy_coordinator_speculative_data_reads:
                      'counter',
                    scylla_storage_proxy_coordinator_speculative_digest_reads:
                      'counter',
                    scylla_storage_proxy_coordinator_throttled_writes:
                      'counter',
                    scylla_storage_proxy_coordinator_total_write_attempts_local_node:
                      'counter',
                    scylla_storage_proxy_coordinator_write_errors_local_node:
                      'counter',
                    scylla_storage_proxy_coordinator_write_latency_count:
                      'counter',
                    scylla_storage_proxy_coordinator_write_latency_sum: 'gauge',
                    scylla_storage_proxy_coordinator_write_timeouts: 'counter',
                    scylla_storage_proxy_coordinator_write_unavailable:
                      'counter',
                    scylla_storage_proxy_replica_cross_shard_ops: 'counter',
                    scylla_storage_proxy_replica_forwarded_mutations: 'counter',
                    scylla_storage_proxy_replica_forwarding_errors: 'counter',
                    scylla_storage_proxy_replica_reads: 'counter',
                    scylla_storage_proxy_replica_received_counter_updates:
                      'counter',
                    scylla_storage_proxy_replica_received_mutations: 'counter',
                    scylla_streaming_total_incoming_bytes: 'counter',
                    scylla_streaming_total_outgoing_bytes: 'counter',
                    scylla_thrift_current_connections: 'gauge',
                    scylla_thrift_served: 'counter',
                    scylla_thrift_thrift_connections: 'counter',
                    scylla_tracing_active_sessions: 'gauge',
                    scylla_tracing_cached_records: 'gauge',
                    scylla_tracing_dropped_records: 'counter',
                    scylla_tracing_dropped_sessions: 'counter',
                    scylla_tracing_flushing_records: 'gauge',
                    scylla_tracing_keyspace_helper_bad_column_family_errors:
                      'counter',
                    scylla_tracing_keyspace_helper_tracing_errors: 'counter',
                    scylla_tracing_pending_for_write_records: 'gauge',
                    scylla_tracing_trace_errors: 'counter',
                    scylla_tracing_trace_records_count: 'counter',
                    scylla_transport_cql_connections: 'counter',
                    scylla_transport_current_connections: 'gauge',
                    scylla_transport_requests_blocked_memory: 'counter',
                    scylla_transport_requests_blocked_memory_current: 'gauge',
                    scylla_transport_requests_served: 'counter',
                    scylla_transport_requests_serving: 'gauge',
                    node_filesystem_avail_bytes: 'counter',
                    node_filesystem_size_bytes: 'counter',
                  },
                  metric_groups: [
                    'scylla.alien',
                    'scylla.batchlog_manager',
                    'scylla.commitlog',
                    'scylla.cql',
                    'scylla.database',
                    'scylla.execution_stages',
                    'scylla.hints',
                    'scylla.httpd',
                    'scylla.io_queue',
                    'scylla.lsa',
                    'scylla.memory',
                    'scylla.memtables',
                    'scylla.query_processor',
                    'scylla.scheduler',
                    'scylla.sstables',
                    'scylla.thrift',
                    'scylla.tracing',
                  ],
                  timeout: 60,
                },
              ],
            }),
            'openmetrics.yaml': jsonToPrettyYaml.stringify({
              init_config: {},
              cluster_check: true,
              instances: [
                {
                  openmetrics_endpoint:
                    'http://argo-rollouts-metrics.argo-rollouts:8090/metrics',
                  namespace: 'argo',
                  metrics: [
                    'notification_send_error',
                    'rollout_events',
                    'rollout_info',
                    'rollout_info_replicas_available',
                    'rollout_info_replicas_desired',
                    'rollout_info_replicas_unavailable',
                    'rollout_info_replicas_updated',
                    'rollout_phase',
                    'rollout_reconcile',
                    'rollout_reconcile_error',
                  ],
                },
              ],
            }),
          },
          metricsProvider: {
            // Enable DD Cluster Agent to act as a source for "external metrics"
            // for kubernetes horizontal autoscaling.
            enabled: true,
            // Enable usage of DatadogMetric CRD to autoscale on arbitrary Datadog queries
            useDatadogMetrics: true,
          },
          env: [
            // tell the cluster agent about what env its in, so it can tag the
            // data it collects accordingly.
            {
              name: 'DD_ENV',
              value: stage.toLowerCase(),
            },
            //https://github.com/DataDog/datadog-agent/issues/8163
            {
              name: 'DD_EXTERNAL_METRICS_PROVIDER_MAX_AGE',
              value: 300,
            },
          ],
          rbac: {
            serviceAccountAnnotations: {
              'eks.amazonaws.com/role-arn': role.roleArn,
            },
          },
          volumes: [
            {
              name: secretVolumeName,
              csi: {
                driver: 'secrets-store.csi.k8s.io',
                readOnly: true,
                volumeAttributes: {
                  secretProviderClass: datadogSecretsProviderName,
                },
              },
            },
          ],
          volumeMounts: [
            {
              name: secretVolumeName,
              mountPath: secretsMountPath,
            },
          ],
        },
      },
    });
    datadogAgent.node.addDependency(datadogSecretsProvider);
    datadogAgent.node.addDependency(namespace);
  }
}
